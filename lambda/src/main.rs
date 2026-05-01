mod auth;
mod config;
mod dao;
mod inference;
mod service;
mod utils;

use lambda_http::{run, service_fn, Body, Error, Request, RequestExt, Response};
use serde::Deserialize;
use service::CreateSessionRequest;
use tracing_subscriber::EnvFilter;
use utils::http::{error_response, parse_json_body, to_response};

pub struct AppState {
    pub bedrock: aws_sdk_bedrockruntime::Client,
    pub s3: aws_sdk_s3::Client,
    pub bucket: String,
}

#[derive(Deserialize)]
struct ChatRequest {
    session_id: String,
    question: String,
}

pub async fn handler(state: &AppState, event: Request) -> Result<Response<Body>, Error> {
    let method = event.method().clone();
    let raw = event.raw_http_path();
    let path: &str = if raw.is_empty() {
        event.uri().path()
    } else {
        &raw
    };

    match (method.as_str(), path) {
        ("POST", "/sessions") => handle_create_session(state, &event).await,
        ("GET", "/sessions") => handle_list_sessions(state).await,
        ("POST", "/chat") => handle_chat(state, &event).await,
        _ if path.starts_with("/sessions/") => {
            let id = path.trim_start_matches("/sessions/");
            // Check for /sessions/{id}/stream-token
            if let Some(session_id) = id.strip_suffix("/stream-token") {
                match method.as_str() {
                    "POST" => return handle_stream_token(state, &event, session_id).await,
                    _ => return Ok(error_response(404, "Not found")),
                }
            }
            match method.as_str() {
                "GET" => handle_get_session(state, id).await,
                "DELETE" => handle_delete_session(state, id).await,
                "PATCH" => handle_update_session(state, &event, id).await,
                _ => Ok(error_response(404, "Not found")),
            }
        }
        _ => Ok(error_response(404, "Not found")),
    }
}

async fn handle_create_session(state: &AppState, event: &Request) -> Result<Response<Body>, Error> {
    let req: CreateSessionRequest = match parse_json_body(event) {
        Ok(r) => r,
        Err(resp) => return Ok(resp),
    };

    let result = service::create_session(&state.s3, &state.bucket, req).await;
    let json = result
        .as_ref()
        .ok()
        .and_then(|r| serde_json::to_string(r).ok());
    Ok(to_response(
        result,
        201,
        json.as_deref(),
        "Failed to create session",
    ))
}

async fn handle_list_sessions(state: &AppState) -> Result<Response<Body>, Error> {
    let result = service::list_sessions(&state.s3, &state.bucket).await;
    let json = result
        .as_ref()
        .ok()
        .and_then(|r| serde_json::to_string(r).ok());
    Ok(to_response(
        result,
        200,
        json.as_deref(),
        "Failed to list sessions",
    ))
}

async fn handle_get_session(state: &AppState, id: &str) -> Result<Response<Body>, Error> {
    let result = service::get_session(&state.s3, &state.bucket, id).await;
    match &result {
        Ok(None) => return Ok(error_response(404, "Session not found")),
        _ => {}
    }
    let json = result
        .as_ref()
        .ok()
        .and_then(|r| r.as_ref())
        .and_then(|r| serde_json::to_string(r).ok());
    Ok(to_response(
        result,
        200,
        json.as_deref(),
        "Failed to get session",
    ))
}

async fn handle_delete_session(state: &AppState, id: &str) -> Result<Response<Body>, Error> {
    Ok(to_response(
        service::delete_session(&state.s3, &state.bucket, id).await,
        204,
        None,
        "Failed to delete session",
    ))
}

async fn handle_update_session(
    state: &AppState,
    event: &Request,
    id: &str,
) -> Result<Response<Body>, Error> {
    let req: service::UpdateSessionRequest = match parse_json_body(event) {
        Ok(r) => r,
        Err(resp) => return Ok(resp),
    };

    let result = service::update_session(&state.s3, &state.bucket, id, req).await;
    let json = result
        .as_ref()
        .ok()
        .and_then(|r| serde_json::to_string(r).ok());
    Ok(to_response(
        result,
        200,
        json.as_deref(),
        "Failed to update session",
    ))
}

async fn handle_chat(state: &AppState, event: &Request) -> Result<Response<Body>, Error> {
    // Stream token is mandatory — validates session scoping and rejects
    // unauthorized requests before any S3/Bedrock call (sub-millisecond AES decrypt).
    let stream_token = match event
        .headers()
        .get("x-stream-token")
        .and_then(|v| v.to_str().ok())
    {
        Some(t) => t,
        None => return Ok(error_response(401, "Missing x-stream-token header")),
    };

    let token_payload = match auth::validate_stream_token(stream_token) {
        Ok(p) => p,
        Err(e) => {
            tracing::error!("Stream token validation failed: {:?}", e);
            return Ok(error_response(401, "Invalid or expired stream token"));
        }
    };

    let req: ChatRequest = match parse_json_body(event) {
        Ok(r) => r,
        Err(resp) => return Ok(resp),
    };

    if token_payload.session_id != req.session_id {
        return Ok(error_response(
            401,
            "Stream token not valid for this session",
        ));
    }

    let result = service::chat(
        &state.s3,
        &state.bedrock,
        &state.bucket,
        &req.session_id,
        &req.question,
    )
    .await;
    let json = result
        .as_ref()
        .ok()
        .and_then(|r| serde_json::to_string(r).ok());
    Ok(to_response(result, 200, json.as_deref(), "Chat failed"))
}

async fn handle_stream_token(
    state: &AppState,
    event: &Request,
    session_id: &str,
) -> Result<Response<Body>, Error> {
    let user_id = auth::extract_user_id(event);

    // Verify session exists
    match service::get_session(&state.s3, &state.bucket, session_id).await {
        Ok(Some(_)) => {}
        Ok(None) => return Ok(error_response(404, "Session not found")),
        Err(e) => {
            tracing::error!("Get session error: {:?}", e);
            return Ok(error_response(500, "Failed to load session"));
        }
    }

    let stream_token = auth::generate_stream_token(&user_id, session_id);
    let json = serde_json::to_string(&stream_token).unwrap();
    Ok(utils::http::json_response(200, &json))
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .json()
        .init();

    let config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;
    let bucket = std::env::var("SESSIONS_BUCKET").expect("SESSIONS_BUCKET must be set");

    let state = AppState {
        bedrock: aws_sdk_bedrockruntime::Client::new(&config),
        s3: aws_sdk_s3::Client::new(&config),
        bucket,
    };

    run(service_fn(|event: Request| async {
        handler(&state, event).await
    }))
    .await
}

#[cfg(test)]
mod tests;
