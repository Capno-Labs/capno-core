'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/cloud/authStore';
import { supabaseConfigured } from '@/lib/sync/supabase';

/** Topbar connectivity pill: local-first status at a glance. */
export function SyncPill() {
  const status = useAuthStore((s) => s.status);
  const [online, setOnline] = useState(true);
  const [cloud, setCloud] = useState(false);

  useEffect(() => {
    setCloud(supabaseConfigured());
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const label = !online
    ? 'Offline · local'
    : cloud && status === 'signed_in'
      ? 'Cloud · signed in'
      : cloud
        ? 'Cloud available'
        : 'Local device';
  const dot = !online ? 'bg-amber' : cloud && status === 'signed_in' ? 'bg-green' : 'bg-faint';

  return (
    <span className="hidden items-center gap-1.5 rounded-full bg-panel-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted sm:inline-flex">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      {label}
    </span>
  );
}
