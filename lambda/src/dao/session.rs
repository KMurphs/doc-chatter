use anyhow::{Context, Result};
use aws_sdk_s3::Client as S3Client;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::inference::bedrock::Turn;

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

#[derive(Serialize)]
pub struct SessionSummary {
    pub session_id: String,
    pub title: String,
    pub model: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

fn s3_key(session_id: &str) -> String {
    format!("sessions/{}.json", session_id)
}

pub async fn put_session(s3: &S3Client, bucket: &str, session: &Session) -> Result<()> {
    let json = serde_json::to_string(session)?;
    s3.put_object()
        .bucket(bucket)
        .key(s3_key(&session.session_id))
        .body(json.into_bytes().into())
        .content_type("application/json")
        .send()
        .await
        .context("Failed to write session to S3")?;
    Ok(())
}

pub async fn get_session(s3: &S3Client, bucket: &str, session_id: &str) -> Result<Option<Session>> {
    let result = s3
        .get_object()
        .bucket(bucket)
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

pub async fn list_sessions(s3: &S3Client, bucket: &str) -> Result<Vec<SessionSummary>> {
    let result = s3
        .list_objects_v2()
        .bucket(bucket)
        .prefix("sessions/")
        .send()
        .await
        .context("Failed to list sessions")?;

    let mut summaries = Vec::new();
    for obj in result.contents() {
        if let Some(key) = obj.key() {
            let session_id = key.replace("sessions/", "").replace(".json", "");
            if let Ok(Some(session)) = get_session(s3, bucket, &session_id).await {
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

pub async fn delete_session(s3: &S3Client, bucket: &str, session_id: &str) -> Result<()> {
    s3.delete_object()
        .bucket(bucket)
        .key(s3_key(session_id))
        .send()
        .await
        .context("Failed to delete session")?;
    Ok(())
}

impl Session {
    pub fn append_turn(&mut self, question: &str, answer: &str) {
        self.history.push(Turn {
            role: "user".to_string(),
            content: question.to_string(),
        });
        self.history.push(Turn {
            role: "assistant".to_string(),
            content: answer.to_string(),
        });
        self.updated_at = Utc::now();
    }
}
