# Hub & Spoke Content Manager 🧠✍️

> **Scale your technical content without losing your soul.**
> A CLI for "Vibe Coding" complex content clusters using the Hub & Spoke strategy and Google Gemini.

## 🚀 What is this?

This is a **Node.js CLI tool** designed for technical writers, developer advocates, and content strategists. It helps you plan, generate, and manage large content clusters ("Hubs") and their satellite articles ("Spokes").

**The Philosophy: "Vibe Coding"**
Unlike generic AI writers that vomit text into a black box, this tool respects your **filesystem as the database**.

- **No Hidden State:** The "Plan" lives inside your Markdown files as `> **TODO:**` blockquotes.
- **No Lock-in:** If you delete the tool, you still have valid, standard Markdown files.
- **Human-in-the-Loop:** You act as the Architect; the AI acts as the Ghostwriter.

---

## 🛠️ Installation

### Prerequisites

- Node.js v18+
- A Google Gemini API Key ([Get one here](https://aistudio.google.com/))

### Setup

1. **Clone and Install:**

```bash
git clone https://github.com/your-username/hub-spoke-cm.git
cd hub-spoke-cm
npm install
```

2. **Build & Link:**

This compiles the TypeScript code and registers the `hub` command globally.

```bash
npm run build
npm link
```

3. **Configure API Key:**

Store your key securely in your OS user config (not in the repo).

```bash
hub config set-key AIzaSyB...YourKey
```

## ⚡ Workflow

### 1. Initialize a Hub (`hub new`)

Start by defining your project. The AI "Architect" model will propose a structure.

```bash
hub new "Advanced Rust Concurrency"
```

- **Prompts:** Asks for Goal, Audience, and **Language** (English, Spanish, etc.).
- **Output:** Creates a folder with a `hub.md` containing the "Blueprint" as blockquote TODOs.

### 2. The "Vibe Check" (`hub check`)

See the status of your content at a glance.

```bash
cd advanced-rust-concurrency
hub check
```

- **Pending (⏳):** Sections with `> **TODO:**` or placeholder text.
- **Done (✅):** Sections with real content.
- **Empty (⚠️):** Sections that look too short.

### 3. Generate Content (`hub fill`)

Turn those TODOs into prose. You can fill one section or **batch** multiple sections into a single API request to save quota.

```bash
# Fill specific sections (interactive selection)
hub fill

# Fill a specific file (if not hub.md)
hub fill --file ./spokes/my-article.md
```

- **Batching:** If you select multiple sections, the CLI sends them all in one request, drastically reducing rate-limit errors.
- **Context:** The AI reads your Hub's "Goal" and "Language" from the frontmatter to ensure consistency.

### 4. Spawn Spokes (`hub spawn`)

Need to deep-dive into a specific sub-topic? Spawn a satellite article.

```bash
hub spawn "async-vs-threads"
```

- **Architecting:** The CLI acts as a conversational partner to outline the new article before creating it.
- **Linking:** Automatically adds a link in `hub.md` pointing to the new spoke, and a backlink in the spoke pointing to the Hub.

### 5. Visualize (`hub map`)

See the tree of your content cluster.

```bash
hub map
```

- **Green (●):** Completed content.
- **Red (○):** Pending content.
- **Structure:** Shows which Hub section links to which Spoke file.

## 📂 Project Structure

We use a **"Distributed Plan"** architecture. There is no central `anatomy.json`. The "Source of Truth" is the Markdown file itself.

```text
my-hub-topic/
├── hub.md             # The Core Article + Metadata (Frontmatter)
└── spokes/            # Satellite Articles
    ├── deep-dive-1.md
    └── deep-dive-2.md
```

**`hub.md` Example:**

```markdown
---
title: "Advanced Rust"
type: "hub"
hubId: "rust-concurrency"
goal: "Master async/await"
language: "English"       <-- AI uses this to force output language
---

## Setup

> **TODO:** Explain how to install Tokio.

_Pending generation..._
```

---

## ⚙️ Advanced Configuration

You can configure which Gemini models to use for different tasks. This allows you to use a **"Smart"** model for planning and a **"Fast"** model for writing.

**View current config:**

```bash
cat ~/.config/hub-spoke-cm/config.json
```

**Set Custom Models:**

```bash
# The "Architect" (Used for 'new' and 'spawn' structure planning)
# Recommended: gemini-1.5-pro or gemini-2.0-flash-exp
hub config set-model-architect gemini-1.5-pro-latest

# The "Writer" (Used for 'fill' prose generation)
# Recommended: gemini-1.5-flash (Fast & Cheap)
hub config set-model-writer gemini-1.5-flash
```

## ❓ Troubleshooting

**`zsh: permission denied: hub`**
The build process might have reset file permissions. Run:

```bash
npm run build
```

**`Error: 429 Too Many Requests`**
You are hitting the rate limit.

1. Try selecting fewer sections when running `hub fill`.
2. The tool automatically uses **Batching** when you select >1 section, which usually fixes this by doing 1 big request instead of 5 small ones.

**"My content is in English but I wanted Spanish"**
Check the `language` field in your file's frontmatter.

```yaml
---
language: "Spanish"
---
```

The AI strictly obeys this field.

## 🛡️ License

MIT © [Your Name]
