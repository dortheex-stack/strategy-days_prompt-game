# 🏆 Prompt Duel

A live AI prompting competition for ~120 supply chain consultants.
Participants compete to write the best AI prompt for a real supply chain crisis.
Scores update on a live leaderboard in real time.

---

## Setup (5 minutes)

### 1. Install dependencies
```bash
npm install
```

### 2. Add your OpenAI API key
Set the `OPENAI_API_KEY` environment variable before running the app.

For local development, create a `.env` file or export it in your shell:
```bash
export OPENAI_API_KEY="your-openai-api-key"
```

Then start the server:
```bash
npm start
```

### 4. Open the apps
| App | URL | Who uses it |
|---|---|---|
| Participant app | http://localhost:3000 | All 120 participants on their phones |
| Host dashboard | http://localhost:3000/dashboard.html | Facilitator on the big screen |

---

## For a live event (sharing with 120 people)

You need to expose the server on your local network or deploy it.

**Option A — Local network (same WiFi)**
Find your machine's local IP:
- Mac: `ipconfig getifaddr en0`
- Windows: `ipconfig` → look for IPv4

Share: `http://192.168.x.x:3000` with participants.

**Option B — Deploy to the internet (recommended for reliability)**
Use [Railway](https://railway.app) or [Render](https://render.com) — both free tier, deploy in ~5 minutes.

---

## How it works

1. Participant opens link, enters name + track (Procurement / Operations / Strategy)
2. They see their track's crisis scenario
3. They write a prompt and submit
4. GPT-4o scores it on 5 criteria (each out of 20 = 100 total)
5. They see their score + per-criteria feedback instantly
6. They can resubmit as many times as they want — **only latest score counts**
7. Host dashboard auto-refreshes every 3 seconds

## Scoring Criteria (each /20)
- **Context** — Did they set the scene?
- **Role Framing** — Did they assign the AI a role/persona?
- **Constraints** — Budget, timeline, limitations?
- **Specificity** — Concrete vs vague?
- **Output Format** — Did they specify the deliverable?

## Admin
Reset all scores between sessions:
```bash
curl -X POST http://localhost:3000/api/reset
```

---

## File Structure
```
/project
  index.html       ← Participant app
  dashboard.html   ← Host leaderboard
  server.js        ← Express backend + OpenAI scoring
  package.json
  data/
    scores.json    ← Auto-created on first submission
```
