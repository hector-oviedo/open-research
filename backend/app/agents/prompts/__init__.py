"""
Prompt Loader Utility

Loads prompt files from the prompts/ directory.
All prompts are loaded once at module import and cached.
"""

from pathlib import Path
from functools import lru_cache


def _get_prompts_dir() -> Path:
    """Get the directory containing prompt files."""
    return Path(__file__).parent


@lru_cache(maxsize=None)
def load_prompt(name: str) -> str:
    """
    Load a prompt file from the prompts directory.
    
    Args:
        name: Prompt filename (e.g., "planner.md")
    
    Returns:
        str: The prompt content
    
    Raises:
        FileNotFoundError: If prompt file doesn't exist
    
    Example:
        >>> from app.agents.prompts import load_prompt
        >>> planner_prompt = load_prompt("planner.md")
    """
    prompts_dir = _get_prompts_dir()
    prompt_file = prompts_dir / name
    
    if not prompt_file.exists():
        raise FileNotFoundError(
            f"Prompt file not found: {prompt_file}\n"
            f"Available prompts: {list_available_prompts()}"
        )
    
    return prompt_file.read_text(encoding="utf-8")


def list_available_prompts() -> list[str]:
    """
    List all available prompt files.
    
    Returns:
        list[str]: List of prompt filenames
    """
    prompts_dir = _get_prompts_dir()
    return [f.name for f in prompts_dir.glob("*.md")]


# Pre-load common prompts for convenience
PLANNER_PROMPT = load_prompt("planner.md")
FINDER_PROMPT = load_prompt("finder.md")
SUMMARIZER_PROMPT = load_prompt("summarizer.md")
REVIEWER_PROMPT = load_prompt("reviewer.md")
