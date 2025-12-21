import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { PhaseConcept, PhaseConceptSchema, FileState, Blueprint, RuntimeError } from '@/lib/agents/state/types';
import { extractJsonObject, safeJsonParse } from '../utils/json-extractor';

const SYSTEM_PROMPT = `You are a senior technical architect planning the NEXT development phase.

Rules:
- Prioritize critical runtime errors and build blockers first.
- Each phase must be deployable and shippable.
- Keep descriptions concise and actionable.
- Output MUST be valid JSON matching the schema below.
- If the project is complete, set lastPhase to true and include an empty files array.

Schema:
{
  "name": string,
  "description": string,
  "files": [{ "path": string, "purpose": string, "changes": string | null }],
  "lastPhase": boolean
}

Return ONLY JSON.`;

export interface PhasePlannerInput {
  blueprint: Blueprint;
  completedPhases: string[];
  filesIndex: FileState[];
  runtimeErrors: RuntimeError[];
  userSuggestions?: string[];
}

function formatErrors(errors: RuntimeError[]): string {
  if (!errors.length) return 'None';
  return errors
    .slice(0, 8)
    .map(err => `- ${err.type}: ${err.message}${err.filePath ? ` (${err.filePath})` : ''}`)
    .join('\n');
}

function summarizeFiles(files: FileState[]): string {
  return files
    .slice(0, 120)
    .map(file => `- ${file.filePath}: ${file.filePurpose || 'file'}`)
    .join('\n');
}

export class CorePhasePlanner {
  constructor(private model: BaseChatModel) {}

  async generate(input: PhasePlannerInput): Promise<PhaseConcept | null> {
    const prompt = `Project title: ${input.blueprint.title}

Blueprint summary:
- Description: ${input.blueprint.description}
- User flow: ${input.blueprint.userFlow.userJourney}
- Architecture: ${input.blueprint.architecture?.dataFlow || input.blueprint.dataFlow}

Completed phases:
${input.completedPhases.length ? input.completedPhases.join(', ') : 'None'}

Runtime errors (if any):
${formatErrors(input.runtimeErrors)}

Files index:
${summarizeFiles(input.filesIndex)}

User suggestions:
${input.userSuggestions?.length ? input.userSuggestions.join('\n') : 'None'}

Plan the next phase with the minimum necessary files and a strong focus on UI polish and correctness.`;

    const response = await this.model.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(prompt),
    ]);

    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    const jsonText = extractJsonObject(content);
    if (!jsonText) return null;

    const parsed = safeJsonParse<PhaseConcept>(jsonText);
    if (!parsed) return null;

    const result = PhaseConceptSchema.safeParse(parsed);
    if (!result.success) return null;

    return result.data;
  }
}

export default CorePhasePlanner;
