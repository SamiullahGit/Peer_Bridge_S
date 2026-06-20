import '../styles/skeleton.css';

// Primitive shimmer block. w/h are any CSS size; r is border-radius.
export function Skel({ w = '100%', h = 12, r = 6, style }) {
  return <span className="skel" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

// Render `count` copies of a skeleton element (keeps callers tidy).
export function SkelList({ count, children }) {
  return Array.from({ length: count }, (_, i) => <span key={i} style={{ display: 'contents' }}>{children}</span>);
}

const col = { display: 'flex', flexDirection: 'column' };

/* ── Feed post card ─────────────────────────────────────────────────── */
export function PostCardSkeleton() {
  return (
    <div className="post-card" aria-hidden="true">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <Skel w={42} h={42} r="50%" />
        <div style={{ ...col, gap: 7, flex: 1 }}>
          <Skel w="38%" h={12} />
          <Skel w="24%" h={10} />
        </div>
        <Skel w={56} h={22} r={999} />
      </div>
      <Skel w="80%" h={16} style={{ marginBottom: 12 }} />
      <Skel w="100%" h={11} style={{ marginBottom: 7 }} />
      <Skel w="92%"  h={11} style={{ marginBottom: 7 }} />
      <Skel w="60%"  h={11} style={{ marginBottom: 16 }} />
      <div style={{ display: 'flex', gap: 22 }}>
        <Skel w={48} h={14} /><Skel w={48} h={14} /><Skel w={48} h={14} /><Skel w={48} h={14} />
      </div>
    </div>
  );
}

/* ── Mentor directory card ──────────────────────────────────────────── */
export function MentorCardSkeleton() {
  return (
    <article className="skel-card" style={{ ...col, gap: 16, padding: 22, borderRadius: 24 }} aria-hidden="true">
      <div style={{ display: 'flex', gap: 14 }}>
        <Skel w={56} h={56} r={14} />
        <div style={{ ...col, gap: 8, flex: 1, paddingTop: 4 }}>
          <Skel w="55%" h={14} />
          <Skel w="40%" h={11} />
          <Skel w="50%" h={11} />
        </div>
      </div>
      <Skel w="100%" h={11} /><Skel w="95%" h={11} /><Skel w="70%" h={11} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    paddingTop: 14, borderTop: '1px solid var(--line)', marginTop: 'auto' }}>
        <Skel w={90} h={11} />
        <div style={{ display: 'flex', gap: 8 }}><Skel w={64} h={30} r={999} /><Skel w={64} h={30} r={999} /></div>
      </div>
    </article>
  );
}

/* ── Resource card ──────────────────────────────────────────────────── */
export function ResourceCardSkeleton() {
  return (
    <div className="skel-card" style={{ ...col, gap: 12 }} aria-hidden="true">
      <div style={{ display: 'flex', gap: 14 }}>
        <Skel w={48} h={48} r={12} />
        <div style={{ ...col, gap: 8, flex: 1, paddingTop: 4 }}>
          <Skel w="80%" h={13} />
          <Skel w="40%" h={18} r={999} />
        </div>
      </div>
      <Skel w="100%" h={11} /><Skel w="85%" h={11} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    paddingTop: 10, borderTop: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Skel w={24} h={24} r="50%" />
          <div style={{ ...col, gap: 5 }}><Skel w={80} h={10} /><Skel w={110} h={9} /></div>
        </div>
        <Skel w={80} h={30} r={8} />
      </div>
    </div>
  );
}

/* ── Event card ─────────────────────────────────────────────────────── */
export function EventCardSkeleton() {
  return (
    <div className="skel-card" style={{ padding: 0, overflow: 'hidden' }} aria-hidden="true">
      <Skel w="100%" h={120} r={0} />
      <div style={{ ...col, gap: 9, padding: '16px 22px' }}>
        <Skel w="90%" h={11} /><Skel w="70%" h={11} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <Skel w={22} h={22} r="50%" /><Skel w={120} h={10} />
        </div>
      </div>
    </div>
  );
}

/* ── Messages: conversation list row ────────────────────────────────── */
export function ConvoItemSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px' }} aria-hidden="true">
      <Skel w={44} h={44} r="50%" />
      <div style={{ ...col, gap: 8, flex: 1 }}><Skel w="45%" h={12} /><Skel w="75%" h={10} /></div>
    </div>
  );
}

/* ── Feed right-rail rows ───────────────────────────────────────────── */
export function PanelRowSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0' }} aria-hidden="true">
      <Skel w={36} h={36} r="50%" />
      <div style={{ ...col, gap: 6, flex: 1 }}><Skel w="55%" h={11} /><Skel w="40%" h={9} /></div>
    </div>
  );
}

/* ── Profile page ───────────────────────────────────────────────────── */
export function ProfileSkeleton() {
  return (
    <div className="page-shell" aria-hidden="true">
      <div className="card" style={{ padding: 32, marginBottom: 24, display: 'flex', gap: 24 }}>
        <Skel w={80} h={80} r="50%" />
        <div style={{ ...col, gap: 12, flex: 1, paddingTop: 6 }}>
          <Skel w="40%" h={22} />
          <Skel w="55%" h={12} />
          <Skel w="80%" h={11} /><Skel w="65%" h={11} />
        </div>
      </div>
      <div className="card" style={{ padding: 22 }}>
        <Skel w={160} h={20} style={{ marginBottom: 18 }} />
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ ...col, gap: 9, padding: '16px 0', borderTop: '1px solid var(--line)' }}>
            <Skel w={120} h={18} r={999} />
            <Skel w="70%" h={14} />
            <Skel w="90%" h={11} />
          </div>
        ))}
      </div>
    </div>
  );
}
