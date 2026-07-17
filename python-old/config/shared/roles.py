from config.shared.types import ChatRole


def normalize_chat_role(role: str) -> ChatRole:
    normalized = role.lower().strip()

    if normalized in {"user"}:
        return "user"

    if normalized in {"assistant", "model", "ia"}:
        return "assistant"

    if normalized in {"system", "developer"}:
        return "system"

    if normalized in {"tool", "function"}:
        return "tool"

    return "user"