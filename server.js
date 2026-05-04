const express = require('express');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ---- CONFIG ----
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // set in environment
const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'scores.json');

if (!OPENAI_API_KEY) {
  console.warn('⚠️  Missing OPENAI_API_KEY env var. /api/submit will fail until set.');
}

function getOpenAIClient() {
  if (!OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: OPENAI_API_KEY });
}

function parseJsonFromModelText(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Empty model response');

  // Fast path: valid JSON already
  try {
    return JSON.parse(raw);
  } catch {}

  // Common case: fenced code block like ```json { ... } ```
  const unfenced = raw
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch {}

  // Fallback: extract first top-level JSON object
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = raw.slice(firstBrace, lastBrace + 1);
    return JSON.parse(candidate);
  }

  throw new Error('Could not parse JSON from model response');
}

// ---- DATA HELPERS ----
function loadData() {
  if (!fs.existsSync(DATA_FILE)) return { entries: {}, recent: [], totalSubmissions: 0 };
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ---- SCORING PROMPT ----
function buildScoringPrompt(scenario, userPrompt) {
  return `You are an expert AI prompt evaluator. A supply chain consultant has written a prompt intended to direct an AI assistant to help solve the following crisis scenario:

SCENARIO:
"${scenario}"

THEIR PROMPT:
"${userPrompt}"

Evaluate the prompt on exactly these 5 criteria, each scored out of 20:

1. context (0-20): Did they provide relevant background, facts, or situational context?
2. roleFraming (0-20): Did they assign the AI a specific role, persona, or expertise?
3. constraints (0-20): Did they include constraints like budget, timeline, stakeholders, or limitations?
4. specificity (0-20): Is the prompt concrete and specific rather than vague or generic?
5. outputFormat (0-20): Did they specify the desired output format, structure, or deliverable?

Respond ONLY with a valid JSON object in this exact format, no preamble, no markdown:
{
  "scores": {
    "context": <number>,
    "roleFraming": <number>,
    "constraints": <number>,
    "specificity": <number>,
    "outputFormat": <number>
  },
  "feedback": {
    "context": "<one sentence of specific feedback>",
    "roleFraming": "<one sentence of specific feedback>",
    "constraints": "<one sentence of specific feedback>",
    "specificity": "<one sentence of specific feedback>",
    "outputFormat": "<one sentence of specific feedback>"
  }
}`;
}

// ---- ROUTES ----

// Submit a prompt for scoring
app.post('/api/submit', async (req, res) => {
  const { name, track, prompt, scenario } = req.body;

  if (!name || !track || !prompt || !scenario) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(500).json({
        error: 'Server is missing OPENAI_API_KEY. Set it in the environment and restart the server.'
      });
    }

    // Call OpenAI for scoring
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: buildScoringPrompt(scenario, prompt) }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 600
    });

    const raw = completion.choices[0].message.content;
    const parsed = parseJsonFromModelText(raw);

    const { scores, feedback } = parsed;
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

    // Save to data store
    const data = loadData();
    const key = `${name.toLowerCase()}_${track}`;

    // Update participant entry (always keep latest)
    data.entries[key] = { name, track, score: totalScore, prompt, updatedAt: Date.now() };

    // Add to recent submissions list (keep last 20)
    data.recent = [{ name, track, score: totalScore, prompt, timestamp: Date.now() }, ...data.recent].slice(0, 20);
    data.totalSubmissions = (data.totalSubmissions || 0) + 1;

    saveData(data);

    // Calculate rank
    const allScores = Object.values(data.entries).map(e => e.score);
    const rank = allScores.filter(s => s > totalScore).length + 1;

    return res.json({
      totalScore,
      scores,
      feedback,
      rank,
      totalParticipants: allScores.length
    });

  } catch (err) {
    console.error('Scoring error:', err);
    return res.status(500).json({ error: 'Scoring failed. Check your API key and try again.' });
  }
});

// Leaderboard endpoint (polled by dashboard every 3s)
app.get('/api/leaderboard', (req, res) => {
  const data = loadData();
  const entries = Object.values(data.entries).sort((a, b) => b.score - a.score);
  res.json({
    entries,
    recent: data.recent || [],
    totalSubmissions: data.totalSubmissions || 0
  });
});

// Reset all data (admin use)
app.post('/api/reset', (req, res) => {
  saveData({ entries: {}, recent: [], totalSubmissions: 0 });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Prompt Duel running at http://localhost:${PORT}`);
  console.log(`📱 Participant app: http://localhost:${PORT}/index.html`);
  console.log(`🖥  Host dashboard:  http://localhost:${PORT}/dashboard.html\n`);
});
