"""
Content Fetcher - Fetches real web content from URLs

This module provides web scraping capabilities to fetch actual content
from discovered sources for the summarizer to process.
"""

import logging
from typing import Optional
from urllib.parse import urlparse
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class ContentFetcher:
    """
    Fetches and extracts clean text content from web URLs.
    
    Uses httpx for async HTTP requests and BeautifulSoup for HTML parsing.
    Extracts main article content while removing ads, nav, scripts, etc.
    """
    
    def __init__(self, timeout: float = 30.0):
        self.timeout = timeout
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;q=0.9,"
                "image/webp,*/*;q=0.8"
            ),
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Connection": "keep-alive",
        }
    
    async def fetch_content(self, url: str) -> Optional[str]:
        """
        Fetch and extract clean text content from a URL.
        
        Args:
            url: The URL to fetch
            
        Returns:
            Clean extracted text or None if failed
        """
        # Validate URL
        if not self._is_valid_url(url):
            logger.warning(f"[Fetcher] Invalid URL: {url}")
            return None
        
        try:
            logger.info(f"[Fetcher] Fetching: {url[:80]}...")
            
            async with httpx.AsyncClient(
                timeout=self.timeout,
                follow_redirects=True,
                headers=self.headers,
            ) as client:
                response = await client.get(url)
                response.raise_for_status()
                
                # Check content type
                content_type = response.headers.get("content-type", "").lower()
                if "text/html" not in content_type and "application/xhtml" not in content_type:
                    logger.warning(f"[Fetcher] Non-HTML content type: {content_type}")
                    return None
                
                # Parse HTML
                html = response.text
                text = self._extract_text(html, url)
                
                if text:
                    logger.info(f"[Fetcher] Extracted {len(text)} chars from {url[:60]}...")
                    return text
                else:
                    logger.warning(f"[Fetcher] No content extracted from: {url[:60]}...")
                    return None
                    
        except httpx.TimeoutException:
            logger.warning(f"[Fetcher] Timeout fetching: {url[:60]}...")
            return None
        except httpx.HTTPStatusError as e:
            logger.warning(f"[Fetcher] HTTP error {e.response.status_code} for: {url[:60]}...")
            return None
        except Exception as e:
            logger.error(f"[Fetcher] Error fetching {url[:60]}...: {e}")
            return None
    
    def _is_valid_url(self, url: str) -> bool:
        """Check if URL is valid and fetchable."""
        try:
            parsed = urlparse(url)
            return bool(parsed.netloc) and bool(parsed.scheme) and parsed.scheme in ("http", "https")
        except Exception:
            return False
    
    def _extract_text(self, html: str, url: str) -> Optional[str]:
        """
        Extract clean text from HTML using BeautifulSoup.
        
        Tries to find main content area first, falls back to body text.
        Removes scripts, styles, nav, ads, etc.
        """
        try:
            soup = BeautifulSoup(html, "html.parser")
            
            # Remove unwanted elements
            for element in soup.find_all([
                "script", "style", "nav", "header", "footer",
                "aside", "advertisement", "iframe", "noscript",
                "form", "button", "input", "select", "textarea"
            ]):
                element.decompose()
            
            # Try to find main content area (common selectors)
            main_content = None
            content_selectors = [
                "main",
                "article",
                "[role='main']",
                ".content",
                ".main-content",
                ".article-content",
                ".post-content",
                "#content",
                "#main-content",
                ".entry-content",
                ".page-content",
            ]
            
            for selector in content_selectors:
                main_content = soup.select_one(selector)
                if main_content:
                    logger.debug(f"[Fetcher] Found content using selector: {selector}")
                    break
            
            # If no main content found, use body
            if not main_content:
                main_content = soup.find("body")
                if not main_content:
                    return None
            
            # Get text and clean it up
            text = main_content.get_text(separator="\n", strip=True)
            
            # Clean up whitespace
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            text = "\n".join(lines)
            
            # Limit length (to avoid token limits)
            max_length = 15000  # ~4000 tokens
            if len(text) > max_length:
                text = text[:max_length] + f"\n\n[Content truncated. Original: {len(text)} chars]"
            
            return text if text else None
            
        except Exception as e:
            logger.error(f"[Fetcher] Error extracting text: {e}")
            return None


# Singleton instance
_fetcher_instance: Optional[ContentFetcher] = None


def get_content_fetcher() -> ContentFetcher:
    """Get singleton ContentFetcher instance."""
    global _fetcher_instance
    if _fetcher_instance is None:
        _fetcher_instance = ContentFetcher()
    return _fetcher_instance
