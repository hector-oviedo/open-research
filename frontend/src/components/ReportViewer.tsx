/**
 * ReportViewer - Feature Component
 * 
 * Displays the final research report with markdown rendering
 * and download functionality (Markdown + PDF).
 */
import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { FileText, FileCode } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { SourceViewer } from './SourceViewer';
import { useResearchStore } from '../stores/researchStore';
import html2pdf from 'html2pdf.js';

// Custom link component that opens in new tab
const MarkdownLink = ({ href, children }: { href?: string; children?: React.ReactNode }) => {
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      className="text-blue-400 hover:text-blue-300 hover:underline"
    >
      {children}
    </a>
  );
};

export function ReportViewer() {
  const { finalReport, status } = useResearchStore();
  const pdfRef = useRef<HTMLDivElement>(null);

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

  const handleDownloadPDF = async () => {
    if (!pdfRef.current) return;

    const opt = {
      margin: [15, 15, 15, 15],
      filename: `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        letterRendering: true,
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait',
      },
    };

    try {
      await html2pdf().set(opt).from(pdfRef.current).save();
    } catch (error) {
      console.error('PDF generation failed:', error);
    }
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
        {/* Hidden PDF content - rendered in light mode for printing */}
        <div 
          ref={pdfRef} 
          style={{ 
            position: 'absolute', 
            left: '-9999px',
            width: '210mm',
            padding: '15mm',
            background: 'white',
            color: 'black',
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: '11pt',
            lineHeight: '1.6',
          }}
        >
          {/* PDF Title */}
          <h1 style={{ 
            fontSize: '24pt', 
            fontWeight: 'bold', 
            marginBottom: '8pt',
            borderBottom: '2pt solid #333',
            paddingBottom: '8pt',
            color: '#000'
          }}>
            {title}
          </h1>
          
          {/* PDF Metadata */}
          <p style={{ 
            fontSize: '10pt', 
            color: '#555', 
            marginBottom: '20pt',
            fontStyle: 'italic'
          }}>
            Research Report | {new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })} | {word_count} words | {sources_used.length} sources
          </p>

          {/* Executive Summary */}
          <h2 style={{ 
            fontSize: '16pt', 
            fontWeight: 'bold', 
            marginTop: '20pt',
            marginBottom: '12pt',
            color: '#000'
          }}>
            Executive Summary
          </h2>
          <div style={{ 
            marginBottom: '20pt',
            textAlign: 'justify'
          }}>
            {executive_summary.split('\n').map((paragraph, idx) => (
              <p key={idx} style={{ marginBottom: '8pt' }}>
                {paragraph.replace(/\[🔗([^\]]+)\]\(([^)]+)\)/g, '$1')}
              </p>
            ))}
          </div>

          {/* Sections */}
          {sections.map((section, index) => (
            <div key={index} style={{ marginBottom: '20pt' }}>
              <h3 style={{ 
                fontSize: '14pt', 
                fontWeight: 'bold',
                marginTop: '16pt',
                marginBottom: '10pt',
                color: '#000',
                borderLeft: '3pt solid #333',
                paddingLeft: '8pt'
              }}>
                {index + 1}. {section.heading}
              </h3>
              <div style={{ textAlign: 'justify' }}>
                {section.content.split('\n\n').map((paragraph, pidx) => (
                  <p key={pidx} style={{ marginBottom: '8pt' }}>
                    {paragraph.replace(/\[🔗([^\]]+)\]\(([^)]+)\)/g, '$1')}
                  </p>
                ))}
              </div>
            </div>
          ))}

          {/* Sources */}
          <h2 style={{ 
            fontSize: '16pt', 
            fontWeight: 'bold', 
            marginTop: '24pt',
            marginBottom: '12pt',
            color: '#000',
            pageBreakBefore: 'always'
          }}>
            References
          </h2>
          <div style={{ fontSize: '10pt' }}>
            {sources_used.map((source, index) => (
              <div key={index} style={{ 
                marginBottom: '10pt',
                paddingLeft: '20pt',
                textIndent: '-20pt'
              }}>
                <span style={{ fontWeight: 'bold' }}>{index + 1}.</span>{' '}
                <span style={{ fontWeight: 'bold' }}>{source.title || 'Untitled'}</span>
                <span style={{ 
                  fontStyle: 'italic',
                  color: source.reliability === 'high' ? '#28a745' : 
                         source.reliability === 'medium' ? '#ffc107' : '#6c757d',
                  marginLeft: '5pt'
                }}>
                  [{source.reliability || 'unknown'}]
                </span>
                <br />
                <span style={{ color: '#0066cc' }}>{source.url}</span>
              </div>
            ))}
          </div>

          {/* Confidence Assessment */}
          <h2 style={{ 
            fontSize: '16pt', 
            fontWeight: 'bold', 
            marginTop: '24pt',
            marginBottom: '12pt',
            color: '#000'
          }}>
            Confidence Assessment
          </h2>
          <div style={{ textAlign: 'justify' }}>
            {confidence_assessment.split('\n').map((paragraph, idx) => (
              <p key={idx} style={{ marginBottom: '8pt' }}>
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        {/* Executive Summary */}
        <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <h4 className="text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">
            Executive Summary
          </h4>
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{ a: MarkdownLink }}
            >
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
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{ a: MarkdownLink }}
                >
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
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{ a: MarkdownLink }}
            >
              {confidence_assessment}
            </ReactMarkdown>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
