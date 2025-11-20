/**
 * Network-Specific Prompt Selector
 * This module combines base prompts with network-specific prompts
 * based on the selected blockchain
 */

import { basePrompt, editModeRules, targetedEditModeRules, codeCompletionRules } from './base-prompt';
import { solanaPrompt } from './solana-prompt';
import { celoPrompt } from './celo-prompt';

export type BlockchainNetwork = 'solana' | 'celo';

export interface PromptOptions {
  conversationContext?: string;
  isEdit?: boolean;
  editContext?: any;
}

/**
 * Get the complete system prompt for a specific blockchain network
 * @param chain - The blockchain network ('solana' or 'celo')
 * @param options - Additional prompt configuration options
 * @returns Complete system prompt string
 */
export function getNetworkPrompt(
  chain: BlockchainNetwork,
  options: PromptOptions = {}
): string {
  const { conversationContext = '', isEdit = false, editContext } = options;

  // Select the appropriate network-specific prompt
  const networkPrompt = chain === 'solana' ? solanaPrompt : celoPrompt;

  // Build the complete system prompt
  let systemPrompt = basePrompt;

  // Add conversation context if provided
  if (conversationContext) {
    systemPrompt += `\n\n${conversationContext}`;
  }

  // Add network-specific instructions
  systemPrompt += `\n\n${networkPrompt}`;

  // Add edit mode rules if in edit mode
  if (isEdit) {
    systemPrompt += `\n\n${editModeRules}`;

    // Add targeted edit mode rules if edit context is provided
    if (editContext) {
      systemPrompt += `\n\n${targetedEditModeRules(editContext)}`;
    }
  }

  // Always add code completion rules at the end
  systemPrompt += `\n\n${codeCompletionRules}`;

  return systemPrompt;
}

/**
 * Get a list of available blockchain networks
 * @returns Array of supported blockchain network identifiers
 */
export function getAvailableNetworks(): BlockchainNetwork[] {
  return ['solana', 'celo'];
}

/**
 * Validate if a given string is a supported blockchain network
 * @param network - The network string to validate
 * @returns True if the network is supported
 */
export function isValidNetwork(network: string): network is BlockchainNetwork {
  return ['solana', 'celo'].includes(network);
}

/**
 * Get display name for a blockchain network
 * @param chain - The blockchain network
 * @returns Human-readable network name
 */
export function getNetworkDisplayName(chain: BlockchainNetwork): string {
  const displayNames: Record<BlockchainNetwork, string> = {
    solana: 'Solana',
    celo: 'Celo',
  };
  return displayNames[chain];
}

/**
 * Get description for a blockchain network
 * @param chain - The blockchain network
 * @returns Network description
 */
export function getNetworkDescription(chain: BlockchainNetwork): string {
  const descriptions: Record<BlockchainNetwork, string> = {
    solana: 'Ultra-fast, low-fee blockchain for high-performance dApps',
    celo: 'Mobile-first, carbon-negative blockchain focused on financial inclusion',
  };
  return descriptions[chain];
}

// Re-export prompt components for direct use if needed
export { basePrompt, editModeRules, targetedEditModeRules, codeCompletionRules } from './base-prompt';
export { solanaPrompt } from './solana-prompt';
export { celoPrompt } from './celo-prompt';

















