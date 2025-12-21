import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Blueprint, BlueprintSchema } from '@/lib/agents/state/types';
import { extractJsonObject, safeJsonParse } from '../utils/json-extractor';

const SYSTEM_PROMPT = `You are a senior product architect and frontend systems designer.

Your task is to produce a concise but information-dense blueprint (PRD) that drives a multi-agent code generator.
The output MUST be valid JSON and MUST conform to the schema below.

Hard requirements:
- Target stack: Next.js (App Router) + TypeScript + Tailwind. MongoDB only if data storage is required.
- No Cloudflare-specific instructions. Avoid edge-worker APIs.
- Provide a beautiful, modern UI design with clear layout, hierarchy, spacing, and responsiveness.
- Include an implementationRoadmap with phased milestones.
- Include initialPhase with explicit files (no binary files).
- Keep projectName lowercase with hyphens or underscores only.
- Provide 2-6 views max, aligned with the user request.

Schema:
{
  "title": string,
  "projectName": string,
  "detailedDescription": string,
  "description": string,
  "colorPalette": string[],
  "views": [{ "name": string, "description": string }],
  "userFlow": { "uiLayout": string, "uiDesign": string, "userJourney": string },
  "dataFlow": string,
  "architecture": { "dataFlow": string },
  "pitfalls": string[],
  "frameworks": string[],
  "implementationRoadmap": [{ "phase": string, "description": string }],
  "initialPhase": {
    "name": string,
    "description": string,
    "files": [{ "path": string, "purpose": string, "changes": string | null }],
    "lastPhase": boolean
  }
}

Return ONLY valid JSON. No markdown, no commentary.`;

export interface BlueprintPlannerInput {
  query: string;
  templateName?: string;
  frameworks?: string[];
}

export class CoreBlueprintPlanner {
  constructor(private model: BaseChatModel) {}

  async generate(input: BlueprintPlannerInput): Promise<Blueprint | null> {
    const templateInfo = input.templateName
      ? `Template: ${input.templateName}`
      : 'Template: none';
    const frameworks = input.frameworks?.length
      ? `Suggested frameworks: ${input.frameworks.join(', ')}`
      : 'Suggested frameworks: none';

    const userPrompt = `User request:
${input.query}

${templateInfo}
${frameworks}

Remember to keep the blueprint concise, structured, and production-oriented.`;

    const response = await this.model.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(userPrompt),
    ]);

    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    const jsonText = extractJsonObject(content);
    if (!jsonText) return null;

    const parsed = safeJsonParse<Blueprint>(jsonText);
    if (!parsed) return null;

    const result = BlueprintSchema.safeParse(parsed);
    if (!result.success) return null;

    return result.data;
  }
}

export default CoreBlueprintPlanner;
