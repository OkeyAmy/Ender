/**
 * Review Agent
 * Reviews code quality and suggests improvements
 */

import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { BaseAgent, AgentConfig, AgentContext, AgentInput, AgentOutput } from './base-agent';
import { FileState, CodeReview } from '../state/types';
import { FileManager } from '../state/file-manager';

const REVIEW_SYSTEM_PROMPT = `You are the Code Review Agent - a senior software engineer specializing in code quality review.

## Your Role
Review generated code for quality, correctness, and completeness.

## Review Criteria
1. **Functionality**: Does the code do what it's supposed to do?
2. **Type Safety**: Are types correct and comprehensive?
3. **Error Handling**: Are errors handled gracefully?
4. **Dependencies**: Are all imports correct?
5. **Performance**: Any obvious performance issues?
6. **Security**: Any security concerns?
7. **Best Practices**: Does it follow established patterns?

## Review Process
1. Analyze each file systematically
2. Check imports and exports
3. Verify type annotations
4. Look for common mistakes
5. Assess overall architecture

## Output Format
{
  "dependenciesNotMet": ["package-name"],
  "issuesFound": true/false,
  "frontendIssues": ["issue1", "issue2"],
  "backendIssues": ["issue1", "issue2"],
  "filesToFix": [
    {
      "filePath": "path/to/file.ts",
      "issues": ["specific issue description"],
      "requireCodeChanges": true/false
    }
  ],
  "commands": ["npm install missing-package"],
  "overallAssessment": "brief assessment",
  "readyForDeployment": true/false
}

## Guidelines
- Be thorough but not pedantic
- Focus on issues that affect functionality
- Suggest specific fixes, not vague improvements
- Prioritize critical issues over style preferences`;

export interface ReviewInput extends AgentInput {
  context: {
    files: FileState[];
    blueprint?: {
      title: string;
      description: string;
      frameworks: string[];
    };
    recentChanges?: string[];
  };
}

export interface ReviewResult extends CodeReview {
  overallAssessment: string;
  readyForDeployment: boolean;
  criticalIssues: number;
  warnings: number;
}

/**
 * ReviewAgent - Reviews code quality
 */
export class ReviewAgent extends BaseAgent {
  private fileManager: FileManager;

  constructor(context: AgentContext) {
    const config: AgentConfig = {
      name: 'ReviewAgent',
      description: 'Reviews code quality and suggests improvements',
      systemPrompt: REVIEW_SYSTEM_PROMPT,
      maxIterations: 5,
      temperature: 0.3,
    };
    super(config, context);
    this.fileManager = new FileManager(context.stateManager);
  }

