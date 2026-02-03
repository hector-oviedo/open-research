/**
 * SourceLink - Reusable Component
 * 
 * Displays a clickable source link with icon, title, and domain.
 * Used throughout the UI wherever sources need to be displayed.
 */
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
        className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 
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
        className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 
                   border border-slate-700/50 hover:bg-slate-700/50 
                   hover:border-slate-600 transition-all group"
        title={url}
      >
        {showIcon && (
          <div className="w-6 h-6 rounded bg-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img
              src={getFaviconUrl(url)}
              alt=""
              className="w-4 h-4"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg class="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>';
              }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <FileText className="w-3 h-3 text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-200 truncate group-hover:text-blue-400 transition-colors">
              {displayTitle}
            </span>
          </div>
          {showDomain && (
            <div className="flex items-center gap-1 mt-0.5">
              <Globe className="w-3 h-3 text-slate-500 flex-shrink-0" />
              <span className="text-xs text-slate-500 truncate">{displayDomain}</span>
            </div>
          )}
        </div>
        <ExternalLink className={`${iconSizes[size]} text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0`} />
      </a>
    );
  }

  // Default variant
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center ${sizeClasses[size]} text-blue-400 
                 hover:text-blue-300 transition-colors group`}
      title={url}
    >
      {showIcon && (
        <img
          src={getFaviconUrl(url)}
          alt=""
          className="w-4 h-4 rounded"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '';
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
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
        <span className="text-xs text-slate-500 self-center">
          +{remainingCount} more
        </span>
      )}
    </div>
  );
}

export default SourceLink;
