# 🏗️ Hub & Spoke CM

**Hub & Spoke CM** is an AI-powered CLI tool designed to automate high-quality technical content clusters. By treating the local filesystem as a stateful database, it enables "Vibe Coding" workflows where content is managed as an interconnected network of nodes.

## 🧠 The Agentic Registry

The heart of the tool is a dynamic **Registry** that manages your "Intelligence Layer". Instead of hardcoded prompts, the system discovers specialized agents as Markdown artifacts within your workspace.

### How it Works:

- **Discovery**: The `RegistryService` scans the `/agents` directory for Markdown files.
- **Discriminated Types**: Each file is categorized by its frontmatter `type` into one of four categories: **Personas**, **Writers**, or **Assemblers**.
- **Live Loading**: Adding a new `.md` file to an agent folder immediately makes that strategy available to the CLI without a rebuild or code change.
- **Context Injection**: The Registry converts these artifacts into active agents, injecting their specific strategies into the Gemini model's system instructions.

---

## 🏛️ System Architecture

### 1. The Structural Layer (Assemblers)

Assemblers act as the "Blueprints" of document organization. They generate a `HubBlueprint` that maps headers to specific writing intents and writers. This blueprint is persisted in the file's frontmatter to maintain the "Source of Truth".

### 2. The Writing Layer (Specialized Strategies)

Using the **Strategy Pattern**, the system routes sections to specialized Writers (e.g., `ProseWriter`, `CodeWriter`). This ensures that technical implementation and narrative flow are handled by agents optimized for those specific tasks.

### 3. The Validation Layer (Verification-First)

- **Structural Integrity**: The `check` logic ensures consistency in persona, language, and completion (no TODOs).

---

## 🛠️ CLI Commands

- **`hub init`**: Scaffolds a new workspace and seeds starter agents (Persona, Writer, Assembler) into `/agents`.
- **`hub new`**: Conducts an Architect interview to plan a Hub. It saves the structural intent as a `blueprint` in the frontmatter.
- **`hub fill`**: The generation engine that executes the `writerMap` strategy to replace `> **TODO:**` blocks with prose or code.
- **`hub check`**: A fast, static audit to identify pending content or metadata inconsistencies.

---

## 📂 Hub Workspaces

A Hub Workspace is defined by its directory structure, allowing for decentralized content management:

- **`.hub/`**: Internal workspace marker.
- **`agents/`**: Your local Intelligence Layer. Dropping a file into `agents/writers/` creates a new writing strategy.
- **`posts/`**: The content database. Every Hub folder contains a `hub.md`.

### Setup

1. **Configure**: `hub config set-key YOUR_GEMINI_API_KEY`.
2. **Initialize**: `hub init`.
3. **Create**: `hub new`.
