import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { FileOutput } from '@/lib/agents/state/types';
import { applySearchReplaceDiff, ApplyResult } from '../output-formats/diff-formats';

const SYSTEM_PROMPT = `You are an elite agent specializing in surgical code fixes.

Rules:
- Only fix the specified issues.
- Use minimal changes and preserve existing behavior.
- Output ONLY search/replace diff blocks in this exact format:
<<<<<<< SEARCH
<exact text from file>
=======
<replacement text>
>>>>>>> REPLACE

No explanations, no markdown fences. Just diff blocks.`;

const buildUserPrompt = (file: FileOutput, issues: string[]): string => {
  const issuesText = issues.length
    ? issues.map((issue, idx) => `${idx + 1}. ${issue}`).join('\n')
    : 'No issues provided.';

  return `File path: ${file.filePath}
File purpose: ${file.filePurpose}

Current contents:
${file.fileContents}

Issues to fix:
${issuesText}

Return only search/replace diff blocks.`;
};

export interface CoreFileRegenerationResult {
  updatedFile: FileOutput | null;
  diff: string;
  applyResult: ApplyResult;
}

export class CoreFileRegenerator {
  constructor(private model: BaseChatModel) {}

  async regenerate(file: FileOutput, issues: string[]): Promise<CoreFileRegenerationResult> {
    const response = await this.model.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(buildUserPrompt(file, issues)),
    ]);

    const raw = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    const fencedMatch = raw.match(/```[a-zA-Z]*\\n([\\s\\S]*?)```/);
    const diff = fencedMatch ? fencedMatch[1] : raw;

    const applyResult = applySearchReplaceDiff(file.fileContents, diff, {
      strict: false,
      enableTelemetry: false,
    });

    if (applyResult.results.blocksApplied === 0) {
      return { updatedFile: null, diff, applyResult };
    }

    const updatedFile: FileOutput = {
      ...file,
      fileContents: applyResult.content,
    };

    return { updatedFile, diff, applyResult };
  }
}

export default CoreFileRegenerator;
