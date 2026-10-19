import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';
import type { Database } from '../supabase/types';

const NEON_AUTH_URL =
  (import.meta.env['VITE_NEON_AUTH_URL'] as string | undefined) ||
  'https://ep-royal-snow-b4i5rtm5.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth';

const NEON_DATA_API_URL =
  (import.meta.env['VITE_NEON_DATA_API_URL'] as string | undefined) ||
  'https://ep-royal-snow-b4i5rtm5.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1';

export function createNeonClient() {
  return createClient<Database>({
    auth: {
      url: NEON_AUTH_URL,
      allowAnonymous: true,
      adapter: SupabaseAuthAdapter(),
    },
    dataApi: {
      url: NEON_DATA_API_URL,
    },
  });
}

let _neon: ReturnType<typeof createNeonClient> | undefined;

export const neon = new Proxy({} as ReturnType<typeof createNeonClient>, {
  get(_, prop, receiver) {
    if (!_neon) _neon = createNeonClient();
    return Reflect.get(_neon, prop, receiver);
  },
});

// Alias for seamless backward compatibility across the codebase
export const supabase = neon;

export function createNonPersistedSupabaseClient() {
  return createNeonClient();
}
