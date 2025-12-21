## Real-time AI Pipeline (Self-healing + Multi-agent)

This repo now ships a dedicated telemetry and recovery stack so the AI sees every sandbox command and can react immediately.

### Pieces
- `lib/sandbox/telemetry/command-log-bus.ts` – global event bus for all sandbox commands (`stdout`, `stderr`, exit code, duration, provider, sandboxId). Provides a rolling buffer and `asAsyncIterable()` for streaming to an LLM.
- `lib/sandbox/automation/self-healing-supervisor.ts` – subscribes to the bus, auto-runs `npm run lint`/`npm run build`, and triggers `buildErrorHandler`/`environmentValidator` recovery the moment a command fails. Started from the sandbox orchestrator.
- `lib/agents/multi-agent-orchestrator.ts` – LangChain-based build/orchestrator agents that consume command logs and validation state to decide next actions and release readiness.

### How to stream logs to an agent
```ts
import { commandLogBus } from '@/lib/sandbox/telemetry/command-log-bus';

for await (const event of commandLogBus.asAsyncIterable()) {
  // Push directly into your model context / tooling
  console.log(event.command, event.exitCode, event.stdout);
}
```

### Running the multi-agent guard (LangChain)
```ts
import { ChatOpenAI } from '@langchain/openai';
import { runMultiAgentCycle } from '@/lib/agents/multi-agent-orchestrator';

const model = new ChatOpenAI({ model: 'gpt-4.1-mini', temperature: 0.2 });
const { buildResult, decision } = await runMultiAgentCycle(model);

if (!decision.readyForUser) {
  // use decision.followUps to drive more tool calls / fixes
}
```

### Notes
- All provider `runCommand`/`installPackages` calls now emit telemetry events automatically.
- The self-healing supervisor is started inside `SandboxOrchestrator.initialize()`; it will debounce heavy checks but still auto-recovers on failures.
- Keep existing API routes using the providers so their commands are observable; direct `sandbox.runCommand` calls bypass the bus.
