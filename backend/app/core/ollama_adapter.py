"""
Ollama Adapter - VLLM Interface for the Deep Research System

This module provides a clean abstraction over the Ollama API.
It handles:
- Chat completions with optional thinking injection
- Response normalization (stripping <think> tags for state)
- Streaming support for real-time updates
- Singleton pattern for connection reuse

Design Pattern: Adapter (wraps Ollama API in application-specific interface)
"""

import json
from typing import AsyncGenerator, Iterator
import httpx
from app.core.config import settings


class VLLMAdapter:
    """
    Adapter for Ollama/VLLM API.
    
    Provides a unified interface for LLM operations with:
    - Automatic thinking injection for specific agents
    - Response streaming
    - Error handling
    
    This is a Singleton - use get_adapter() to get the instance.
    """
    
    _instance = None
    
    def __new__(cls):
        """Ensure singleton pattern."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        """Initialize the adapter (only runs once due to singleton)."""
        if self._initialized:
            return
        
        self.base_url = settings.OLLAMA_HOST
        self.model = settings.OLLAMA_MODEL
        self.temperature = settings.LLM_TEMPERATURE
        self.max_tokens = settings.LLM_MAX_TOKENS
        self.client = httpx.AsyncClient(timeout=300.0)
        self._initialized = True
    
    async def chat_completion(
        self,
        messages: list[dict[str, str]],
        enable_thinking: bool = False,
        stream: bool = False,
        response_format: str | dict | None = None,
    ) -> dict | AsyncGenerator[str, None]:
        """
        Send a chat completion request to Ollama.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            enable_thinking: If True, injects thinking config for Planner/Reviewer
            stream: If True, returns an async generator of response chunks
            response_format: Optional Ollama response format (e.g. "json")
        
        Returns:
            Either a complete response dict or an async generator for streaming
        
        Example:
            >>> adapter = get_adapter()
            >>> response = await adapter.chat_completion([
            ...     {"role": "user", "content": "Research quantum computing"}
            ... ], enable_thinking=True)
        """
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": stream,
            "options": {
                "temperature": self.temperature,
                "num_predict": self.max_tokens,
            },
        }

        if response_format is not None:
            payload["format"] = response_format
        
        # Inject thinking configuration for Planner/Reviewer agents
        if enable_thinking:
            payload["thinking"] = {"type": "enabled"}
        
        if stream:
            return self._stream_completion(payload)
        
        response = await self.client.post(
            f"{self.base_url}/api/chat",
            json=payload,
        )
        response.raise_for_status()
        return response.json()
    
    async def _stream_completion(
        self,
        payload: dict,
    ) -> AsyncGenerator[str, None]:
        """
        Stream completion response from Ollama.
        
        Yields raw response chunks including <think> tags.
        Caller is responsible for parsing/normalizing.
        
        Args:
            payload: Request payload dict
        
        Yields:
            str: Response content chunks
        """
        async with self.client.stream(
            "POST",
            f"{self.base_url}/api/chat",
            json=payload,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line:
                    try:
                        data = json.loads(line)
                        if "message" in data and "content" in data["message"]:
                            yield data["message"]["content"]
                    except json.JSONDecodeError:
                        continue
    
    def normalize_response(self, response: str) -> tuple[str, str]:
        """
        Normalize response by separating thinking from content.
        
        Args:
            response: Raw response string potentially containing <think> tags
        
        Returns:
            tuple: (reasoning_log, clean_content)
            - reasoning_log: Content inside <think> tags (for TraceLog)
            - clean_content: Content with tags stripped (for Graph State)
        
        Example:
            >>> raw = "<think>Analyzing...</think>Result: 42"
            >>> reasoning, content = adapter.normalize_response(raw)
            >>> reasoning
            'Analyzing...'
            >>> content
            'Result: 42'
        """
        reasoning = ""
        content = response
        
        # Extract thinking content
        if "<think>" in response and "</think>" in response:
            start = response.find("<think>") + len("<think>")
            end = response.find("</think>")
            reasoning = response[start:end].strip()
            # Remove thinking tags from content
            content = response[:start-len("<think>")] + response[end+len("</think>"):]
            content = content.strip()
        
        return reasoning, content
    
    async def generate_simple(
        self,
        prompt: str,
        enable_thinking: bool = False,
    ) -> dict:
        """
        Simple generation endpoint (non-chat) for quick queries.
        
        Args:
            prompt: Text prompt
            enable_thinking: Enable thinking for complex reasoning
        
        Returns:
            dict: Response with 'response' field
        """
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": self.temperature,
                "num_predict": self.max_tokens,
            },
        }
        
        if enable_thinking:
            payload["thinking"] = {"type": "enabled"}
        
        response = await self.client.post(
            f"{self.base_url}/api/generate",
            json=payload,
        )
        response.raise_for_status()
        return response.json()
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()


def get_adapter() -> VLLMAdapter:
    """
    Get the singleton VLLMAdapter instance.
    
    Returns:
        VLLMAdapter: Singleton adapter instance
    
    Example:
        >>> adapter = get_adapter()
        >>> response = await adapter.chat_completion([...])
    """
    return VLLMAdapter()
