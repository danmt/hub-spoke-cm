# 📁 Package: `@hub-spoke/cli`

The Command Line Interface for the Hub & Spoke Content Manager. This package provides the terminal-based implementation of the Hub & Spoke ecosystem, handling filesystem interaction, user prompts, and global configuration.

## 🎯 Role in the Ecosystem

The CLI is a **Platform Implementation** of the `@hub-spoke/core`. While the Core contains the brains, the CLI provides:

- **Persistence**: Manages global secrets in `~/.config/hub-spoke-cm/config.json`.
- **User Interface**: Rich terminal interactions using `inquirer` and `chalk`.
- **Platform Services**: Implements Node.js-specific versions of Core interfaces (e.g., `WinstonLoggerProvider`).

## 🚀 Installation

### Global Link (Recommended for Dev)

To use the `hub` command from anywhere:

```bash
cd packages/cli
npm install
npm run build
npm link --force
```

### Development Mode

To run without building:

```bash
npm run dev -- [command]
```

## ⌨️ Command Reference

### ⚙️ Configuration

The CLI manages your Gemini API credentials and model preferences globally.

- `hub config list`: View current settings (API keys are masked for security).
- `hub config set-key <key>`: Update your Gemini API Key.
- `hub config set-model <model>`: Set the default model (e.g., `gemini-2.0-pro`).

### 🛠️ Workspace Management

- `hub init`: Scaffolds a new project structure in the current directory.
  - Creates `.hub/`, `agents/`, and `posts/`.
  - Generates a local `.gitignore`.
- `hub new`: Interactive wizard to architect a new Content Hub.
- `hub fill`: Populates missing content in existing Hub files using your custom agents.

### 🔍 Discovery & Validation

These commands allow you to inspect how the CLI is "seeing" your local agents before you run a heavy AI action.

- **`hub registry`**: Scans the `agents/` directory and displays a table of all discovered Personas, Writers, and Assemblers.
- **`hub check`**: The "System Health" command.
  - Validates the workspace structure.
  - Checks if the Gemini API Key is set and valid.
  - Verifies that at least one of each agent type is present.
  - Checks the `.hub/logs` permissions.

### 📦 Portability & Output

- **`hub export`**: Bundles a Hub, its structure, and all its generated posts into a single portable format (JSON or a standalone Markdown file).

## 🛠️ Architecture: The CLI-to-Core Bridge

The CLI bridges the gap between your local environment and the agnostic Core.

1. **Context Loading**: The CLI identifies the `workspaceRoot` and loads the global API key.
2. **Agent Charging**: The CLI reads markdown artifacts from `agents/` and "charges" them by passing the API key into the `RegistryService`.
3. **UI Interleaving**: The CLI provides callbacks to Core Actions. When the Core needs user feedback (e.g., "Do you like this blueprint?"), the CLI triggers an `inquirer` prompt.
4. **Logging**: The CLI initializes a `WinstonLoggerProvider` that directs all `@hub-spoke/core` trace logs into `.hub/logs/hub-trace-YYYY-MM-DD.log`.

## 📂 Configuration Storage

The CLI stores global data in a standard Unix-style hidden directory:

- **Path**: `~/.config/hub-spoke-cm/config.json`
- **Format**: JSON validated by the Core `HubConfigSchema`.

## 🧪 Development Guidelines

- **UI Logic Only**: Keep the CLI focused on "How it looks." All "How it works" logic should be moved to `@hub-spoke/core`.
- **Async Safety**: Ensure all commands handle `IoService` failures gracefully (e.g., if a user runs `hub fill` outside of a workspace).
- **Color Palette**: Use `chalk.cyan` for information, `chalk.green` for success, and `chalk.red` for errors to maintain a consistent "vibe."
