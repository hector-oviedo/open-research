/**
 * ResultScreen
 *
 * Dedicated full-screen view for the final report.
 */
import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, FileSearch } from 'lucide-react';
import { useResearchStore } from '../stores/researchStore';

interface ResultScreenProps {
  onBack: () => void;
}

const ReportViewer = lazy(async () => {
  const module = await import('../components/ReportViewer');
  return { default: module.ReportViewer };
});

export function ResultScreen({ onBack }: ResultScreenProps) {
  const { query, finalReport } = useResearchStore();

  if (!finalReport) {
    return null;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 rounded-xl border border-[hsl(var(--border)/0.7)] bg-[hsl(var(--card)/0.68)] px-4 py-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Result Screen</p>
            <h1 className="mt-1 text-lg font-semibold text-[hsl(var(--foreground))]">Research Report</h1>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{query}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-300">
              <FileSearch className="h-3.5 w-3.5" />
              {finalReport.word_count} words
            </span>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/0.85)] px-3 py-2 text-sm text-[hsl(var(--foreground))] transition-colors hover:border-blue-400/60"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Workspace
            </button>
          </div>
        </div>
      </motion.section>

      <Suspense
        fallback={
          <div className="rounded-xl border border-[hsl(var(--border)/0.7)] bg-[hsl(var(--card)/0.68)] px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">
            Rendering report...
          </div>
        }
      >
        <ReportViewer />
      </Suspense>
    </main>
  );
}
