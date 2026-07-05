import type { PostgrestError } from '@supabase/supabase-js';

import type {
  Collection,
  CollectionAssignment,
  CollectionId,
  CollectionItemType,
  CollectionRepository,
  CollectionWithCount,
  Database,
  LyricFile,
  LyricRepository,
  Project,
  ProjectAssignment,
  ProjectRepository,
  ProjectWithCount,
  RecordingItem,
  RecordingRepository,
  RecordingUploadPayload,
  SectionType,
} from '@refrain/domain';

import type { RefrainSupabaseClient } from './client';

export const DEFAULT_RECORDINGS_BUCKET = 'recordings';

type LyricRow = Pick<
  Database['public']['Tables']['lyric_files']['Row'],
  'id' | 'title' | 'body' | 'section_types' | 'created_at' | 'updated_at'
>;
type CollectionRow = Pick<
  Database['public']['Tables']['collections']['Row'],
  'id' | 'title' | 'description' | 'created_at' | 'updated_at'
>;
type CollectionItemRow = Pick<
  Database['public']['Tables']['collection_items']['Row'],
  'collection_id' | 'item_id' | 'item_type' | 'created_at'
>;
type CollectionIdRow = Pick<Database['public']['Tables']['collection_items']['Row'], 'collection_id'>;
type RecordingRow = Pick<
  Database['public']['Tables']['recordings']['Row'],
  'id' | 'title' | 'duration_ms' | 'uri' | 'created_at' | 'updated_at'
>;

const handleError = (error: PostgrestError | null) => {
  if (error) {
    throw new Error(error.message);
  }
};

const getUserIdOrThrow = async (client: RefrainSupabaseClient, noun: string): Promise<string> => {
  const { data, error } = await client.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }
  const userId = data.session?.user?.id;
  if (!userId) {
    throw new Error(`No authenticated user for ${noun} operation.`);
  }
  return userId;
};

const mapLyricRow = (row: LyricRow): LyricFile => ({
  id: row.id,
  title: row.title ?? '',
  body: row.body ?? '',
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
  sectionTypes: (row.section_types ?? {}) as Record<number, SectionType>,
});

const mapCollectionRow = (row: CollectionRow): CollectionWithCount => ({
  id: row.id,
  title: row.title ?? '',
  description: row.description,
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
  itemCount: 0,
  lyricCount: 0,
  recordingCount: 0,
});

const mapProjectRow = (row: CollectionRow): ProjectWithCount => ({
  id: row.id,
  title: row.title ?? '',
  description: row.description,
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
  itemCount: 0,
  lyricCount: 0,
  recordingCount: 0,
});

const mapAssignmentRow = (row: CollectionItemRow): CollectionAssignment => ({
  collectionId: row.collection_id,
  itemId: row.item_id,
  itemType: row.item_type,
  createdAt: new Date(row.created_at).getTime(),
});

const mapProjectAssignmentRow = (row: CollectionItemRow): ProjectAssignment => ({
  projectId: row.collection_id,
  itemId: row.item_id,
  itemType: row.item_type,
  createdAt: new Date(row.created_at).getTime(),
});

const mapRecordingRow = (row: RecordingRow): RecordingItem => ({
  id: row.id,
  title: row.title ?? '',
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
  durationMs: row.duration_ms ?? 0,
  storageBucket: row.uri ? DEFAULT_RECORDINGS_BUCKET : null,
  storagePath: row.uri ?? null,
  mimeType: null,
  localUri: null,
  syncStatus: row.uri ? 'ready' : 'needs-reupload',
});

