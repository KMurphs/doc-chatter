use anyhow::{Context, Result};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use tokio::sync::OnceCell;

#[derive(Deserialize)]
struct Jwk {
    kid: String,
    n: String,
    e: String,
}

#[derive(Deserialize)]
struct JwkSet {
    keys: Vec<Jwk>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct Claims {
    pub sub: String,
    pub email: Option<String>,
    pub token_use: Option<String>,
}

static JWKS_CACHE: OnceCell<JwkSet> = OnceCell::const_new();

async fn fetch_jwks(region: &str, user_pool_id: &str) -> Result<JwkSet> {
    let url = format!(
        "https://cognito-idp.{}.amazonaws.com/{}/.well-known/jwks.json",
        region, user_pool_id
    );
    let jwks: JwkSet = reqwest::get(&url)
        .await
        .context("Failed to fetch JWKS")?
        .json()
        .await
        .context("Failed to parse JWKS")?;
    Ok(jwks)
}

pub async fn validate_jwt(token: &str) -> Result<Claims> {
    let region = std::env::var("COGNITO_REGION").unwrap_or_else(|_| "us-east-1".to_string());
    let user_pool_id =
        std::env::var("COGNITO_USER_POOL_ID").context("COGNITO_USER_POOL_ID not set")?;
    let client_id = std::env::var("COGNITO_CLIENT_ID").context("COGNITO_CLIENT_ID not set")?;

    let jwks = JWKS_CACHE
        .get_or_try_init(|| fetch_jwks(&region, &user_pool_id))
        .await?;

    let header = decode_header(token).context("Invalid JWT header")?;
    let kid = header.kid.context("JWT missing kid")?;

    let jwk = jwks
        .keys
        .iter()
        .find(|k| k.kid == kid)
        .context("No matching key in JWKS")?;

    let key =
        DecodingKey::from_rsa_components(&jwk.n, &jwk.e).context("Invalid RSA key components")?;

    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_audience(&[&client_id]);
    validation.set_issuer(&[format!(
        "https://cognito-idp.{}.amazonaws.com/{}",
        region, user_pool_id
    )]);

    let token_data = decode::<Claims>(token, &key, &validation).context("JWT validation failed")?;

    Ok(token_data.claims)
}
