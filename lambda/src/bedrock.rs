use anyhow::Result;
use aws_sdk_bedrockruntime::types::{ContentBlock, ConversationRole, Message, SystemContentBlock};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct ChatRequest {
    pub paper_text: String,
    pub question: String,
    #[serde(default)]
    pub history: Vec<Turn>,
    #[serde(default = "default_model")]
    pub model: String,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct Turn {
    pub role: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct ChatResponse {
    pub answer: String,
}

fn default_model() -> String {
    std::env::var("DEFAULT_MODEL").unwrap_or_else(|_| "sonnet".to_string())
}

pub fn model_id(model: &str) -> &str {
    match model {
        "opus" => "us.anthropic.claude-opus-4-6-v1",
        "sonnet" => "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
        "haiku" => "us.anthropic.claude-haiku-4-5-20251001-v1:0",
        other => other,
    }
}

pub fn build_system_prompt(paper_text: &str) -> String {
    format!(
        "You are a research paper assistant helping someone who is driving or walking. \
         They cannot read — they are listening to your responses. \
         Keep responses concise: short sentences, clear transitions, no bullet points or lists. \
         Speak naturally as if explaining to a colleague.\n\n\
         When making claims, reference which part of the paper you are drawing from.\n\
         If the answer is not in the paper, say so rather than guessing.\n\n\
         --- PAPER START ---\n{}\n--- PAPER END ---",
        paper_text
    )
}

pub fn build_messages(history: &[Turn], question: &str) -> Vec<Message> {
    let mut messages: Vec<Message> = history
        .iter()
        .map(|turn| {
            let role = match turn.role.as_str() {
                "user" => ConversationRole::User,
                _ => ConversationRole::Assistant,
            };
            Message::builder()
                .role(role)
                .content(ContentBlock::Text(turn.content.clone()))
                .build()
                .expect("valid message")
        })
        .collect();

    messages.push(
        Message::builder()
            .role(ConversationRole::User)
            .content(ContentBlock::Text(question.to_string()))
            .build()
            .expect("valid message"),
    );

    messages
}

pub async fn invoke_bedrock(
    client: &aws_sdk_bedrockruntime::Client,
    request: &ChatRequest,
) -> Result<String> {
    let system_prompt = build_system_prompt(&request.paper_text);
    let messages = build_messages(&request.history, &request.question);
    let mid = model_id(&request.model);

    let response = client
        .converse()
        .model_id(mid)
        .system(SystemContentBlock::Text(system_prompt))
        .set_messages(Some(messages))
        .send()
        .await?;

    let output = response.output().expect("response has output");
    if let aws_sdk_bedrockruntime::types::ConverseOutput::Message(msg) = output {
        for block in msg.content() {
            if let ContentBlock::Text(text) = block {
                return Ok(text.clone());
            }
        }
    }

    Ok("No response generated.".to_string())
}
