import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Blueprint, PhaseConcept, FileOutput, FileState } from '@/lib/agents/state/types';
import { extractJsonObject, safeJsonParse } from '../utils/json-extractor';

export interface CoreCodeGenInput {
  blueprint: Blueprint;
  phase: PhaseConcept;
  existingFiles: FileState[];
}

export interface CoreCodeGenOutput {
  files: FileOutput[];
  commands: string[];
  summary: string;
}

const SYSTEM_PROMPT = `You are a senior TypeScript engineer generating production-ready code.

Rules:
- Output MUST be valid JSON with this schema:
  { "files": [{ "filePath": string, "fileContents": string, "filePurpose": string }], "commands": string[], "summary": string }
- Provide complete file contents (no placeholders, no TODOs).
- Use Tailwind for styling and keep UI polished and responsive.
- Avoid dynamic imports and websockets.
- Respect existing file paths; only touch files listed in the phase.

Return ONLY JSON.`;

function summarizeExistingFiles(files: FileState[]): string {
  if (!files.length) return 'None';
  return files
    .slice(0, 120)
    .map(file => `- ${file.filePath}: ${file.filePurpose || 'file'}`)
    .join('\n');
}

export class CoreCodeGenerator {
  constructor(private model: BaseChatModel) {}

  async generate(input: CoreCodeGenInput): Promise<CoreCodeGenOutput | null> {
    const detailedDescription = input.blueprint.detailedDescription || input.blueprint.description;
    const prompt = `Blueprint title: ${input.blueprint.title}

Blueprint description:
${detailedDescription}

User flow:
- Layout: ${input.blueprint.userFlow.uiLayout}
- Design: ${input.blueprint.userFlow.uiDesign}
- Journey: ${input.blueprint.userFlow.userJourney}

Architecture:
${input.blueprint.architecture?.dataFlow || input.blueprint.dataFlow}

Color palette: ${input.blueprint.colorPalette.join(', ')}

Frameworks: ${input.blueprint.frameworks.join(', ')}

Phase to implement:
- Name: ${input.phase.name}
- Description: ${input.phase.description}

Files to generate:
${input.phase.files.map(file => `- ${file.path}: ${file.purpose}${file.changes ? ` (Changes: ${file.changes})` : ''}`).join('\n')}

Existing files (do not re-create unless listed above):
${summarizeExistingFiles(input.existingFiles)}

Generate the files now.`;

    const response = await this.model.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(prompt),
    ]);

    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    const jsonText = extractJsonObject(content);
    if (!jsonText) return null;

    const parsed = safeJsonParse<CoreCodeGenOutput>(jsonText);
    if (!parsed) return null;

    return {
      files: (parsed.files || []).map(file => ({
        filePath: file.filePath,
        fileContents: file.fileContents || '',
        filePurpose: file.filePurpose || 'Generated file',
      })),
      commands: parsed.commands || [],
      summary: parsed.summary || 'Generation complete',
    };
  }
}

export default CoreCodeGenerator;
