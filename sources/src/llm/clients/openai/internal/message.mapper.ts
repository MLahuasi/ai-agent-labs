import OpenAI from "openai";

export function getDoneReason(
  response: OpenAI.Responses.Response,
): "tool_calls" | "stop" | "length" | "content_filter" | "failed" | "unknown" {
  const hasToolCalls = response.output.some(
    (item) => item.type === "function_call",
  );

  if (hasToolCalls) {
    return "tool_calls";
  }

  if (response.status === "completed") {
    return "stop";
  }

  if (response.status === "incomplete") {
    switch (response.incomplete_details?.reason) {
      case "max_output_tokens":
        return "length";

      case "content_filter":
        return "content_filter";

      default:
        return "unknown";
    }
  }

  if (response.status === "failed") {
    return "failed";
  }

  return "unknown";
}
