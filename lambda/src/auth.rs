use aes_gcm::{aead::Aead, aead::KeyInit, AeadCore, Aes256Gcm, Nonce};
use anyhow::{Context, Result};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use chrono::{Duration, Utc};
use rand::rngs::OsRng;
use serde::Serialize;
use sha2::{Digest, Sha256};

const STREAM_TOKEN_VALIDITY_MINUTES: i64 = 15;

#[derive(Serialize)]
pub struct StreamTokenResponse {
    pub token: String,
    pub expires_at: chrono::DateTime<Utc>,
}

pub struct StreamTokenPayload {
    pub session_id: String,
}

/// Generate an encrypted stream token.
/// Payload (user_id:session_id:expiry) is encrypted with AES-256-GCM.
/// The result is an opaque base64 string — no information leaks.
pub fn generate_stream_token(user_id: &str, session_id: &str) -> StreamTokenResponse {
    let expires_at = Utc::now() + Duration::minutes(STREAM_TOKEN_VALIDITY_MINUTES);
    let payload = format!("{}:{}:{}", user_id, session_id, expires_at.timestamp());

    let key = derive_key();
    let cipher = Aes256Gcm::new(&key.into());
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    let ciphertext = cipher
        .encrypt(&nonce, payload.as_bytes())
        .expect("encryption failed");

    let mut combined = nonce.to_vec();
    combined.extend_from_slice(&ciphertext);

    StreamTokenResponse {
        token: URL_SAFE_NO_PAD.encode(&combined),
        expires_at,
    }
}

/// Decrypt and validate a stream token.
/// Returns the payload if valid, or an error if expired/tampered/invalid.
pub fn validate_stream_token(token: &str) -> Result<StreamTokenPayload> {
    let combined = URL_SAFE_NO_PAD
        .decode(token)
        .context("Invalid base64 in stream token")?;

    if combined.len() < 12 {
        anyhow::bail!("Stream token too short");
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let key = derive_key();
    let cipher = Aes256Gcm::new(&key.into());

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| anyhow::anyhow!("Stream token decryption failed — tampered or wrong key"))?;

    let payload = String::from_utf8(plaintext).context("Invalid UTF-8 in stream token")?;
    let parts: Vec<&str> = payload.splitn(3, ':').collect();
    if parts.len() != 3 {
        anyhow::bail!("Malformed stream token payload");
    }

    let expiry: i64 = parts[2].parse().context("Invalid expiry in stream token")?;
    let expires_at =
        chrono::DateTime::from_timestamp(expiry, 0).context("Invalid timestamp in stream token")?;

    if Utc::now() > expires_at {
        anyhow::bail!("Stream token expired");
    }

    Ok(StreamTokenPayload {
        session_id: parts[1].to_string(),
    })
}

fn derive_key() -> [u8; 32] {
    let secret = std::env::var("STREAM_TOKEN_SECRET")
        .unwrap_or_else(|_| "doc-chatter-default-secret".to_string());
    let mut hasher = Sha256::new();
    hasher.update(secret.as_bytes());
    hasher.finalize().into()
}

/// Extract the Cognito user ID (sub) from API Gateway request context.
pub fn extract_user_id(event: &lambda_http::Request) -> String {
    use lambda_http::RequestExt;
    event
        .request_context_ref()
        .and_then(|ctx| {
            if let lambda_http::request::RequestContext::ApiGatewayV1(apigw) = ctx {
                apigw
                    .authorizer
                    .fields
                    .get("claims")
                    .and_then(|c| c.as_object())
                    .and_then(|c| c.get("sub"))
                    .and_then(|s| s.as_str())
                    .map(|s: &str| s.to_string())
            } else {
                None
            }
        })
        .unwrap_or_else(|| "unknown".to_string())
}
