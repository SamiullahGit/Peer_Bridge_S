// Pretty-prints a role enum. Kept tolerant of legacy values that may
// still exist on stale sessionStorage payloads.

const LABELS = {
  student   : 'Student',
  mentor    : 'Mentor',
  admin     : 'Admin',
  // Legacy fallbacks from the SQL era.
  freshman  : 'Student',
  sophomore : 'Student',
  junior    : 'Student',
  senior    : 'Mentor',
  lead_mentor: 'Mentor',
};

export function roleLabel(role) {
  return LABELS[role] || role;
}
