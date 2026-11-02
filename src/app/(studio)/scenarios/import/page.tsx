'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { FacultyGate } from '@/components/FacultyGate';
import { ImportReview } from '@/components/import/ImportReview';
import { ImportStart } from '@/components/import/ImportStart';
import { PageHead } from '@/components/ui/PageHead';

function ImportContent() {
  const search = useSearchParams();
  const sourceId = search.get('source');
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHead
        eyebrow="Case library"
        title={sourceId ? 'Review the imported run sheet' : 'Import a run sheet'}
        lede={
          sourceId
            ? 'Check each field against the source on the left. Accept what is right, edit what is not, and enter what the sheet leaves out. Saving puts the scenario in your library as a draft for the editor and approval.'
            : 'Turn an existing instructor run sheet into a Capno scenario without rewriting it.'
        }
        actions={
          <Link href="/scenarios" className="btn-ghost">
            ← Library
          </Link>
        }
      />
      {sourceId ? <ImportReview sourceId={sourceId} /> : <ImportStart />}
    </div>
  );
}

export default function ImportPage() {
  return (
    <FacultyGate>
      <Suspense>
        <ImportContent />
      </Suspense>
    </FacultyGate>
  );
}