export const createSupabaseLyricRepository = (client: RefrainSupabaseClient): LyricRepository => ({
  async init() {},

  async listFiles() {
    const userId = await getUserIdOrThrow(client, 'lyric');
    const { data, error } = await client
      .from('lyric_files')
      .select('id, title, body, section_types, created_at, updated_at, deleted_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    handleError(error);
    return (data ?? []).map(mapLyricRow);
  },

  async getFile(id) {
    const userId = await getUserIdOrThrow(client, 'lyric');
    const { data, error } = await client
      .from('lyric_files')
      .select('id, title, body, section_types, created_at, updated_at, deleted_at')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();
    handleError(error);
    return data ? mapLyricRow(data) : null;
  },

  async upsertFile(file) {
    const userId = await getUserIdOrThrow(client, 'lyric');
    const { error } = await client.from('lyric_files').upsert(
      {
        id: file.id,
        user_id: userId,
        title: file.title ?? '',
        body: file.body ?? '',
        section_types: file.sectionTypes ?? {},
        created_at: new Date(file.createdAt).toISOString(),
        updated_at: new Date(file.updatedAt).toISOString(),
        deleted_at: null,
      },
      { onConflict: 'id' },
    );
    handleError(error);
  },

  async deleteFile(id) {
    const userId = await getUserIdOrThrow(client, 'lyric');
    const { error } = await client
      .from('lyric_files')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);
    handleError(error);
  },

  async clearAll() {
    const userId = await getUserIdOrThrow(client, 'lyric');
    const { error } = await client.from('lyric_files').delete().eq('user_id', userId);
    handleError(error);
  },
});

