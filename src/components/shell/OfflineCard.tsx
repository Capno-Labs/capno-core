'use client';

import { useEffect, useState } from 'react';

/** Small offline-readiness card at the bottom of the sidebar. */
export function OfflineCard() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return (
    <div className="mx-1 mb-1 rounded-ctl bg-panel p-3 ring-1 ring-line">
      <div className="flex items-center gap-2 text-xs font-bold text-ink">
        <span
          className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-green' : 'bg-amber'}`}
          aria-hidden
        />
        {online ? 'Offline ready' : 'Offline mode'}
      </div>
      <div className="mt-1 text-[11px] text-faint">
        {online
          ? 'Scenarios and sessions work without a connection.'
          : 'No connection — everything local keeps working.'}
      </div>
    </div>
  );
}
