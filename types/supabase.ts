export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      collection_items: {
        Row: {
          id: string;
          user_id: string;
          collection_id: string;
          item_type: Database['public']['Enums']['collection_item_type'];
          item_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          collection_id: string;
          item_type: Database['public']['Enums']['collection_item_type'];
          item_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          collection_id?: string;
          item_type?: Database['public']['Enums']['collection_item_type'];
          item_id?: string;
          created_at?: string;
        };
      };
      collections: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      lyric_files: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          body: string;
          section_types: Json | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title?: string;
          body?: string;
          section_types?: Json | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          title?: string;
          body?: string;
          section_types?: Json | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      recordings: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          body?: never;
          section_types?: never;
          uri: string | null;
          duration_ms: number | null;
          created_at: string;
          updated_at: string;
          deleted_at?: never;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title?: string | null;
          uri?: string | null;
          duration_ms?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string | null;
          uri?: string | null;
          duration_ms?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      collection_item_type: 'lyric' | 'recording';
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
