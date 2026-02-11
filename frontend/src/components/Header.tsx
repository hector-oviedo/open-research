/**
 * Header - Layout Component
 * 
 * Isolated header component with logo and heartbeat indicator.
 * Follows atomic design principles - no nested div soup.
 */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Check, Laptop, Menu, Moon, Settings, Sun } from 'lucide-react';
import type { ResolvedThemeMode, ThemeMode } from '../hooks/useTheme';

interface HeaderProps {
  /** Whether the SSE connection is healthy */
  isConnected?: boolean;
  /** Callback when session history is clicked */
  onSessionsClick?: () => void;
  /** Callback when settings is clicked */
  onSettingsClick?: () => void;
  /** Theme selection mode */
  theme?: ThemeMode;
  /** Effective resolved theme */
  resolvedTheme?: ResolvedThemeMode;
  /** Set theme callback */
  onThemeChange?: (theme: ThemeMode) => void;
  /** Reset to new-query workspace */
  onLogoClick?: () => void;
}

/**
 * HeartbeatIndicator - Shows connection health with pulsing dot
 */
function HeartbeatIndicator({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-[hsl(var(--border)/0.7)] bg-[hsl(var(--card)/0.65)] px-3 py-1.5">
      <motion.div
        className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-emerald-400' : 'bg-red-400'
        }`}
        animate={
          isConnected
            ? {
                scale: [1, 1.2, 1],
                opacity: [1, 0.7, 1],
              }
            : {}
        }
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <span className={`text-xs font-medium ${
        isConnected ? 'text-emerald-400' : 'text-red-400'
      }`}>
        {isConnected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  );
}

/**
 * Logo - Brand identity component
 */
function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg p-1 text-left transition-colors hover:bg-[hsl(var(--secondary)/0.55)]"
      title="Start a new research"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400">
        <Activity className="w-5 h-5 text-white" />
      </div>
      <div>
        <span className="text-xl font-bold text-[hsl(var(--foreground))]">Deep Research System</span>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Multi-Agent AI Research System</p>
      </div>
    </button>
  );
}

/**
 * Header - Main navigation bar
 */
export function Header({
  isConnected = true,
  onSessionsClick,
  onSettingsClick,
  theme = 'system',
  resolvedTheme = 'dark',
  onThemeChange,
  onLogoClick,
}: HeaderProps) {
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isThemeMenuOpen) {
      return;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!themeMenuRef.current?.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isThemeMenuOpen]);

  const themeOptions: Array<{ value: ThemeMode; label: string; icon: typeof Laptop }> = [
    { value: 'system', label: 'System', icon: Laptop },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'light', label: 'Light', icon: Sun },
  ];

  const ThemeIcon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <header className="sticky top-0 z-50 border-b border-[hsl(var(--border)/0.6)] bg-[hsl(var(--background)/0.86)] backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          {onSessionsClick && (
            <button
              onClick={onSessionsClick}
              className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]"
              title="Open session history"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <Logo onClick={onLogoClick} />
        </div>

        {/* Right: Heartbeat, Theme, Settings */}
        <div className="flex items-center gap-4">
          <HeartbeatIndicator isConnected={isConnected} />
          {onThemeChange && (
            <div className="relative" ref={themeMenuRef}>
              <button
                onClick={() => setIsThemeMenuOpen((current) => !current)}
                className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]"
                title={`Theme: ${theme}`}
              >
                <ThemeIcon className="h-5 w-5" />
              </button>
              {isThemeMenuOpen && (
                <div className="absolute right-0 top-12 z-50 w-40 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1 shadow-xl">
                  {themeOptions.map((option) => {
                    const OptionIcon = option.icon;
                    const isSelected = option.value === theme;
                    return (
                      <button
                        key={option.value}
                        onClick={() => {
                          onThemeChange(option.value);
                          setIsThemeMenuOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--secondary))]"
                      >
                        <span className="flex items-center gap-2">
                          <OptionIcon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                          {option.label}
                        </span>
                        {isSelected && <Check className="h-4 w-4 text-[hsl(var(--primary))]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
