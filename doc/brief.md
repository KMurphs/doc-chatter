Design document — Voice-first research paper assistant (Phase 1)
Problem

The core problem you’re trying to solve is not “chat with PDFs.” It’s closer to this: a person is moving through the world—driving, walking, doing something else—and wants to reason through research papers without sitting down to read them. That changes everything about the interaction model. Reading becomes listening. Navigation becomes conversation. And the system has to tolerate interruption, imprecision, and partial attention.

The deeper constraint is that research papers are dense, structured arguments, not casual documents. So the system is not just retrieving facts; it is trying to preserve reasoning chains across sections like methods, results, and interpretation, while the user asks high-level, often causal questions like “why did this work?” or “how does this compare to that paper?”

That combination—dense documents, mobile context, and conversational reasoning—is what makes this problem interesting.

Background

Most existing systems treat “chat with documents” as a retrieval problem. They break the paper into chunks, embed them, and then retrieve the most similar parts at question time. That works reasonably well for factual lookup, but it quietly collapses when the question requires global understanding.

Research papers are not independent paragraphs. They are structured arguments. The meaning of a result often depends on something defined much earlier in the methods section, and the interpretation often depends on the relationship between multiple results. Chunk-based systems tend to lose that structure. They retrieve locally relevant text but fail to preserve global coherence.

On the other end of the spectrum, large language models with long context windows can ingest entire documents, but most real systems don’t exploit this cleanly. Either the context is still fragmented, or the UX is not designed for continuous, voice-driven exploration.

So there is a gap between two extremes: brittle retrieval systems and expensive general-purpose LLM interfaces that are not tailored for document reasoning workflows.

Related products

Existing chat-with-PDF tools like ChatPDF or Humata sit firmly in the retrieval camp. They are good at answering “what does this section say,” but they struggle with “why does this result follow from that method.” They also tend to feel like search tools rather than reasoning tools.

General assistants like ChatGPT or Claude can handle the reasoning, but they are not structured around persistent document ingestion in a way that feels natural for repeated exploration. You often end up re-uploading or re-explaining context.

Local LLM stacks like Ollama-based tools give you control and privacy, but they typically lack a polished mobile voice experience and don’t integrate routing or cloud fallback in a seamless way.

So each category solves part of the problem, but none are designed for “hands-free, multi-step reasoning over a small number of full research papers.”

High-level design

The system you are building is intentionally minimal in structure, but opinionated in flow.

At the center is a mobile-first interface that behaves like a voice conversation. The user speaks a question, the system transcribes it, and the system responds with spoken output. There is no document navigation UI in the traditional sense. The paper is not something the user browses; it is something the system reasons over in the background.

The key design decision in this phase is that there is no retrieval system. Instead, the full paper—or at most two papers—is injected into the model context directly. This turns the problem from “finding relevant parts of the document” into “reasoning over a compressed but complete representation of the document.”

A lightweight API layer sits between the device and the models. Its job is not orchestration in the complex sense, but routing. It decides whether to send the request to a local model running at home or to a cloud model, depending on availability, cost, and expected reasoning difficulty.

The local model is a Qwen 3B or 7B instance running on a personal machine and exposed via a tunnel. This provides a zero-marginal-cost path for most interactions. The cloud model is a higher-capability fallback for cases where reasoning quality or reliability is more important than cost.

Text-to-speech is handled entirely on-device using the browser’s native capabilities. This keeps latency low and avoids unnecessary cloud calls. Speech-to-text is also handled on-device where possible, using browser APIs, again for latency and simplicity.

The important thing to notice in this design is that almost all complexity is pushed out of the system. There is no vector database, no retrieval pipeline, and no multi-stage reasoning graph. The system is intentionally “thin” so that the behaviour of the models is observable.

Alternatives considered

A natural alternative would be a full RAG architecture with embeddings and chunk-level retrieval. That would scale better in theory, but it introduces fragmentation immediately. You lose global document coherence, which is exactly what this phase is trying to evaluate.

A second alternative is cloud-only inference. That would simplify architecture significantly, but it removes control over cost and introduces dependency on external APIs for every interaction.

A third alternative is fully local inference. That would maximize privacy and cost efficiency, but it limits reasoning quality for long-context, multi-document understanding and makes mobile experience harder to guarantee.

The hybrid approach is chosen not because it is optimal in any one dimension, but because it preserves optionality: local for cost, cloud for capability, and device for interaction.

Low-level design and technology choices

On the device, the system is deliberately lightweight. A PWA or simple mobile web app handles input and output. Speech recognition is handled through browser-native APIs where available, and speech synthesis is used for response playback. This keeps the interaction loop tight and avoids unnecessary dependencies.

The API layer is a minimal FastAPI service. Its only responsibilities are receiving the user query, attaching the selected documents, and routing the request to the appropriate model backend. It does not perform retrieval or complex orchestration.

The context builder is a simple but critical component. Its job is to preserve structure when injecting papers into the prompt. Papers are not concatenated blindly; they are labeled explicitly so the model can distinguish between sources. This becomes important in the two-paper case, where cross-paper contamination is one of the main failure modes.

The local model runs on a home machine using Ollama or a similar runtime. It is exposed through a Cloudflare Tunnel so that the mobile device can access it securely. This gives you a private inference endpoint that behaves like a cloud API but has no per-token cost.

The cloud model is used as a fallback path. In practice this will be something like Gemini Flash or a Claude-class model, used only when the local system is insufficient or unavailable.

Text-to-speech is intentionally kept on-device. This avoids network latency in the most sensitive part of the interaction loop—the response playback—and keeps the experience immediate and continuous.

Core design intent

The important thing about this system is not that it is complete, but that it is diagnostic. It is designed to reveal where reasoning breaks when full documents are given to models directly. It is intentionally avoiding retrieval so that failure modes are visible rather than hidden inside a pipeline.

The system is therefore less about production efficiency and more about understanding boundaries: how far a model can go with full-context reasoning, when it starts to degrade, and what kinds of questions trigger that degradation.

That understanding is what will later justify whether you introduce RAG, routing complexity, or more sophisticated memory systems.