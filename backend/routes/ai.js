const router = require('express').Router();
const auth   = require('../middleware/auth');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Curated general-purpose free chat models. OpenRouter tries them in order
// (automatic fallback) — avoids the random `openrouter/free` router picking
// a specialised model (e.g. a content-safety classifier).
// OpenRouter allows at most 3 models in a fallback list.
const MODELS = [
  'openai/gpt-oss-20b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
];

const SYSTEM_PROMPT = `You are Baba, a warm, encouraging study buddy inside Peer Bridge — a peer-mentorship community for NUST (National University of Sciences & Technology, Pakistan) students.
Help students with academics, study tips, career/internship guidance, and university life. Be concise, friendly, and practical. Use simple explanations and small examples. Format with short paragraphs or bullet points. If a question needs a human mentor, gently suggest connecting with a mentor or posting in the feed. Never make up facts about a specific person or NUST policy — say you're not sure instead.`;

// ── Tiny per-user rate guard (in-memory; resets on restart) ─────────────
const hits = new Map();   // userId -> [timestamps]
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 8;
function rateLimited(userId) {
  const now = Date.now();
  const arr = (hits.get(userId) || []).filter(t => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) { hits.set(userId, arr); return true; }
  arr.push(now); hits.set(userId, arr); return false;
}

// ── POST /api/ai/ask  { messages: [{role, content}], context? } ─────────
router.post('/ask', auth, async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({ error: 'Ask Baba is not configured yet.' });
    }
    if (rateLimited(req.user.id)) {
      return res.status(429).json({ error: 'Slow down a sec — too many questions at once. Try again shortly.' });
    }

    // Accept either a full messages array or a single question.
    let messages = Array.isArray(req.body.messages) ? req.body.messages : null;
    if (!messages) {
      const q = (req.body.question || '').trim();
      if (!q) return res.status(400).json({ error: 'Ask me something!' });
      messages = [{ role: 'user', content: q }];
    }
    // Keep only the last 12 turns and clamp content length.
    messages = messages
      .filter(m => m && typeof m.content === 'string' && ['user', 'assistant'].includes(m.role))
      .slice(-12)
      .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
    if (!messages.length) return res.status(400).json({ error: 'Ask me something!' });

    const payload = {
      models: MODELS,            // ordered fallback list
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 800,
    };

    const r = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type' : 'application/json',
        'HTTP-Referer' : 'https://peer-bridge.app',
        'X-Title'      : 'Peer Bridge - Ask Baba',
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('OpenRouter error', r.status, detail.slice(0, 300));
      const msg = r.status === 429
        ? 'Baba is a bit busy right now (rate limited). Please try again in a moment.'
        : 'Baba could not answer right now. Please try again.';
      return res.status(502).json({ error: msg });
    }

    const data = await r.json();
    const answer = data?.choices?.[0]?.message?.content?.trim();
    if (!answer) return res.status(502).json({ error: 'Baba had nothing to say — try rephrasing.' });

    res.json({ answer, model: data?.model || MODELS[0] });
  } catch (err) {
    console.error('ai/ask failed:', err.message);
    res.status(500).json({ error: 'Something went wrong asking Baba.' });
  }
});

module.exports = router;
