const router = require('express').Router();
const auth   = require('../middleware/auth');
const { supabase } = require('../config/supabase');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Curated general-purpose free chat models. OpenRouter tries them in order
// (automatic fallback). At most 3 allowed in a fallback list.
const MODELS = [
  'openai/gpt-oss-20b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
];

const SYSTEM_PROMPT = `You are Baba, a warm, encouraging study buddy inside Peer Bridge — a peer-mentorship community for NUST (National University of Sciences & Technology, Pakistan) students.
Help students with academics, study tips, career/internship guidance, and university life. Be concise, friendly, and practical. Use simple explanations and small examples. Format with short paragraphs or bullet points. If a question needs a human mentor, gently suggest connecting with a mentor or posting in the feed. Never make up facts about a specific person or NUST policy — say you're not sure instead.`;

const TAGS = ['Academic Help', 'Career & Internships', 'Resources', 'Events & Societies'];

// ── Per-user rate guard (in-memory; resets on restart) ──────────────────
const hits = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 12;
function rateLimited(userId) {
  const now = Date.now();
  const arr = (hits.get(userId) || []).filter(t => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) { hits.set(userId, arr); return true; }
  arr.push(now); hits.set(userId, arr); return false;
}

// ── Shared OpenRouter caller. Returns the assistant text or throws. ─────
async function callOpenRouter(messages, { maxTokens = 800, system = SYSTEM_PROMPT } = {}) {
  if (!process.env.OPENROUTER_API_KEY) {
    const e = new Error('Ask Baba is not configured yet.'); e.status = 503; throw e;
  }
  const payload = {
    models: MODELS,
    messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
    max_tokens: maxTokens,
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
    const e = new Error(r.status === 429
      ? 'Baba is a bit busy right now (rate limited). Please try again in a moment.'
      : 'Baba could not answer right now. Please try again.');
    e.status = 502; throw e;
  }
  const data = await r.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) { const e = new Error('Baba had nothing to say — try rephrasing.'); e.status = 502; throw e; }
  return { text, model: data?.model || MODELS[0] };
}

function guard(req, res) {
  if (!process.env.OPENROUTER_API_KEY) { res.status(503).json({ error: 'Ask Baba is not configured yet.' }); return false; }
  if (rateLimited(req.user.id)) { res.status(429).json({ error: 'Slow down a sec — too many AI requests. Try again shortly.' }); return false; }
  return true;
}

// ════════════════════════════════════════════════════════════════════
// POST /api/ai/ask  { messages | question }  — the Baba chat assistant
// ════════════════════════════════════════════════════════════════════
router.post('/ask', auth, async (req, res) => {
  try {
    if (!guard(req, res)) return;
    let messages = Array.isArray(req.body.messages) ? req.body.messages : null;
    if (!messages) {
      const q = (req.body.question || '').trim();
      if (!q) return res.status(400).json({ error: 'Ask me something!' });
      messages = [{ role: 'user', content: q }];
    }
    messages = messages
      .filter(m => m && typeof m.content === 'string' && ['user', 'assistant'].includes(m.role))
      .slice(-12).map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
    if (!messages.length) return res.status(400).json({ error: 'Ask me something!' });

    const { text, model } = await callOpenRouter(messages, { maxTokens: 800 });
    res.json({ answer: text, model });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Something went wrong.' });
  }
});

// ════════════════════════════════════════════════════════════════════
// POST /api/ai/summarize  { post_id }  — TL;DR of a post + its replies
// ════════════════════════════════════════════════════════════════════
router.post('/summarize', auth, async (req, res) => {
  try {
    if (!guard(req, res)) return;
    const { post_id } = req.body;
    if (!post_id) return res.status(400).json({ error: 'post_id is required' });

    const { data: post } = await supabase
      .from('posts').select('title, body').eq('id', post_id).maybeSingle();
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const { data: replies } = await supabase
      .from('replies').select('text, author:author_id(name)').eq('post_id', post_id)
      .order('created_at', { ascending: true }).limit(40);

    const thread = [
      `POST: ${post.title}\n${post.body || ''}`,
      ...(replies || []).map((r, i) => `REPLY ${i + 1} (${r.author?.name || 'user'}): ${r.text}`),
    ].join('\n\n').slice(0, 8000);

    const { text } = await callOpenRouter(
      [{ role: 'user', content: `Summarize this discussion thread for a student in 3-5 short bullet points. Capture the question and the key answers/advice. Be concise.\n\n${thread}` }],
      { maxTokens: 500 },
    );
    res.json({ summary: text });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to summarize.' });
  }
});

