use aws_sdk_bedrockruntime::operation::converse::ConverseOutput;
use aws_sdk_bedrockruntime::types::{
    ContentBlock, ConversationRole, ConverseOutput as ConverseOutputType, Message, StopReason,
};
use aws_sdk_s3::operation::delete_object::DeleteObjectOutput;
use aws_sdk_s3::operation::get_object::GetObjectOutput;
use aws_sdk_s3::operation::list_objects_v2::ListObjectsV2Output;
use aws_sdk_s3::operation::put_object::PutObjectOutput;
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::types::Object;
use aws_smithy_mocks::{mock, mock_client, RuleMode};
use lambda_http::{Body, Request};

use crate::auth;
use crate::{handler, AppState};

// --- Helpers ---

fn build_request(
    method: &str,
    path: &str,
    body: Option<&str>,
    headers: Vec<(&str, &str)>,
) -> Request {
    let mut builder = lambda_http::http::Request::builder()
        .method(method)
        .uri(format!("https://example.com{}", path))
        .header("Content-Type", "application/json");

    for (k, v) in &headers {
        builder = builder.header(*k, *v);
    }

    let body = match body {
        Some(b) => Body::Text(b.to_string()),
        None => Body::Empty,
    };

    builder.body(body).unwrap()
}

fn response_status(resp: &lambda_http::Response<Body>) -> u16 {
    resp.status().as_u16()
}

fn response_body(resp: &lambda_http::Response<Body>) -> String {
    match resp.body() {
        Body::Text(s) => s.clone(),
        _ => String::new(),
    }
}

fn make_session_json(session_id: &str, token: &str) -> String {
    format!(
        r#"{{"session_id":"{}","title":"Test","paper_text":"test paper","history":[],"model":"sonnet","system_prompt":"prompt","subject_expertise":"medium","research_expertise":"medium","token":"{}","token_expiry":"2099-01-01T00:00:00Z","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z"}}"#,
        session_id, token
    )
}

fn mock_put_object() -> aws_smithy_mocks::Rule {
    mock!(aws_sdk_s3::Client::put_object).then_output(|| PutObjectOutput::builder().build())
}

fn mock_get_object(body: &str) -> aws_smithy_mocks::Rule {
    let body = body.to_string();
    mock!(aws_sdk_s3::Client::get_object).then_output(move || {
        GetObjectOutput::builder()
            .body(ByteStream::from(body.clone().into_bytes()))
            .build()
    })
}

fn mock_get_object_not_found() -> aws_smithy_mocks::Rule {
    mock!(aws_sdk_s3::Client::get_object).then_error(|| {
        aws_sdk_s3::operation::get_object::GetObjectError::NoSuchKey(
            aws_sdk_s3::types::error::NoSuchKey::builder().build(),
        )
    })
}

fn mock_list_objects(keys: Vec<&str>) -> aws_smithy_mocks::Rule {
    let keys: Vec<String> = keys.into_iter().map(|k| k.to_string()).collect();
    mock!(aws_sdk_s3::Client::list_objects_v2).then_output(move || {
        let objects: Vec<Object> = keys
            .iter()
            .map(|k| Object::builder().key(k.clone()).build())
            .collect();
        ListObjectsV2Output::builder()
            .set_contents(Some(objects))
            .build()
    })
}

fn mock_list_objects_empty() -> aws_smithy_mocks::Rule {
    mock!(aws_sdk_s3::Client::list_objects_v2)
        .then_output(|| ListObjectsV2Output::builder().build())
}

fn mock_delete_object() -> aws_smithy_mocks::Rule {
    mock!(aws_sdk_s3::Client::delete_object).then_output(|| DeleteObjectOutput::builder().build())
}

fn mock_converse(answer: &str) -> aws_smithy_mocks::Rule {
    let answer = answer.to_string();
    mock!(aws_sdk_bedrockruntime::Client::converse).then_output(move || {
        ConverseOutput::builder()
            .output(ConverseOutputType::Message(
                Message::builder()
                    .role(ConversationRole::Assistant)
                    .content(ContentBlock::Text(answer.clone()))
                    .build()
                    .unwrap(),
            ))
            .stop_reason(StopReason::EndTurn)
            .build()
            .unwrap()
    })
}

fn mock_s3_error_500() -> aws_smithy_mocks::Rule {
    mock!(aws_sdk_s3::Client::put_object).then_http_response(|| {
        aws_smithy_runtime_api::http::Response::new(
            aws_smithy_runtime_api::http::StatusCode::try_from(500).unwrap(),
            aws_smithy_types::body::SdkBody::from("error"),
        )
    })
}

fn mock_converse_error() -> aws_smithy_mocks::Rule {
    mock!(aws_sdk_bedrockruntime::Client::converse).then_http_response(|| {
        aws_smithy_runtime_api::http::Response::new(
            aws_smithy_runtime_api::http::StatusCode::try_from(500).unwrap(),
            aws_smithy_types::body::SdkBody::from("error"),
        )
    })
}

