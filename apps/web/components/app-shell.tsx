'use client';

import {
  AlertTriangle,
  BookOpenText,
  ChevronDown,
  FileImage,
  Files,
  Folder,
  LogOut,
  Mic2,
  Moon,
  MoreHorizontal,
  Music2,
  Plus,
  RefreshCw,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { useAuthStore } from '@/lib/auth-store';
import { resolveTheme, THEME_STORAGE_KEY, type ThemePreference } from '@/lib/theme';
import { useWorkspaceStore } from '@/lib/workspace-store';
import { cx } from './workspace-primitives';
import type { ProjectWithCount } from '@refrain/domain';

const applyTheme = (preference: ThemePreference) => {
  const resolved = resolveTheme(preference, window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [newProject, setNewProject] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectMenu, setProjectMenu] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectWithCount | null>(null);
  const [deletingProject, setDeletingProject] = useState<ProjectWithCount | null>(null);
  const { user, signOut } = useAuthStore((state) => ({ user: state.user, signOut: state.signOut }));
  const {
    createLyric,
    createProject,
    deleteProject,
    projects,
    refresh,
    renameProject,
    workspaceError,
    workspaceLoading,
  } = useWorkspaceStore((state) => ({
    createLyric: state.createLyric,
    createProject: state.createProject,
    deleteProject: state.deleteProject,
    projects: state.projects,
    refresh: state.refresh,
    renameProject: state.renameProject,
    workspaceError: state.error,
    workspaceLoading: state.isLoading,
  }));
  const libraryBase = pathname === '/preview' ? '/preview' : '/library';
  const isLibraryWorkspace = pathname === '/library' || pathname === '/preview';
  const hasLibraryLevel = isLibraryWorkspace && Boolean(
    searchParams.get('view') || searchParams.get('project') || searchParams.get('lyric') || searchParams.get('recording'),
  );

  useEffect(() => {
    const saved = (localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null) ?? 'system';
    setTheme(saved);
    applyTheme(saved);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => saved === 'system' && applyTheme('system');
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setCreateOpen((open) => !open);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
        event.preventDefault();
        setSidebarOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setThemePreference = (value: ThemePreference) => {
    localStorage.setItem(THEME_STORAGE_KEY, value);
    setTheme(value);
    applyTheme(value);
  };

  const handleCreateLyric = async () => {
    const lyric = await createLyric();
    setCreateOpen(false);
    router.push(`${libraryBase}?view=all&lyric=${lyric.id}`);
  };

  const submitProject = async () => {
    if (!projectTitle.trim()) return;
    const project = await createProject(projectTitle);
    setProjectTitle('');
    setNewProject(false);
    router.push(`${libraryBase}?project=${project.id}`);
  };

  return (
    <div className="flex h-dvh min-h-screen overflow-hidden bg-canvas text-ink">
      {sidebarOpen ? (
        <aside className={cx(
          'rf-sidebar relative z-30 h-full w-full shrink-0 border-r border-divider md:w-[240px]',
          hasLibraryLevel ? 'hidden md:flex' : 'flex',
          'flex-col',
        )}>
          <div className="flex h-16 shrink-0 items-center justify-between px-4">
            <Link href={libraryBase} className="flex min-w-0 items-center gap-2.5 rounded-lg">
              <Image src="/assets/refrain-bird.png" alt="" width={34} height={34} priority className="size-8 scale-125 object-contain" />
              <span className="text-[17px] font-semibold tracking-[-0.02em]">Refrain</span>
            </Link>
            <div className="relative">
              <button type="button" className="notes-icon-button bg-accent text-white" aria-label="Create item" title="Create item (⌘N)" onClick={() => setCreateOpen(!createOpen)}>
                <Plus size={18} />
              </button>
              {createOpen ? (
                <div className="notes-menu left-auto right-0 top-[calc(100%+8px)] w-56">
                  <MenuButton icon={BookOpenText} label="New lyric" onClick={() => void handleCreateLyric()} />
                  <MenuButton icon={Mic2} label="New recording" onClick={() => { setCreateOpen(false); router.push(`${libraryBase}?view=all&capture=1`); }} />
                  <MenuButton icon={FileImage} label="Import lyric image" onClick={() => { setCreateOpen(false); router.push(`${libraryBase}?view=all&import=1`); }} />
                  <p className="border-t border-divider px-3 pt-2 text-[11px] text-muted">⌘N</p>
                </div>
              ) : null}
            </div>
          </div>

          <nav aria-label="Library" className="rf-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted/70">Library</p>
            <SidebarLink href={`${libraryBase}?view=all`} active={isLibraryWorkspace && (searchParams.get('view') === 'all' || (!searchParams.get('view') && !searchParams.get('project')))} icon={Files} label="All Items" />
            <SidebarLink href={`${libraryBase}?view=lyrics`} active={searchParams.get('view') === 'lyrics'} icon={Music2} label="Lyrics" />
            <SidebarLink href={`${libraryBase}?view=recordings`} active={searchParams.get('view') === 'recordings'} icon={Mic2} label="Recordings" />

            <div className="mt-5 flex items-center justify-between px-2 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted/70">Projects</p>
              <button type="button" onClick={() => setNewProject(true)} aria-label="New project" className="rounded-md p-1 text-muted hover:bg-paper/50 hover:text-ink"><Plus size={14} /></button>
            </div>
            {newProject ? (
              <form className="mb-1 px-1" onSubmit={(event) => { event.preventDefault(); void submitProject(); }}>
                <input autoFocus value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} onBlur={() => !projectTitle && setNewProject(false)} placeholder="Project name" className="w-full rounded-lg border border-accent bg-paper px-2.5 py-2 text-sm outline-none ring-2 ring-accentSoft" />
              </form>
            ) : null}
            {projects.map((project) => (
              <div className="group relative" key={project.id}>
                <SidebarLink href={`${libraryBase}?project=${project.id}`} active={searchParams.get('project') === project.id} icon={Folder} label={project.title} count={project.itemCount} />
                <button type="button" aria-label={`More options for ${project.title}`} onClick={() => setProjectMenu(projectMenu === project.id ? null : project.id)} className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-1 text-muted opacity-0 hover:bg-paper group-hover:opacity-100 focus:opacity-100"><MoreHorizontal size={14} /></button>
                {projectMenu === project.id ? (
                  <div className="notes-menu left-3 right-3 top-9 z-40">
                    <button type="button" onClick={() => { setProjectMenu(null); setEditingProject(project); }} className="notes-menu-item">Rename & Details…</button>
                    <button type="button" onClick={() => { setProjectMenu(null); setDeletingProject(project); }} className="notes-menu-item text-danger">Delete Project…</button>
                  </div>
                ) : null}
              </div>
            ))}
          </nav>

          <div className="relative border-t border-divider p-2">
            <button type="button" onClick={() => setAccountOpen(!accountOpen)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-paper/50">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accentPressed text-xs font-semibold text-white">{user?.email?.charAt(0).toUpperCase() || 'R'}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{user?.email ?? 'Preview user'}</span><span className="block text-[11px] text-muted">Account & appearance</span></span>
              <ChevronDown size={14} className="text-muted" />
            </button>
            {accountOpen ? (
              <div className="notes-menu bottom-[calc(100%+6px)] left-2 right-2">
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Appearance</p>
                <div className="grid grid-cols-3 gap-1 px-2 pb-2">
                  {(['light', 'dark', 'system'] as ThemePreference[]).map((value) => (
                    <button key={value} type="button" onClick={() => setThemePreference(value)} className={cx('rounded-lg px-2 py-2 text-xs capitalize', theme === value ? 'rf-selection font-semibold' : 'hover:bg-canvas')}>
                      {value === 'dark' ? <Moon className="mx-auto mb-1" size={14} /> : <Sun className="mx-auto mb-1" size={14} />}{value}
                    </button>
                  ))}
                </div>
                <Link href="/settings" onClick={() => setAccountOpen(false)} className="notes-menu-item"><Settings size={15} /> Settings</Link>
                <button type="button" onClick={() => void signOut()} className="notes-menu-item text-danger"><LogOut size={15} /> Sign out</button>
              </div>
            ) : null}
          </div>
        </aside>
      ) : null}

      <main className="relative min-w-0 flex-1 overflow-hidden">
        {workspaceError ? (
          <div className="absolute inset-x-4 top-4 z-50 flex items-center gap-3 rounded-xl border border-danger/30 bg-paper px-4 py-3 text-sm text-danger shadow-float">
            <AlertTriangle size={17} /><span className="min-w-0 flex-1">{workspaceError}</span>
            <button type="button" disabled={workspaceLoading} onClick={() => void refresh()} className="notes-icon-button"><RefreshCw size={15} /></button>
          </div>
        ) : null}
        {children}
      </main>
      {editingProject ? <ProjectEditor project={editingProject} onClose={() => setEditingProject(null)} onSave={async (title, description) => { await renameProject(editingProject.id, title, description); setEditingProject(null); }} /> : null}
      {deletingProject ? <ShellDialog title="Delete Project?" onClose={() => setDeletingProject(null)}><p className="text-sm leading-6 text-muted">“{deletingProject.title}” will be deleted. Its lyrics and recordings will remain in your library.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setDeletingProject(null)} className="rounded-lg px-4 py-2 text-sm hover:bg-canvas">Cancel</button><button type="button" onClick={async () => { await deleteProject(deletingProject.id); if (searchParams.get('project') === deletingProject.id) router.push(`${libraryBase}?view=all`); setDeletingProject(null); }} className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white">Delete</button></div></ShellDialog> : null}
    </div>
  );
}

function SidebarLink({ href, active, icon: Icon, label, count }: { href: string; active: boolean; icon: typeof Files; label: string; count?: number }) {
  return <Link href={href} className={cx('flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition', active ? 'rf-selection font-medium text-ink' : 'text-muted hover:bg-paper/45 hover:text-ink')}><Icon size={16} strokeWidth={1.8} /><span className="min-w-0 flex-1 truncate">{label}</span>{count !== undefined ? <span className="text-xs text-muted/70">{count}</span> : null}</Link>;
}

function MenuButton({ icon: Icon, label, onClick }: { icon: typeof Files; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="notes-menu-item"><Icon size={16} />{label}</button>;
}

function ProjectEditor({ project, onClose, onSave }: { project: ProjectWithCount; onClose: () => void; onSave: (title: string, description: string | null) => Promise<void> }) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? '');
  return <ShellDialog title="Project Details" onClose={onClose}><label className="block text-xs font-medium text-muted">Name<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-divider bg-canvas px-3 text-sm text-ink outline-none focus:border-accent" /></label><label className="mt-4 block text-xs font-medium text-muted">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1.5 h-24 w-full resize-none rounded-lg border border-divider bg-canvas p-3 text-sm text-ink outline-none focus:border-accent" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm hover:bg-canvas">Cancel</button><button type="button" disabled={!title.trim()} onClick={() => void onSave(title.trim(), description.trim() || null)} className="rounded-lg bg-accentPressed px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save</button></div></ShellDialog>;
}

function ShellDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="rf-overlay fixed inset-0 z-[80] flex items-center justify-center p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-2xl border border-divider bg-paper p-5 shadow-float"><header className="mb-4 flex items-center"><h2 className="flex-1 text-lg font-semibold">{title}</h2><button type="button" onClick={onClose} className="notes-icon-button"><X size={17} /></button></header>{children}</div></div>;
}