// ════════════════════════════════════════════════════════════════════
// POST /api/ai/match-mentors  { query }  — rank best mentors for a need
// ════════════════════════════════════════════════════════════════════
router.post('/match-mentors', auth, async (req, res) => {
  try {
    if (!guard(req, res)) return;
    const query = (req.body.query || '').trim();
    if (!query) return res.status(400).json({ error: 'Describe what you need help with.' });

    const { data: mentors } = await supabase
      .from('users')
      .select('id, name, department, bio, skills, rating')
      .eq('role', 'mentor').eq('is_under_review', false).eq('is_locked', false)
      .order('rating', { ascending: false }).limit(25);
    if (!mentors || !mentors.length) return res.json({ matches: [], note: 'No mentors available yet.' });

    const list = mentors.map((m, i) =>
      `${i}. ${m.name} — ${m.department || 'NUST'} | skills: ${(m.skills || []).join(', ') || 'n/a'} | ${(m.bio || '').slice(0, 120)}`
    ).join('\n');

    const { text } = await callOpenRouter([{
      role: 'user',
      content: `A student needs help with: "${query}".\nHere are mentors (numbered):\n${list}\n\nPick the 3 best-matching mentors. Reply with ONLY a JSON array of objects like [{"i":0,"reason":"one short sentence"}], best first. No other text.`,
    }], { maxTokens: 400, system: 'You are a precise matching assistant. Output only valid JSON.' });

    // Parse defensively.
    let picks = [];
    try {
      const m = text.match(/\[[\s\S]*\]/);
      picks = JSON.parse(m ? m[0] : text);
    } catch { picks = []; }

    const matches = (Array.isArray(picks) ? picks : [])
      .filter(p => Number.isInteger(p.i) && mentors[p.i])
      .slice(0, 3)
      .map(p => ({ ...mentors[p.i], reason: String(p.reason || '').slice(0, 160) }));

    // Fallback: top-rated if parsing failed.
    if (!matches.length) {
      mentors.slice(0, 3).forEach(m => matches.push({ ...m, reason: 'Highly rated mentor in a relevant area.' }));
    }
    res.json({ matches });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to match mentors.' });
  }
});

// ════════════════════════════════════════════════════════════════════
// POST /api/ai/suggest-replies  { messages }  — 3 short reply suggestions
// ════════════════════════════════════════════════════════════════════
router.post('/suggest-replies', auth, async (req, res) => {
  try {
    if (!guard(req, res)) return;
    const messages = (Array.isArray(req.body.messages) ? req.body.messages : [])
      .filter(m => m && typeof m.content === 'string').slice(-8)
      .map(m => `${m.role === 'me' ? 'Me' : 'Them'}: ${m.content.slice(0, 500)}`).join('\n');
    if (!messages) return res.json({ suggestions: [] });

    const { text } = await callOpenRouter([{
      role: 'user',
      content: `Here is a chat conversation:\n${messages}\n\nSuggest 3 short, friendly replies I (Me) could send next. Each under 12 words. Reply with ONLY a JSON array of strings, no other text.`,
    }], { maxTokens: 400, system: 'You output only valid JSON arrays of short strings.' });

    let suggestions = [];
    try { const m = text.match(/\[[\s\S]*\]/); suggestions = JSON.parse(m ? m[0] : text); } catch { suggestions = []; }
    suggestions = (Array.isArray(suggestions) ? suggestions : [])
      .filter(s => typeof s === 'string').map(s => s.slice(0, 80)).slice(0, 3);
    res.json({ suggestions });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed.' });
  }
});

// ════════════════════════════════════════════════════════════════════
// POST /api/ai/suggest-tag  { title, body }  — pick the best post tag
// ════════════════════════════════════════════════════════════════════
router.post('/suggest-tag', auth, async (req, res) => {
  try {
    if (!guard(req, res)) return;
    const title = (req.body.title || '').trim();
    const body  = (req.body.body || '').trim();
    if (!title && !body) return res.status(400).json({ error: 'Write something first.' });

    const { text } = await callOpenRouter([{
      role: 'user',
      content: `Classify this student post into exactly ONE category from: ${TAGS.join(' | ')}.\n\nTitle: ${title}\nBody: ${body.slice(0, 1000)}\n\nReply with ONLY the exact category name, nothing else.`,
    }], { maxTokens: 200, system: 'You output only one of the allowed category names, verbatim.' });

    const tag = TAGS.find(t => text.toLowerCase().includes(t.toLowerCase())) || null;
    res.json({ tag });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed.' });
  }
});

module.exports = router;
