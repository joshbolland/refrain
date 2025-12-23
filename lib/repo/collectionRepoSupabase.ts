import type { PostgrestError } from '@supabase/supabase-js';

import type {
  Collection,
  CollectionAssignment,
  CollectionId,
  CollectionItemType,
  CollectionWithCount,
} from '../../types/collection';
import type { Database } from '../../types/supabase';
import { supabase } from '../supabaseClient';

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

type CollectionRow = Database['public']['Tables']['collections']['Row'];
type CollectionItemRow = Database['public']['Tables']['collection_items']['Row'];
type CollectionRowWithCount = CollectionRow & { collection_items?: { count: number }[] };

const mapCollection = (row: CollectionRowWithCount): CollectionWithCount => ({
  id: row.id,
  title: row.title ?? '',
  description: row.description,
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
  itemCount: row.collection_items?.[0]?.count ?? 0,
  lyricCount: 0,
  recordingCount: 0,
});

const mapAssignment = (row: CollectionItemRow): CollectionAssignment => ({
  collectionId: row.collection_id,
  itemId: row.item_id,
  itemType: row.item_type,
  createdAt: new Date(row.created_at).getTime(),
});

const handleError = (error: PostgrestError | null) => {
  if (error) {
    throw new Error(error.message);
  }
};

const getUserIdOrThrow = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(error.message);
  }
  const userId = data.user?.id;
  if (!userId) {
    throw new Error('No authenticated user for collection operation.');
  }
  return userId;
};

export const createSupabaseCollectionRepository = (): CollectionRepository => ({
  async init() {
    // Supabase client is ready once auth is restored; nothing to init.
  },

  async listCollections(): Promise<CollectionWithCount[]> {
    const userId = await getUserIdOrThrow();
    const { data, error } = await supabase
      .from('collections')
      .select('id, title, description, created_at, updated_at, collection_items(count)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    handleError(error);
    return (data as CollectionRowWithCount[] | null)?.map(mapCollection) ?? [];
  },

  async listAssignments(): Promise<CollectionAssignment[]> {
    const userId = await getUserIdOrThrow();
    const { data, error } = await supabase
      .from('collection_items')
      .select('collection_id, item_id, item_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    handleError(error);
    return (data ?? []).map(mapAssignment);
  },

  async listCollectionItems(collectionId: CollectionId): Promise<CollectionAssignment[]> {
    const userId = await getUserIdOrThrow();
    const { data, error } = await supabase
      .from('collection_items')
      .select('collection_id, item_id, item_type, created_at')
      .eq('user_id', userId)
      .eq('collection_id', collectionId)
      .order('created_at', { ascending: false });

    handleError(error);
    return (data ?? []).map(mapAssignment);
  },

  async listItemCollections(itemType: CollectionItemType, itemId: string): Promise<CollectionId[]> {
    const userId = await getUserIdOrThrow();
    const { data, error } = await supabase
      .from('collection_items')
      .select('collection_id')
      .eq('user_id', userId)
      .eq('item_type', itemType)
      .eq('item_id', itemId);

    handleError(error);
    return (data ?? []).map((row) => row.collection_id);
  },

  async createCollection(payload): Promise<Collection> {
    const userId = await getUserIdOrThrow();
    const now = new Date().toISOString();
    const { data, error } = await supabase
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
    return {
      id: data.id,
      title: data.title ?? '',
      description: data.description,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };
  },

  async renameCollection(id, title, description): Promise<Collection> {
    const userId = await getUserIdOrThrow();
    const now = new Date().toISOString();
    const { data, error } = await supabase
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
    const userId = await getUserIdOrThrow();
    const { error } = await supabase.from('collections').delete().eq('id', id).eq('user_id', userId);
    handleError(error);
  },

  async addItemToCollection({ collectionId, itemId, itemType }): Promise<CollectionAssignment> {
    const userId = await getUserIdOrThrow();
    const now = new Date().toISOString();
    const { error } = await supabase.from('collection_items').upsert(
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
    const userId = await getUserIdOrThrow();
    const { error } = await supabase
      .from('collection_items')
      .delete()
      .eq('collection_id', collectionId)
      .eq('item_id', itemId)
      .eq('item_type', itemType)
      .eq('user_id', userId);
    handleError(error);
  },
});

const repository = createSupabaseCollectionRepository();

export const getCollectionRepository = (): CollectionRepository => repository;
