use lambda_http::{Body, Request, Response};

pub fn json_response(status: u16, body: &str) -> Response<Body> {
    Response::builder()
        .status(status)
        .header("Content-Type", "application/json")
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Amz-Date,X-Amz-Security-Token,X-Amz-Content-Sha256")
        .body(Body::Text(body.to_string()))
        .unwrap()
}

pub fn error_response(status: u16, msg: &str) -> Response<Body> {
    json_response(status, &format!("{{\"error\":\"{}\"}}", msg))
}

pub fn to_response<T, E: std::fmt::Debug>(
    result: Result<T, E>,
    ok_status: u16,
    body: Option<&str>,
    error_msg: &str,
) -> Response<Body> {
    match result {
        Ok(_) => match body {
            Some(json) => json_response(ok_status, json),
            None => Response::builder()
                .status(ok_status)
                .header("Access-Control-Allow-Origin", "*")
                .body(Body::Empty)
                .unwrap(),
        },
        Err(e) => {
            tracing::error!("{}: {:?}", error_msg, e);
            error_response(500, error_msg)
        }
    }
}

fn parse_body(event: &Request) -> Option<String> {
    match event.body() {
        Body::Text(s) if !s.is_empty() => Some(s.clone()),
        Body::Binary(b) if !b.is_empty() => Some(String::from_utf8_lossy(b).to_string()),
        _ => None,
    }
}

pub fn parse_json_body<T: serde::de::DeserializeOwned>(
    event: &Request,
) -> Result<T, Response<Body>> {
    let body =
        parse_body(event).ok_or_else(|| error_response(400, "Request body is missing or empty"))?;
    serde_json::from_str(&body).map_err(|e| error_response(400, &format!("Invalid JSON: {}", e)))
}
