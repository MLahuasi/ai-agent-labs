export interface OllamaGenerateResponse {
  model: string;

  message: {
    role: string;
    content: string;
  };

  done: boolean;

  prompt_eval_count?: number;
  eval_count?: number;
}
