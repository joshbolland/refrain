'use client';

import { FolderKanban, FolderPlus, Mic2, Music, Save, Search, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { formatDurationSeconds, formatShortDate } from '@refrain/domain';

import { useWorkspaceStore } from '@/lib/workspace-store';

import {
  AppFrame,
  HeaderBand,
  NativeListRow,
  Pane,
  TextActionButton,
  ToolbarIconButton,
} from './workspace-primitives';

export function ProjectsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('project');
  const [query, setQuery] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [renameTitle, setRenameTitle] = useState('');
  const [renameDescription, setRenameDescription] = useState('');
  const { projects, createProject, renameProject, deleteProject, projectItems } = useWorkspaceStore((state) => ({
    projects: state.projects,
    createProject: state.createProject,
    renameProject: state.renameProject,
    deleteProject: state.deleteProject,
    projectItems: state.projectItems,
  }));

  const filteredProjects = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return projects;
    }
    return projects.filter(
      (project) =>
        project.title.toLowerCase().includes(trimmed) ||
        (project.description ?? '').toLowerCase().includes(trimmed),
    );
  }, [projects, query]);

  const selectedProject = projects.find((project) => project.id === selectedId) ?? filteredProjects[0] ?? null;
  const items = useMemo(
    () => (selectedProject ? projectItems(selectedProject.id) : []),
    [projectItems, selectedProject],
  );
  const projectCountLabel = `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`;

  useEffect(() => {
    if (selectedProject && selectedProject.id !== selectedId) {
      router.replace(`/projects?project=${selectedProject.id}`);
    }
  }, [router, selectedProject, selectedId]);

  useEffect(() => {
    setRenameTitle(selectedProject?.title ?? '');
    setRenameDescription(selectedProject?.description ?? '');
  }, [selectedProject?.description, selectedProject?.id, selectedProject?.title]);

  const createNewProject = async () => {
    const project = await createProject(titleDraft, descriptionDraft);
    setTitleDraft('');
    setDescriptionDraft('');
    router.push(`/projects?project=${project.id}`);
  };

  return (
    <AppFrame>
      <HeaderBand
        eyebrow="Projects"
        title="Organize ideas"
        subtitle="Group lyrics and recordings into writing contexts."
        meta={<span className="pb-1 text-sm font-semibold text-headerSubtitle">{projectCountLabel}</span>}
        actions={
          <TextActionButton onClick={() => void createNewProject()} variant="primary" disabled={!titleDraft.trim()}>
            <FolderPlus size={15} />
            Create
          </TextActionButton>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden border-b border-divider bg-paper lg:grid-cols-[320px_minmax(0,1fr)]">
        <Pane className="border-b lg:border-b-0 lg:border-r" scroll>
          <div className="sticky top-0 z-10 border-b border-divider bg-paper/95 px-4 py-3 backdrop-blur">
            <label className="flex h-10 items-center gap-2 rounded-xl border border-divider bg-white px-3 text-sm text-muted transition focus-within:border-accent">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none"
                placeholder="Search projects"
              />
            </label>

            <div className="mt-3 space-y-2 rounded-2xl border border-divider bg-canvas p-3">
              <input
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                className="w-full rounded-xl border border-divider bg-paper px-3 py-2 text-sm text-ink outline-none transition focus:border-accent"
                placeholder="Project title"
              />
              <textarea
                value={descriptionDraft}
                onChange={(event) => setDescriptionDraft(event.target.value)}
                className="min-h-[70px] w-full resize-none rounded-xl border border-divider bg-paper px-3 py-2 text-sm text-ink outline-none transition focus:border-accent"
                placeholder="Optional description"
              />
            </div>
          </div>

          <div className="space-y-1 px-3 py-3">
            {filteredProjects.map((project) => (
              <NativeListRow
                key={project.id}
                active={project.id === selectedProject?.id}
                icon={<FolderKanban size={17} />}
                meta={project.itemCount}
                onClick={() => router.push(`/projects?project=${project.id}`)}
                subtitle={`Updated ${formatShortDate(project.updatedAt)}`}
                title={project.title || 'Untitled project'}
              />
            ))}
            {!filteredProjects.length ? (
              <div className="rounded-2xl border border-dashed border-divider px-4 py-6 text-sm leading-6 text-muted/80">
                No projects match this search.
              </div>
            ) : null}
          </div>
        </Pane>

        <Pane className="bg-[#fbfbf8]" scroll>
          {selectedProject ? (
            <div className="grid min-h-full grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="border-b border-divider xl:border-b-0 xl:border-r">
                <div className="border-b border-divider bg-paper px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted/70">Project</p>
                  <h2 className="mt-1 text-3xl font-semibold leading-tight text-ink">{selectedProject.title}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted/85">
                    {selectedProject.description || 'Collect related lyrics and recordings in one writing context.'}
                  </p>
                </div>

                <div className="space-y-2 p-4">
                  {items.map((item) => (
                    <NativeListRow
                      key={`${item.type}-${item.data.id}`}
                      icon={item.type === 'lyric' ? <Music size={17} /> : <Mic2 size={17} />}
                      meta={
                        item.type === 'lyric'
                          ? formatShortDate(item.data.updatedAt)
                          : formatDurationSeconds(item.data.durationMs)
                      }
                      onClick={() =>
                        router.push(
                          item.type === 'lyric'
                            ? `/library?lyric=${item.data.id}`
                            : `/library?recording=${item.data.id}`,
                        )
                      }
                      subtitle={item.type === 'lyric' ? 'Lyric' : 'Recording'}
                      title={item.data.title || 'Untitled'}
                    />
                  ))}
                  {!items.length ? (
                    <div className="rounded-2xl border border-dashed border-divider bg-paper/70 px-4 py-8 text-sm leading-6 text-muted/80">
                      Add lyrics or recordings from their detail panes to build this project.
                    </div>
                  ) : null}
                </div>
              </div>

              <aside className="bg-paper p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted/70">Details</p>
                <input
                  value={renameTitle}
                  onChange={(event) => setRenameTitle(event.target.value)}
                  className="mt-3 w-full rounded-xl border border-divider bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-accent"
                  placeholder="Project title"
                />
                <textarea
                  value={renameDescription}
                  onChange={(event) => setRenameDescription(event.target.value)}
                  className="mt-2 min-h-[140px] w-full resize-none rounded-xl border border-divider bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-accent"
                  placeholder="Project description"
                />
                <div className="mt-3 flex gap-2">
                  <TextActionButton
                    onClick={() => void renameProject(selectedProject.id, renameTitle, renameDescription)}
                    variant="primary"
                  >
                    <Save size={14} />
                    Save
                  </TextActionButton>
                  <ToolbarIconButton
                    icon={Trash2}
                    label="Delete project"
                    variant="danger"
                    onClick={async () => {
                      await deleteProject(selectedProject.id);
                      router.push('/projects');
                    }}
                  />
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    ['Items', selectedProject.itemCount],
                    ['Lyrics', selectedProject.lyricCount],
                    ['Audio', selectedProject.recordingCount],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-divider bg-canvas p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/70">{label}</p>
                      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          ) : (
            <div className="flex h-full min-h-[620px] items-center justify-center p-8 text-center">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted/70">Projects</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Create a project</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted/80">
                  Projects keep related lyrics and recordings together.
                </p>
              </div>
            </div>
          )}
        </Pane>
      </div>
    </AppFrame>
  );
}
