# 🏗️ Hub & Spoke CM

**Hub & Spoke CM** is an AI-powered CLI tool designed to automate the creation of high-quality technical content clusters using the **Hub and Spoke** strategy. Instead of treating content as isolated files, this system views them as a "Distributed Plan"—a network of interconnected nodes where a central "Hub" (the deep-dive authority) orchestrates several "Spokes" (satellite articles) to maximize SEO, educational depth, and topical authority.

Built with **TypeScript** and powered by **Google Gemini**, the tool treats the local filesystem as a stateful database, using Markdown files as the primary interface for "Vibe Coding".

---

## 🏛️ System Architecture

The tool is divided into three distinct layers that decouple project planning from content generation:

### 1. The Intelligence Layer (Agents & Personas)

- **`ArchitectAgent`**: Acts as the project manager. It conducts an interactive "interview" with the user, validates requirements against available tools, and outputs a structured `Brief`.
- **Personas**: Located in `src/core/personas/`, these define the "voice" of the content (e.g., `ArgentinianPersona`, `SarcasticSpanishPersona`). They ensure consistency across the entire cluster.

### 2. The Structural Layer (Assemblers)

- **Assemblers**: Found in `src/core/assemblers/`, these are the "blueprints" of document organization.
- **`TutorialAssembler`**: Focuses on logical, step-by-step progression.
- **`DeepDiveAssembler`**: Focuses on senior-level technical scrutiny, internals, and trade-offs.

### 3. The Writing Layer (Specialized Strategies)

Using the **Strategy Pattern**, the system routes specific content sections to specialized AI writers:

- **`ProseWriter`**: Optimized for narrative flow, transitions, and clarity.
- **`CodeWriter`**: Optimized for technical accuracy, providing clean, production-ready code blocks.

---

## 🛠️ CLI Commands

### `hub new`

Initializes a new content Hub.

1. **Discovery**: Triggers an interactive interview to define topic, goal, audience, and language.
2. **Scaffolding**: The `Architect` selects a `Persona` and `Assembler`.
3. **Blueprinting**: Generates a `hub.md` file with YAML frontmatter and `TODO` placeholders for each section.

### `hub spawn`

Creates a satellite "Spoke" article.

- It inherits the `personaId`, `audience`, and `language` from the parent Hub.
- It creates a new file in the `/spokes` directory, linked back to the Hub via the `hubId`.

### `hub fill`

The primary generation engine.

- **Parsing**: Scans Markdown files for `> **TODO:**` blocks.
- **Routing**: Consults the `writerMap` in the frontmatter to determine whether to use the `CodeWriter` or `ProseWriter` for each section.
- **Merging**: Performs "Sectional Parsing" to update only the `TODO` blocks while preserving any human-edited text.

### `hub check`

Audits the project for consistency.

- Validates "Persona Drift" (ensuring all spokes match the hub's persona).
- Validates "Language Mismatch".
- Identifies empty sections or pending `TODO` blocks.

### `hub map`

Visualizes the relationship between the Hub and its Spokes.

- Scans the `/spokes` directory and maps files back to specific sections in the `hub.md` based on internal links and metadata.

### `hub config`

Manages global settings.

- `set-key`: Sets the Gemini API Key.
- `set-model-architect`: Configures the model for planning (default: `gemini-3-flash-preview`).
- `set-model-writer`: Configures the model for prose generation (default: `gemini-3-flash-preview`).

---

## 📂 FileSystem as a Database

The system relies on strict metadata schemas to manage state without a central database:

- **Frontmatter (`schemas.ts`)**: Every file contains Zod-validated metadata, including the `hubId`, `personaId`, and `writerMap`.
- **Recursive Discovery**: The CLI uses `findHubRoot` to allow users to run commands from any subdirectory; the tool will search upwards until it finds the `hub.md` file.
- **Sectional Parsing**: Using regex-based splitting, the tool treats H2 headers as keys in a `Record<string, string>`, allowing granular updates to specific document parts.

---

## 🚀 Getting Started

### Installation

```bash
npm install
npm run build

```

### Setup

1. Set your API key:

```bash
hub config set-key YOUR_GEMINI_API_KEY

```

2. Start a new project:

```bash
hub new

```

3. Generate content:

```bash
hub fill

```
