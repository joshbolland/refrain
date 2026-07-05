'use client';

import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  FolderKanban,
  LogOut,
  Mic2,
  Plus,
  RefreshCw,
  Settings,
  UserCircle,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { useAuthStore } from '@/lib/auth-store';
import { useWorkspaceStore } from '@/lib/workspace-store';

import { cx } from './workspace-primitives';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { user, signOut } = useAuthStore((state) => ({
    user: state.user,
    signOut: state.signOut,
  }));
  const createLyric = useWorkspaceStore((state) => state.createLyric);
  const { workspaceError, refreshWorkspace, workspaceLoading } = useWorkspaceStore((state) => ({
    workspaceError: state.error,
    refreshWorkspace: state.refresh,
    workspaceLoading: state.isLoading,
  }));

  const handleCreateLyric = async () => {
    const lyric = await createLyric();
    setCreateOpen(false);
    router.push(`/library?lyric=${lyric.id}`);
  };

  const handleCreateRecording = () => {
    setCreateOpen(false);
    router.push('/library?capture=1');
  };

  const handleSignOut = async () => {
    setAccountOpen(false);
    await signOut();
  };

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden bg-canvas">
      <TopAppBar
        accountOpen={accountOpen}
        createOpen={createOpen}
        onAccountOpenChange={setAccountOpen}
        onCreateLyric={() => void handleCreateLyric()}
        onCreateOpenChange={setCreateOpen}
        onCreateRecording={handleCreateRecording}
        onSignOut={() => void handleSignOut()}
        pathname={pathname}
        userEmail={user?.email ?? 'Unknown user'}
      />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {workspaceError ? (
          <div className="mx-4 mt-4 flex shrink-0 flex-col gap-3 rounded-2xl border border-danger/25 bg-red-50 px-4 py-3 text-sm text-danger md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 gap-3">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              <p className="min-w-0 leading-6">{workspaceError}</p>
            </div>
            <button
              type="button"
              onClick={() => void refreshWorkspace()}
              disabled={workspaceLoading}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-danger/25 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </main>
    </div>
  );
}

function TopAppBar({
  accountOpen,
  createOpen,
  onAccountOpenChange,
  onCreateLyric,
  onCreateOpenChange,
  onCreateRecording,
  onSignOut,
  pathname,
  userEmail,
}: {
  accountOpen: boolean;
  createOpen: boolean;
  onAccountOpenChange: (open: boolean) => void;
  onCreateLyric: () => void;
  onCreateOpenChange: (open: boolean) => void;
  onCreateRecording: () => void;
  onSignOut: () => void;
  pathname: string;
  userEmail: string;
}) {
  return (
    <header className="relative z-30 shrink-0 border-b border-divider bg-paper/88 px-3 py-2 shadow-[0_1px_0_rgba(17,24,39,0.02)] backdrop-blur-xl md:px-4">
      <div className="grid h-12 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <Link href="/library" className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-white/70">
          <Image
            alt=""
            className="rounded-lg object-contain"
            height={30}
            priority
            src="/assets/refrain-bird.png"
            width={30}
          />
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold leading-tight text-ink">Refrain</p>
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/65">Workspace</p>
          </div>
        </Link>

        <nav aria-label="Primary" className="relative flex items-center rounded-2xl border border-divider bg-canvas p-1 shadow-soft">
          <PrimaryNavLink href="/library" icon={BookOpen} label="Library" pathname={pathname} />
          <div className="relative px-1">
            <button
              type="button"
              onClick={() => {
                onCreateOpenChange(!createOpen);
                onAccountOpenChange(false);
              }}
              aria-label="Create"
              title="Create"
              className={cx(
                'flex h-9 w-9 items-center justify-center rounded-full border text-white shadow-soft transition',
                createOpen
                  ? 'border-accentPressed bg-accentPressed'
                  : 'border-accent bg-accent hover:bg-accentPressed',
              )}
            >
              <Plus size={20} strokeWidth={2.5} />
            </button>
            {createOpen ? (
              <div className="absolute left-1/2 top-[calc(100%+10px)] w-56 -translate-x-1/2 rounded-2xl border border-divider bg-paper p-2 shadow-float">
                <button
                  type="button"
                  onClick={onCreateLyric}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-accentSoft"
                >
                  <BookOpen size={17} />
                  New lyric
                </button>
                <button
                  type="button"
                  onClick={onCreateRecording}
                  className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-accentSoft"
                >
                  <Mic2 size={17} />
                  New recording
                </button>
              </div>
            ) : null}
          </div>
          <PrimaryNavLink href="/projects" icon={FolderKanban} label="Projects" pathname={pathname} />
        </nav>

        <div className="relative flex min-w-0 justify-end">
          <button
            type="button"
            onClick={() => {
              onAccountOpenChange(!accountOpen);
              onCreateOpenChange(false);
            }}
            className={cx(
              'flex max-w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-sm font-semibold transition',
              pathname.startsWith('/settings') || accountOpen
                ? 'border-accent/40 bg-accentSoft text-accentPressed'
                : 'border-transparent text-muted hover:border-divider hover:bg-white/70 hover:text-ink',
            )}
          >
            <UserCircle size={20} />
            <span className="hidden max-w-[180px] truncate md:inline">{userEmail}</span>
            <ChevronDown size={15} />
          </button>

          {accountOpen ? (
            <div className="absolute right-0 top-[calc(100%+10px)] w-72 rounded-2xl border border-divider bg-paper p-2 shadow-float">
              <div className="px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/65">Signed in</p>
                <p className="mt-1 truncate text-sm font-semibold text-ink">{userEmail}</p>
              </div>
              <Link
                href="/settings"
                onClick={() => onAccountOpenChange(false)}
                className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:bg-accentSoft hover:text-ink"
              >
                <Settings size={17} />
                Settings
              </Link>
              <button
                type="button"
                onClick={onSignOut}
                className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-muted hover:bg-red-50 hover:text-danger"
              >
                <LogOut size={17} />
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function PrimaryNavLink({
  href,
  icon: Icon,
  label,
  pathname,
}: {
  href: string;
  icon: typeof BookOpen;
  label: string;
  pathname: string;
}) {
  const active = pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cx(
        'flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition sm:min-w-[104px] sm:justify-center',
        active ? 'bg-paper text-accentPressed shadow-soft' : 'text-muted hover:text-ink',
      )}
    >
      <Icon size={17} />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
