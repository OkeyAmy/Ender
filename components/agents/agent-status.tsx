'use client';

/**
 * Agent Status Component
 * Displays real-time status of the multi-agent system
 */

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, 
  Code, 
  Bug, 
  CheckSquare, 
  Hammer,
  Activity,
  Loader2,
  Pause,
  Play,
  AlertTriangle
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type AgentType = 'orchestrator' | 'codegen' | 'debug' | 'review' | 'build';

export interface AgentInfo {
  type: AgentType;
  status: 'idle' | 'active' | 'waiting' | 'error';
  message?: string;
  lastActivity?: Date;
}

export interface AgentStatusProps {
  agents: AgentInfo[];
  isGenerating: boolean;
  isDebugging: boolean;
  onStart?: () => void;
  onStop?: () => void;
  className?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getAgentIcon(type: AgentType) {
  switch (type) {
    case 'orchestrator':
      return Brain;
    case 'codegen':
      return Code;
    case 'debug':
      return Bug;
    case 'review':
      return CheckSquare;
    case 'build':
      return Hammer;
    default:
      return Activity;
  }
}

function getAgentName(type: AgentType): string {
  switch (type) {
    case 'orchestrator':
      return 'Orchestrator';
    case 'codegen':
      return 'Code Generator';
    case 'debug':
      return 'Debugger';
    case 'review':
      return 'Reviewer';
    case 'build':
      return 'Build Agent';
    default:
      return type;
  }
}

function getStatusColor(status: AgentInfo['status']): string {
  switch (status) {
    case 'active':
      return 'text-green-500 bg-green-100 dark:bg-green-900/30';
    case 'waiting':
      return 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30';
    case 'error':
      return 'text-red-500 bg-red-100 dark:bg-red-900/30';
    default:
      return 'text-gray-400 bg-gray-100 dark:bg-gray-800';
  }
}

function formatLastActivity(date?: Date): string {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

// ============================================================================
// AGENT CARD COMPONENT
// ============================================================================

function AgentCard({ agent }: { agent: AgentInfo }) {
  const Icon = getAgentIcon(agent.type);
  const statusColor = getStatusColor(agent.status);
  const isActive = agent.status === 'active';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`p-3 rounded-lg border transition-all ${
        isActive
          ? 'border-green-300 dark:border-green-700 shadow-sm'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Icon with status indicator */}
        <div className={`p-2 rounded-lg ${statusColor}`}>
          <Icon className="w-5 h-5" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {getAgentName(agent.type)}
            </span>
            {isActive && (
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-green-500"
              />
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {agent.message || (isActive ? 'Processing...' : 'Idle')}
          </p>
        </div>

        {/* Last activity */}
        {agent.lastActivity && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatLastActivity(agent.lastActivity)}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AgentStatus({
  agents,
  isGenerating,
  isDebugging,
  onStart,
  onStop,
  className = '',
}: AgentStatusProps) {
  const activeAgents = agents.filter(a => a.status === 'active').length;
  const hasError = agents.some(a => a.status === 'error');
  const isRunning = isGenerating || isDebugging;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isRunning ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
            <Activity className={`w-5 h-5 ${isRunning ? 'text-blue-500' : 'text-gray-400'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Agent System
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isRunning 
                ? `${activeAgents} agent${activeAgents !== 1 ? 's' : ''} active`
                : 'System idle'}
            </p>
          </div>
        </div>

        {/* Control button */}
        {(onStart || onStop) && (
          <button
            onClick={isRunning ? onStop : onStart}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isRunning
                ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4" />
                Stop
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start
              </>
            )}
          </button>
        )}
      </div>

      {/* Status indicator */}
      {isRunning && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            {isGenerating ? 'Generating code...' : 'Debugging...'}
          </span>
        </div>
      )}

      {/* Error indicator */}
      {hasError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700 dark:text-red-300">
            Some agents encountered errors
          </span>
        </div>
      )}

      {/* Agent cards */}
      <div className="grid gap-2">
        {agents.map((agent) => (
          <AgentCard key={agent.type} agent={agent} />
        ))}
      </div>

      {/* Empty state */}
      {agents.length === 0 && (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No agents initialized</p>
        </div>
      )}
    </div>
  );
}

export default AgentStatus;





