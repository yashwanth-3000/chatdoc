# ChatDock

ChatDock is a hackathon project for making governed website chatbots. It helps teams design a website assistant, configure model fallback through TrueFoundry AI Gateway, scope MCP Gateway access, add guardrails, set budgets, and generate a demo-ready configuration.

The current repository is split into:

- `frontend` - the ChatDock website and chatbot builder UI
- `backend` - backend workspace placeholder for API and gateway integration work

## Design Note

The website UI direction was adapted from an older project layout, then reworked with new ChatDock content, chatbot maker flows, TrueFoundry hackathon positioning, and compact product screens.

## Run Frontend

```bash
cd frontend
npm run dev -- -p 3001
```

Open [http://localhost:3001](http://localhost:3001).

## Main Routes

- `/` - product overview
- `/builder` - chatbot configuration builder
- `/templates` - reusable chatbot templates
- `/architecture` - TrueFoundry architecture mapping
- `/demo` - judge-facing demo plan
- `/about` - hackathon brief
