import type { CollectionRepository } from '@refrain/domain';
import { createSupabaseCollectionRepository } from '@refrain/supabase-client';

import { supabase } from '../supabaseClient';

export { createSupabaseCollectionRepository } from '@refrain/supabase-client';

const repository = createSupabaseCollectionRepository(supabase);

export const getCollectionRepository = (): CollectionRepository => repository;
