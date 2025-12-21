/**
 * Phase Manager
 * Handles phase-based code generation workflow
 */

import { AgentStateManager } from './agent-state-manager';
import {
  PhaseConcept,
  PhaseState,
  FileState,
  CurrentDevState,
  PhaseGenerationArgs,
  Blueprint,
} from './types';
import { v4 as uuidv4 } from 'uuid';

const MAX_PHASES = 12;

export interface PhaseResult {
  success: boolean;
  phase: PhaseState;
  filesGenerated: FileState[];
  errors: string[];
}

export interface PhaseExecutionContext {
  stateManager: AgentStateManager;
  blueprint: Blueprint;
  currentPhaseIndex: number;
}

/**
 * PhaseManager - Orchestrates phase-based code generation
 */
export class PhaseManager {
  private stateManager: AgentStateManager;

  constructor(stateManager: AgentStateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Get the next phase to execute based on current state
   */
  async getNextPhase(): Promise<PhaseConcept | null> {
    const state = await this.stateManager.getCachedState();
    if (!state || !state.blueprint) return null;

    const completedPhases = state.generatedPhases.filter(p => p.completed);
    const roadmap = state.blueprint.implementationRoadmap;

    // Check if all phases are complete
    if (completedPhases.length >= roadmap.length || state.phasesCounter >= MAX_PHASES) {
      return null;
    }

    // Check if there's a current incomplete phase
    if (state.currentPhase && !this.isPhaseComplete(state, state.currentPhase)) {
      return state.currentPhase;
    }

    // Get next phase from roadmap
    const nextPhaseIndex = completedPhases.length;
    if (nextPhaseIndex >= roadmap.length) {
      return null;
    }

    const nextRoadmapPhase = roadmap[nextPhaseIndex];
    
    // For the initial phase, use the blueprint's initial phase
    if (nextPhaseIndex === 0 && state.blueprint.initialPhase) {
      return state.blueprint.initialPhase;
    }

    // Create a phase concept from roadmap
    return {
      name: nextRoadmapPhase.phase,
      description: nextRoadmapPhase.description,
      files: [],
      lastPhase: nextPhaseIndex === roadmap.length - 1,
    };
  }

  /**
   * Start executing a phase
   */
  async startPhase(phase: PhaseConcept): Promise<void> {
    await this.stateManager.updateState({
      $set: {
        currentPhase: phase,
        currentDevState: CurrentDevState.PHASE_GENERATING,
      },
    });
  }

  /**
   * Mark current phase as implementing
   */
  async setPhaseImplementing(): Promise<void> {
    await this.stateManager.setDevState(CurrentDevState.PHASE_IMPLEMENTING);
  }

  /**
   * Complete the current phase
   */
  async completePhase(filesGenerated: string[], errors: string[] = []): Promise<PhaseState | null> {
    const state = await this.stateManager.getCachedState();
    if (!state || !state.currentPhase) return null;

    const completedPhase: PhaseState = {
      ...state.currentPhase,
      completed: true,
      startedAt: state.currentPhase.startedAt || new Date(),
      completedAt: new Date(),
      filesGenerated,
      errors,
    };

    await this.stateManager.addPhase(completedPhase);
    
    // Clear current phase and set state
    await this.stateManager.updateState({
      $set: {
        currentPhase: undefined,
        currentDevState: CurrentDevState.IDLE,
      },
    });

    return completedPhase;
  }

  /**
   * Create a phase from generation args
   */
  createPhaseFromArgs(args: PhaseGenerationArgs): PhaseConcept {
    return {
      name: args.phaseName,
      description: args.phaseDescription,
      files: args.files,
      lastPhase: false,
    };
  }

  /**
   * Check if a phase is complete
   */
  private isPhaseComplete(state: any, phase: PhaseConcept): boolean {
    const existingPhase = state.generatedPhases.find(
      (p: PhaseState) => p.name === phase.name
    );
    return existingPhase?.completed ?? false;
  }

  /**
   * Get all generated phases
   */
  async getGeneratedPhases(): Promise<PhaseState[]> {
    const state = await this.stateManager.getCachedState();
    return state?.generatedPhases || [];
  }

  /**
   * Get phase statistics
   */
  async getPhaseStats(): Promise<{
    total: number;
    completed: number;
    remaining: number;
    currentPhase: string | null;
  }> {
    const state = await this.stateManager.getCachedState();
    if (!state) {
      return { total: 0, completed: 0, remaining: 0, currentPhase: null };
    }

    const total = state.blueprint?.implementationRoadmap.length || 0;
    const completed = state.generatedPhases.filter(p => p.completed).length;

    return {
      total,
      completed,
      remaining: total - completed,
      currentPhase: state.currentPhase?.name || null,
    };
  }

  /**
   * Check if all phases are complete
   */
  async isComplete(): Promise<boolean> {
    const stats = await this.getPhaseStats();
    return stats.remaining === 0 && stats.total > 0;
  }

  /**
   * Get progress percentage
   */
  async getProgress(): Promise<number> {
    const stats = await this.getPhaseStats();
    if (stats.total === 0) return 0;
    return Math.round((stats.completed / stats.total) * 100);
  }

  /**
   * Reset phases for regeneration
   */
  async resetPhases(): Promise<void> {
    await this.stateManager.updateState({
      $set: {
        generatedPhases: [],
        currentPhase: undefined,
        phasesCounter: 0,
        currentDevState: CurrentDevState.IDLE,
        mvpGenerated: false,
        reviewingInitiated: false,
      },
    });
  }
}

export default PhaseManager;





