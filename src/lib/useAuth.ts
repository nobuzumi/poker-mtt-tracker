'use client';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './supabase';

export interface AuthState {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  email: string | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(() => {
    const configured = isSupabaseConfigured();
    return { configured, loading: configured, session: null, email: null };
  });

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let active = true;
    sb.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState({
        configured: true,
        loading: false,
        session: data.session,
        email: data.session?.user.email ?? null,
      });
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (!active) return;
      setState({ configured: true, loading: false, session, email: session?.user.email ?? null });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
