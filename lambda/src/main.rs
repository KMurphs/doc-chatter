mod bedrock;
mod session;

use bedrock::{invoke_bedrock, ChatResponse, Turn};
use lambda_http::{run, service_fn, Body, Error, Request, RequestExt, Response};
use session::{
    create_session, delete_session, get_session, list_sessions, put_session,
    validate_token, CreateSessionRequest,
};
use serde::Deserialize;
use tracing_subscriber::EnvFilter;

struct AppState {
    bedrock: aws_sdk_bedrockruntime::Client,
    s3: aws_sdk_s3::Client,
}

#[derive(Deserialize)]
struct ChatRequest {
    session_id: String,
    question: String,
}

fn json_response(status: u16, body: &str) -> Response<Body> {
    Response::builder()
        .status(status)
        .header("Content-Type", "application/json")
        .body(Body::Text(body.to_string()))
        .unwrap()
}

fn error_response(status: u16, msg: &str) -> Response<Body> {
    json_response(status, &format!("{{\"error\":\"{}\"}}", msg))
}

fn parse_body(event: &Request) -> Option<String> {
    match event.body() {
        Body::Text(s) if !s.is_empty() => Some(s.clone()),
        Body::Binary(b) if !b.is_empty() => Some(String::from_utf8_lossy(b).to_string()),
        _ => None,
    }
}

async fn handler(state: &AppState, event: Request) -> Result<Response<Body>, Error> {
    let method = event.method().clone();
    let path = event.raw_http_path();

    match (method.as_str(), &*path) {
        // Session CRUD
        ("POST", "/sessions") => handle_create_session(state, &event).await,
        ("GET", "/sessions") => handle_list_sessions(state).await,
        ("GET", p) if p.starts_with("/sessions/") => {
            let id = p.trim_start_matches("/sessions/");
            handle_get_session(state, id).await
        }
        ("DELETE", p) if p.starts_with("/sessions/") => {
            let id = p.trim_start_matches("/sessions/");
            handle_delete_session(state, id).await
        }
        // Chat (streaming endpoint)
        ("POST", "/chat") => handle_chat(state, &event).await,
        _ => Ok(error_response(404, "Not found")),
    }
}

async fn handle_create_session(
    state: &AppState,
    event: &Request,
) -> Result<Response<Body>, Error> {
    let body = match parse_body(event) {
        Some(b) => b,
        None => return Ok(error_response(400, "Request body is missing or empty")),
    };

    let req: CreateSessionRequest = match serde_json::from_str(&body) {
        Ok(r) => r,
        Err(e) => return Ok(error_response(400, &format!("Invalid JSON: {}", e))),
    };

    match create_session(&state.s3, req).await {
        Ok(resp) => Ok(json_response(201, &serde_json::to_string(&resp)?)),
        Err(e) => {
            tracing::error!("Create session error: {:#}", e);
            Ok(error_response(500, &format!("Failed to create session: {}", e)))
        }
    }
}

async fn handle_list_sessions(state: &AppState) -> Result<Response<Body>, Error> {
    match list_sessions(&state.s3).await {
        Ok(sessions) => Ok(json_response(200, &serde_json::to_string(&sessions)?)),
        Err(e) => {
            tracing::error!("List sessions error: {:?}", e);
            Ok(error_response(500, "Failed to list sessions"))
        }
    }
}

async fn handle_get_session(state: &AppState, id: &str) -> Result<Response<Body>, Error> {
    match get_session(&state.s3, id).await {
        Ok(Some(session)) => Ok(json_response(200, &serde_json::to_string(&session)?)),
        Ok(None) => Ok(error_response(404, "Session not found")),
        Err(e) => {
            tracing::error!("Get session error: {:?}", e);
            Ok(error_response(500, "Failed to get session"))
        }
    }
}

async fn handle_delete_session(state: &AppState, id: &str) -> Result<Response<Body>, Error> {
    match delete_session(&state.s3, id).await {
        Ok(_) => Ok(Response::builder().status(204).body(Body::Empty).unwrap()),
        Err(e) => {
            tracing::error!("Delete session error: {:?}", e);
            Ok(error_response(500, "Failed to delete session"))
        }
    }
}

async fn handle_chat(state: &AppState, event: &Request) -> Result<Response<Body>, Error> {
    let body = match parse_body(event) {
        Some(b) => b,
        None => return Ok(error_response(400, "Request body is missing or empty")),
    };

    let req: ChatRequest = match serde_json::from_str(&body) {
        Ok(r) => r,
        Err(e) => return Ok(error_response(400, &format!("Invalid JSON: {}", e))),
    };

    // Load session
    let mut session = match get_session(&state.s3, &req.session_id).await {
        Ok(Some(s)) => s,
        Ok(None) => return Ok(error_response(404, "Session not found")),
        Err(e) => {
            tracing::error!("Load session error: {:?}", e);
            return Ok(error_response(500, "Failed to load session"));
        }
    };

    // Validate token
    let token = event
        .headers()
        .get("x-session-token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if !validate_token(&session, token) {
        return Ok(error_response(401, "Invalid or expired session token"));
    }

    // Call Bedrock
    let answer = match invoke_bedrock(
        &state.bedrock,
        &session.model,
        &session.system_prompt,
        &session.paper_text,
        &session.history,
        &req.question,
    )
    .await
    {
        Ok(a) => a,
        Err(e) => {
            tracing::error!("Bedrock error: {:?}", e);
            return Ok(error_response(500, &format!("Bedrock error: {}", e)));
        }
    };

    // Append turn and save
    session.history.push(Turn {
        role: "user".to_string(),
        content: req.question,
    });
    session.history.push(Turn {
        role: "assistant".to_string(),
        content: answer.clone(),
    });
    session.updated_at = chrono::Utc::now();

    if let Err(e) = put_session(&state.s3, &session).await {
        tracing::error!("Save session error: {:?}", e);
    }

    let response = ChatResponse { answer };
    Ok(json_response(200, &serde_json::to_string(&response)?))
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .json()
        .init();

    let config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;
    let state = AppState {
        bedrock: aws_sdk_bedrockruntime::Client::new(&config),
        s3: aws_sdk_s3::Client::new(&config),
    };

    run(service_fn(|event: Request| async {
        handler(&state, event).await
    }))
    .await
}
