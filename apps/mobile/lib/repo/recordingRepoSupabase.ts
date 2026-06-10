import type { RecordingRepository } from '@refrain/domain';
import { createSupabaseRecordingRepository } from '@refrain/supabase-client';

import { supabase } from '../supabaseClient';

export { createSupabaseRecordingRepository } from '@refrain/supabase-client';

const repository = createSupabaseRecordingRepository(supabase);

export const getRecordingRepository = (): RecordingRepository => repository;
