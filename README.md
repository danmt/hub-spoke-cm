# Hub & Spoke Content Manager (Monorepo)

An AI-native content strategy engine designed for **"Vibe Coding"**—where the architecture is robust enough to stay out of your way. This monorepo uses **npm workspaces** to separate platform-agnostic logic from specific delivery interfaces.

## 🏗️ The Multi-Platform Strategy

The project is split into two distinct layers to ensure that the AI orchestration logic can be reused in a future Android application without modification:

1.  **`@hub-spoke/core`**: The Headless Engine.
    - Contains all Zod schemas, Markdown parsers, and AI Action logic.
    - **Zero Environmental Assumptions**: Does not know about `.env` files or specific PC paths.
    - **Credential-Carrying Agents**: AI agents are "dumb" until the platform "charges" them with an API key.

2.  **`@hub-spoke/cli`**: The Terminal Interface.
    - Handles local I/O, `~/.config` persistence, and terminal styling.
    - Implements the `WinstonLoggerProvider` for local file logging.

## 🛠️ Getting Started

### Prerequisites

- **Node.js**: v20 or higher
- **npm**: v7 or higher (for Workspaces support)

### Installation

From the root directory:

```bash
npm install
```

### Building the Ecosystem

Because the CLI depends on the Core, you must build the Core first:

```bash
# Build everything in the correct order
npm run build

# Or build specific packages
npm run build -w @hub-spoke/core
npm run build -w @hub-spoke/cli
```

### Global CLI Access

To use the `hub` command from anywhere on your machine:

```bash
cd packages/cli
npm link --force
```

## ⌨️ Common Development Scripts

| Command                                   | Action                                       |
| ----------------------------------------- | -------------------------------------------- |
| `npm run dev -w @hub-spoke/cli -- [args]` | Run the CLI in development mode using `tsx`. |
| `npm run test`                            | Run the test suite across all packages.      |
| `npm run build`                           | Transpile all TypeScript packages to ESM.    |
| `npm run lint`                            | Check code quality and formatting.           |

---

## 🗺️ Dependency Graph & Data Flow

1. **User** runs `hub fill`.
2. **CLI** fetches the API key from `~/.config/hub-spoke-cm/config.json`.
3. **CLI** finds the local workspace root and loads Agent files (`.md`).
4. **CLI** initializes Core Agents by passing them the API key and local content.
5. **Core Action** executes the AI logic and returns the personified content.
6. **CLI** writes the result back to the local Hub file.
