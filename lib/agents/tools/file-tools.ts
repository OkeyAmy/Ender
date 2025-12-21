/**
 * File Tools
 * LangChain tools for file operations
 */

import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { AgentStateManager } from '../state/agent-state-manager';
import { FileManager } from '../state/file-manager';
import { PhaseConcept } from '../state/types';
import { ModelFactory } from '../models/model-factory';
import { appConfig } from '@/config/app.config';
import { CoreCodeGenerator } from '../core-generators/operations/code-generator';
import { CoreFileRegenerator } from '../core-generators/operations/file-regenerator';

/**
 * Read Files Tool
 * Reads file contents from the sandbox
 */
export class ReadFilesTool extends StructuredTool {
  name = 'read_files';
  description = 'Read contents of one or more files. Batch multiple files in one call for efficiency.';

  schema = z.object({
    paths: z.array(z.string()).describe('Array of relative file paths to read'),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const provider = sandboxManager.getActiveProvider();
    if (!provider) {
      return JSON.stringify({ error: 'No active sandbox provider' });
    }

    const results: Record<string, unknown> = {};

    for (const path of input.paths) {
      try {
        const content = await provider.readFile(path);
        results[path] = {
          success: true,
          content: content?.slice(0, 10000), // Limit size
          truncated: content && content.length > 10000,
        };
      } catch (error) {
        results[path] = {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to read file',
        };
      }
    }

    return JSON.stringify(results);
  }
}

/**
 * Write File Tool
 * Writes content to a file in the sandbox
 */
export class WriteFileTool extends StructuredTool {
  name = 'write_file';
  description = 'Write content to a file. Creates the file if it does not exist.';

  schema = z.object({
    path: z.string().describe('Relative file path'),
    content: z.string().describe('File content to write'),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const provider = sandboxManager.getActiveProvider();
    if (!provider) {
      return JSON.stringify({ error: 'No active sandbox provider' });
    }

    try {
      await provider.writeFile(input.path, input.content);
      return JSON.stringify({
        success: true,
        path: input.path,
        message: 'File written successfully',
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to write file',
      });
    }
  }
}

/**
 * List Files Tool
 * Lists files in a directory
 */
export class ListFilesTool extends StructuredTool {
  name = 'list_files';
  description = 'List files in a directory';

  schema = z.object({
    path: z.string().optional().describe('Directory path (defaults to project root)'),
    recursive: z.boolean().optional().describe('List recursively'),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const provider = sandboxManager.getActiveProvider();
    if (!provider) {
      return JSON.stringify({ error: 'No active sandbox provider' });
    }

    try {
      const path = input.path || '.';
      const command = input.recursive
        ? `find ${path} -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" | head -100`
        : `ls -la ${path}`;

      const result = await provider.runCommand(command);
      
      return JSON.stringify({
        success: result.exitCode === 0,
        files: result.stdout?.split('\n').filter(Boolean) || [],
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list files',
      });
    }
  }
}

/**
 * Regenerate File Tool
 * Uses AI to fix issues in a file
 */
export class RegenerateFileTool extends StructuredTool {
  name = 'regenerate_file';
  description = 'Apply surgical fixes to an existing file. Provide specific issues to fix.';

  schema = z.object({
    path: z.string().describe('Relative path to the file'),
    issues: z.array(z.string()).describe('Array of specific issues to fix'),
  });

  private stateManager: AgentStateManager;
  private regenerator: CoreFileRegenerator;

  constructor(stateManager: AgentStateManager) {
    super();
    this.stateManager = stateManager;
    const modelConfig = ModelFactory.fromModelId(appConfig.ai.defaultModel, {
      apiKey: process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY,
    });
    this.regenerator = new CoreFileRegenerator(ModelFactory.create(modelConfig));
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const provider = sandboxManager.getActiveProvider();
    if (!provider) {
      return JSON.stringify({ error: 'No active sandbox provider' });
    }

    try {
      // Read current file
      const currentContent = await provider.readFile(input.path);
      if (!currentContent) {
        return JSON.stringify({
          success: false,
          error: 'File not found or empty',
        });
      }

      const fileManager = new FileManager(this.stateManager);
      const existingFile = await fileManager.getFile(input.path);

      const result = await this.regenerator.regenerate(
        {
          filePath: input.path,
          fileContents: currentContent,
          filePurpose: existingFile?.filePurpose || 'Regenerated file',
        },
        input.issues
      );

      if (!result.updatedFile) {
        return JSON.stringify({
          success: false,
          path: input.path,
          errors: result.applyResult.results.errors,
          message: 'Failed to apply diff blocks.',
        });
      }

      await provider.writeFile(input.path, result.updatedFile.fileContents);
      await fileManager.upsertFile(result.updatedFile, result.diff);

      return JSON.stringify({
        success: true,
        path: input.path,
        appliedBlocks: result.applyResult.results.blocksApplied,
        failedBlocks: result.applyResult.results.blocksFailed,
        diff: result.diff,
        message: 'File regenerated and applied successfully.',
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to regenerate file',
      });
    }
  }
}

/**
 * Generate Files Tool
 * Generates new files using phase implementation
 */
export class GenerateFilesTool extends StructuredTool {
  name = 'generate_files';
  description = 'Generate new files or rewrite broken files using phase implementation';
  private stateManager: AgentStateManager;
  private generator: CoreCodeGenerator;

