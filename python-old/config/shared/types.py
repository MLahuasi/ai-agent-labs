from typing import Any, Literal, NotRequired, Protocol, TypedDict


# -------------------------------------------------------------------------
# Chat
# -------------------------------------------------------------------------

ChatRole = Literal[
    "system",
    "user",
    "assistant",
    "tool",
]


class ChatMessage(TypedDict):
    """
    Formato neutral utilizado internamente por la aplicación.

    Cada adapter es responsable de convertir esta estructura al formato
    específico requerido por OpenAI, Gemini, Groq u Ollama.
    """

    role: str
    content: NotRequired[str | None]
    model: NotRequired[str]
    name: NotRequired[str]
    tool_call_id: NotRequired[str]
    tool_calls: NotRequired[list[dict[str, Any]]]


class ChatResponse(TypedDict):
    content: str
    model: str


class ChatTurnResult(TypedDict):
    """
    Resultado estándar de un turno completo de conversación.

    Todos los adapters deben retornar esta estructura.

    Esto evita que la lógica común tenga que inspeccionar el historial
    para deducir si se utilizaron herramientas.
    """

    # Texto final generado por el modelo.
    content: str

    # True cuando el modelo solicitó al menos una herramienta.
    used_tools: bool

    # Nombres de las herramientas solicitadas por el modelo.
    tool_names: list[str]

    # Herramientas cuyo resultado indicó status="ok".
    successful_tool_names: list[str]

    # Cantidad de ciclos modelo -> tools realizados.
    tool_iterations: int


# -------------------------------------------------------------------------
# Tools
# -------------------------------------------------------------------------

class ToolResponse(TypedDict):
    action: str
    status: str
    message: str


# -------------------------------------------------------------------------
# Tool schemas
# -------------------------------------------------------------------------

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


# -------------------------------------------------------------------------
# Tool calls
# -------------------------------------------------------------------------

class ToolCallFunction(Protocol):
    name: str
    arguments: str


class ToolCall(Protocol):
    id: str
    function: ToolCallFunction


class ToolCallFunctionDict(TypedDict):
    """
    Formato normalizado utilizado por adapters que representan
    los argumentos mediante diccionarios.
    """

    name: str
    arguments: dict[str, object] | str


class ToolCallDict(TypedDict):
    id: str
    type: Literal["function"]
    function: ToolCallFunctionDict


NormalizedToolCall = ToolCall | ToolCallDict