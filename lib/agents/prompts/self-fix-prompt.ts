import { ChatPromptTemplate } from '@langchain/core/prompts';

export const FIX_BUILD_ERROR_PROMPT = ChatPromptTemplate.fromMessages([
    [
        'system',
        `You are an expert build engineer. Your goal is to fix build errors in a web application.
You have access to tools to install packages, lint code, and check types.
Analyze the error logs and validation summary.
If a package is missing, use the install-package tool.
If there is a syntax error, explain how to fix it (the actual code fix will be applied by another agent, but you can suggest it).
If there is a lint error, use the lint-codebase tool with fix=true.
Always verify your fix with the build-check tool.
`
    ],
    [
        'human',
        `Build failed with the following logs:
{logs}

Validation summary:
{validation}

Please fix the issue.`
    ]
]);

export const FIX_LINT_ERROR_PROMPT = ChatPromptTemplate.fromMessages([
    [
        'system',
        `You are a code quality expert. Your goal is to fix linting errors.
Use the lint-codebase tool to attempt automatic fixes.
If automatic fixes fail, analyze the error and suggest manual changes.
`
    ],
    [
        'human',
        `Linting failed with the following output:
{logs}

Please fix the lint errors.`
    ]
]);
