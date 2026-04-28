mod bedrock;

use bedrock::{invoke_bedrock, ChatRequest, ChatResponse};
use lambda_http::{run, service_fn, Body, Error, Request, Response};
use tracing_subscriber::EnvFilter;

async fn handler(
    client: &aws_sdk_bedrockruntime::Client,
    event: Request,
) -> Result<Response<Body>, Error> {
    let body_str = match event.body() {
        Body::Text(s) if !s.is_empty() => s.clone(),
        Body::Binary(b) if !b.is_empty() => String::from_utf8_lossy(b).to_string(),
        _ => {
            return Ok(Response::builder()
                .status(400)
                .body(Body::Text("Request body is missing or empty".to_string()))
                .unwrap())
        }
    };

    let request: ChatRequest = match serde_json::from_str(&body_str) {
        Ok(r) => r,
        Err(e) => {
            return Ok(Response::builder()
                .status(400)
                .body(Body::Text(format!("Request body is not valid JSON: {}", e)))
                .unwrap())
        }
    };

    match invoke_bedrock(client, &request).await {
        Ok(answer) => {
            let response = ChatResponse { answer };
            Ok(Response::builder()
                .status(200)
                .header("Content-Type", "application/json")
                .body(Body::Text(serde_json::to_string(&response)?))
                .unwrap())
        }
        Err(e) => {
            tracing::error!("Bedrock error: {:?}", e);
            Ok(Response::builder()
                .status(500)
                .body(Body::Text(format!("Bedrock error: {}", e)))
                .unwrap())
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .json()
        .init();

    let config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;
    let client = aws_sdk_bedrockruntime::Client::new(&config);

    run(service_fn(|event: Request| async {
        handler(&client, event).await
    }))
    .await
}
