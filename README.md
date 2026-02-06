# 🏗️ Hub & Spoke CM

**Hub & Spoke CM** is an AI-powered CLI tool designed to automate the creation of high-quality technical content clusters. It treats your filesystem as a stateful database, using Markdown files as the primary interface for "Vibe Coding".

## 🏛️ System Architecture

The tool is divided into four distinct layers that decouple project planning, generation, and quality control:

### 1. The Intelligence Layer (Agents & Personas)

- **`ArchitectAgent`**: Conducts an interactive interview to define the project scope and selects the best tools for the job.
- **`Auditor`**: A specialized quality-control agent that analyzes semantic integrity, "Intent Drift," and cohesion.
- **Personas**: Define the "voice" (tone, accent, language) to ensure consistency across the entire cluster.

### 2. The Structural Layer (Assemblers)

- **Assemblers**: Act as the "Blueprints" of document organization (e.g., `TutorialAssembler`, `DeepDiveAssembler`). They generate a `HubBlueprint` that maps headers to specific writing intents.

### 3. The Writing Layer (Specialized Strategies)

- **`Writer`**: Specialized agents (e.g., `ProseWriter`, `CodeWriter`) that execute specific sections based on the intent defined in the blueprint.

### 4. The Validation Layer (Verification Loop)

- **Semantic Audit**: Unlike a simple "check," the audit verifies if the content matches the original blueprint intent.
- **Verification Loop**: When a fix is requested, the system generates a candidate, asks the Auditor to verify it, and only performs a surgical merge if the issue is resolved.

---

## 🛠️ CLI Commands

### `hub init`

Initializes a new workspace.

- **Starter Mode**: Deploys standard personas, writers, and the **Standard Auditor** (which checks for robotic tone and flow).

### `hub new`

Initializes a new content Hub.

1. **Interview**: The `Architect` defines topic, goal, and audience.
2. **Blueprinting**: Persists the original structural intent into the `hub.md` frontmatter as a `blueprint`.
3. **Scaffolding**: Generates placeholders and `writerMap` assignments.

### `hub spawn`

Creates a satellite "Spoke" article.

- Inherits persona, audience, and language from the parent Hub.
- Generates its own dedicated `blueprint` for future auditing.

### `hub fill`

The primary generation engine.

- Scans for `> **TODO:**` blocks and routes them to the correct `Writer` strategy defined in the frontmatter.

### `hub audit`

The advanced quality control engine.

1. **Integrity Check**: Enforces a structural check (ensures no TODOs or persona drift).
2. **Semantic Analysis**: Uses a selected `Auditor` strategy to find semantic issues.
3. **Verified Fix**: Refactors problematic sections and verifies the fix before merging.

### `hub check`

Performs a structural audit to identify pending TODOs, language mismatches, or persona drift across the workspace.

---

## 📂 FileSystem as a Database

The system relies on strict metadata schemas to manage state:

- **`blueprint`**: Stores the original "Intent" for every section so the Auditor can detect if the generated content drifted from the plan.
- **`writerMap`**: Maps specific headers to specialized Writing strategies (Code vs Prose).
- **Sectional Parsing**: Uses regex-based splitting to treat H2 headers as keys, allowing the **Verification Loop** to refactor specific sections without touching the rest of the file.

---

## 🚀 Getting Started

1. **Install Dependencies**: `npm install && npm run build`.
2. **Configure API**: `hub config set-key YOUR_GEMINI_API_KEY`.
3. **Initialize**: `hub init` to seed your agents.
4. **Create**: `hub new` to plan your first Hub.
5. **Verify**: `hub audit` to ensure your content is production-ready.
