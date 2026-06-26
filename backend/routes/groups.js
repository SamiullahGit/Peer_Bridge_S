const router = require('express').Router();
const multer = require('multer');
const auth   = require('../middleware/auth');
const { supabase } = require('../config/supabase');
const { makeStorage, fileUrl } = require('../config/storage');

const upload = multer({
  storage: makeStorage('messages', 'gmsg'),
  limits : { fileSize: 15 * 1024 * 1024 },
});
function attachmentType(mime = '') {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O 1/I
function generateCode(len = 8) {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

async function recount(groupId) {
  const { count } = await supabase.from('group_members')
    .select('user_id', { count: 'exact', head: true }).eq('group_id', groupId);
  await supabase.from('study_groups').update({ member_count: count || 0 }).eq('id', groupId);
  return count || 0;
}

// ── GET /api/groups  (all groups + caller's membership info) ──────────
router.get('/', auth, async (req, res) => {
  try {
    const [{ data: groups, error }, { data: mine }] = await Promise.all([
      supabase.from('study_groups').select('*').order('created_at', { ascending: false }),
      supabase.from('group_members').select('group_id,role').eq('user_id', req.user.id),
    ]);
    if (error) throw error;

    const memberMap = Object.fromEntries((mine || []).map(m => [m.group_id, m.role]));
    res.json((groups || []).map(g => ({
      ...g,
      is_member: g.id in memberMap,
      my_role  : memberMap[g.id] || null,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// ── POST /api/groups/join-by-code  { code } ───────────────────────────
router.post('/join-by-code', auth, async (req, res) => {
  try {
    const code = (req.body.code || '').toUpperCase().trim();
    if (!code) return res.status(400).json({ error: 'Enter an invite code' });

    const { data: group } = await supabase
      .from('study_groups').select('*').eq('invite_code', code).maybeSingle();
    if (!group) return res.status(404).json({ error: 'No group found with that code' });

    const { error: insErr } = await supabase
      .from('group_members').insert({ group_id: group.id, user_id: req.user.id, role: 'member' });
    if (insErr && insErr.code !== '23505') throw insErr;

    const count = await recount(group.id);
    res.json({ ...group, member_count: count, is_member: true, my_role: 'member' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// ── POST /api/groups  (create) ────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, topic } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Group name is required' });

    // Unique invite code — retry up to 5 times on collision.
    let group, createErr;
    for (let attempt = 0; attempt < 5; attempt++) {
      const res2 = await supabase.from('study_groups')
        .insert({ name: name.trim(), description: description || null, topic: topic || null,
                  created_by: req.user.id, invite_code: generateCode() })
        .select().single();
      if (!res2.error) { group = res2.data; break; }
      if (res2.error.code !== '23505') { createErr = res2.error; break; }
    }
    if (!group) throw createErr || new Error('Failed to generate unique invite code');

    await supabase.from('group_members').insert({ group_id: group.id, user_id: req.user.id, role: 'admin' });
    await supabase.from('study_groups').update({ member_count: 1 }).eq('id', group.id);

    res.status(201).json({ ...group, member_count: 1, is_member: true, my_role: 'admin' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// ── POST /api/groups/:id/join ─────────────────────────────────────────
router.post('/:id/join', auth, async (req, res) => {
  try {
    const { error } = await supabase.from('group_members')
      .insert({ group_id: req.params.id, user_id: req.user.id, role: 'member' });
    if (error && error.code !== '23505') throw error;

    const count = await recount(req.params.id);
    res.json({ ok: true, member_count: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// ── DELETE /api/groups/:id/join  (leave) ─────────────────────────────
router.delete('/:id/join', auth, async (req, res) => {
  try {
    // Admins can leave too — but if they're the only admin, block it.
    const { data: me } = await supabase.from('group_members').select('role')
      .eq('group_id', req.params.id).eq('user_id', req.user.id).maybeSingle();

    if (me?.role === 'admin') {
      const { count: adminCount } = await supabase.from('group_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('group_id', req.params.id).eq('role', 'admin');
      if (adminCount <= 1) {
        const { count: total } = await supabase.from('group_members')
          .select('user_id', { count: 'exact', head: true }).eq('group_id', req.params.id);
        if (total > 1) return res.status(400).json({ error: 'Assign another admin before leaving' });
      }
    }

    await supabase.from('group_members')
      .delete().eq('group_id', req.params.id).eq('user_id', req.user.id);

    const count = await recount(req.params.id);
    res.json({ ok: true, member_count: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

// ── GET /api/groups/:id/members ───────────────────────────────────────
router.get('/:id/members', auth, async (req, res) => {
  try {
    const { data: myMembership } = await supabase.from('group_members')
      .select('role').eq('group_id', req.params.id).eq('user_id', req.user.id).maybeSingle();
    if (!myMembership) return res.status(403).json({ error: 'Not a member of this group' });

    const { data: members, error } = await supabase.from('group_members')
      .select('role, joined_at, user:user_id(id,name,role,department,profile_image)')
      .eq('group_id', req.params.id)
      .order('joined_at', { ascending: true });
    if (error) throw error;

    res.json((members || []).map(m => ({
      id           : m.user?.id,
      name         : m.user?.name,
      role         : m.user?.role,
      department   : m.user?.department,
      profile_image: m.user?.profile_image,
      group_role   : m.role,
      joined_at    : m.joined_at,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// ── DELETE /api/groups/:id/members/:userId  (kick — admin only) ───────
router.delete('/:id/members/:userId', auth, async (req, res) => {
  try {
    const { data: me } = await supabase.from('group_members').select('role')
      .eq('group_id', req.params.id).eq('user_id', req.user.id).maybeSingle();
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Use /leave to remove yourself' });

    await supabase.from('group_members')
      .delete().eq('group_id', req.params.id).eq('user_id', req.params.userId);

    const count = await recount(req.params.id);
    res.json({ ok: true, member_count: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// ── PATCH /api/groups/:id/members/:userId/role  (promote/demote — admin) ─
router.patch('/:id/members/:userId/role', auth, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Role must be admin or member' });

    const { data: me } = await supabase.from('group_members').select('role')
      .eq('group_id', req.params.id).eq('user_id', req.user.id).maybeSingle();
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

    await supabase.from('group_members').update({ role })
      .eq('group_id', req.params.id).eq('user_id', req.params.userId);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// ── DELETE /api/groups/:id  (delete group — admin only) ───────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const { data: me } = await supabase.from('group_members').select('role')
      .eq('group_id', req.params.id).eq('user_id', req.user.id).maybeSingle();
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

    await supabase.from('study_groups').delete().eq('id', req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// ── GET /api/groups/:id/messages ──────────────────────────────────────
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const { data: member } = await supabase.from('group_members')
      .select('user_id').eq('group_id', req.params.id).eq('user_id', req.user.id).maybeSingle();
    if (!member) return res.status(403).json({ error: 'Join the group first' });

    const { data: msgs, error } = await supabase.from('group_messages')
      .select('id, text, created_at, is_pinned, reply_to, attachment_url, attachment_type, attachment_name, sender:sender_id(id,name,role,profile_image)')
      .eq('group_id', req.params.id)
      .order('created_at', { ascending: true }).limit(100);
    if (error) throw error;

    res.json((msgs || []).map(m => ({
      id          : m.id, text: m.text, created_at: m.created_at,
      is_pinned   : m.is_pinned || false, reply_to: m.reply_to,
      attachment_url : m.attachment_url, attachment_type: m.attachment_type, attachment_name: m.attachment_name,
      sender_id   : m.sender?.id,  sender_name : m.sender?.name,
      sender_role : m.sender?.role, sender_image: m.sender?.profile_image,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ── POST /api/groups/:id/messages ─────────────────────────────────────
router.post('/:id/messages', auth, upload.single('attachment'), async (req, res) => {
  try {
    const text = (req.body.text || '').trim();
    const file = req.file;
    if (!text && !file) return res.status(400).json({ error: 'Message cannot be empty' });

    const { data: member } = await supabase.from('group_members')
      .select('user_id').eq('group_id', req.params.id).eq('user_id', req.user.id).maybeSingle();
    if (!member) return res.status(403).json({ error: 'Join the group first' });

    const row = { group_id: req.params.id, sender_id: req.user.id, text: text || null,
                  reply_to: req.body.reply_to || null };
    if (file) {
      row.attachment_url  = fileUrl(file);
      row.attachment_type = attachmentType(file.mimetype);
      row.attachment_name = file.originalname || 'attachment';
    }

    const { data: msg, error } = await supabase.from('group_messages')
      .insert(row)
      .select().single();
    if (error) throw error;

    res.status(201).json({
      id: msg.id, text: msg.text, created_at: msg.created_at,
      is_pinned: false, reply_to: msg.reply_to,
      attachment_url: msg.attachment_url, attachment_type: msg.attachment_type, attachment_name: msg.attachment_name,
      sender_id: req.user.id, sender_name: req.user.name,
      sender_role: req.user.role, sender_image: null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ── PATCH /api/groups/:id/messages/:msgId/pin  (admin: pin/unpin) ──────
router.patch('/:id/messages/:msgId/pin', auth, async (req, res) => {
  try {
    const { data: me } = await supabase.from('group_members').select('role')
      .eq('group_id', req.params.id).eq('user_id', req.user.id).maybeSingle();
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

    const pin = req.body.pinned !== false;
    // Only one pinned announcement at a time — clear others when pinning.
    if (pin) {
      await supabase.from('group_messages').update({ is_pinned: false })
        .eq('group_id', req.params.id).eq('is_pinned', true);
    }
    await supabase.from('group_messages').update({ is_pinned: pin })
      .eq('id', req.params.msgId).eq('group_id', req.params.id);
    res.json({ ok: true, is_pinned: pin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to pin message' });
  }
});

module.exports = router;
