import { User, createClient } from '@supabase/supabase-js';
import { BehaviorSubject, fromEvent } from 'rxjs';
import { createPersistBehaviorSubject } from './utils';

export const supabase = createClient(
  'https://makcbuwrvhmfggzvhtux.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ha2NidXdydmhtZmdnenZodHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTA2NTM4MjIsImV4cCI6MjAwNjIyOTgyMn0.JFvsU_M6Br4uVsTM1E9hZumjFylSPsXGaV03xOoV9Uo',
  {
    auth: {
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: window.localStorage,
    },
  },
);

export const authState$ = new BehaviorSubject<
  { user: User; refresh_token: string; access_token: string } | undefined
>(undefined);

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    // delete cookies on sign out
    const expires = new Date(0).toUTCString();
    document.cookie = `yuan-access-token=; path=/; expires=${expires}; samesite=none; secure`;
    document.cookie = `yuan-refresh-token=; path=/; expires=${expires}; samesite=none; secure`;
    authState$.next(undefined);
  } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    const maxAge = 100 * 365 * 24 * 60 * 60; // 100 years, never expires
    document.cookie = `yuan-access-token=${
      session!.access_token
    }; path=/; max-age=${maxAge}; samesite=none; secure`;
    document.cookie = `yuan-refresh-token=${
      session!.refresh_token
    }; path=/; max-age=${maxAge}; samesite=none; secure`;
    authState$.next({
      user: session?.user!,
      refresh_token: session!.refresh_token,
      access_token: session!.access_token,
    });
  }
});
