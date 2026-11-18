import type { ComponentChildren, JSX } from 'preact';

export type PlatformName = 'facebook' | 'instagram' | 'linkedin' | 'tiktok';

const paths: Record<PlatformName, JSX.Element> = {
  facebook: <path d="M13.5 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.3V13h2.8v8z" />,
  instagram: <>
    <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2.2" />
    <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="2.2" />
    <circle cx="17.7" cy="6.6" r="1.2" />
  </>,
  linkedin: <>
    <path d="M5.3 8.7a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM3.8 10h3v10h-3zM9 10h2.9v1.4h.1a3.2 3.2 0 0 1 2.9-1.6c3.1 0 3.7 2 3.7 4.6V20h-3v-5c0-1.2 0-2.7-1.7-2.7s-2 1.3-2 2.6V20H9z" />
  </>,
  tiktok: <>
    <path d="M14.1 3h3c.2 1.7 1.2 3.2 2.9 4v3.1a9 9 0 0 1-3-.9v6.1a6.3 6.3 0 1 1-6.3-6.3c.4 0 .8 0 1.2.1v3.2a3.2 3.2 0 1 0 2.2 3V3Z" transform="translate(-.8 -.3)" fill="#25f4ee" />
    <path d="M14.1 3h3c.2 1.7 1.2 3.2 2.9 4v3.1a9 9 0 0 1-3-.9v6.1a6.3 6.3 0 1 1-6.3-6.3c.4 0 .8 0 1.2.1v3.2a3.2 3.2 0 1 0 2.2 3V3Z" transform="translate(.6 .4)" fill="#fe2c55" />
    <path d="M14.1 3h3c.2 1.7 1.2 3.2 2.9 4v3.1a9 9 0 0 1-3-.9v6.1a6.3 6.3 0 1 1-6.3-6.3c.4 0 .8 0 1.2.1v3.2a3.2 3.2 0 1 0 2.2 3V3Z" fill="currentColor" />
  </>,
};

const labels: Record<PlatformName, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
};

export function PlatformLogo({ platform, size = 'small' }: {
  platform: PlatformName;
  size?: 'small' | 'medium' | 'large';
}) {
  return (
    <span className={`platform-logo platform-logo-${platform} platform-logo-${size}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">{paths[platform]}</svg>
      <span className="sr-only">{labels[platform]}</span>
    </span>
  );
}

export function PlatformPill({ platform, children, compact = false }: {
  platform: 'facebook' | 'instagram';
  children?: ComponentChildren;
  compact?: boolean;
}) {
  return (
    <span className={`chip platform-pill ${platform}${compact ? ' compact' : ''}`} title={labels[platform]}>
      <PlatformLogo platform={platform} size="small" />
      {compact ? <span className="sr-only">{labels[platform]}</span> : children ?? labels[platform]}
    </span>
  );
}
