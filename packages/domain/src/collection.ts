export type CollectionId = string;

export type CollectionItemType = 'lyric' | 'recording';

export interface Collection {
  id: CollectionId;
  title: string;
  description?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CollectionWithCount extends Collection {
  itemCount: number;
  lyricCount: number;
  recordingCount: number;
}

export interface CollectionAssignment {
  collectionId: CollectionId;
  itemId: string;
  itemType: CollectionItemType;
  createdAt: number;
}

export interface CollectionItemWithData {
  assignment: CollectionAssignment;
  item:
    | { type: 'lyric'; data: import('./lyricFile').LyricFile }
    | { type: 'recording'; data: import('./recording').RecordingItem };
}
