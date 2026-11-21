'use client';

import { useEffect, useState } from 'react';
import { applyTheme, getActiveTheme, type Theme } from '@/lib/theme';
import { Icon } from './Icon';

/** Dark/light switch. The DOM attribute (set pre-hydration by the inline
 *  script in layout.tsx) is the source of truth, so read it after mount. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(getActiveTheme());
  }, []);

  const next: Theme = theme === 'light' ? 'dark' : 'light';

  return (
    <button
      type="button"
      className="btn-ghost btn-icon"
      aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
      title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
    >
      <Icon name={theme === 'light' ? 'moon' : 'sun'} size={16} />
    </button>
  );
}
