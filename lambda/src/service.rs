use anyhow::Result;
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::config::{default_expertise, default_model, default_system_prompt};
use crate::dao::session::{self, Session, SessionSummary};
use crate::inference::bedrock;

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
    pub token_expiry: chrono::DateTime<Utc>,
}

#[derive(Serialize)]
pub struct ChatResult {
    pub answer: String,
}

fn generate_title(paper_text: &str) -> String {
    paper_text
        .chars()
        .take(50)
        .collect::<String>()
        .trim()
        .to_string()
}

pub async fn create_session(
    s3: &aws_sdk_s3::Client,
    bucket: &str,
    req: CreateSessionRequest,
) -> Result<CreateSessionResponse> {
    let now = Utc::now();
    let session_id = Uuid::new_v4().to_string();
    let token = Uuid::new_v4().to_string();
    let token_expiry = now + Duration::hours(24);
    let title = req.title.unwrap_or_else(|| generate_title(&req.paper_text));

    let s = Session {
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

    session::put_session(s3, bucket, &s).await?;

    Ok(CreateSessionResponse {
        session_id,
        token,
        token_expiry,
    })
}

pub async fn list_sessions(s3: &aws_sdk_s3::Client, bucket: &str) -> Result<Vec<SessionSummary>> {
    session::list_sessions(s3, bucket).await
}

pub async fn get_session(
    s3: &aws_sdk_s3::Client,
    bucket: &str,
    id: &str,
) -> Result<Option<Session>> {
    session::get_session(s3, bucket, id).await
}

pub async fn delete_session(s3: &aws_sdk_s3::Client, bucket: &str, id: &str) -> Result<()> {
    session::delete_session(s3, bucket, id).await
}

pub async fn chat(
    s3: &aws_sdk_s3::Client,
    bedrock_client: &aws_sdk_bedrockruntime::Client,
    bucket: &str,
    session_id: &str,
    token: &str,
    question: &str,
) -> Result<ChatResult> {
    let mut sess = session::get_session(s3, bucket, session_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Session not found"))?;

    if !session::validate_token(&sess, token) {
        return Err(anyhow::anyhow!("Invalid or expired session token"));
    }

    let answer = bedrock::invoke_bedrock(
        bedrock_client,
        &sess.model,
        &sess.system_prompt,
        &sess.paper_text,
        &sess.history,
        question,
    )
    .await?;

    sess.append_turn(question, &answer);
    session::put_session(s3, bucket, &sess).await?;

    Ok(ChatResult { answer })
}
