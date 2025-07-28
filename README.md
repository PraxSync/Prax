<img width="1500" height="500" alt="image" src="https://github.com/user-attachments/assets/1fc5fe6b-4bdb-4f7b-8b94-45dc2156d7a6" />


<p align="center">
Prax: Visual workflows for building intelligent LLM agents.
</p>

<p align="center">
Wire logic. Run models. Build agents like systems.
</p>

<p align="center">
Multi-model. Modular. Memory-ready. Built for control.
</p>

---

Prax is a visual framework for creating agent flows powered by LLMs.

It lets you combine tools, prompts, memory, and multiple model providers into a single drag-and-drop interface.  
Build autonomous logic with full visibility and no boilerplate, designed for engineers, tinkerers, and AI explorers.

No vendor lock-in. No black boxes.  
Just structured intelligence, built your way.

---

### Features

- **Visual Agent Builder** — Drag, connect, and orchestrate LLM blocks with logic, tools, and memory.

- **Multi-LLM Support** — Seamlessly run OpenAI, Anthropic, and other providers side by side.

- **Prompt Blocks** — Design and reuse advanced prompt chains across agent workflows.

- **Tool Integration** — Call APIs, trigger code, and plug in custom functions with I/O blocks.

- **State + Memory** — Build agents with long-term recall and flow-aware context.

- **Transparent Execution** — See exactly how your logic runs with live visual feedback.

- **Headless Mode** — Export agents for server-side or production deployment.

---

### Tech Stack

- `frontend` : React (Vite), Tailwind CSS, Zustand, Framer Motion for visual interaction

- `backend` : Node.js (Express) for execution engine and model orchestration

- `workflow-engine` : Node-based agent execution graph with custom runtime

- `shared` : TypeScript utilities, schema definitions, and core types

- `ai-layer` : Multi-provider support (OpenAI, Anthropic, local models coming soon)

- `dev-tools` : TypeScript, ESLint, Prettier, Vitest, TurboRepo

---

### Getting Started

1. Clone the repository:

```bash
git clone https://github.com/PraxSync/prax.git
cd prax 
```

---

### How it Works

1. User builds agent logic on canvas using nodes

2. Nodes represent prompt chains, tools, memory, and control flow

3. Execution engine resolves the graph in real-time

4. Visual feedback updates as outputs return from LLMs

5. Agents can be saved, exported, or deployed

---

### License

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](https://opensource.org/licenses/MIT)

---

### Links

Website: [Prax](https://www.praxsync.tech/)

Docs: [PraxDocs](https://praxsync.gitbook.io/prax/)

Twitter: [@PraxSync](https://x.com/PraxSync)
