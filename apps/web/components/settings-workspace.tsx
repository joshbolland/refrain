'use client';

import { useAuthStore } from '@/lib/auth-store';
import { useWorkspaceStore } from '@/lib/workspace-store';

export function SettingsWorkspace() {
  const { user, signOut } = useAuthStore((state) => ({
    user: state.user,
    signOut: state.signOut,
  }));
  const { files, recordings, collections } = useWorkspaceStore((state) => ({
    files: state.files,
    recordings: state.recordings,
    collections: state.collections,
  }));

  return (
    <section className="grid h-full min-h-[78vh] gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="rounded-[28px] border border-divider/70 bg-white/80 p-5 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted/70">Settings</p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">Account and workspace</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            ['Lyrics', files.length.toString()],
            ['Recordings', recordings.length.toString()],
            ['Collections', collections.length.toString()],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[24px] border border-divider bg-paper p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted/70">{label}</p>
              <p className="mt-3 text-3xl font-semibold text-ink">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-divider/70 bg-white/80 p-5 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted/70">Profile</p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">{user?.email ?? 'Unknown user'}</h2>
        <p className="mt-3 text-sm text-muted/80">
          Email/password and Google sign-in are supported on web in this first desktop release.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-5 rounded-full bg-accent px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-accentPressed"
        >
          Sign out
        </button>
      </div>
    </section>
  );
}
