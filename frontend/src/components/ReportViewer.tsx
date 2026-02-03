/**
 * ReportViewer - Feature Component
 * 
 * Displays the final research report with markdown rendering
 * and download functionality (Markdown + PDF).
 */
import { motion } from 'framer-motion';
import { FileText, FileCode } from 'lucide-react';
import jsPDF from 'jspdf';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { SourceViewer } from './SourceViewer';
import { useResearchStore } from '../stores/researchStore';

export function ReportViewer() {
  const { finalReport, status } = useResearchStore();

  if (!finalReport || status !== 'completed') return null;

  // Safety checks for report data - using snake_case from backend
  const title = finalReport.title || 'Untitled Report';
  const word_count = finalReport.word_count || 0;
  const sources_used = finalReport.sources_used || [];
  const sections = finalReport.sections || [];
  const executive_summary = finalReport.executive_summary || '';
  const confidence_assessment = finalReport.confidence_assessment || '';

  const handleDownloadMarkdown = () => {
    const markdown = `# ${finalReport.title}

${finalReport.executive_summary}

## Report Details

**Word Count:** ${finalReport.word_count}
**Sources Used:** ${sources_used.length}
**Confidence:** ${finalReport.confidence_assessment}

${finalReport.sections.map(s => `
## ${s.heading}

${s.content}
`).join('\n')}

## Sources

${sources_used.map((s, i) => `${i + 1}. [${s.title || 'Untitled'}](${s.url}) - ${s.reliability || 'unknown'}`).join('\n')}
`;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    // Title
    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.text(title, margin, y);
    y += 15;

    // Metadata
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Word Count: ${word_count} | Sources: ${sources_used.length}`, margin, y);
    y += 10;

    // Executive Summary
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Executive Summary', margin, y);
    y += 8;
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    const summaryLines = doc.splitTextToSize(executive_summary, maxWidth);
    doc.text(summaryLines, margin, y);
    y += summaryLines.length * 6 + 10;

    // Sections
    sections.forEach((section) => {
      // Check if we need a new page
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(section.heading, margin, y);
      y += 8;

      doc.setFontSize(11);
      doc.setTextColor(50, 50, 50);
      const contentLines = doc.splitTextToSize(section.content, maxWidth);
      doc.text(contentLines, margin, y);
      y += contentLines.length * 6 + 10;
    });

    // Sources
    if (y > 220) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`Sources (${sources_used.length})`, margin, y);
    y += 10;

    doc.setFontSize(10);
    sources_used.forEach((source, index) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.setTextColor(50, 50, 50);
      const sourceText = `${index + 1}. ${source.title || 'Untitled'} (${source.reliability || 'unknown'})`;
      const sourceLines = doc.splitTextToSize(sourceText, maxWidth);
      doc.text(sourceLines, margin, y);
      y += sourceLines.length * 5 + 3;
      
      doc.setTextColor(100, 100, 100);
      const urlLines = doc.splitTextToSize(source.url, maxWidth);
      doc.text(urlLines, margin + 5, y);
      y += urlLines.length * 4 + 5;
    });

    doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <Card
        title={title}
        subtitle={`${word_count} words • ${sources_used.length} sources`}
        headerAction={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleDownloadPDF}>
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button variant="secondary" size="sm" onClick={handleDownloadMarkdown}>
              <FileCode className="w-4 h-4 mr-2" />
              Markdown
            </Button>
          </div>
        }
      >
        {/* Executive Summary */}
        <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <h4 className="text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">
            Executive Summary
          </h4>
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {executive_summary}
            </ReactMarkdown>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((section, index) => (
            <div key={index} className="border-b border-slate-800 pb-6 last:border-0">
              <h4 className="text-lg font-semibold text-white mb-3">{section.heading}</h4>
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {section.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>

        {/* Sources */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <SourceViewer sources={sources_used} />
        </div>

        {/* Confidence Assessment */}
        <div className="mt-6 p-4 bg-slate-800/30 rounded-lg">
          <h4 className="text-sm font-medium text-slate-400 mb-2">Confidence Assessment</h4>
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {confidence_assessment}
            </ReactMarkdown>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
