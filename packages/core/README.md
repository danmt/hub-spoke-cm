# 📁 Package: `@hub-spoke/core`

This package is the environment-independent engine of the Hub & Spoke system. It manages the lifecycle of content hubs, the orchestration of AI agents, and the parsing of structural artifacts.

## 🎯 Design Philosophy: "The Agnostic Brain"

The Core is built to run anywhere a modern JavaScript runtime exists (Node.js, Deno, React Native, or the Browser). To achieve this, it adheres to three strict rules:

1. **Dependency Inversion**: The Core defines _how_ a logger or a file-seeker should look, but the **Platform** (CLI/Mobile) provides the actual tool.
2. **No Environmental Leaks**: No calls to `process.env`, `process.cwd()`, or hardcoded OS paths.
3. **Stateless Execution**: Business logic (Actions) should not hold global state. Everything required for an operation is passed in at the moment of execution.

## 🏗️ Core Modules

### 1. Services (`/src/services`)

The functional powerhouses of the system.

- **`AiService`**: A stateless utility that takes a prompt and an API key to return AI responses.
- **`IoService`**: The workspace architect. Handles directory scaffolding and Hub discovery based on an injected `rootDir`.
- **`RegistryService`**: The "Agent Factory." It reads markdown artifacts and transforms them into active, credentialed Agents.
- **`LoggerService`**: A pluggable interface. Defaults to a silent fallback until a Platform Provider (like Winston or Logcat) is registered.

### 2. Agents (`/src/agents`)

The "Workforce." Each agent type (Persona, Writer, Assembler) encapsulates specific AI behavior and system instructions. Agents carry their own **API Key** and **Model ID**, allowing for granular control over which AI model powers which task.

### 3. Actions (`/src/actions`)

The "Orchestrators." Classes like `FillAction` and `CreateHubAction` manage the multi-step "dance" between different agents. They use a **Callback Pattern** (`onStatus`, `onInteraction`) to communicate with the UI without knowing if that UI is a terminal or a mobile modal.

## 🔄 The Interaction Loop

1. **Platform** initializes `RegistryService` with local files and credentials.
2. **Platform** triggers an `Action` (e.g., `CreateHubAction`).
3. **Action** requests a plan from the **Architect**.
4. **Action** yields control to the **Platform** via a callback for user approval.
5. **Platform** returns a "Proceed" signal.
6. **Action** triggers the **Writer** and **Persona** agents to finalize content.

## 🛠️ Contribution Guidelines

### Adding a New Agent Type

1. Define the artifact schema in `src/types/artifacts.ts`.
2. Create the Agent class in `src/agents/`.
3. Update `RegistryService.initializeAgents()` to recognize the new type.

### Adding a New Action

1. Extend the `BaseAction` class.
2. Ensure all UI-blocking steps use the `onInteraction` hook to remain headless.
3. Export the action from `src/index.ts`.

### ⚠️ Restricted Imports

To maintain mobile compatibility, **never** import the following directly into Core logic:

- `fs` or `fs/promises` (Use `IoService` or inject paths)
- `os`
- `process` (except for type checks)
- Platform-specific binaries (e.g., `winston`, `inquirer`, `chalk`)

## 🧪 Development

```bash
# Run unit tests for core logic
npm run test -w @hub-spoke/core

# Build core for usage in other packages
npm run build -w @hub-spoke/core
```
