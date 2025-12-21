'use client';

/**
 * Phase Timeline Component
 * Displays phase-based code generation progress
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Circle, Loader2, XCircle, Code, Settings, Eye, Wrench } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface Phase {
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  filesGenerated?: string[];
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface PhaseTimelineProps {
  phases: Phase[];
  currentPhase?: string;
  progress: number;
  className?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getPhaseIcon(status: Phase['status'], isActive: boolean) {
  if (status === 'completed') {
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  }
  if (status === 'failed') {
    return <XCircle className="w-5 h-5 text-red-500" />;
  }
  if (status === 'in_progress' || isActive) {
    return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
  }
  return <Circle className="w-5 h-5 text-gray-400" />;
}

function getPhaseTypeIcon(name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('setup') || lowerName.includes('config')) {
    return <Settings className="w-4 h-4" />;
  }
  if (lowerName.includes('ui') || lowerName.includes('frontend') || lowerName.includes('view')) {
    return <Eye className="w-4 h-4" />;
  }
  if (lowerName.includes('fix') || lowerName.includes('debug')) {
    return <Wrench className="w-4 h-4" />;
  }
  return <Code className="w-4 h-4" />;
}

function formatDuration(start?: Date, end?: Date): string {
  if (!start) return '';
  const endTime = end || new Date();
  const duration = endTime.getTime() - start.getTime();
  const seconds = Math.floor(duration / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PhaseTimeline({ phases, currentPhase, progress, className = '' }: PhaseTimelineProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-1">
        <AnimatePresence mode="popLayout">
          {phases.map((phase, index) => {
            const isActive = phase.name === currentPhase || phase.status === 'in_progress';
            const isLast = index === phases.length - 1;

            return (
              <motion.div
                key={phase.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="relative"
              >
                {/* Connection line */}
                {!isLast && (
                  <div
                    className={`absolute left-[9px] top-8 w-0.5 h-full -mb-1 ${
                      phase.status === 'completed'
                        ? 'bg-green-500'
                        : phase.status === 'failed'
                        ? 'bg-red-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                )}

                {/* Phase item */}
                <div
                  className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                      : phase.status === 'completed'
                      ? 'bg-green-50/50 dark:bg-green-900/10'
                      : phase.status === 'failed'
                      ? 'bg-red-50/50 dark:bg-red-900/10'
                      : ''
                  }`}
                >
                  {/* Status icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getPhaseIcon(phase.status, isActive)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400">
                        {getPhaseTypeIcon(phase.name)}
                      </span>
                      <h4
                        className={`font-medium truncate ${
                          isActive
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        {phase.name}
                      </h4>
                      {phase.startedAt && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDuration(phase.startedAt, phase.completedAt)}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                      {phase.description}
                    </p>

                    {/* Files generated */}
                    {phase.filesGenerated && phase.filesGenerated.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {phase.filesGenerated.slice(0, 3).map((file) => (
                          <span
                            key={file}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                          >
                            <Code className="w-3 h-3 mr-1" />
                            {file.split('/').pop()}
                          </span>
                        ))}
                        {phase.filesGenerated.length > 3 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            +{phase.filesGenerated.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Error message */}
                    {phase.error && (
                      <div className="mt-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">
                        {phase.error}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {phases.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Code className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No phases yet</p>
          <p className="text-sm">Start generation to see progress</p>
        </div>
      )}
    </div>
  );
}

export default PhaseTimeline;





