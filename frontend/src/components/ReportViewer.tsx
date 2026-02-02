/**
 * ReportViewer - Feature Component
 * 
 * Displays the final research report with markdown rendering
 * and download functionality (Markdown + PDF).
 */
import { motion } from 'framer-motion';
import { FileText, FileCode } from 'lucide-react';
import jsPDF from 'jspdf';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { SourceViewer } from './SourceViewer';
import { useResearchStore } from '../stores/researchStore';

export function ReportViewer() {
  const { finalReport, status } = useResearchStore();

  if (!finalReport || status !== 'completed') return null;

  const handleDownloadMarkdown = () => {
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

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    // Title
    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.text(finalReport.title, margin, y);
    y += 15;

    // Metadata
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Word Count: ${finalReport.wordCount} | Sources: ${finalReport.sourcesUsed.length}`, margin, y);
    y += 10;

    // Executive Summary
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Executive Summary', margin, y);
    y += 8;
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    const summaryLines = doc.splitTextToSize(finalReport.executiveSummary, maxWidth);
    doc.text(summaryLines, margin, y);
    y += summaryLines.length * 6 + 10;

    // Sections
    finalReport.sections.forEach((section) => {
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
    doc.text(`Sources (${finalReport.sourcesUsed.length})`, margin, y);
    y += 10;

    doc.setFontSize(10);
    finalReport.sourcesUsed.forEach((source, index) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.setTextColor(50, 50, 50);
      const sourceText = `${index + 1}. ${source.title} (${source.reliability})`;
      const sourceLines = doc.splitTextToSize(sourceText, maxWidth);
      doc.text(sourceLines, margin, y);
      y += sourceLines.length * 5 + 3;
      
      doc.setTextColor(100, 100, 100);
      const urlLines = doc.splitTextToSize(source.url, maxWidth);
      doc.text(urlLines, margin + 5, y);
      y += urlLines.length * 4 + 5;
    });

    doc.save(`${finalReport.title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
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
          <SourceViewer sources={finalReport.sourcesUsed} />
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
