export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  chatId: string;
  streaming?: boolean;
}

export type ActivityKind =
  | "chat_send"
  | "chat_response"
  | "chat_abort"
  | "chat_clear"
  | "chat_switch"
  | "tool_invoked"
  | "info";

export interface ActivityEvent {
  id: string;
  ts: number;
  kind: ActivityKind;
  message: string;
  detail?: string;
}