  /**
   * Execute code review
   */
  async execute(input: ReviewInput): Promise<AgentOutput> {
    try {
      this.initializeMessages();

      // Build review prompt
      const prompt = this.buildReviewPrompt(input);
      this.addMessage(new HumanMessage(prompt));

      // Get review
      const response = await this.getModel().invoke(this.getMessages());
      const result = this.parseReviewOutput(response as AIMessage);

      // Log review
      await this.logReview(result);

      return {
        output: JSON.stringify(result),
        success: true,
        metadata: {
          issuesFound: result.issuesFound,
          criticalIssues: result.criticalIssues,
          readyForDeployment: result.readyForDeployment,
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Quick review - just check for obvious issues
   */
  async quickReview(files: FileState[]): Promise<{
    hasIssues: boolean;
    criticalCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];

    for (const file of files) {
      // Check for common issues
      const fileIssues = this.quickFileCheck(file);
      issues.push(...fileIssues);
    }

    return {
      hasIssues: issues.length > 0,
      criticalCount: issues.filter(i => i.includes('[CRITICAL]')).length,
      issues,
    };
  }

  /**
   * Build review prompt
   */
  private buildReviewPrompt(input: ReviewInput): string {
    const { files, blueprint, recentChanges } = input.context;

    let prompt = `## Code Review Task

### Project Context
${blueprint ? `
**Title**: ${blueprint.title}
**Description**: ${blueprint.description}
**Frameworks**: ${blueprint.frameworks.join(', ')}
` : 'No blueprint available'}

### Files to Review (${files.length} total)
`;

    // Include file contents for smaller codebases
    if (files.length <= 20) {
      for (const file of files) {
        prompt += `
#### ${file.filePath}
**Purpose**: ${file.filePurpose}
\`\`\`
${file.fileContents.slice(0, 2000)}${file.fileContents.length > 2000 ? '\n... (truncated)' : ''}
\`\`\`
`;
      }
    } else {
      // Just list files for larger codebases
      prompt += files.map(f => `- ${f.filePath}: ${f.filePurpose}`).join('\n');
      prompt += '\n\n(Full contents available via read_files tool)';
    }

    if (recentChanges && recentChanges.length > 0) {
      prompt += `

### Recent Changes
${recentChanges.join('\n')}
`;
    }

    prompt += `

### Your Task
Review all files and provide a comprehensive assessment. Focus on:
1. Missing dependencies or imports
2. Type errors or type safety issues
3. React-specific issues (hooks, rendering)
4. API/backend issues
5. Security concerns

Provide actionable feedback for each issue found.`;

    return prompt;
  }

  /**
   * Quick file check for common issues
   */
  private quickFileCheck(file: FileState): string[] {
    const issues: string[] = [];
    const content = file.fileContents;

    // Check for TODO/FIXME comments
    if (/TODO|FIXME/i.test(content)) {
      issues.push(`[WARNING] ${file.filePath}: Contains TODO/FIXME comments`);
    }

    // Check for console.log in production code
    if (/console\.(log|warn|error)/.test(content) && !file.filePath.includes('test')) {
      issues.push(`[WARNING] ${file.filePath}: Contains console statements`);
    }

    // Check for any type usage
    if (/:\s*any\b/.test(content)) {
      issues.push(`[WARNING] ${file.filePath}: Uses 'any' type`);
    }

    // Check for empty catch blocks
    if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(content)) {
      issues.push(`[CRITICAL] ${file.filePath}: Empty catch block`);
    }

    // Check for hardcoded URLs/secrets
    if (/https?:\/\/(?!localhost|127\.0\.0\.1)[^\s'"]+\.(com|io|org|net)/.test(content)) {
      if (!/process\.env|import\.meta\.env/.test(content)) {
        issues.push(`[WARNING] ${file.filePath}: May contain hardcoded URLs`);
      }
    }

    // Check for React hooks issues
    if (/use[A-Z][a-zA-Z]*\(/.test(content)) {
      // Missing dependency array
      if (/useEffect\s*\(\s*\([^)]*\)\s*=>\s*\{[^}]*\}\s*\)(?!\s*,)/.test(content)) {
        issues.push(`[CRITICAL] ${file.filePath}: useEffect may be missing dependency array`);
      }
    }

    return issues;
  }

  /**
   * Parse review output
   */
  private parseReviewOutput(response: AIMessage): ReviewResult {
    const content = this.parseResponse(response);

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.normalizeReviewResult(parsed);
      }
    } catch {
      // Parse from content
    }

    return this.parseContentToReview(content);
  }

  /**
   * Normalize review result
   */
  private normalizeReviewResult(parsed: any): ReviewResult {
    const filesToFix = parsed.filesToFix || [];
    const criticalIssues = filesToFix.filter((f: any) => f.requireCodeChanges).length;

    return {
      dependenciesNotMet: parsed.dependenciesNotMet || [],
      issuesFound: parsed.issuesFound ?? filesToFix.length > 0,
      frontendIssues: parsed.frontendIssues || [],
      backendIssues: parsed.backendIssues || [],
      filesToFix: filesToFix.map((f: any) => ({
        filePath: f.filePath,
        issues: f.issues || [],
        requireCodeChanges: f.requireCodeChanges ?? true,
      })),
      commands: parsed.commands || [],
      overallAssessment: parsed.overallAssessment || 'Review complete',
      readyForDeployment: parsed.readyForDeployment ?? !parsed.issuesFound,
      criticalIssues,
      warnings: filesToFix.length - criticalIssues,
    };
  }

  /**
   * Parse content to review result
   */
  private parseContentToReview(content: string): ReviewResult {
    const hasIssues = content.toLowerCase().includes('issue') || 
                      content.toLowerCase().includes('error') ||
                      content.toLowerCase().includes('problem');

    return {
      dependenciesNotMet: [],
      issuesFound: hasIssues,
      frontendIssues: [],
      backendIssues: [],
      filesToFix: [],
      commands: [],
      overallAssessment: content.slice(0, 500),
      readyForDeployment: !hasIssues,
      criticalIssues: 0,
      warnings: 0,
    };
  }

  /**
   * Log review
   */
  private async logReview(result: ReviewResult): Promise<void> {
    await this.getStateManager().addMessage({
      role: 'assistant',
      content: `[Review] ${result.overallAssessment} (${result.criticalIssues} critical, ${result.warnings} warnings)`,
    });
  }
}

export default ReviewAgent;





