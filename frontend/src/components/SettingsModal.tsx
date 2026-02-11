/**
 * SettingsModal
 *
 * Controls per-session research runtime options.
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Settings2, X } from 'lucide-react';
import type { ResearchOptions } from '../types';
import { Button } from './ui/Button';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: ResearchOptions) => void;
  initialSettings: ResearchOptions;
}

interface SliderFieldProps {
  label: string;
  description: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}

function SliderField({
  label,
  description,
  min,
  max,
  value,
  onChange,
}: SliderFieldProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-[hsl(var(--foreground))]">{label}</label>
        <span className="rounded-md bg-blue-500/15 px-2 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
          {value}
        </span>
      </div>
      <p className="mb-2 text-xs text-[hsl(var(--muted-foreground))]">{description}</p>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full cursor-pointer accent-blue-500"
      />
      <div className="mt-1 flex justify-between text-[11px] text-[hsl(var(--muted-foreground))]">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function ToggleField({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border)/0.7)] bg-[hsl(var(--secondary)/0.55)] px-4 py-3">
      <div>
        <label className="block text-sm font-medium text-[hsl(var(--foreground))]">{label}</label>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-6 w-12 rounded-full transition-colors ${
          value ? 'bg-blue-500' : 'bg-[hsl(var(--input))]'
        }`}
      >
        <motion.span
          className="absolute top-1 h-4 w-4 rounded-full bg-white"
          animate={{ left: value ? '28px' : '4px' }}
          transition={{ duration: 0.2 }}
        />
      </button>
    </div>
  );
}

export function SettingsModal({
  isOpen,
  onClose,
  onSave,
  initialSettings,
}: SettingsModalProps) {
  const [settings, setSettings] = useState<ResearchOptions>(initialSettings);

  useEffect(() => {
    if (isOpen) {
      setSettings(initialSettings);
    }
  }, [isOpen, initialSettings]);

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.section
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="pointer-events-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-[hsl(var(--border)/0.7)] bg-[hsl(var(--card))] shadow-2xl">
              <header className="flex items-center justify-between border-b border-[hsl(var(--border)/0.65)] px-6 py-4">
                <div className="flex items-center gap-3">
                  <Settings2 className="h-5 w-5 text-blue-400" />
                  <div>
                    <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Research Settings</h2>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Tune depth, source coverage, and session memory.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="grid gap-6 p-6 md:grid-cols-2">
                <SliderField
                  label="Max Iterations"
                  description="Reviewer/planner loop depth."
                  min={1}
                  max={10}
                  value={settings.maxIterations}
                  onChange={(maxIterations) => setSettings((current) => ({ ...current, maxIterations }))}
                />
                <SliderField
                  label="Max Sources"
                  description="Global source cap across the session."
                  min={3}
                  max={40}
                  value={settings.maxSources}
                  onChange={(maxSources) => setSettings((current) => ({ ...current, maxSources }))}
                />
                <SliderField
                  label="Sources / Question"
                  description="Cap per sub-question for source selection."
                  min={1}
                  max={12}
                  value={settings.maxSourcesPerQuestion}
                  onChange={(maxSourcesPerQuestion) =>
                    setSettings((current) => ({ ...current, maxSourcesPerQuestion }))
                  }
                />
                <SliderField
                  label="Search Results / Query"
                  description="Raw hits fetched for each finder query."
                  min={1}
                  max={15}
                  value={settings.searchResultsPerQuery}
                  onChange={(searchResultsPerQuery) =>
                    setSettings((current) => ({ ...current, searchResultsPerQuery }))
                  }
                />
                <SliderField
                  label="Summarizer Source Limit"
                  description="How many sources are deeply analyzed."
                  min={1}
                  max={20}
                  value={settings.summarizerSourceLimit}
                  onChange={(summarizerSourceLimit) =>
                    setSettings((current) => ({ ...current, summarizerSourceLimit }))
                  }
                />
                <SliderField
                  label="Session Memory Limit"
                  description="How many prior sessions are used as context."
                  min={0}
                  max={8}
                  value={settings.sessionMemoryLimit}
                  onChange={(sessionMemoryLimit) =>
                    setSettings((current) => ({ ...current, sessionMemoryLimit }))
                  }
                />
              </div>

              <div className="space-y-3 px-6 pb-2">
                <ToggleField
                  label="Source Diversity"
                  description="Restrict repeated domains and broaden perspective."
                  value={settings.sourceDiversity}
                  onChange={(sourceDiversity) => setSettings((current) => ({ ...current, sourceDiversity }))}
                />
                <ToggleField
                  label="Session Memory"
                  description="Use recent completed sessions to improve planning."
                  value={settings.includeSessionMemory}
                  onChange={(includeSessionMemory) =>
                    setSettings((current) => ({ ...current, includeSessionMemory }))
                  }
                />
              </div>

              <div className="px-6 pb-6 pt-4">
                <label className="mb-2 block text-sm font-medium text-[hsl(var(--foreground))]">Report Length</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['short', 'medium', 'long'] as const).map((length) => (
                    <button
                      key={length}
                      type="button"
                      onClick={() => setSettings((current) => ({ ...current, reportLength: length }))}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        settings.reportLength === length
                          ? 'border-blue-500 bg-blue-500/20 text-blue-700 dark:text-blue-200'
                          : 'border-[hsl(var(--border))] bg-[hsl(var(--secondary)/0.55)] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--foreground)/0.25)]'
                      }`}
                    >
                      {length.charAt(0).toUpperCase() + length.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <footer className="flex items-center justify-end gap-3 border-t border-[hsl(var(--border)/0.65)] bg-[hsl(var(--secondary)/0.35)] px-6 py-4">
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Apply Settings</Button>
              </footer>
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}