fn make_state(
    s3_rules: Vec<&aws_smithy_mocks::Rule>,
    bedrock_rules: Vec<&aws_smithy_mocks::Rule>,
) -> AppState {
    {
        let s3 = mock_client!(aws_sdk_s3, RuleMode::MatchAny, s3_rules);
        let bedrock = if bedrock_rules.is_empty() {
            let noop = mock_converse("unused");
            mock_client!(aws_sdk_bedrockruntime, [&noop])
        } else {
            mock_client!(aws_sdk_bedrockruntime, RuleMode::MatchAny, bedrock_rules)
        };
        AppState {
            s3,
            bedrock,
            bucket: "test-bucket".to_string(),
        }
    }
}

fn stream_token_for(session_id: &str) -> String {
    std::env::set_var("STREAM_TOKEN_SECRET", "test-secret");
    auth::generate_stream_token("test-user", session_id).token
}

// --- Happy path: Sessions ---

#[tokio::test]
async fn given_valid_paper_when_create_session_then_returns_201() {
    let put = mock_put_object();
    let state = make_state(vec![&put], vec![]);

    let req = build_request(
        "POST",
        "/sessions",
        Some(r#"{"paper_text":"test paper","title":"Test"}"#),
        vec![],
    );

    let resp = handler(&state, req).await.unwrap();
    assert_eq!(response_status(&resp), 201);

    let body: serde_json::Value = serde_json::from_str(&response_body(&resp)).unwrap();
    assert!(body["session_id"].is_string());
    assert_eq!(put.num_calls(), 1);
}

#[tokio::test]
async fn given_no_sessions_when_list_then_returns_empty_array() {
    let list = mock_list_objects_empty();
    let state = make_state(vec![&list], vec![]);

    let req = build_request("GET", "/sessions", None, vec![]);
    let resp = handler(&state, req).await.unwrap();

    assert_eq!(response_status(&resp), 200);
    assert_eq!(response_body(&resp), "[]");
}

#[tokio::test]
async fn given_session_exists_when_list_then_returns_session() {
    let session_json = make_session_json("sess-1", "tok-1");
    let list = mock_list_objects(vec!["sessions/sess-1.json"]);
    let get = mock_get_object(&session_json);
    let state = make_state(vec![&list, &get], vec![]);

    let req = build_request("GET", "/sessions", None, vec![]);
    let resp = handler(&state, req).await.unwrap();

    assert_eq!(response_status(&resp), 200);
    let body: Vec<serde_json::Value> = serde_json::from_str(&response_body(&resp)).unwrap();
    assert_eq!(body.len(), 1);
    assert_eq!(body[0]["title"], "Test");
}

#[tokio::test]
async fn given_session_exists_when_get_then_returns_full_session() {
    let session_json = make_session_json("sess-1", "tok-1");
    let get = mock_get_object(&session_json);
    let state = make_state(vec![&get], vec![]);

    let req = build_request("GET", "/sessions/sess-1", None, vec![]);
    let resp = handler(&state, req).await.unwrap();

    assert_eq!(response_status(&resp), 200);
    let body: serde_json::Value = serde_json::from_str(&response_body(&resp)).unwrap();
    assert_eq!(body["title"], "Test");
    assert_eq!(body["paper_text"], "test paper");
}

#[tokio::test]
async fn given_no_session_when_get_then_returns_404() {
    let get = mock_get_object_not_found();
    let state = make_state(vec![&get], vec![]);

    let req = build_request("GET", "/sessions/nonexistent", None, vec![]);
    let resp = handler(&state, req).await.unwrap();

    assert_eq!(response_status(&resp), 404);
}

#[tokio::test]
async fn given_session_exists_when_delete_then_returns_204() {
    let del = mock_delete_object();
    let state = make_state(vec![&del], vec![]);

    let req = build_request("DELETE", "/sessions/sess-1", None, vec![]);
    let resp = handler(&state, req).await.unwrap();

    assert_eq!(response_status(&resp), 204);
    assert_eq!(del.num_calls(), 1);
}

// --- Happy path: Chat ---

#[tokio::test]
async fn given_valid_session_when_chat_then_returns_answer() {
    let session_json = r#"{"session_id":"sess-1","title":"Test","paper_text":"test paper","history":[{"role":"user","content":"What is this about?"},{"role":"assistant","content":"It is about dropout."}],"model":"sonnet","system_prompt":"prompt","subject_expertise":"medium","research_expertise":"medium","token":"","token_expiry":"2026-01-01T00:00:00Z","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z"}"#;
    let get = mock_get_object(session_json);
    let put = mock_put_object();
    let converse = mock_converse("The dropout rate was 0.5");
    let state = make_state(vec![&get, &put], vec![&converse]);
    let token = stream_token_for("sess-1");

    let req = build_request(
        "POST",
        "/chat",
        Some(r#"{"session_id":"sess-1","question":"What was the dropout rate?"}"#),
        vec![("x-stream-token", &token)],
    );
    let resp = handler(&state, req).await.unwrap();

    assert_eq!(response_status(&resp), 200);
    let body: serde_json::Value = serde_json::from_str(&response_body(&resp)).unwrap();
    assert_eq!(body["answer"], "The dropout rate was 0.5");
    assert_eq!(converse.num_calls(), 1);
    assert_eq!(put.num_calls(), 1);
}

// --- 4xx errors ---

#[tokio::test]
async fn given_nonexistent_session_when_chat_then_returns_error() {
    let get = mock_get_object_not_found();
    let state = make_state(vec![&get], vec![]);
    let token = stream_token_for("nope");

    let req = build_request(
        "POST",
        "/chat",
        Some(r#"{"session_id":"nope","question":"Q"}"#),
        vec![("x-stream-token", &token)],
    );
    let resp = handler(&state, req).await.unwrap();

    assert_eq!(response_status(&resp), 500);
}

#[tokio::test]
async fn given_invalid_json_when_create_session_then_returns_400() {
    let state = make_state(vec![], vec![]);
    let req = build_request("POST", "/sessions", Some("not json"), vec![]);

    let resp = handler(&state, req).await.unwrap();
    assert_eq!(response_status(&resp), 400);
}

#[tokio::test]
async fn given_empty_body_when_create_session_then_returns_400() {
    let state = make_state(vec![], vec![]);
    let req = build_request("POST", "/sessions", None, vec![]);

    let resp = handler(&state, req).await.unwrap();
    assert_eq!(response_status(&resp), 400);
}

#[tokio::test]
async fn given_no_body_when_chat_then_returns_401_missing_token() {
    let state = make_state(vec![], vec![]);
    let req = build_request("POST", "/chat", Some("not json"), vec![]);

    let resp = handler(&state, req).await.unwrap();
    assert_eq!(response_status(&resp), 401);
}

#[tokio::test]
async fn given_unknown_path_when_request_then_returns_404() {
    let state = make_state(vec![], vec![]);
    let req = build_request("GET", "/unknown", None, vec![]);

    let resp = handler(&state, req).await.unwrap();
    assert_eq!(response_status(&resp), 404);
}

// --- 5xx errors: downstream failures ---

#[tokio::test]
async fn given_s3_put_fails_when_create_session_then_returns_500() {
    let put = mock_s3_error_500();
    let state = make_state(vec![&put], vec![]);

    let req = build_request(
        "POST",
        "/sessions",
        Some(r#"{"paper_text":"paper","title":"Test"}"#),
        vec![],
    );
    let resp = handler(&state, req).await.unwrap();

    assert_eq!(response_status(&resp), 500);
}

#[tokio::test]
async fn given_s3_list_fails_when_list_sessions_then_returns_500() {
    let list = mock!(aws_sdk_s3::Client::list_objects_v2).then_http_response(|| {
        aws_smithy_runtime_api::http::Response::new(
            aws_smithy_runtime_api::http::StatusCode::try_from(500).unwrap(),
            aws_smithy_types::body::SdkBody::from("error"),
        )
    });
    let state = make_state(vec![&list], vec![]);

    let req = build_request("GET", "/sessions", None, vec![]);
    let resp = handler(&state, req).await.unwrap();

    assert_eq!(response_status(&resp), 500);
}

#[tokio::test]
async fn given_s3_get_fails_when_get_session_then_returns_500() {
    let get = mock!(aws_sdk_s3::Client::get_object).then_http_response(|| {
        aws_smithy_runtime_api::http::Response::new(
            aws_smithy_runtime_api::http::StatusCode::try_from(500).unwrap(),
            aws_smithy_types::body::SdkBody::from("error"),
        )
    });
    let state = make_state(vec![&get], vec![]);

    let req = build_request("GET", "/sessions/some-id", None, vec![]);
    let resp = handler(&state, req).await.unwrap();

    assert_eq!(response_status(&resp), 500);
}

#[tokio::test]
async fn given_s3_delete_fails_when_delete_session_then_returns_500() {
    let del = mock!(aws_sdk_s3::Client::delete_object).then_http_response(|| {
        aws_smithy_runtime_api::http::Response::new(
            aws_smithy_runtime_api::http::StatusCode::try_from(500).unwrap(),
            aws_smithy_types::body::SdkBody::from("error"),
        )
    });
    let state = make_state(vec![&del], vec![]);

    let req = build_request("DELETE", "/sessions/some-id", None, vec![]);
    let resp = handler(&state, req).await.unwrap();

    assert_eq!(response_status(&resp), 500);
}

#[tokio::test]
async fn given_bedrock_fails_when_chat_then_returns_500() {
    let session_json = make_session_json("sess-1", "");
    let get = mock_get_object(&session_json);
    let converse = mock_converse_error();
    let state = make_state(vec![&get], vec![&converse]);
    let token = stream_token_for("sess-1");

    let req = build_request(
        "POST",
        "/chat",
        Some(r#"{"session_id":"sess-1","question":"Q"}"#),
        vec![("x-stream-token", &token)],
    );
    let resp = handler(&state, req).await.unwrap();

    assert_eq!(response_status(&resp), 500);
}
