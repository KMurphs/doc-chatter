export interface SessionSummary {
  session_id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface SessionDetail {
  session_id: string;
  title: string;
  paper_text: string;
  history: { role: string; content: string }[];
  model: string;
  system_prompt: string;
  subject_expertise: string;
  research_expertise: string;
  profileId?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSessionRequest {
  paper_text: string;
  title?: string;
  model?: string;
  subject_expertise?: string;
  research_expertise?: string;
  system_prompt?: string;
  profileId?: string;
}

export interface UpdateSessionRequest {
  model?: string;
  system_prompt?: string;
  subject_expertise?: string;
  research_expertise?: string;
  title?: string;
  profileId?: string;
}

export interface SessionService {
  list(): Promise<SessionSummary[]>;
  get(id: string): Promise<SessionDetail>;
  create(req: CreateSessionRequest): Promise<{ session_id: string }>;
  update(id: string, req: UpdateSessionRequest): Promise<SessionDetail>;
  delete(id: string): Promise<void>;
  appendHistory(id: string, role: string, content: string): Promise<void>;
}
