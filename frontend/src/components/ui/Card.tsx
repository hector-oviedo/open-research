/**
 * Card - Atomic UI Component
 * 
 * Container component with glass effect.
 */
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  headerAction?: ReactNode;
}

export function Card({ children, className = '', title, subtitle, headerAction }: CardProps) {
  return (
    <div className={`
      glass rounded-xl overflow-hidden flex flex-col
      ${className}
    `}>
      {(title || headerAction) && (
        <div className="flex items-center justify-between border-b border-[hsl(var(--border)/0.7)] px-3 py-2.5 sm:px-6 sm:py-4">
          <div>
            {title && <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] sm:text-lg">{title}</h3>}
            {subtitle && <p className="text-[11px] text-[hsl(var(--muted-foreground))] sm:text-sm">{subtitle}</p>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="p-2.5 sm:p-6 flex-1 min-h-0">{children}</div>
    </div>
  );
}
