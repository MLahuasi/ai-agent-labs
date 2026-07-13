from __future__ import annotations

import json
from typing import Any

from typing import Any, cast


def normalize_block(text: str) -> str:
    if not text:
        return ""

    return "\n".join(
        line.rstrip()
        for line in text.strip().splitlines()
        if line.strip()
    )


def as_dict_list(value: Any) -> list[dict[str, Any]]:
    """
    Convierte de forma segura un valor desconocido a list[dict[str, Any]].

    Evita warnings de Pyright/Pylance sobre list[Unknown] y dict[Unknown, Unknown].
    """
    if not isinstance(value, list):
        return []

    items = cast(list[Any], value)

    return [
        cast(dict[str, Any], item)
        for item in items
        if isinstance(item, dict)
    ]


def compact_github_projects_knowledge(
    github_projects: str,
    *,
    max_projects: int | None = None,
) -> str:
    if not github_projects:
        return ""

    try:
        data = cast(dict[str, Any], json.loads(github_projects))
    except json.JSONDecodeError:
        return normalize_block(github_projects)

    projects = as_dict_list(data.get("projects"))

    if max_projects is not None:
        projects = projects[:max_projects]

    compact_projects: list[dict[str, Any]] = []

    for project in projects:
        visibility = project.get("visibility")
        repository = project.get("repository")

        is_public_project = (
            isinstance(visibility, str)
            and visibility == "public"
            and isinstance(repository, str)
            and bool(repository)
        )

        evidence_level = 4 if is_public_project else 3

        compact_projects.append(
            {
                "name": project.get("name"),
                "repository": repository,
                "visibility": visibility,
                "category": project.get("category"),
                "summary": project.get("summary"),
                "main_technologies": project.get("main_technologies", []),
                "architecture": project.get("architecture", []),
                "main_features": project.get("main_features", []),
                "technical_focus": project.get("technical_focus", []),
                "evidence_level": evidence_level,
            }
        )

    metadata = data.get("metadata")
    owner_profile = data.get("owner_profile")

    metadata_dict = (
        cast(dict[str, Any], metadata)
        if isinstance(metadata, dict)
        else {}
    )

    owner_profile_dict = (
        cast(dict[str, Any], owner_profile)
        if isinstance(owner_profile, dict)
        else {}
    )

    compact_data = {
        "owner": (
            metadata_dict.get("generated_for")
            or owner_profile_dict.get("name")
        ),
        "github_username": (
            metadata_dict.get("github_username")
            or owner_profile_dict.get("github_username")
        ),
        "rule": (
            "Los proyectos con evidence_level 4 son repositorios públicos documentados. "
            "No implican producción, clientes, tiendas ni entregas verificables salvo que se indique explícitamente."
        ),
        "projects": compact_projects,
    }

    return json.dumps(
        compact_data,
        ensure_ascii=False,
        separators=(",", ":"),
    )