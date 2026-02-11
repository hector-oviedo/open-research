/**
 * SourceLink - Reusable Component
 * 
 * Displays a clickable source link with icon, title, and domain.
 * Used throughout the UI wherever sources need to be displayed.
 */
import { useState } from 'react';
import { ExternalLink, Globe, FileText } from 'lucide-react';

interface SourceLinkProps {
  url: string;
  title?: string;
  domain?: string;
  showIcon?: boolean;
  showDomain?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'inline' | 'card';
}

function getDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

function getFaviconUrl(url: string): string {
  const domain = getDomainFromUrl(url);
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

export function SourceLink({
  url,
  title,
  domain,
  showIcon = true,
  showDomain = true,
  size = 'md',
  variant = 'default',
}: SourceLinkProps) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const displayDomain = domain || getDomainFromUrl(url);
  const displayTitle = title || displayDomain;
  
  const sizeClasses = {
    sm: 'text-xs gap-1',
    md: 'text-sm gap-2',
    lg: 'text-base gap-2',
  };
  
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  if (variant === 'inline') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[hsl(var(--primary))] hover:text-[hsl(var(--accent))]
                   hover:underline transition-colors"
        title={url}
      >
        <ExternalLink className="w-3 h-3" />
        <span className="truncate max-w-[200px]">{displayTitle}</span>
      </a>
    );
  }

  if (variant === 'card') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-2 rounded-lg border border-[hsl(var(--border)/0.7)] bg-[hsl(var(--secondary)/0.65)] p-2 transition-all hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary)/0.9)]"
        title={url}
      >
        {showIcon && (
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-[hsl(var(--input))]">
            {!faviconFailed ? (
              <img
                src={getFaviconUrl(url)}
                alt=""
                className="h-4 w-4"
                onError={() => setFaviconFailed(true)}
              />
            ) : (
              <Globe className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3 flex-shrink-0 text-[hsl(var(--muted-foreground))]" />
            <span className="truncate text-sm text-[hsl(var(--foreground))] transition-colors group-hover:text-[hsl(var(--primary))]">
              {displayTitle}
            </span>
          </div>
          {showDomain && (
            <div className="flex items-center gap-1 mt-0.5">
              <Globe className="h-3 w-3 flex-shrink-0 text-[hsl(var(--muted-foreground))]" />
              <span className="truncate text-xs text-[hsl(var(--muted-foreground))]">{displayDomain}</span>
            </div>
          )}
        </div>
        <ExternalLink
          className={`${iconSizes[size]} flex-shrink-0 text-[hsl(var(--muted-foreground))] opacity-0 transition-opacity group-hover:opacity-100`}
        />
      </a>
    );
  }

  // Default variant
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center ${sizeClasses[size]} group text-[hsl(var(--primary))] transition-colors hover:text-[hsl(var(--accent))]`}
      title={url}
    >
      {showIcon && (
        !faviconFailed ? (
          <img
            src={getFaviconUrl(url)}
            alt=""
            className="h-4 w-4 rounded"
            onError={() => setFaviconFailed(true)}
          />
        ) : (
          <Globe className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        )
      )}
      <span className="truncate max-w-[250px]">{displayTitle}</span>
      <ExternalLink className={`${iconSizes[size]} opacity-0 group-hover:opacity-100 transition-opacity`} />
    </a>
  );
}

/**
 * SourceLinkList - Display multiple sources as a list
 */
interface SourceLinkListProps {
  urls: string[];
  maxVisible?: number;
}

export function SourceLinkList({ urls, maxVisible = 3 }: SourceLinkListProps) {
  if (!urls || urls.length === 0) return null;
  
  const visibleUrls = urls.slice(0, maxVisible);
  const remainingCount = urls.length - maxVisible;
  
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {visibleUrls.map((url, index) => (
        <SourceLink
          key={index}
          url={url}
          variant="inline"
          size="sm"
        />
      ))}
      {remainingCount > 0 && (
        <span className="self-center text-xs text-[hsl(var(--muted-foreground))]">
          +{remainingCount} more
        </span>
      )}
    </div>
  );
}

export default SourceLink;
