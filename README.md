# senior-ai

An AI engineering team for **Claude Code** and **Mistral Vibe**, on **macOS, Linux and Windows**.

You describe what you want; a product-manager agent turns it into user stories, an architect decides how to build it, department agents build it, read-only reviewers check it in a loop until it passes, and a QA agent verifies the acceptance criteria end to end. Hooks keep it safe: no secrets in files, no destructive commands, and nothing is committed, pushed or deployed without your approval.

- [What you get](#what-you-get)
- [Install](#install)
- [Set up a project](#set-up-a-project)
- [Use](#use)
- [Update](#update)
- [Uninstall](#uninstall)
- [Documentation](#documentation)

---

## What you get

| Department | Agents | What they do |
|---|---|---|
| **Core** | `orchestrator` | Product manager: stories, acceptance criteria, task breakdown, delegation, follow-up, report |
| | `architect` | Studies the stack, chooses technologies, records decisions (ADRs), defines the technical approach |
| | `qa-engineer` | Turns acceptance criteria into Playwright end-to-end tests and reports pass or fail per criterion |
| **Frontend** | `ui-builder` | Builds UI components pixel-perfectly from a design, with Storybook stories |
| | `frontend-dev` | Builds pages, routing, forms, state and data access, with unit tests |
| | `i18n-specialist` | Makes text translatable: ICU plurals, locale formatting, right-to-left, translation files |
| | `code-auditor`, `a11y-auditor`, `visual-reviewer`, `perf-auditor`, `frontend-security` | Read-only reviewers: code quality, WCAG 2.2 AA accessibility, design fidelity, performance, security |
| **Backend** | `api-developer` | Builds endpoints, services and integrations, with unit and end-to-end tests |
| | `db-engineer` | Designs schemas, writes migrations that are safe on live data, adds indexes, optimizes queries |
| | `backend-reviewer`, `db-reviewer`, `backend-security` | Read-only reviewers: backend code, database changes, security |
| **DevOps** | *coming next* | Docker, Vercel, CI |

Plus 19 skills (Angular, NestJS, PostgreSQL, SCSS, design tokens, Storybook, accessibility, i18n, web performance, security, architecture, end-to-end testing…), a project memory in `.senior-ai/`, safety hooks, and optional MCP integrations (Playwright, Context7, GitHub, Chrome DevTools, Angular CLI, Figma, Vercel). See [the team](docs/team.md).

---

## Install

### 1. Install the prerequisites

You need **Node.js 22 or later**, **git**, and at least one AI tool.

**Node.js:** download the LTS version from [nodejs.org](https://nodejs.org). Check it in a terminal:

```bash
node --version
```

**git:** [git-scm.com/downloads](https://git-scm.com/downloads) (already installed on most macOS and Linux machines).

**Claude Code** ([docs](https://code.claude.com/docs/en/setup)), on macOS and Linux:

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

On Windows (PowerShell):

```powershell
irm https://claude.ai/install.ps1 | iex
```

**Mistral Vibe** ([docs](https://github.com/mistralai/mistral-vibe)), on macOS and Linux:

```bash
curl -LsSf https://mistral.ai/vibe/install.sh | bash
```

On Windows (PowerShell), install `uv`, then Vibe:

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

```powershell
uv tool install mistral-vibe
```

Start each AI tool once and log in before installing senior-ai.

### 2. Install senior-ai

Open a terminal in your home folder (or wherever you want to keep senior-ai), then:

```bash
git clone https://github.com/fereshenteti/senior-ai.git
```

```bash
cd senior-ai
```

macOS / Linux:

```bash
./install.sh
```

Windows (PowerShell or Command Prompt):

```powershell
.\install.cmd
```

The installer:
1. finds the AI tools installed on your machine;
2. asks which ones to install senior-ai for;
3. lists the optional extras (MCP servers and plugins) each tool is missing, and asks which to install: all, some or none. **None is required**: if you skip one, or it fails to install, senior-ai works without it;
4. installs senior-ai and the extras you chose;
5. prints a summary, including how to log in to extras that need an account (Figma, Vercel, GitHub).

Keep the `senior-ai` folder: updates are pulled into it. Installer options (`--tool`, `--yes`, `--no-extras`, `--dry-run`, `--uninstall`) are listed by `./install.sh --help` and in [docs/installer.md](docs/installer.md).

**Claude Code only, without cloning:**

```bash
claude plugin marketplace add fereshenteti/senior-ai
```

```bash
claude plugin install senior-ai@feres
```

This installs senior-ai itself, without the extras.

---

## Set up a project

Open your AI tool in the project's folder and run:

- **Claude Code:** `/senior-ai:setup-project`
- **Vibe:** ask *"Use the setup-project skill"*

It looks at the project, then asks you, in one message:
1. which AI tools the team uses;
2. which departments the project needs (frontend, backend, devops);
3. whether the project memory (`.senior-ai/`) is **shared in git** with the team or **kept on your machine** (added to `.gitignore`);
4. whether your Claude sessions should **start as the orchestrator** (default: no).

It then writes a project `AGENTS.md` with the facts it found (stack, commands, design source), creates the project memory, and for Claude Code turns senior-ai on for every teammate who opens the project. Commit the files it lists.

---

## Use

### Give the team a goal

In a session you already have open:

```
/senior-ai:orchestrate Users need to delete notes they no longer want
```

or mention the orchestrator: `@agent-senior-ai:orchestrator Users need to delete notes…`

To start a new session as the orchestrator:

```bash
claude --agent orchestrator
```

In Vibe, press `Shift+Tab` until the agent shown is `orchestrator`, or start with `vibe --agent orchestrator`.

The orchestrator writes the story and its acceptance criteria in `.senior-ai/stories/`, asks the architect when the work touches the structure, delegates each task with a review loop, has QA verify the result, and reports back. It asks you before committing, pushing, deploying or adding dependencies.

### Work with one agent

| To… | Claude Code (in a session) | Vibe |
|---|---|---|
| choose a technology or document the architecture | `@agent-senior-ai:architect …` | ask the orchestrator to involve the architect |
| build a UI component from a design | `@agent-senior-ai:ui-builder …` | `Shift+Tab` to `ui-builder` |
| review your changes | `@agent-senior-ai:code-auditor review my changes` | *"Use the code-auditor subagent to review my changes"* |
| test a story's acceptance criteria | `@agent-senior-ai:qa-engineer test S-003` | ask the orchestrator to involve QA |

Plain words work too: *"Use the architect agent to choose a database for this project."*

---

## Update

senior-ai never updates itself. When GitHub has a newer version, your AI tool tells you, with the command to run: Claude Code at the start of a session, Vibe after an answer (at most once a day).

**Claude Code:**

```bash
claude plugin update senior-ai@feres
```

Then restart Claude Code.

**Vibe:** in your `senior-ai` folder:

```bash
git pull
```

Then macOS / Linux:

```bash
./install.sh --tool vibe
```

Windows:

```powershell
.\install.cmd --tool vibe
```

---

## Uninstall

In your `senior-ai` folder, macOS / Linux:

```bash
./install.sh --uninstall
```

Windows:

```powershell
.\install.cmd --uninstall
```

It removes senior-ai, restores any files it had replaced, and asks whether to also remove the extras it installed (default: keep them).

---

## Documentation

- [The team](docs/team.md): departments, agents, skills, the review loop, model choice
- [Project memory](docs/project-memory.md): the `.senior-ai/` folder
- [Safety hooks](docs/hooks.md): what is blocked, what needs your approval, and in which tool
- [Optional extras](docs/extras.md): MCP servers and plugins, accounts, manual setup
- [Installer](docs/installer.md): options, what it changes, backups
- [Troubleshooting](docs/troubleshooting.md)
- [Maintaining senior-ai](docs/maintaining.md): structure, adding an agent, a skill, a stack or a tool, tests, releases
