import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { WorkspacePreview } from '@/components/workspace-preview';

export default function PreviewPage() {
  if (process.env.NODE_ENV !== 'development' && process.env.REFRAIN_ENABLE_PREVIEW !== '1') {
    notFound();
  }

  return (
    <Suspense fallback={<main className="min-h-screen bg-canvas" />}>
      <WorkspacePreview />
    </Suspense>
  );
}
