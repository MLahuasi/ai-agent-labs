from typing import Any, Literal, NotRequired, Protocol, TypedDict
# Chat

ChatRole = Literal[
    "system",
    "user",
    "assistant",
    "tool",
]


class ChatMessage(TypedDict):
    role: str
    content: NotRequired[str | None]
    model: NotRequired[str]
    name: NotRequired[str]
    tool_call_id: NotRequired[str]
    tool_calls: NotRequired[list[dict[str, Any]]]


class ChatResponse(TypedDict):
    content: str
    model: str

# Tools
class ToolResponse(TypedDict):
    action: str
    status: str
    message: str

# Tools Schemas

JsonProperty = dict[str, str]


class RecordUserDetailsProperties(TypedDict):
    email: JsonProperty
    name: JsonProperty
    notes: JsonProperty


class RecordUserDetailsParameters(TypedDict):
    type: Literal["object"]
    properties: RecordUserDetailsProperties
    required: list[Literal["email"]]
    additionalProperties: Literal[False]


class RecordUserDetailsSchema(TypedDict):
    name: Literal["record_user_details"]
    description: str
    parameters: RecordUserDetailsParameters


class RecordUnknownQuestionProperties(TypedDict):
    question: JsonProperty


class RecordUnknownQuestionParameters(TypedDict):
    type: Literal["object"]
    properties: RecordUnknownQuestionProperties
    required: list[Literal["question"]]
    additionalProperties: Literal[False]


class RecordUnknownQuestionSchema(TypedDict):
    name: Literal["record_unknown_question"]
    description: str
    parameters: RecordUnknownQuestionParameters


class SendEmailToAdminProperties(TypedDict):
    subject: JsonProperty
    message: JsonProperty


class SendEmailToAdminParameters(TypedDict):
    type: Literal["object"]
    properties: SendEmailToAdminProperties
    required: list[Literal["subject", "message"]]
    additionalProperties: Literal[False]


class SendEmailToAdminSchema(TypedDict):
    name: Literal["send_email_to_admin"]
    description: str
    parameters: SendEmailToAdminParameters


ToolSchema = (
    RecordUserDetailsSchema
    | RecordUnknownQuestionSchema
    | SendEmailToAdminSchema
)


class ToolDefinition(TypedDict):
    type: Literal["function"]
    function: ToolSchema


class ToolCallFunction(Protocol):
    name: str
    arguments: str


class ToolCall(Protocol):
    id: str
    function: ToolCallFunction

# Ollama normalized tool calls

class ToolCallFunctionDict(TypedDict):
    name: str
    arguments: dict[str, object] | str


class ToolCallDict(TypedDict):
    id: str
    type: Literal["function"]
    function: ToolCallFunctionDict


NormalizedToolCall = ToolCall | ToolCallDict