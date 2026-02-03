/**
 * ReportViewer - Feature Component
 * 
 * Displays the final research report with markdown rendering
 * and download functionality (Markdown + PDF).
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, FileCode, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { SourceViewer } from './SourceViewer';
import { useResearchStore } from '../stores/researchStore';

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
  const [showPdfPreview, setShowPdfPreview] = useState(false);

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
    // Open print dialog for PDF generation
    setShowPdfPreview(true);
    
    // Wait for render then print
    setTimeout(() => {
      window.print();
    }, 500);
  };

  // Clean markdown text for PDF
  const cleanText = (text: string) => {
    return text
      .replace(/\[🔗([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#/g, '');
  };

  return (
    <>
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

      {/* PDF Print Preview Modal */}
      {showPdfPreview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between print:hidden">
              <h3 className="text-lg font-semibold text-gray-900">PDF Preview</h3>
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={() => window.print()}>
                  <FileText className="w-4 h-4 mr-2" />
                  Print to PDF
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowPdfPreview(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* PDF Content - This is what gets printed */}
            <div className="p-8 md:p-12 bg-white text-black" id="pdf-content">
              {/* Title */}
              <h1 style={{ 
                fontSize: '28pt', 
                fontWeight: 'bold',
                marginBottom: '8pt',
                color: '#000',
                borderBottom: '2pt solid #333',
                paddingBottom: '12pt',
                fontFamily: 'Georgia, serif'
              }}>
                {title}
              </h1>

              {/* Metadata */}
              <p style={{ 
                fontSize: '10pt', 
                color: '#555',
                marginBottom: '24pt',
                fontStyle: 'italic',
                fontFamily: 'Georgia, serif'
              }}>
                Research Report | {new Date().toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })} | {word_count} words | {sources_used.length} sources
              </p>

              {/* Executive Summary */}
              <div style={{ marginBottom: '24pt' }}>
                <h2 style={{ 
                  fontSize: '16pt', 
                  fontWeight: 'bold',
                  marginBottom: '12pt',
                  color: '#000',
                  fontFamily: 'Georgia, serif'
                }}>
                  Executive Summary
                </h2>
                <div style={{ 
                  fontSize: '11pt',
                  lineHeight: '1.6',
                  textAlign: 'justify',
                  fontFamily: 'Georgia, serif'
                }}>
                  {executive_summary.split('\n').filter(p => p.trim()).map((paragraph, idx) => (
                    <p key={idx} style={{ marginBottom: '8pt', textIndent: '0' }}>
                      {cleanText(paragraph)}
                    </p>
                  ))}
                </div>
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
                    fontFamily: 'Georgia, serif',
                    borderLeft: '3pt solid #333',
                    paddingLeft: '10pt'
                  }}>
                    {index + 1}. {section.heading}
                  </h3>
                  <div style={{ 
                    fontSize: '11pt',
                    lineHeight: '1.6',
                    textAlign: 'justify',
                    fontFamily: 'Georgia, serif'
                  }}>
                    {section.content.split('\n\n').filter(p => p.trim()).map((paragraph, pidx) => (
                      <p key={pidx} style={{ marginBottom: '8pt' }}>
                        {cleanText(paragraph)}
                      </p>
                    ))}
                  </div>
                </div>
              ))}

              {/* Page break before references */}
              <div style={{ pageBreakBefore: 'always' }}>
                <h2 style={{ 
                  fontSize: '16pt', 
                  fontWeight: 'bold',
                  marginBottom: '16pt',
                  color: '#000',
                  fontFamily: 'Georgia, serif'
                }}>
                  References
                </h2>

                <div style={{ fontSize: '10pt', fontFamily: 'Georgia, serif' }}>
                  {sources_used.map((source, index) => (
                    <div key={index} style={{ 
                      marginBottom: '12pt',
                      paddingLeft: '20pt',
                      textIndent: '-20pt'
                    }}>
                      <span style={{ fontWeight: 'bold' }}>{index + 1}.</span>
                      {' '}
                      <span style={{ fontWeight: 'bold' }}>{source.title || 'Untitled'}</span>
                      {' '}
                      <span style={{ 
                        fontStyle: 'italic',
                        color: source.reliability === 'high' ? '#28a745' : 
                               source.reliability === 'medium' ? '#856404' : '#6c757d'
                      }}>
                        [{source.reliability || 'unknown'}]
                      </span>
                      <br />
                      <span style={{ color: '#0066cc' }}>{source.url}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Confidence Assessment */}
              <div style={{ marginTop: '24pt' }}>
                <h2 style={{ 
                  fontSize: '16pt', 
                  fontWeight: 'bold',
                  marginBottom: '12pt',
                  color: '#000',
                  fontFamily: 'Georgia, serif'
                }}>
                  Confidence Assessment
                </h2>
                <div style={{ 
                  fontSize: '11pt',
                  lineHeight: '1.6',
                  textAlign: 'justify',
                  fontFamily: 'Georgia, serif'
                }}>
                  {confidence_assessment.split('\n').filter(p => p.trim()).map((paragraph, idx) => (
                    <p key={idx} style={{ marginBottom: '8pt' }}>
                      {cleanText(paragraph)}
                    </p>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div style={{ 
                marginTop: '40pt',
                paddingTop: '12pt',
                borderTop: '1pt solid #ccc',
                fontSize: '8pt',
                color: '#666',
                textAlign: 'center',
                fontFamily: 'Georgia, serif'
              }}>
                Generated by Deep Research System
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #pdf-content, #pdf-content * {
            visibility: visible;
          }
          #pdf-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20mm !important;
          }
        }
      `}</style>
    </>
  );
}
