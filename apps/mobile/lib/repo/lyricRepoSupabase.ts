import type { LyricRepository } from '@refrain/domain';
import { createSupabaseLyricRepository } from '@refrain/supabase-client';

import { supabase } from '../supabaseClient';

export { createSupabaseLyricRepository } from '@refrain/supabase-client';

const repository = createSupabaseLyricRepository(supabase);

export const getLyricRepository = (): LyricRepository => repository;
