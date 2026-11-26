import type { ReactNode } from 'react';

/**
 * Inline icon set — 24px grid, 1.75 stroke, currentColor. Hand-drawn here on
 * purpose (no icon dependency; see CLAUDE.md invariant 6). Icons are
 * decorative by default: label the control, not the icon.
 */
const PATHS = {
  home: <path d="M4 11.5 12 4l8 7.5V20h-5.5v-5.5h-5V20H4z" />,
  library: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  play: <path d="M7 4.5v15l12-7.5z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
  reset: <path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5" />,
  undo: <path d="M9 5 4 10l5 5M4 10h10a5 5 0 0 1 0 10h-3" />,
  redo: <path d="M15 5l5 5-5 5M20 10H10a5 5 0 0 0 0 10h3" />,
  debrief: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M8.5 13l2.5 2.5 4.5-5" />
    </>
  ),
  edit: <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17zM14.5 7.5l3 3" />,
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4M6.5 11h2.5l1.5-3 2.5 5 1.5-2h3" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </>
  ),
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="18.5" cy="12" r="1.2" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  'arrow-up': <path d="M12 19V5M6 11l6-6 6 6" />,
  'arrow-down': <path d="M12 5v14M6 13l6 6 6-6" />,
  external: <path d="M14 5h5v5M19 5l-8 8M11 6H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-5" />,
  upload: <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />,
  download: <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" />,
  print: (
    <>
      <path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2" />
      <rect x="7" y="14" width="10" height="6" rx="1" />
    </>
  ),
  save: <path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  file: <path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" />,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  code: <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16v4M17 18h4" />,
  alert: <path d="M12 4 2.5 20h19zM12 10v4.5M12 17.5v.01" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.01" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />,
  bell: <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5h4" />,
  'bell-off': <path d="M6 16V11a6 6 0 0 1 9-5.2M18 11v5l1.5 2H8M10 20.5h4M4 4l16 16" />,
  cloud: <path d="M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 9.5 4.3 4.3 0 0 1 17 18z" />,
  fullscreen: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 18,
  className,
}: {
  name: IconName;
  /** Rendered size in px. */
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={`shrink-0 ${className ?? ''}`}
    >
      {PATHS[name]}
    </svg>
  );
}
