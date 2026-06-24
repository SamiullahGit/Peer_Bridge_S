// Instagram/Twitter-style verified badge. Shown once a user reaches the
// follower threshold (see FOLLOWERS_FOR_VERIFIED).
export const FOLLOWERS_FOR_VERIFIED = 100;

export function isVerified(user) {
  return (user?.followers_count || 0) >= FOLLOWERS_FOR_VERIFIED;
}

export default function VerifiedTick({ size = 16 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      role="img" aria-label="Verified"
      style={{ flexShrink: 0, verticalAlign: 'middle' }}
    >
      <title>Verified · 100+ followers</title>
      {/* scalloped seal */}
      <path fill="#2563EB" d="M12 1l2.39 1.79 2.98.18 1.07 2.79 2.4 1.79-.9 2.85.9 2.85-2.4 1.79-1.07 2.79-2.98.18L12 23l-2.39-1.79-2.98-.18-1.07-2.79-2.4-1.79.9-2.85-.9-2.85 2.4-1.79 1.07-2.79 2.98-.18L12 1z"/>
      {/* check mark */}
      <path fill="#fff" d="M10.6 15.4l-3-3 1.4-1.4 1.6 1.6 4-4 1.4 1.4-5.4 5.4z"/>
    </svg>
  );
}