export const createSupabaseCollectionRepository = (client: RefrainSupabaseClient): CollectionRepository => ({
  async init() {},

  async listCollections() {
    const userId = await getUserIdOrThrow(client, 'collection');
    const { data, error } = await client
      .from('collections')
      .select('id, title, description, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    handleError(error);
    return (data ?? []).map(mapCollectionRow);
  },

  async listAssignments() {
    const userId = await getUserIdOrThrow(client, 'collection');
    const { data, error } = await client
      .from('collection_items')
      .select('collection_id, item_id, item_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    handleError(error);
    return (data ?? []).map(mapAssignmentRow);
  },

  async listCollectionItems(collectionId) {
    const userId = await getUserIdOrThrow(client, 'collection');
    const { data, error } = await client
      .from('collection_items')
      .select('collection_id, item_id, item_type, created_at')
      .eq('user_id', userId)
      .eq('collection_id', collectionId)
      .order('created_at', { ascending: false });
    handleError(error);
    return (data ?? []).map(mapAssignmentRow);
  },

  async listItemCollections(itemType, itemId) {
    const userId = await getUserIdOrThrow(client, 'collection');
    const { data, error } = await client
      .from('collection_items')
      .select('collection_id')
      .eq('user_id', userId)
      .eq('item_type', itemType)
      .eq('item_id', itemId);
    handleError(error);
    return (data ?? []).map((row: CollectionIdRow) => row.collection_id);
  },

  async createCollection(payload) {
    const userId = await getUserIdOrThrow(client, 'collection');
    const now = new Date().toISOString();
    const { data, error } = await client
      .from('collections')
      .insert({
        user_id: userId,
        title: payload.title,
        description: payload.description ?? null,
        created_at: now,
        updated_at: now,
      })
      .select('id, title, description, created_at, updated_at')
      .maybeSingle();
    handleError(error);
    if (!data) {
      throw new Error('Failed to create collection.');
    }
    const collection: Collection = {
      id: data.id,
      title: data.title ?? '',
      description: data.description,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };
    return collection;
  },

  async renameCollection(id, title, description) {
    const userId = await getUserIdOrThrow(client, 'collection');
    const now = new Date().toISOString();
    const { data, error } = await client
      .from('collections')
      .update({
        title,
        description: description ?? null,
        updated_at: now,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id, title, description, created_at, updated_at')
      .maybeSingle();
    handleError(error);
    if (!data) {
      throw new Error('Collection not found.');
    }
    return {
      id: data.id,
      title: data.title ?? '',
      description: data.description,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };
  },

  async deleteCollection(id) {
    const userId = await getUserIdOrThrow(client, 'collection');
    const { error } = await client.from('collections').delete().eq('id', id).eq('user_id', userId);
    handleError(error);
  },

  async addItemToCollection({ collectionId, itemId, itemType }) {
    const userId = await getUserIdOrThrow(client, 'collection');
    const now = new Date().toISOString();
    const { error } = await client.from('collection_items').upsert(
      {
        user_id: userId,
        collection_id: collectionId,
        item_id: itemId,
        item_type: itemType,
        created_at: now,
      },
      { onConflict: 'collection_id,item_type,item_id', ignoreDuplicates: true },
    );
    if (error && error.code !== '23505') {
      handleError(error);
    }
    return {
      collectionId,
      itemId,
      itemType,
      createdAt: new Date(now).getTime(),
    };
  },

  async removeItemFromCollection({ collectionId, itemId, itemType }) {
    const userId = await getUserIdOrThrow(client, 'collection');
    const { error } = await client
      .from('collection_items')
      .delete()
      .eq('collection_id', collectionId)
      .eq('item_id', itemId)
      .eq('item_type', itemType)
      .eq('user_id', userId);
    handleError(error);
  },
});

export const createSupabaseProjectRepository = (client: RefrainSupabaseClient): ProjectRepository => ({
  async init() {},

  async listProjects() {
    const userId = await getUserIdOrThrow(client, 'project');
    const { data, error } = await client
      .from('collections')
      .select('id, title, description, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    handleError(error);
    return (data ?? []).map(mapProjectRow);
  },

  async listAssignments() {
    const userId = await getUserIdOrThrow(client, 'project');
    const { data, error } = await client
      .from('collection_items')
      .select('collection_id, item_id, item_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    handleError(error);
    return (data ?? []).map(mapProjectAssignmentRow);
  },

  async listProjectItems(projectId) {
    const userId = await getUserIdOrThrow(client, 'project');
    const { data, error } = await client
      .from('collection_items')
      .select('collection_id, item_id, item_type, created_at')
      .eq('user_id', userId)
      .eq('collection_id', projectId)
      .order('created_at', { ascending: false });
    handleError(error);
    return (data ?? []).map(mapProjectAssignmentRow);
  },

  async listItemProjects(itemType, itemId) {
    const userId = await getUserIdOrThrow(client, 'project');
    const { data, error } = await client
      .from('collection_items')
      .select('collection_id')
      .eq('user_id', userId)
      .eq('item_type', itemType)
      .eq('item_id', itemId);
    handleError(error);
    return (data ?? []).map((row: CollectionIdRow) => row.collection_id);
  },

  async createProject(payload) {
    const userId = await getUserIdOrThrow(client, 'project');
    const now = new Date().toISOString();
    const { data, error } = await client
      .from('collections')
      .insert({
        user_id: userId,
        title: payload.title,
        description: payload.description ?? null,
        created_at: now,
        updated_at: now,
      })
      .select('id, title, description, created_at, updated_at')
      .maybeSingle();
    handleError(error);
    if (!data) {
      throw new Error('Failed to create project.');
    }
    const project: Project = {
      id: data.id,
      title: data.title ?? '',
      description: data.description,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };
    return project;
  },

  async renameProject(id, title, description) {
    const userId = await getUserIdOrThrow(client, 'project');
    const now = new Date().toISOString();
    const { data, error } = await client
      .from('collections')
      .update({
        title,
        description: description ?? null,
        updated_at: now,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id, title, description, created_at, updated_at')
      .maybeSingle();
    handleError(error);
    if (!data) {
      throw new Error('Project not found.');
    }
    return {
      id: data.id,
      title: data.title ?? '',
      description: data.description,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };
  },

  async deleteProject(id) {
    const userId = await getUserIdOrThrow(client, 'project');
    const { error } = await client.from('collections').delete().eq('id', id).eq('user_id', userId);
    handleError(error);
  },

  async addItemToProject({ projectId, itemId, itemType }) {
    const userId = await getUserIdOrThrow(client, 'project');
    const now = new Date().toISOString();
    const { error } = await client.from('collection_items').upsert(
      {
        user_id: userId,
        collection_id: projectId,
        item_id: itemId,
        item_type: itemType,
        created_at: now,
      },
      { onConflict: 'collection_id,item_type,item_id', ignoreDuplicates: true },
    );
    if (error && error.code !== '23505') {
      handleError(error);
    }
    return {
      projectId,
      itemId,
      itemType,
      createdAt: new Date(now).getTime(),
    };
  },

  async removeItemFromProject({ projectId, itemId, itemType }) {
    const userId = await getUserIdOrThrow(client, 'project');
    const { error } = await client
      .from('collection_items')
      .delete()
      .eq('collection_id', projectId)
      .eq('item_id', itemId)
      .eq('item_type', itemType)
      .eq('user_id', userId);
    handleError(error);
  },
});

interface CreateRecordingRepositoryOptions {
  bucket?: string;
}

export const createSupabaseRecordingRepository = (
  client: RefrainSupabaseClient,
  options: CreateRecordingRepositoryOptions = {},
): RecordingRepository => {
  const bucket = options.bucket ?? DEFAULT_RECORDINGS_BUCKET;

  return {
    async init() {},

    async listRecordings() {
      const userId = await getUserIdOrThrow(client, 'recording');
      const { data, error } = await client
        .from('recordings')
        .select('id, title, duration_ms, uri, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      handleError(error);
      return (data ?? []).map(mapRecordingRow);
    },

    async upsertRecording(recording) {
      const userId = await getUserIdOrThrow(client, 'recording');
      const { error } = await client.from('recordings').upsert(
        {
          id: recording.id,
          user_id: userId,
          title: recording.title ?? '',
          duration_ms: recording.durationMs ?? 0,
          uri: recording.storagePath ?? recording.localUri ?? null,
          created_at: new Date(recording.createdAt).toISOString(),
          updated_at: new Date(recording.updatedAt).toISOString(),
        },
        { onConflict: 'id' },
      );
      handleError(error);
    },

    async uploadMedia(payload) {
      const userId = await getUserIdOrThrow(client, 'recording');
      const createdAt = payload.createdAt ?? Date.now();
      const extension = payload.extension.replace(/^\./, '') || 'm4a';
      const path = `users/${userId.toLowerCase()}/${payload.recordingId}.${extension}`;
      const { error } = await client.storage.from(bucket).upload(path, payload.data, {
        upsert: true,
        contentType: payload.contentType,
      });
      if (error) {
        throw new Error(error.message);
      }
      return {
        storageBucket: bucket,
        storagePath: path,
        mimeType: payload.contentType,
        localUri: payload.localUri ?? null,
        syncStatus: 'ready' as const,
      };
    },

    async resolvePlaybackUrl(recording) {
      if (recording.storageBucket && recording.storagePath) {
        const { data, error } = await client.storage
          .from(recording.storageBucket)
          .createSignedUrl(recording.storagePath, 60 * 60);
        if (error) {
          throw new Error(error.message);
        }
        return data.signedUrl;
      }
      return recording.localUri ?? null;
    },

    async repairRecording(recording, payload) {
      const media = await this.uploadMedia(payload);
      const updated: RecordingItem = {
        ...recording,
        ...media,
        updatedAt: Date.now(),
      };
      await this.upsertRecording(updated);
      return updated;
    },

    async deleteRecording(recording) {
      const userId = await getUserIdOrThrow(client, 'recording');
      if (recording.storageBucket && recording.storagePath) {
        const { error: storageError } = await client.storage
          .from(recording.storageBucket)
          .remove([recording.storagePath]);
        if (storageError) {
          throw new Error(storageError.message);
        }
      }
      const { error } = await client.from('recordings').delete().eq('id', recording.id).eq('user_id', userId);
      handleError(error);
    },

    async clearAll() {
      const userId = await getUserIdOrThrow(client, 'recording');
      const recordings = await this.listRecordings();
      const storageTargets = recordings
        .filter((recording) => recording.storageBucket === bucket && recording.storagePath)
        .map((recording) => recording.storagePath as string);
      if (storageTargets.length > 0) {
        const { error: storageError } = await client.storage.from(bucket).remove(storageTargets);
        if (storageError) {
          throw new Error(storageError.message);
        }
      }
      const { error } = await client.from('recordings').delete().eq('user_id', userId);
      handleError(error);
    },
  };
};
