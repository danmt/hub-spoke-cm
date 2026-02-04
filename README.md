# Hub & Spoke Content Manager 🧠✍️

> **Scale your technical content without losing your soul.**
> A CLI for "Vibe Coding" complex articles using the Hub & Spoke strategy and Google Gemini.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

## 🚀 What is this?

This is a **Node.js CLI tool** designed for technical writers and developer advocates. It helps you plan, generate, and manage large content clusters ("Hubs") and their satellite articles ("Spokes").

Unlike generic AI writers, this tool respects your **filesystem as the database**. You work in Markdown, edit files manually in your favorite IDE ("Vibe Coding"), and use the CLI only to automate the boring stuff: structure planning, first drafts, and internal linking.

## ✨ Features

- **🧠 AI Architect:** Generates a comprehensive `anatomy.json` blueprint based on your topic and audience.
- **📝 Vibe Coding:** Writes content directly into your Markdown files without overwriting your manual edits.
- **🔗 Auto-Linking:** Automatically manages bidirectional links between the Hub and its Spokes.
- **✅ The Reconciler:** Checks your `hub.md` against the blueprint to find missing sections or orphaned content.
- **🗺️ Visualization:** Visualizes your content graph in the terminal.

## 🛠️ Installation

### Prerequisites

- Node.js v18+
- A Google Gemini API Key ([Get one here](https://aistudio.google.com/))

### Setup

1.  **Clone and Install:**

```bash
git clone [https://github.com/danmt/hub-spoke-cm.git](https://github.com/danmt/hub-spoke-cm.git)
cd hub-spoke-cm
npm install
```

2.  **Build & Link:**

This compiles the TypeScript code and registers the `hub` command globally.

```bash
npm run build
npm link
```

3.  **Configure API Key:**

You can set your key globally so you don't need a `.env` file in every project.

```bash
hub config set-key AIzaSyB...YourKey
```

## ⚡ Workflow

### 1. Initialize a Hub

Start by defining your project. The AI will propose a structure for you.

```bash
hub new "Advanced Rust Concurrency"
```

- **Prompts:** Asks for Goal ("Teach async/await") and Audience ("Senior Devs").
- **Output:** Creates a folder with `anatomy.json` and a skeleton `hub.md`.

### 2. Verify Structure

Go into your new folder. You can manually edit `hub.md` (change headers, delete sections) and then run:

```bash
cd advanced-rust-concurrency
hub check
```

- **Green (✅):** Section exists in both `anatomy.json` and `hub.md`.
- **Red (❌):** Defined in blueprint but missing in the file.
- **Yellow (⚠️):** You added a custom section manually (not in blueprint).

### 3. Generate Content (The "Fill")

Generate a first draft for specific sections. The AI reads the `intent` from the blueprint to write relevant prose.

```bash
# Fill a specific section
hub fill --component async-basics

# Or fill all empty sections
hub fill --all
```

- **Note:** It _only_ fills the text between headers. It won't touch your surrounding notes.

### 4. Spawn Spokes

Need to deep-dive into a specific sub-topic? Spawn a "Spoke" article.

```bash
hub spawn --component async-basics "understanding-tokio"
```

- **Magic:**

1. Creates `spokes/understanding-tokio.md`.
2. Writes an intro based on the context of the "async-basics" section.
3. **Adds a link** in `hub.md` pointing to the new spoke.
4. **Adds a backlink** in the spoke pointing to the hub.

### 5. Visualize

See the tree of your content cluster.

```bash
hub map
```

## 📂 Project Structure

A Hub is just a folder. You can commit it to Git as usual.

```text
my-hub-topic/
├── anatomy.json       # The Blueprint (Metadata, Goals, Component Intent)
├── hub.md             # The Main Article (Source of Truth)
└── spokes/            # Satellite Articles
    ├── deep-dive-1.md
    └── deep-dive-2.md
```

**`anatomy.json` Example:**

```json
{
  "hubId": "rust-concurrency",
  "goal": "Explain async rust",
  "components": [
    {
      "id": "setup",
      "header": "Setting up the Environment",
      "intent": "Explain how to install Tokio and Cargo."
    }
  ]
}
```

## ❓ Troubleshooting

**`zod: permission denied: hub`**
The build process might have reset file permissions. Run:

```bash
npm run build
```

_(We included a fix in `package.json` to auto-restore permissions on build)._

**`Error: 404 Not Found (Gemini)`**
The specific AI model version might be deprecated or unavailable in your region.

1. Open `src/core/ai.ts`.
2. Change `const MODEL_NAME = 'gemini-1.5-flash-001'` to a supported version.

**Content isn't syncing?**
The parser relies on **H2 (`##`)** and **H3 (`###`)** headers to identify sections.

- Ensure your `anatomy.json` "header" field matches the Markdown header text exactly.
- Run `hub check` to see mismatches.

## 🛡️ License

MIT © [Your Name]