  schema = z.object({
    phase_name: z.string().describe('Name of the phase'),
    phase_description: z.string().describe('Description of what to generate'),
    requirements: z.array(z.string()).describe('Detailed requirements for generation'),
    files: z.array(z.object({
      path: z.string(),
      purpose: z.string(),
      changes: z.string().nullable(),
    })).describe('Files to generate'),
  });

  constructor(stateManager: AgentStateManager) {
    super();
    this.stateManager = stateManager;
    const modelConfig = ModelFactory.fromModelId(appConfig.ai.defaultModel, {
      apiKey: process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY,
    });
    this.generator = new CoreCodeGenerator(ModelFactory.create(modelConfig));
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const provider = sandboxManager.getActiveProvider();
    if (!provider) {
      return JSON.stringify({ error: 'No active sandbox provider' });
    }

    const state = await this.stateManager.getCachedState();
    if (!state?.blueprint) {
      return JSON.stringify({
        success: false,
        message: 'No blueprint available for generation context.',
      });
    }

    const fileManager = new FileManager(this.stateManager);
    const existingFiles = Object.values(await fileManager.getAllFiles());

    const phase: PhaseConcept = {
      name: input.phase_name,
      description: input.phase_description,
      files: input.files,
      lastPhase: false,
    };

    const result = await this.generator.generate({
      blueprint: state.blueprint,
      phase,
      existingFiles,
    });

    if (!result) {
      return JSON.stringify({
        success: false,
        message: 'Generation failed to produce files.',
      });
    }

    for (const file of result.files) {
      await provider.writeFile(file.filePath, file.fileContents);
      await fileManager.upsertFile(file, 'generated by generate_files tool');
    }

    return JSON.stringify({
      success: true,
      phase_name: input.phase_name,
      files: result.files.map(f => f.filePath),
      commands: result.commands,
      summary: result.summary,
      message: 'Files generated and written to sandbox.',
    });
  }
}

/**
 * Search Files Tool
 * Search for patterns in files
 */
export class SearchFilesTool extends StructuredTool {
  name = 'search_files';
  description = 'Search for a pattern in files using grep';

  schema = z.object({
    pattern: z.string().describe('Search pattern (regex supported)'),
    path: z.string().optional().describe('Directory to search in'),
    filePattern: z.string().optional().describe('File pattern (e.g., "*.ts")'),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const provider = sandboxManager.getActiveProvider();
    if (!provider) {
      return JSON.stringify({ error: 'No active sandbox provider' });
    }

    try {
      const path = input.path || '.';
      const includes = input.filePattern ? `--include="${input.filePattern}"` : '--include="*.ts" --include="*.tsx"';
      const command = `grep -rn ${includes} "${input.pattern}" ${path} 2>/dev/null | head -50`;

      const result = await provider.runCommand(command);
      const matches = result.stdout?.split('\n').filter(Boolean) || [];

      return JSON.stringify({
        success: true,
        pattern: input.pattern,
        matchCount: matches.length,
        matches: matches.slice(0, 30),
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
      });
    }
  }
}

/**
 * Delete File Tool
 * Deletes a file from the sandbox
 */
export class DeleteFileTool extends StructuredTool {
  name = 'delete_file';
  description = 'Delete a file from the project';

  schema = z.object({
    path: z.string().describe('Relative path to the file to delete'),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const provider = sandboxManager.getActiveProvider();
    if (!provider) {
      return JSON.stringify({ error: 'No active sandbox provider' });
    }

    try {
      const result = await provider.runCommand(`rm -f "${input.path}"`);
      
      return JSON.stringify({
        success: result.exitCode === 0,
        path: input.path,
        message: result.exitCode === 0 ? 'File deleted' : 'Failed to delete file',
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete file',
      });
    }
  }
}

/**
 * Create all file tools
 */
export function createFileTools(stateManager?: AgentStateManager): StructuredTool[] {
  const tools: StructuredTool[] = [
    new ReadFilesTool(),
    new WriteFileTool(),
    new ListFilesTool(),
    new SearchFilesTool(),
    new DeleteFileTool(),
  ];

  if (stateManager) {
    tools.push(new GenerateFilesTool(stateManager));
    tools.push(new RegenerateFileTool(stateManager));
  }

  return tools;
}

export default createFileTools;



