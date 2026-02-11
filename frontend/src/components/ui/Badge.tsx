/**
 * Badge - Atomic UI Component
 * 
 * Status indicator with color variants.
 */
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'running';
  className?: string;
}

const variantStyles = {
  default: 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] border border-[hsl(var(--border))]',
  success: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30',
  warning: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30',
  error: 'bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30',
  info: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30',
  running: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30 animate-pulse',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`
      inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
      ${variantStyles[variant]}
      ${className}
    `}>
      {variant === 'running' && (
        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-1.5 animate-pulse" />
      )}
      {children}
    </span>
  );
}
