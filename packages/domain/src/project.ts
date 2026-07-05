import type { LyricFile } from './lyricFile';
import type { RecordingItem } from './recording';

export type ProjectId = string;

export type ProjectItemType = 'lyric' | 'recording';

export interface Project {
  id: ProjectId;
  title: string;
  description?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectWithCount extends Project {
  itemCount: number;
  lyricCount: number;
  recordingCount: number;
}

export interface ProjectAssignment {
  projectId: ProjectId;
  itemId: string;
  itemType: ProjectItemType;
  createdAt: number;
}

export interface ProjectItemWithData {
  assignment: ProjectAssignment;
  item:
    | { type: 'lyric'; data: LyricFile }
    | { type: 'recording'; data: RecordingItem };
}
