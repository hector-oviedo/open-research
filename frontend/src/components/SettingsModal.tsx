/**
 * SettingsModal - Feature Component
 * 
 * Modal for configuring research parameters.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings2 } from 'lucide-react';
import { Button } from './ui/Button';

export interface ResearchSettings {
  maxSources: number;
  maxIterations: number;
  sourceDiversity: boolean;
  reportLength: 'short' | 'medium' | 'long';
}

const defaultSettings: ResearchSettings = {
  maxSources: 10,
  maxIterations: 3,
  sourceDiversity: true,
  reportLength: 'medium',
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: ResearchSettings) => void;
  initialSettings?: ResearchSettings;
}

export function SettingsModal({ isOpen, onClose, onSave, initialSettings }: SettingsModalProps) {
  const [settings, setSettings] = useState<ResearchSettings>(initialSettings || defaultSettings);

  // Reset settings when modal opens
  useEffect(() => {
    if (isOpen) {
      setSettings(initialSettings || defaultSettings);
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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <div className="w-full max-w-md bg-[#13131f] border border-slate-700 rounded-2xl shadow-2xl pointer-events-auto overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                  <Settings2 className="w-5 h-5 text-blue-400" />
                  <h2 className="text-lg font-semibold text-white">Research Settings</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Max Sources */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-300">
                      Max Sources
                    </label>
                    <span className="text-sm text-blue-400 font-mono">
                      {settings.maxSources}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="20"
                    value={settings.maxSources}
                    onChange={(e) => setSettings(s => ({ ...s, maxSources: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>5</span>
                    <span>20</span>
                  </div>
                </div>

                {/* Max Iterations */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-300">
                      Max Iterations
                    </label>
                    <span className="text-sm text-blue-400 font-mono">
                      {settings.maxIterations}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={settings.maxIterations}
                    onChange={(e) => setSettings(s => ({ ...s, maxIterations: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>1 (faster)</span>
                    <span>5 (thorough)</span>
                  </div>
                </div>

                {/* Source Diversity */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-slate-300 block">
                      Source Diversity
                    </label>
                    <span className="text-xs text-slate-500">
                      Max 2 sources per domain
                    </span>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, sourceDiversity: !s.sourceDiversity }))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.sourceDiversity ? 'bg-blue-500' : 'bg-slate-700'
                    }`}
                  >
                    <motion.div
                      className="absolute top-1 w-4 h-4 rounded-full bg-white"
                      animate={{ left: settings.sourceDiversity ? '28px' : '4px' }}
                      transition={{ duration: 0.2 }}
                    />
                  </button>
                </div>

                {/* Report Length */}
                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-2">
                    Report Length
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['short', 'medium', 'long'] as const).map((length) => (
                      <button
                        key={length}
                        onClick={() => setSettings(s => ({ ...s, reportLength: length }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          settings.reportLength === length
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {length.charAt(0).toUpperCase() + length.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700/50 bg-slate-800/30">
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  Save Settings
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
