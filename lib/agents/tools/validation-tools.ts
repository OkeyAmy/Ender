import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

/**
 * Tool to run ESLint on the codebase.
 */
export const lintTool = new DynamicStructuredTool({
    name: 'lint-codebase',
    description: 'Runs ESLint on the project to check for code quality issues and errors.',
    schema: z.object({
        fix: z.boolean().optional().describe('Whether to automatically fix lint errors (--fix)'),
    }),
    func: async ({ fix }) => {
        const provider = sandboxManager.getActiveProvider();
        if (!provider) {
            return 'Error: No active sandbox provider found.';
        }

        try {
            const command = fix ? 'npm run lint -- --fix' : 'npm run lint';
            const result = await provider.runCommand(command);

            if (result.exitCode === 0) {
                return 'Lint check passed. No errors found.';
            }

            return `Lint check failed:\n${result.stdout}\n${result.stderr}`;
        } catch (error) {
            return `Error running lint: ${(error as Error).message}`;
        }
    },
});

/**
 * Tool to run TypeScript type checking.
 */
export const typeCheckTool = new DynamicStructuredTool({
    name: 'type-check',
    description: 'Runs TypeScript compiler (tsc) to check for type errors.',
    schema: z.object({}),
    func: async () => {
        const provider = sandboxManager.getActiveProvider();
        if (!provider) {
            return 'Error: No active sandbox provider found.';
        }

        try {
            // Assuming 'tsc --noEmit' is what we want, or a script if available.
            // We'll try to run tsc directly or via npm if a script exists.
            // Often 'npm run build' includes type checking, but we might want just type checking.
            // Let's try 'npx tsc --noEmit' to be safe.
            const result = await provider.runCommand('npx tsc --noEmit');

            if (result.exitCode === 0) {
                return 'Type check passed. No errors found.';
            }

            return `Type check failed:\n${result.stdout}\n${result.stderr}`;
        } catch (error) {
            return `Error running type check: ${(error as Error).message}`;
        }
    },
});

/**
 * Tool to run a build check.
 */
export const buildCheckTool = new DynamicStructuredTool({
    name: 'build-check',
    description: 'Runs the build process to verify the project builds successfully.',
    schema: z.object({}),
    func: async () => {
        const provider = sandboxManager.getActiveProvider();
        if (!provider) {
            return 'Error: No active sandbox provider found.';
        }

        try {
            const result = await provider.runCommand('npm run build');

            if (result.exitCode === 0) {
                return 'Build passed successfully.';
            }

            return `Build failed:\n${result.stdout}\n${result.stderr}`;
        } catch (error) {
            return `Error running build: ${(error as Error).message}`;
        }
    },
});

/**
 * Tool to install a package.
 */
export const installPackageTool = new DynamicStructuredTool({
    name: 'install-package',
    description: 'Installs a specific npm package.',
    schema: z.object({
        packageName: z.string().describe('The name of the package to install'),
        dev: z.boolean().optional().describe('Whether to install as a dev dependency'),
    }),
    func: async ({ packageName, dev }) => {
        const provider = sandboxManager.getActiveProvider();
        if (!provider) {
            return 'Error: No active sandbox provider found.';
        }

        try {
            const flag = dev ? '--save-dev' : '';
            const command = `npm install ${packageName} ${flag}`;
            const result = await provider.runCommand(command);

            if (result.exitCode === 0) {
                return `Successfully installed ${packageName}.`;
            }

            return `Failed to install ${packageName}:\n${result.stdout}\n${result.stderr}`;
        } catch (error) {
            return `Error installing package: ${(error as Error).message}`;
        }
    },
});

export const validationTools: StructuredToolInterface[] = [
    lintTool,
    typeCheckTool,
    buildCheckTool,
    installPackageTool,
];
