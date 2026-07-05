import { redirect } from 'next/navigation';

export default async function RecordingsPage({
  searchParams,
}: {
  searchParams: Promise<{ capture?: string; recording?: string }>;
}) {
  const params = await searchParams;
  const query: string[] = [];
  if (params.recording) {
    query.push(`recording=${encodeURIComponent(params.recording)}`);
  }
  if (params.capture) {
    query.push(`capture=${encodeURIComponent(params.capture)}`);
  }
  redirect(`/library${query.length ? `?${query.join('&')}` : ''}`);
}
