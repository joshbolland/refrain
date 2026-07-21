'use client';

import { ArrowLeft, Cloud, Database, LogOut, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';
import { useWorkspaceStore } from '@/lib/workspace-store';

export function SettingsWorkspace() {
  const { user, signOut } = useAuthStore((state) => ({ user: state.user, signOut: state.signOut }));
  const { files, recordings, projects } = useWorkspaceStore((state) => ({ files: state.files, recordings: state.recordings, projects: state.projects }));
  const providers = user?.identities?.map((identity) => identity.provider).filter(Boolean).join(', ') || 'Preview session';
  return <section className="rf-scrollbar h-full overflow-y-auto bg-paper">
    <header className="rf-glass sticky top-0 z-10 flex h-14 items-center border-b border-divider px-3"><Link href="/library" className="notes-icon-button md:hidden"><ArrowLeft size={18} /></Link><h1 className="ml-2 text-sm font-semibold">Settings</h1></header>
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8 md:py-12">
      <h2 className="text-[32px] font-bold tracking-[-0.04em]">Account & Workspace</h2><p className="mt-2 text-sm text-muted">Your Refrain identity, sync status, and library overview.</p>
      <div className="mt-8 overflow-hidden rounded-2xl border border-divider">
        <SettingRow icon={UserRound} label="Email" value={user?.email ?? 'Preview user'} />
        <SettingRow icon={Cloud} label="Sign-in provider" value={providers} />
        <SettingRow icon={Database} label="Library" value={`${files.length} lyrics · ${recordings.length} recordings · ${projects.length} projects`} last />
      </div>
      <div className="mt-8 rounded-2xl border border-divider p-5"><h3 className="text-sm font-semibold">Sync</h3><p className="mt-2 text-sm leading-6 text-muted">Refrain keeps your lyrics, recordings, Projects, and links in your private Supabase workspace.</p><div className="mt-4 flex items-center gap-2 text-xs text-muted"><span className="size-2 rounded-full bg-green-500" />Connected</div></div>
      <button type="button" onClick={() => void signOut()} className="mt-8 flex items-center gap-2 rounded-xl border border-divider px-4 py-2.5 text-sm font-medium text-danger hover:bg-red-50"><LogOut size={16} />Sign out</button>
    </div>
  </section>;
}

function SettingRow({ icon: Icon, label, value, last = false }: { icon: typeof UserRound; label: string; value: string; last?: boolean }) {
  return <div className={`flex items-center gap-3 bg-paper px-4 py-4 ${last ? '' : 'border-b border-divider'}`}><span className="flex size-8 items-center justify-center rounded-lg bg-accentSoft text-accentPressed"><Icon size={16} /></span><span className="text-sm font-medium">{label}</span><span className="ml-auto max-w-[60%] truncate text-right text-sm text-muted">{value}</span></div>;
}
