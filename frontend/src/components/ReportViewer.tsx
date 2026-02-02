/**
 * ReportViewer - Feature Component
 * 
 * Displays the final research report with markdown rendering
 * and download functionality.
 */
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { useResearchStore } from '../stores/researchStore';

export function ReportViewer() {
  const { finalReport, status } = useResearchStore();

  if (!finalReport || status !== 'completed') return null;

  const handleDownload = () => {
    const markdown = `# ${finalReport.title}

${finalReport.executiveSummary}

## Report Details

**Word Count:** ${finalReport.wordCount}
**Sources Used:** ${finalReport.sourcesUsed.length}
**Confidence:** ${finalReport.confidenceAssessment}

${finalReport.sections.map(s => `
## ${s.heading}

${s.content}
`).join('\n')}

## Sources

${finalReport.sourcesUsed.map((s, i) => `${i + 1}. [${s.title}](${s.url}) - ${s.reliability}`).join('\n')}
`;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${finalReport.title.toLowerCase().replace(/\s+/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <Card
        title={finalReport.title}
        subtitle={`${finalReport.wordCount} words • ${finalReport.sourcesUsed.length} sources`}
        headerAction={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        }
      >
        {/* Executive Summary */}
        <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <h4 className="text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">
            Executive Summary
          </h4>
          <p className="text-slate-300 leading-relaxed">{finalReport.executiveSummary}</p>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {finalReport.sections.map((section, index) => (
            <div key={index} className="border-b border-slate-800 pb-6 last:border-0">
              <h4 className="text-lg font-semibold text-white mb-3">{section.heading}</h4>
              <div className="prose prose-invert prose-sm max-w-none">
                <p className="text-slate-300 whitespace-pre-wrap">{section.content}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Sources */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <h4 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">
            Sources ({finalReport.sourcesUsed.length})
          </h4>
          <div className="space-y-2">
            {finalReport.sourcesUsed.map((source, index) => (
              <a
                key={index}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors group"
              >
                <span className="text-slate-500 font-mono text-sm">{index + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-blue-400 group-hover:text-blue-300 truncate">
                    {source.title}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{source.url}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  source.reliability === 'high' 
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : source.reliability === 'medium'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-slate-700 text-slate-400'
                }`}>
                  {source.reliability}
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* Confidence Assessment */}
        <div className="mt-6 p-4 bg-slate-800/30 rounded-lg">
          <h4 className="text-sm font-medium text-slate-400 mb-2">Confidence Assessment</h4>
          <p className="text-sm text-slate-300">{finalReport.confidenceAssessment}</p>
        </div>
      </Card>
    </motion.div>
  );
}
