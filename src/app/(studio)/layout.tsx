'use client';

import { AppShell } from '@/components/shell/AppShell';

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
