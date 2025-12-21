/**
 * Code Generation Agent
 * Generates code files based on blueprints and phases
 */

import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { BaseAgent, AgentConfig, AgentContext, AgentInput, AgentOutput } from './base-agent';
import { Blueprint, PhaseConcept, FileOutput, FileConcept } from '../state/types';
import { PhaseManager } from '../state/phase-manager';
import { FileManager } from '../state/file-manager';
import { CoreBlueprintPlanner } from '../core-generators/planning/blueprint-planner';
import { CorePhasePlanner } from '../core-generators/planning/phase-planner';
import { CoreCodeGenerator } from '../core-generators/operations/code-generator';
import { CoreFileRegenerator } from '../core-generators/operations/file-regenerator';

const CODEGEN_SYSTEM_PROMPT = `You are the Code Generation Agent - an expert software engineer specializing in generating production-quality code.

## Your Role
Generate complete, working code files based on blueprints, phases, and requirements.

## Code Quality Standards
1. **Complete Implementation**: Every file must be fully implemented, no TODOs or placeholders
2. **TypeScript First**: Use TypeScript with strict typing
3. **Modern Patterns**: Use modern React patterns (hooks, functional components)
4. **Consistent Style**: Follow the project's established patterns
5. **Error Handling**: Include proper error handling
6. **Accessibility**: Include ARIA labels and semantic HTML

## Output Format
For each file, provide:
{
  "files": [
    {
      "filePath": "relative/path/to/file.tsx",
      "fileContents": "complete file contents here",
      "filePurpose": "brief description of what this file does"
    }
  ],
  "commands": ["npm install package-name"],
  "summary": "Brief summary of what was generated"
}

## Guidelines
- Generate files in the order specified by the phase
- Include all necessary imports
- Follow the blueprint's design specifications
- Use the specified color palette and styling
- Implement complete functionality, not stubs
- Handle edge cases and loading states`;

export interface CodeGenInput extends AgentInput {
  context: {
    blueprint: Blueprint;
    currentPhase: PhaseConcept;
    existingFiles: string[];
    templateName?: string;
  };
}

export interface CodeGenOutput {
  files: FileOutput[];
  commands: string[];
  summary: string;
}

/**
 * CodeGenAgent - Generates code based on blueprints
 */
export class CodeGenAgent extends BaseAgent {
  private phaseManager: PhaseManager;
  private fileManager: FileManager;

  constructor(context: AgentContext) {
    const config: AgentConfig = {
      name: 'CodeGenAgent',
      description: 'Generates code files based on blueprints and phases',
      systemPrompt: CODEGEN_SYSTEM_PROMPT,
      maxIterations: 10,
      temperature: 0.7,
    };
    super(config, context);
    this.phaseManager = new PhaseManager(context.stateManager);
    this.fileManager = new FileManager(context.stateManager);
  }

  private async isSmartMode(): Promise<boolean> {
    const state = await this.getStateManager().getCachedState();
    return state?.agentMode === 'smart';
  }

