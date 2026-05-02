import { SessionDetail } from '../sessions/types';

export interface InferenceService {
  chat(session: SessionDetail, question: string): Promise<string>;
}
