export interface Session {
  session_id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export const mockSessions: Session[] = [
  { session_id: '1', title: 'Dropout Regularization Study', model: 'sonnet', created_at: '2026-05-01T15:12:00Z', updated_at: '2026-05-01T15:18:00Z' },
  { session_id: '2', title: 'Attention Is All You Need', model: 'opus', created_at: '2026-05-01T13:00:00Z', updated_at: '2026-05-01T13:45:00Z' },
  { session_id: '3', title: 'BERT: Pre-training of Deep Bidirectional Transformers', model: 'haiku', created_at: '2026-04-30T10:00:00Z', updated_at: '2026-04-30T10:00:00Z' },
];

export const mockHistory: Turn[] = [
  { role: 'user', content: 'What dropout rate did they use?' },
  { role: 'assistant', content: 'The authors used a dropout rate of 0.5 applied to fully connected layers. According to the paper, this reduced overfitting by 15 percent on CIFAR-10.' },
  { role: 'user', content: 'Why did the benefit diminish in deeper networks?' },
  { role: 'assistant', content: 'The paper suggests that batch normalization in deeper networks provides overlapping regularization effects. So when you already have batch norm, adding dropout doesn\'t help as much because both techniques are addressing similar issues with training stability and overfitting.' },
];

export const modelLabels: Record<string, string> = {
  opus: 'Deep',
  sonnet: 'Balanced',
  haiku: 'Fast',
};
