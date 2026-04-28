use anyhow::{Context, Result};
use aws_sdk_s3::Client as S3Client;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::bedrock::Turn;

#[derive(Serialize, Deserialize, Clone)]
pub struct Session {
    pub session_id: String,
    pub title: String,
    pub paper_text: String,
    pub history: Vec<Turn>,
    pub model: String,
    pub system_prompt: String,
    pub subject_expertise: String,
    pub research_expertise: String,
    pub token: String,
    pub token_expiry: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateSessionRequest {
    pub paper_text: String,
    pub title: Option<String>,
    #[serde(default = "default_model")]
    pub model: String,
    pub system_prompt: Option<String>,
    #[serde(default = "default_expertise")]
    pub subject_expertise: String,
    #[serde(default = "default_expertise")]
    pub research_expertise: String,
}

#[derive(Serialize)]
pub struct CreateSessionResponse {
    pub session_id: String,
    pub token: String,
    pub token_expiry: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct SessionSummary {
    pub session_id: String,
    pub title: String,
    pub model: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

fn default_model() -> String {
    std::env::var("DEFAULT_MODEL").unwrap_or_else(|_| "sonnet".to_string())
}

fn default_expertise() -> String {
    "medium".to_string()
}

fn default_system_prompt() -> String {
    "You are a research paper assistant helping someone who is driving or walking. \
     They cannot read — they are listening to your responses. \
     Keep responses concise: short sentences, clear transitions, no bullet points or lists. \
     Speak naturally as if explaining to a colleague.\n\n\
     When making claims, reference which part of the paper you are drawing from.\n\
     If the answer is not in the paper, say so rather than guessing."
        .to_string()
}

fn s3_key(session_id: &str) -> String {
    format!("sessions/{}.json", session_id)
}

fn bucket_name() -> String {
    std::env::var("SESSIONS_BUCKET").expect("SESSIONS_BUCKET must be set")
}

pub fn generate_title(paper_text: &str) -> String {
    paper_text
        .chars()
        .take(50)
        .collect::<String>()
        .trim()
        .to_string()
}

pub async fn create_session(s3: &S3Client, req: CreateSessionRequest) -> Result<CreateSessionResponse> {
    let now = Utc::now();
    let session_id = Uuid::new_v4().to_string();
    let token = Uuid::new_v4().to_string();
    let token_expiry = now + Duration::hours(24);
    let title = req.title.unwrap_or_else(|| generate_title(&req.paper_text));

    let session = Session {
        session_id: session_id.clone(),
        title,
        paper_text: req.paper_text,
        history: vec![],
        model: req.model,
        system_prompt: req.system_prompt.unwrap_or_else(default_system_prompt),
        subject_expertise: req.subject_expertise,
        research_expertise: req.research_expertise,
        token: token.clone(),
        token_expiry,
        created_at: now,
        updated_at: now,
    };

    put_session(s3, &session).await?;

    Ok(CreateSessionResponse {
        session_id,
        token,
        token_expiry,
    })
}

pub async fn put_session(s3: &S3Client, session: &Session) -> Result<()> {
    let json = serde_json::to_string(session)?;
    s3.put_object()
        .bucket(bucket_name())
        .key(s3_key(&session.session_id))
        .body(json.into_bytes().into())
        .content_type("application/json")
        .send()
        .await
        .context("Failed to write session to S3")?;
    Ok(())
}

pub async fn get_session(s3: &S3Client, session_id: &str) -> Result<Option<Session>> {
    let result = s3
        .get_object()
        .bucket(bucket_name())
        .key(s3_key(session_id))
        .send()
        .await;

    match result {
        Ok(output) => {
            let bytes = output.body.collect().await?.into_bytes();
            let session: Session = serde_json::from_slice(&bytes)?;
            Ok(Some(session))
        }
        Err(e) => {
            if e.as_service_error()
                .map(|e| e.is_no_such_key())
                .unwrap_or(false)
            {
                Ok(None)
            } else {
                Err(e.into())
            }
        }
    }
}

pub async fn list_sessions(s3: &S3Client) -> Result<Vec<SessionSummary>> {
    let result = s3
        .list_objects_v2()
        .bucket(bucket_name())
        .prefix("sessions/")
        .send()
        .await
        .context("Failed to list sessions")?;

    let mut summaries = Vec::new();
    for obj in result.contents() {
        if let Some(key) = obj.key() {
            let session_id = key.replace("sessions/", "").replace(".json", "");
            if let Ok(Some(session)) = get_session(s3, &session_id).await {
                summaries.push(SessionSummary {
                    session_id: session.session_id,
                    title: session.title,
                    model: session.model,
                    created_at: session.created_at,
                    updated_at: session.updated_at,
                });
            }
        }
    }

    Ok(summaries)
}

pub async fn delete_session(s3: &S3Client, session_id: &str) -> Result<()> {
    s3.delete_object()
        .bucket(bucket_name())
        .key(s3_key(session_id))
        .send()
        .await
        .context("Failed to delete session")?;
    Ok(())
}

pub fn validate_token(session: &Session, token: &str) -> bool {
    session.token == token && session.token_expiry > Utc::now()
}
