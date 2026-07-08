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
    <div className="flex h-dvh min-h-screen flex-col overflow-hidden bg-canvas">
      <TopAppBar
        accountOpen={accountOpen}
        createOpen={createOpen}
        onAccountOpenChange={setAccountOpen}
        onCreateLyric={() => void handleCreateLyric()}
        onCreateOpenChange={setCreateOpen}
        onCreateRecording={handleCreateRecording}
        onSignOut={() => void handleSignOut()}
        pathname={pathname}
        userEmail={user?.email ?? 'Refrain user'}
      />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[84px] md:pb-0">
        {workspaceError ? (
          <div className="mx-4 mt-4 flex shrink-0 flex-col gap-3 rounded-xl border border-danger/25 bg-red-50 px-4 py-3 text-sm text-danger md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 gap-3">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              <p className="min-w-0 leading-6">{workspaceError}</p>
            </div>
            <button
              type="button"
              onClick={() => void refreshWorkspace()}
              disabled={workspaceLoading}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-danger/25 bg-white px-3 py-2 text-xs font-semibold transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </main>

      <MobileNavigation
        createOpen={createOpen}
        onCreateLyric={() => void handleCreateLyric()}
        onCreateOpenChange={setCreateOpen}
        onCreateRecording={handleCreateRecording}
        pathname={pathname}
      />
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
  const initial = userEmail.trim().charAt(0).toUpperCase() || 'R';

  return (
    <header className="relative z-30 shrink-0 border-b border-divider bg-paper px-4 md:px-6">
      <div className="grid h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <Link href="/library" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Image
            alt=""
            className="size-8 scale-[1.35] object-contain"
            height={32}
            priority
            src="/assets/refrain-bird.png"
            width={32}
          />
          <span className="truncate text-[17px] font-semibold tracking-[-0.01em] text-ink">Refrain</span>
        </Link>

        <nav aria-label="Primary" className="hidden h-full items-center gap-2 md:flex">
          <PrimaryNavLink href="/library" icon={BookOpen} label="Library" pathname={pathname} />
          <PrimaryNavLink href="/projects" icon={FolderKanban} label="Projects" pathname={pathname} />
          <div className="relative ml-8">
            <button
              type="button"
              onClick={() => {
                onCreateOpenChange(!createOpen);
                onAccountOpenChange(false);
              }}
              aria-label="Create"
              title="Create"
              className={cx(
                'flex size-10 items-center justify-center rounded-full border text-white shadow-[0_6px_18px_rgba(124,143,255,0.24)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                createOpen
                  ? 'border-accentPressed bg-accentPressed'
                  : 'border-accent bg-accent hover:border-accentPressed hover:bg-accentPressed',
              )}
            >
              <Plus size={20} strokeWidth={2.25} />
            </button>
            {createOpen ? (
              <CreateMenu onCreateLyric={onCreateLyric} onCreateRecording={onCreateRecording} />
            ) : null}
          </div>
        </nav>

        <div className="relative col-start-3 flex min-w-0 justify-end">
          <button
            type="button"
            onClick={() => {
              onAccountOpenChange(!accountOpen);
              onCreateOpenChange(false);
            }}
            aria-expanded={accountOpen}
            className={cx(
              'flex items-center gap-2 rounded-full p-1 pr-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              pathname.startsWith('/settings') || accountOpen ? 'bg-accentSoft' : 'hover:bg-canvas',
            )}
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
              {initial}
            </span>
            <ChevronDown size={14} className="hidden text-muted sm:block" />
            <span className="sr-only">Account menu for {userEmail}</span>
          </button>

          {accountOpen ? (
            <div className="absolute right-0 top-[calc(100%+10px)] w-72 rounded-xl border border-divider bg-paper p-2 shadow-float">
              <div className="px-3 py-2">
                <p className="text-xs text-muted/70">Signed in as</p>
                <p className="mt-1 truncate text-sm font-semibold text-ink">{userEmail}</p>
              </div>
              <Link
                href="/settings"
                onClick={() => onAccountOpenChange(false)}
                className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-accentSoft hover:text-ink"
              >
                <Settings size={17} />
                Settings
              </Link>
              <button
                type="button"
                onClick={onSignOut}
                className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted hover:bg-red-50 hover:text-danger"
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

function CreateMenu({
  onCreateLyric,
  onCreateRecording,
  mobile = false,
}: {
  onCreateLyric: () => void;
  onCreateRecording: () => void;
  mobile?: boolean;
}) {
  return (
    <div
      className={cx(
        'w-56 rounded-xl border border-divider bg-paper p-2 shadow-float',
        mobile ? 'fixed bottom-[88px] left-1/2 -translate-x-1/2' : 'absolute left-1/2 top-[calc(100%+10px)] -translate-x-1/2',
      )}
    >
      <button
        type="button"
        onClick={onCreateLyric}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-accentSoft"
      >
        <BookOpen size={17} />
        New lyric
      </button>
      <button
        type="button"
        onClick={onCreateRecording}
        className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-accentSoft"
      >
        <Mic2 size={17} />
        New recording
      </button>
    </div>
  );
}

function MobileNavigation({
  createOpen,
  onCreateLyric,
  onCreateOpenChange,
  onCreateRecording,
  pathname,
}: {
  createOpen: boolean;
  onCreateLyric: () => void;
  onCreateOpenChange: (open: boolean) => void;
  onCreateRecording: () => void;
  pathname: string;
}) {
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 grid h-[84px] grid-cols-3 border-t border-divider bg-paper px-5 md:hidden">
      <MobileNavLink href="/library" icon={BookOpen} label="Library" pathname={pathname} />
      <div className="relative flex justify-center">
        <button
          type="button"
          onClick={() => onCreateOpenChange(!createOpen)}
          aria-label="Create"
          aria-expanded={createOpen}
          className="-mt-5 flex size-16 items-center justify-center rounded-full border-4 border-paper bg-accent text-white shadow-[0_8px_24px_rgba(124,143,255,0.3)] transition hover:bg-accentPressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Plus size={26} strokeWidth={2.2} />
        </button>
        {createOpen ? (
          <CreateMenu mobile onCreateLyric={onCreateLyric} onCreateRecording={onCreateRecording} />
        ) : null}
      </div>
      <MobileNavLink href="/projects" icon={FolderKanban} label="Projects" pathname={pathname} />
    </nav>
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
        'relative flex h-full items-center gap-2 px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
        active ? 'text-accentPressed after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-accentPressed' : 'text-muted hover:text-ink',
      )}
    >
      <Icon size={17} strokeWidth={1.75} />
      {label}
    </Link>
  );
}

function MobileNavLink({
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
        'flex min-w-0 flex-col items-center justify-center gap-1 text-xs font-medium transition',
        active ? 'text-accentPressed' : 'text-muted',
      )}
    >
      <Icon size={22} strokeWidth={1.75} />
      {label}
    </Link>
  );
}
