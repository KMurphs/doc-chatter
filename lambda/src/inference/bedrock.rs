use anyhow::Result;
use aws_sdk_bedrockruntime::types::{ContentBlock, ConversationRole, Message, SystemContentBlock};
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Clone)]
pub struct Turn {
    pub role: String,
    pub content: String,
}

fn model_id(model: &str) -> &str {
    match model {
        "opus" => "us.anthropic.claude-opus-4-6-v1",
        "sonnet" => "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
        "haiku" => "us.anthropic.claude-haiku-4-5-20251001-v1:0",
        other => other,
    }
}

fn build_system_prompt(system_prompt: &str, paper_text: &str) -> String {
    format!(
        "{}\n\n--- PAPER START ---\n{}\n--- PAPER END ---",
        system_prompt, paper_text
    )
}

fn build_messages(history: &[Turn], question: &str) -> Vec<Message> {
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
    model: &str,
    system_prompt: &str,
    paper_text: &str,
    history: &[Turn],
    question: &str,
) -> Result<String> {
    let full_system_prompt = build_system_prompt(system_prompt, paper_text);
    let messages = build_messages(history, question);
    let mid = model_id(model);

    let response = client
        .converse()
        .model_id(mid)
        .system(SystemContentBlock::Text(full_system_prompt))
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
