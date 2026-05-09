import { initialsOf, avatarColors } from '../utils/avatar.js';

// Generic round avatar. If `imgUrl` is provided, renders an <img>;
// otherwise paints initials on a deterministic gradient swatch.

export default function Avatar({ name = '?', size = 36, imgUrl = '', shape = 'circle', online = false }) {
  const radius = shape === 'square' ? '18px' : '50%';

  if (imgUrl) {
    return (
      <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
        <div style={{
          width: size, height: size, borderRadius: radius, overflow: 'hidden',
          flexShrink: 0, border: '2px solid #E4EAF2',
        }}>
          <img src={imgUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        {online && <OnlineDot size={size} />}
      </div>
    );
  }

  const init   = initialsOf(name);
  const [bg, fg] = avatarColors(name);
  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: radius,
        background: `linear-gradient(135deg, ${bg}, ${fg}33)`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.38), fontWeight: 700, color: fg,
        flexShrink: 0,
      }}>
        {init}
      </div>
      {online && <OnlineDot size={size} />}
    </div>
  );
}

function OnlineDot({ size }) {
  const dot = Math.max(8, Math.round(size * 0.28));
  return (
    <span style={{
      position: 'absolute', bottom: 0, right: 0,
      width: dot, height: dot, borderRadius: '50%',
      background: '#22C55E', border: '2px solid #fff',
    }} />
  );
}
