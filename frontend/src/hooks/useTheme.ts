/**
 * useTheme
 *
 * Global light/dark theme state with local persistence.
 */
import { useEffect, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'deep-research-theme';

function getSystemTheme(): ResolvedThemeMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveInitialTheme(): ThemeMode {
  const savedTheme = window.localStorage.getItem(STORAGE_KEY);
  if (savedTheme === 'system' || savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }
  return 'system';
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(resolveInitialTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedThemeMode>(getSystemTheme);

  useEffect(() => {
    const applyTheme = () => {
      const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
      setResolvedTheme(effectiveTheme);
      document.documentElement.classList.toggle('dark', effectiveTheme === 'dark');
    };

    applyTheme();
    window.localStorage.setItem(STORAGE_KEY, theme);

    if (theme !== 'system') {
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onThemeChange = () => applyTheme();
    media.addEventListener('change', onThemeChange);
    return () => media.removeEventListener('change', onThemeChange);
  }, [theme]);

  return {
    theme,
    resolvedTheme,
    setTheme,
  };
}
