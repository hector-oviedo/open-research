/**
 * SourceViewer - Feature Component
 * 
 * Displays research sources in a nice card grid format.
 */
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
    low: { color: 'bg-slate-700 text-slate-400 border-slate-600', icon: AlertCircle, label: 'Low' },
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
  if (!sources || sources.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>No sources available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          Sources ({sources.length})
        </h3>
        <div className="flex items-center gap-4 text-sm text-slate-500">
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
          
          return (
            <motion.a
              key={source.id || index}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50
                         hover:bg-slate-800/50 hover:border-slate-600 transition-all group"
            >
              {/* Favicon */}
              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                <img
                  src={favicon}
                  alt=""
                  className="w-6 h-6"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
                  }}
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">
                    {source.title || 'Untitled Source'}
                  </h4>
                  <ExternalLink className="w-4 h-4 text-slate-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {domain}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <ReliabilityBadge reliability={source.reliability || 'low'} />
                  {source.confidence > 0 && (
                    <span className="text-xs text-slate-500">
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
