/**
 * AgentStatus - Feature Component
 * 
 * Visualizes the 5 agents with their current status.
 */
import { motion } from 'framer-motion';
import { useResearchStore } from '../stores/researchStore';
import { Brain, Search, FileText, CheckCircle, PenTool } from 'lucide-react';

const agentIcons = {
  Planner: Brain,
  Finder: Search,
  Summarizer: FileText,
  Reviewer: CheckCircle,
  Writer: PenTool,
};

interface AgentStatusProps {
  showTitle?: boolean;
}

export function AgentStatus({ showTitle = true }: AgentStatusProps) {
  const { agentStatus } = useResearchStore();

  return (
    <div className="w-full">
      {showTitle && (
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] sm:mb-4 sm:text-sm">
          Agent Pipeline
        </h3>
      )}
      <div className="flex flex-col gap-2 sm:gap-3">
        {agentStatus.map((agent, index) => {
          const Icon = agentIcons[agent.name as keyof typeof agentIcons];
          const isActive = agent.status === 'running';
          const isCompleted = agent.status === 'completed';
          const cardStyle = {
            borderColor: isActive || isCompleted ? `${agent.color}75` : 'hsl(var(--border) / 0.6)',
            boxShadow: isActive ? `0 0 0 1px ${agent.color}55, 0 8px 24px ${agent.color}22` : undefined,
          };
          
          return (
            <motion.div
              key={agent.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0, scale: isActive ? 1.01 : 1 }}
              transition={{ delay: index * 0.1 }}
              className={`
                relative flex items-center justify-center gap-2 overflow-hidden rounded-xl border-b-0 p-2 lg:justify-start lg:gap-4 lg:p-4
                border transition-all duration-300
                ${isActive 
                  ? 'bg-[hsl(var(--card)/0.98)]' 
                  : isCompleted
                    ? 'bg-[hsl(var(--card)/0.82)]'
                    : 'bg-[hsl(var(--card)/0.42)]'
                }
              `}
              style={cardStyle}
              title={agent.name}
            >
              {/* Status indicator */}
              <div className="relative">
                  <div
                    className={`
                    h-8 w-8 rounded-lg flex items-center justify-center lg:h-10 lg:w-10 lg:rounded-xl
                    transition-all duration-300
                    ${isActive ? 'animate-pulse' : ''}
                  `}
                  style={{ 
                    backgroundColor: isActive || isCompleted 
                      ? `${agent.color}20` 
                      : 'hsl(var(--secondary))',
                    border: `1px solid ${isActive || isCompleted ? agent.color : 'transparent'}`,
                  }}
                >
                  <Icon 
                    className="h-4 w-4 transition-colors duration-300 sm:h-5 sm:w-5"
                    style={{ color: isActive || isCompleted ? agent.color : 'hsl(var(--muted-foreground))' }}
                  />
                </div>
                
                {/* Connection line */}
                {index < agentStatus.length - 1 && (
                  <div 
                    className={`
                      absolute left-1/2 top-full w-0.5 h-3 -translate-x-1/2 mt-1
                      transition-colors duration-500
                    `}
                    style={{ 
                      backgroundColor: isCompleted ? agent.color : 'hsl(var(--border))'
                    }}
                  />
                )}
              </div>

              {/* Agent info */}
              <div className="hidden flex-1 lg:block">
                <div className="flex items-center gap-2">
                  <span className={`
                    text-xs font-medium transition-colors duration-300 lg:text-base
                    ${isActive || isCompleted ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}
                  `}>
                    {agent.name}
                  </span>
                  {isActive && (
                    <span className="rounded-full px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300 animate-pulse" style={{ backgroundColor: `${agent.color}22` }}>
                      Running
                    </span>
                  )}
                  {isCompleted && (
                    <span className="rounded-full px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300" style={{ backgroundColor: `${agent.color}20` }}>
                      Done
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] lg:text-sm">{agent.description}</p>
              </div>

              {/* Processing loop animation for active agent */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden bg-[hsl(var(--border))]">
                  <motion.div
                    className="h-full"
                    style={{ backgroundColor: agent.color }}
                    initial={{ x: '-100%', opacity: 0.7 }}
                    animate={{ x: '100%', opacity: 1 }}
                    transition={{ 
                      duration: 1.5, 
                      ease: 'easeInOut',
                      repeat: Infinity,
                      repeatType: 'loop'
                    }}
                  />
                </div>
              )}
              {isCompleted && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-1"
                  style={{ backgroundColor: `${agent.color}66` }}
                />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
