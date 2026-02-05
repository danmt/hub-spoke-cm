# 🏗️ Hub & Spoke CM

The system is designed around a **"Distributed Plan"** philosophy. Instead of a centralized database, the tool treats Markdown files as stateful nodes. The architecture is divided into three primary layers: **Orchestration**, **Intelligence**, and **Persistence**.

## 1. The Core Execution Flow

Every content cluster follows a strict lifecycle managed by different components of the system:

1. **Discovery (The Interview):** The `new` command initializes the `ArchitectAgent`.
2. **Scaffolding (The Blueprint):** The Architect selects a `Persona` and an `Assembler`. The `Assembler` generates a `HubBlueprint`.
3. **Persistence (The Write):** The system translates the blueprint into a physical directory and a `hub.md` file with metadata and `TODO` placeholders.
4. **Expansion (Spoke Generation):** The `spawn` command creates satellite articles that inherit context from the Hub's frontmatter.
5. **Generation (The Fill):** The `fill` command parses the files, identifies `TODO` blocks, and routes them to specialized `Writer` strategies.

## 2. Component Interaction Map

### A. The Intelligence Layer (Agents & Personas)

- **`ArchitectAgent`:** Acts as the project manager. It holds the conversation history and uses a system instruction that includes a manifest of all available tools. It is responsible for outputting a structured `Brief` in JSON format.
- **Personas:** Located in `src/core/personas/`, these classes (e.g., `ArgentinianPersona`, `SarcasticSpanishPersona`) provide the unique system instructions for the LLM. They ensure that even if different models are used for planning and writing, the "voice" remains consistent across the cluster.

### B. The Structural Layer (Assemblers)

Found in `src/core/assemblers/`, Assemblers are the architects of the document structure.

- **`generateSkeleton(brief)`:** This core method takes the user's goals and returns a `HubBlueprint`, which includes an array of `HubComponent` objects.
- **Logic Routing:** Each component in the blueprint is assigned a `writerId` (e.g., `code` or `prose`), which pre-determines how that section will be generated later.

### C. The Writing Layer (Strategies)

The system uses the **Strategy Pattern** for content generation in `src/core/writers/`.

- **`ProseWriter`:** Optimized for natural language, flow, and educational tone.
- **`CodeWriter`:** Optimized for technical accuracy, providing implementation blocks with comments in the target language.
- **Execution:** The `FillService` identifies which writer to use by looking up the `writerMap` stored in the file's YAML frontmatter.

## 3. The "FileSystem as Database" Logic

State management is handled through a combination of **Frontmatter** and **Sectional Parsing**:

- **Frontmatter Schema (`schemas.ts`):** We use **Zod** to strictly enforce the metadata structure. This includes the `hubId` (the link between nodes), `personaId` (the voice), and `writerMap` (the generation strategy).
- **The Parser (`parser.ts`):** This component is critical for "Vibe Coding." It uses a regex-based approach to split a single Markdown file into a `Record<string, string>` where the keys are H2 headers and the values are the body content. This allows the tool to update only the sections marked with `TODO` while leaving human-edited sections untouched.
- **Recursive Root Discovery:** The `findHubRoot` utility allows the CLI to work from any subdirectory by searching upwards for a `hub.md` file, ensuring spokes always find their parent context.

## 4. Sequence Diagram: Creating a Hub

1. **User** runs `hub new`.
2. **`newCommand`** prompts for basics and instantiates `ArchitectAgent`.
3. **`ArchitectAgent`** interviews the user until a `[FINALIZE]` tag is issued.
4. **`Assembler`** creates the `HubBlueprint` based on the finalized `Brief`.
5. **`IO Utility`** creates the directory and writes the initial `hub.md`.
6. **User** runs `hub fill`.
7. **`FillService`** reads `hub.md`, parses sections, and calls the appropriate **Writer** for each `TODO`.
8. **`reconstructMarkdown`** merges the new AI content with existing frontmatter and saves it back to the disk.

---

## 🔧 Configuration & Models

The tool allows split-model usage to balance cost and intelligence:

- **Architect Model:** Defaulting to `gemini-3-flash-preview` (or configured via `set-model-architect`), used for complex reasoning and planning.
- **Writer Model:** Used for prose generation, allowing for faster, cheaper models like `gemini-1.5-flash`.

This decoupled architecture ensures that as AI models or technical writing requirements evolve, we only need to add new `Assemblers`, `Personas`, or `Writers` without re-engineering the core CLI.
