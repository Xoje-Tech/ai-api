export interface ChatMessage {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
}

export interface AIService {
  readonly name: string;
  chat: (messages: ChatMessage[]) => Promise<AsyncIterable<string>>;
}
