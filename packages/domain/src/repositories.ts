import type {
  Collection,
  CollectionAssignment,
  CollectionId,
  CollectionItemType,
  CollectionWithCount,
} from './collection';
import type { LyricFile, LyricFileId } from './lyricFile';
import type {
  Project,
  ProjectAssignment,
  ProjectId,
  ProjectItemType,
  ProjectWithCount,
} from './project';
import type { RecordingId, RecordingItem } from './recording';

export interface LyricRepository {
  init(): Promise<void>;
  listFiles(): Promise<LyricFile[]>;
  getFile(id: LyricFileId): Promise<LyricFile | null>;
  upsertFile(file: LyricFile): Promise<void>;
  deleteFile(id: LyricFileId): Promise<void>;
  clearAll(): Promise<void>;
}

export interface CollectionRepository {
  init(): Promise<void>;
  listCollections(): Promise<CollectionWithCount[]>;
  listAssignments(): Promise<CollectionAssignment[]>;
  listCollectionItems(collectionId: CollectionId): Promise<CollectionAssignment[]>;
  listItemCollections(itemType: CollectionItemType, itemId: string): Promise<CollectionId[]>;
  createCollection(payload: { title: string; description?: string | null }): Promise<Collection>;
  renameCollection(id: CollectionId, title: string, description?: string | null): Promise<Collection>;
  deleteCollection(id: CollectionId): Promise<void>;
  addItemToCollection(payload: {
    collectionId: CollectionId;
    itemType: CollectionItemType;
    itemId: string;
  }): Promise<CollectionAssignment>;
  removeItemFromCollection(payload: {
    collectionId: CollectionId;
    itemType: CollectionItemType;
    itemId: string;
  }): Promise<void>;
}

export interface ProjectRepository {
  init(): Promise<void>;
  listProjects(): Promise<ProjectWithCount[]>;
  listAssignments(): Promise<ProjectAssignment[]>;
  listProjectItems(projectId: ProjectId): Promise<ProjectAssignment[]>;
  listItemProjects(itemType: ProjectItemType, itemId: string): Promise<ProjectId[]>;
  createProject(payload: { title: string; description?: string | null }): Promise<Project>;
  renameProject(id: ProjectId, title: string, description?: string | null): Promise<Project>;
  deleteProject(id: ProjectId): Promise<void>;
  addItemToProject(payload: {
    projectId: ProjectId;
    itemType: ProjectItemType;
    itemId: string;
  }): Promise<ProjectAssignment>;
  removeItemFromProject(payload: {
    projectId: ProjectId;
    itemType: ProjectItemType;
    itemId: string;
  }): Promise<void>;
}

export type RecordingUploadBinary = Blob | ArrayBuffer | Uint8Array;

export interface RecordingUploadPayload {
  recordingId: RecordingId;
  data: RecordingUploadBinary;
  contentType: string;
  extension: string;
  localUri?: string | null;
  createdAt?: number;
}

export interface RecordingRepository {
  init(): Promise<void>;
  listRecordings(): Promise<RecordingItem[]>;
  upsertRecording(recording: RecordingItem): Promise<void>;
  uploadMedia(payload: RecordingUploadPayload): Promise<Pick<
    RecordingItem,
    'storageBucket' | 'storagePath' | 'mimeType' | 'localUri' | 'syncStatus'
  >>;
  resolvePlaybackUrl(recording: RecordingItem): Promise<string | null>;
  repairRecording(recording: RecordingItem, payload: RecordingUploadPayload): Promise<RecordingItem>;
  deleteRecording(recording: Pick<RecordingItem, 'id' | 'storageBucket' | 'storagePath'>): Promise<void>;
  clearAll(): Promise<void>;
}
