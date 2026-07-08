'use client';

import { useEffect } from 'react';

import type { LyricFile, ProjectAssignment, ProjectWithCount, RecordingItem } from '@refrain/domain';

import { useWorkspaceStore } from '@/lib/workspace-store';

import { AppShell } from './app-shell';
import { LibraryWorkspace } from './library-workspace';

const now = Date.now();

const previewFiles: LyricFile[] = [
  {
    id: 'preview-paper-satellites',
    title: 'Paper Satellites',
    body: [
      'I keep your frequency',
      'folded in my coat',
      'paper satellites',
      'circling what we wrote',
      '',
      'Signal in the static',
      "you're the only one I know",
      'tuning in and out',
      'to places we can go',
      '',
      'We send it up',
      'and let it spin',
      'paper satellites',
      "won't let us in",
      'but we keep trying',
    ].join('\n'),
    createdAt: now - 1000 * 60 * 60 * 24 * 12,
    updatedAt: now - 1000 * 60 * 18,
    sectionTypes: { 0: 'verse', 5: 'pre-chorus', 10: 'chorus' },
  },
  {
    id: 'preview-midnight-receiver',
    title: 'Midnight Receiver',
    body: 'Meet me where the signal bends\nunder the tower light',
    createdAt: now - 1000 * 60 * 60 * 24 * 8,
    updatedAt: now - 1000 * 60 * 60 * 26,
    sectionTypes: { 0: 'verse' },
  },
  {
    id: 'preview-blue-hour',
    title: 'Blue Hour',
    body: 'The city turns indigo\njust before we let it go',
    createdAt: now - 1000 * 60 * 60 * 24 * 20,
    updatedAt: now - 1000 * 60 * 60 * 24 * 3,
    sectionTypes: { 0: 'verse' },
  },
];

const previewRecordings: RecordingItem[] = [
  {
    id: 'preview-bridge-idea',
    title: 'Voice memo — bridge idea',
    createdAt: now - 1000 * 60 * 60 * 30,
    updatedAt: now - 1000 * 60 * 60 * 30,
    durationMs: 42_000,
    storageBucket: null,
    storagePath: null,
    mimeType: 'audio/webm',
    localUri: null,
    syncStatus: 'needs-reupload',
  },
];

const previewProjects: ProjectWithCount[] = [
  {
    id: 'preview-night-drive',
    title: 'Night Drive EP',
    description: 'Late-night songs and voice notes.',
    createdAt: now - 1000 * 60 * 60 * 24 * 30,
    updatedAt: now - 1000 * 60 * 60 * 8,
    itemCount: 1,
    lyricCount: 1,
    recordingCount: 0,
  },
  {
    id: 'preview-personal-demos',
    title: 'Personal Demos',
    description: null,
    createdAt: now - 1000 * 60 * 60 * 24 * 24,
    updatedAt: now - 1000 * 60 * 60 * 24,
    itemCount: 0,
    lyricCount: 0,
    recordingCount: 0,
  },
];

const previewAssignments: ProjectAssignment[] = [
  {
    projectId: 'preview-night-drive',
    itemId: 'preview-paper-satellites',
    itemType: 'lyric',
    createdAt: now - 1000 * 60 * 60 * 6,
  },
];

export function WorkspacePreview() {
  useEffect(() => {
    useWorkspaceStore.setState({
      files: previewFiles,
      recordings: previewRecordings,
      projects: previewProjects,
      assignments: previewAssignments,
      isInitialized: true,
      isLoading: false,
      activeUserId: 'preview-user',
      error: null,
    });
  }, []);

  return (
    <AppShell>
      <LibraryWorkspace initialSelectedWord="coat" />
    </AppShell>
  );
}
