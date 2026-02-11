/**
 * SourceViewer - Feature Component
 * 
 * Displays research sources in a nice card grid format.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Globe, Shield, AlertCircle } from 'lucide-react';
import type { Source } from '../types';

interface SourceViewerProps {
  sources: Source[];
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
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

function ReliabilityBadge({ reliability }: { reliability: string }) {
  const configs = {
    high: { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: Shield, label: 'High' },
    medium: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: AlertCircle, label: 'Medium' },
    low: { color: 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]', icon: AlertCircle, label: 'Low' },
  };
  
  const config = configs[reliability as keyof typeof configs] || configs.low;
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

export function SourceViewer({ sources }: SourceViewerProps) {
  const [failedFavicons, setFailedFavicons] = useState<Record<string, boolean>>({});

  const markFailedFavicon = (sourceKey: string) => {
    setFailedFavicons((current) => ({ ...current, [sourceKey]: true }));
  };

  if (!sources || sources.length === 0) {
    return (
      <div className="py-8 text-center text-[hsl(var(--muted-foreground))]">
        <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>No sources available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
          Sources ({sources.length})
        </h3>
        <div className="flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            High
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Medium
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sources.map((source, index) => {
          const domain = getDomainFromUrl(source.url);
          const favicon = getFaviconUrl(source.url);
          const sourceKey = source.id || `${source.url}-${index}`;
          const hasFaviconError = Boolean(failedFavicons[sourceKey]);
          
          return (
            <motion.a
              key={sourceKey}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group flex items-start gap-3 rounded-xl border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--card)/0.6)] p-4
                         transition-all hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--card)/0.9)]"
            >
              {/* Favicon */}
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[hsl(var(--input))]">
                {!hasFaviconError ? (
                  <img
                    src={favicon}
                    alt=""
                    className="h-6 w-6"
                    onError={() => markFailedFavicon(sourceKey)}
                  />
                ) : (
                  <Globe className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="truncate text-sm font-medium text-[hsl(var(--foreground))] transition-colors group-hover:text-blue-400">
                    {source.title || 'Untitled Source'}
                  </h4>
                  <ExternalLink className="h-4 w-4 flex-shrink-0 text-[hsl(var(--muted-foreground))] opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="mt-0.5 truncate text-xs text-[hsl(var(--muted-foreground))]">
                  {domain}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <ReliabilityBadge reliability={source.reliability || 'low'} />
                  {source.confidence > 0 && (
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {(source.confidence * 100).toFixed(0)}% match
                    </span>
                  )}
                </div>
              </div>
            </motion.a>
          );
        })}
      </div>
    </div>
  );
}