  /**
   * Execute code generation
   */
  async execute(input: CodeGenInput): Promise<AgentOutput> {
    try {
      this.initializeMessages();

      // Build the generation prompt
      const prompt = this.buildGenerationPrompt(input);
      this.addMessage(new HumanMessage(prompt));

      // Generate code
      const response = await this.getModel().invoke(this.getMessages());
      const result = this.parseCodeGenOutput(response as AIMessage);

      // Save generated files
      await this.saveGeneratedFiles(result.files);

      // Log activity
      await this.logGeneration(result);

      return {
        output: JSON.stringify(result),
        success: true,
        metadata: {
          filesGenerated: result.files.length,
          commands: result.commands,
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Generate blueprint from user query
   */
  async generateBlueprint(query: string, templateName?: string): Promise<Blueprint | null> {
    try {
      if (await this.isSmartMode()) {
        const planner = new CoreBlueprintPlanner(this.getModel());
        const planned = await planner.generate({ query, templateName });
        if (planned) {
          return planned;
        }
      }

      this.initializeMessages(this.getBlueprintPromptContext());
      
      const prompt = `Generate a detailed blueprint for the following project:

## User Request
${query}

${templateName ? `## Template: ${templateName}` : ''}

Provide a comprehensive blueprint following the exact schema specified.`;

      this.addMessage(new HumanMessage(prompt));
      const response = await this.getModel().invoke(this.getMessages());
      
      return this.parseBlueprintOutput(response as AIMessage);
    } catch (error) {
      this.log('Error generating blueprint', { error });
      return null;
    }
  }

  /**
   * Generate next phase
   */
  async generateNextPhase(): Promise<PhaseConcept | null> {
    if (await this.isSmartMode()) {
      const state = await this.getStateManager().getCachedState();
      if (state?.blueprint) {
        const planner = new CorePhasePlanner(this.getModel());
        const filesIndex = Object.values(await this.fileManager.getAllFiles());
        const completedPhases = state.generatedPhases
          .filter(phase => phase.completed)
          .map(phase => phase.name);

        const nextPhase = await planner.generate({
          blueprint: state.blueprint,
          completedPhases,
          filesIndex,
          runtimeErrors: state.runtimeErrors,
          userSuggestions: state.pendingUserInputs.slice(-3),
        });

        if (nextPhase) {
          await this.phaseManager.startPhase(nextPhase);
          return nextPhase;
        }
      }
    }

    const nextPhase = await this.phaseManager.getNextPhase();
    if (!nextPhase) return null;

    await this.phaseManager.startPhase(nextPhase);
    return nextPhase;
  }

  /**
   * Implement current phase
   */
  async implementPhase(phase: PhaseConcept, blueprint: Blueprint): Promise<CodeGenOutput> {
    if (await this.isSmartMode()) {
      const generator = new CoreCodeGenerator(this.getModel());
      const existingFiles = Object.values(await this.fileManager.getAllFiles());
      const output = await generator.generate({ blueprint, phase, existingFiles });

      if (output) {
        await this.saveGeneratedFiles(output.files);
        return output;
      }
    }

    const existingFiles = Object.keys(await this.fileManager.getAllFiles());
    
    const result = await this.execute({
      input: `Implement phase: ${phase.name}`,
      context: {
        blueprint,
        currentPhase: phase,
        existingFiles,
      },
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to implement phase');
    }

    return JSON.parse(result.output);
  }

  /**
   * Build generation prompt
   */
  private buildGenerationPrompt(input: CodeGenInput): string {
    const { blueprint, currentPhase, existingFiles } = input.context;

    return `## Task: Implement Phase "${currentPhase.name}"

### Blueprint Overview
**Title**: ${blueprint.title}
**Description**: ${blueprint.description}

### User Flow
- **UI Layout**: ${blueprint.userFlow.uiLayout}
- **UI Design**: ${blueprint.userFlow.uiDesign}
- **User Journey**: ${blueprint.userFlow.userJourney}

### Architecture
${blueprint.architecture.dataFlow}

### Color Palette
${blueprint.colorPalette.join(', ')}

### Frameworks
${blueprint.frameworks.join(', ')}

### Known Pitfalls to Avoid
${blueprint.pitfalls.map(p => `- ${p}`).join('\n')}

---

## Current Phase Details
**Name**: ${currentPhase.name}
**Description**: ${currentPhase.description}

### Files to Generate
${currentPhase.files.map(f => `- **${f.path}**: ${f.purpose}${f.changes ? ` (Changes: ${f.changes})` : ''}`).join('\n')}

### Existing Files (do not recreate)
${existingFiles.length > 0 ? existingFiles.join('\n') : 'None yet'}

---

Generate all files for this phase with complete, production-ready code.`;
  }

  /**
   * Parse code generation output
   */
  private parseCodeGenOutput(response: AIMessage): CodeGenOutput {
    const content = this.parseResponse(response);
    
    try {
      // Try to extract JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          files: parsed.files || [],
          commands: parsed.commands || [],
          summary: parsed.summary || 'Code generation complete',
        };
      }
    } catch {
      // Parse file blocks from markdown
      return this.parseMarkdownFiles(content);
    }

    return {
      files: [],
      commands: [],
      summary: 'No files generated',
    };
  }

  /**
   * Parse files from markdown code blocks
   */
  private parseMarkdownFiles(content: string): CodeGenOutput {
    const files: FileOutput[] = [];
    const codeBlockRegex = /```(?:typescript|tsx|ts|javascript|jsx|js|json|css|html)?\s*\n([\s\S]*?)```/g;
    const filePathRegex = /(?:\/\/|#|<!--)\s*(?:file:|path:)\s*(\S+)/i;

    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const code = match[1];
      const pathMatch = code.match(filePathRegex);
      
      if (pathMatch) {
        files.push({
          filePath: pathMatch[1],
          fileContents: code.replace(filePathRegex, '').trim(),
          filePurpose: 'Generated file',
        });
      }
    }

    return {
      files,
      commands: [],
      summary: `Parsed ${files.length} files from response`,
    };
  }

  /**
   * Parse blueprint output
   */
  private parseBlueprintOutput(response: AIMessage): Blueprint | null {
    const content = this.parseResponse(response);
    
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as Blueprint;
      }
    } catch (error) {
      this.log('Error parsing blueprint', { error });
    }

    return null;
  }

  /**
   * Save generated files
   */
  private async saveGeneratedFiles(files: FileOutput[]): Promise<void> {
    for (const file of files) {
      await this.fileManager.upsertFile(file);
    }
  }

  /**
   * Log generation activity
   */
  private async logGeneration(result: CodeGenOutput): Promise<void> {
    await this.getStateManager().addMessage({
      role: 'assistant',
      content: `[CodeGen] Generated ${result.files.length} files: ${result.summary}`,
    });
  }

  /**
   * Get blueprint prompt context
   */
  private getBlueprintPromptContext(): string {
    return `You are generating a project blueprint. The blueprint must include:
- Clear title and descriptions
- Color palette (RGB hex codes)
- User flow details
- Architecture overview
- Implementation roadmap with phases
- First phase details with files

Output as a valid JSON object matching the Blueprint schema.`;
  }

  /**
   * Regenerate a specific file
   */
  async regenerateFile(filePath: string, issues: string[]): Promise<FileOutput | null> {
    const existingFile = await this.fileManager.getFile(filePath);
    if (await this.isSmartMode() && existingFile) {
      const regenerator = new CoreFileRegenerator(this.getModel());
      const result = await regenerator.regenerate(existingFile, issues);

      if (result.updatedFile) {
        await this.fileManager.upsertFile(result.updatedFile, result.diff);
        return result.updatedFile;
      }
    }
    
    const prompt = `## Task: Fix Issues in File

**File**: ${filePath}
${existingFile ? `\n### Current Contents\n\`\`\`\n${existingFile.fileContents}\n\`\`\`` : ''}

### Issues to Fix
${issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

Provide the complete fixed file contents.`;

    this.initializeMessages();
    this.addMessage(new HumanMessage(prompt));
    
    const response = await this.getModel().invoke(this.getMessages());
    const content = this.parseResponse(response as AIMessage);
    
    // Extract code from response
    const codeMatch = content.match(/```[\w]*\n([\s\S]*?)```/);
    if (codeMatch) {
      const newFile: FileOutput = {
        filePath,
        fileContents: codeMatch[1].trim(),
        filePurpose: existingFile?.filePurpose || 'Regenerated file',
      };
      
      await this.fileManager.upsertFile(newFile, `Fixed: ${issues.join(', ')}`);
      return newFile;
    }

    return null;
  }
}

export default CodeGenAgent;



