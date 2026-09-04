# CampusOS

An intelligent campus platform built for the AI Build Hackathon: a data dashboard for managing schedules, rooms, events, announcements, and assignments, plus an AI agent that reads and acts on that same live data through real tool calling.

## Overview

CampusOS is a single Node.js/Express app. On startup it seeds a SQLite database from the provided seed JSON files (only on first run — after that, SQLite is the source of truth). A vanilla JS dashboard on the left lets you view, add, edit, and delete records across all five systems, plus book rooms and register for events; every change is written straight to SQLite and reflected in the UI immediately, no manual refresh. A chat panel on the right talks to an AI agent (Claude, via the Anthropic Messages API) that uses real function/tool calling to query and modify the exact same database the dashboard uses — so an edit made in the dashboard is visible to the agent on the very next question, and an action the agent takes (like booking a room) shows up in the dashboard right away.

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** SQLite (via `better-sqlite3`), seeded once from `data/*.json` on first boot
- **Frontend:** Vanilla HTML/CSS/JS single-page dashboard (no build step, no framework)
- **AI Agent:** [Groq](https://groq.com) (`openai/gpt-oss-120b` by default) — free API tier, no credit card required. Called directly via Groq's OpenAI-compatible `/chat/completions` endpoint with **native tool/function calling** — the model calls real functions (`list_schedules`, `book_room`, `search_available_rooms`, `register_for_event`, etc.) that hit the live SQLite database through the same service layer the REST API uses. No prompt-chaining or faked function calling.

## Setup Instructions

**Requirements:** Node.js 18+

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# then open .env and paste your Groq API key into GROQ_API_KEY
# get a free key (no credit card needed) at https://console.groq.com/keys

# 3. Start the app
npm start
```

Open **http://localhost:3000** — the dashboard and the chat agent are both served from this one URL. The database file `campusos.db` is created automatically on first run and seeded from `data/*.json`; it persists across restarts (delete `campusos.db` if you ever want to reseed from scratch).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes (for the agent) | Free API key for Groq — get one at [console.groq.com/keys](https://console.groq.com/keys), no credit card required. The dashboard/CRUD works without it; only `/api/chat` needs it. |
| `GROQ_MODEL` | No | Overrides the model used by the agent. Defaults to `openai/gpt-oss-120b`. |
| `PORT` | No | Port for the server. Defaults to `3000`. |

## How to Use the Agent

Type into the chat panel on the right, or click one of the suggestion chips. Things it can handle:

- **Lookups:** "When is my next class?", "What classes do I have on Wednesday?", "What assignments are due this week?", "Show me high priority announcements."
- **Multi-source reasoning:** "I'm free until 2 — anything on campus I could drop into?", "Which labs have a projector and fit at least 30 people?"
- **Actions:** "Book Room 7A02 tomorrow from 3 to 5 PM" (it will ask for your name if you don't give one), "Register me for the Guest Lecture on Deep Learning."
- **Vague requests:** "Just book me any room tomorrow afternoon" — the agent will ask which room and time instead of guessing.
- **Live edits:** Edit or add something in the dashboard (e.g. change a room's capacity, post a new announcement), then immediately ask the agent about it — it always queries the current database, never a cached copy.

## Project Structure

```
campusos/
├── server/
│   ├── index.js           # Express entry point
│   ├── db.js               # SQLite setup + one-time seeding from data/*.json
│   ├── routes.js           # REST API for all 5 systems + booking/registration + /api/chat
│   ├── services/           # CRUD + business logic per resource (shared by API and agent)
│   └── agent/
│       ├── tools.js        # Tool definitions + executors the agent can call
│       └── chat.js         # Anthropic tool-calling loop
├── public/                 # Dashboard frontend (HTML/CSS/vanilla JS)
├── data/                   # Seed JSON (only used once, on first boot)
└── .env.example
```

## Notes

- All five systems (Schedules, Rooms, Events, Announcements, Assignments) support full add/edit/delete from the dashboard, with rooms additionally supporting **book/cancel** and events supporting **register/cancel**.
- Room booking checks for time-conflicts server-side before confirming.
- Event registration checks capacity and blocks duplicate/closed registrations.
- The agent's system prompt tells it to always call a tool before answering factual questions (never rely on memory) and to ask a clarifying question before booking/registering when the request is vague.
