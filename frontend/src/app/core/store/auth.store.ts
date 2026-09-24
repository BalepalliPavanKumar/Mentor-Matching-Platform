import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { AuthState, LoginRequest } from '../models/auth.model';
import { AuthService } from '../services/auth.service';
import { firstValueFrom } from 'rxjs';

const emptyState: AuthState = {
  user: null,
  token: null,
  isLoading: false,
  error: null,
};

const STORAGE_KEY = 'skillsync.auth';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return JSON.parse(window.atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string | null | undefined): boolean {
  if (!token || typeof window === 'undefined') {
    return true;
  }

  const payload = decodeJwtPayload(token);
  const exp = payload?.['exp'];

  if (typeof exp !== 'number') {
    return false;
  }

  return (Date.now() / 1000) >= exp;
}

function readPersistedState(): AuthState {
  if (typeof window === 'undefined') {
    return emptyState;
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return emptyState;
  }

  try {
    const parsed = JSON.parse(raw) as Pick<AuthState, 'user' | 'token'>;
    if (!parsed.user || !parsed.token || isTokenExpired(parsed.token)) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return emptyState;
    }
    return { ...emptyState, user: parsed.user, token: parsed.token };
  } catch {
    return emptyState;
  }
}

function persistAuthState(state: Pick<AuthState, 'user' | 'token'>): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (!state.user || !state.token) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(readPersistedState()),
  withComputed(({ user, token }) => ({
    isAuthenticated: computed(() => !!user() && !!token() && !isTokenExpired(token())),
    isAdmin: computed(() => user()?.role === 'ROLE_ADMIN'),
    isMentor: computed(() => user()?.role === 'ROLE_MENTOR'),
    isLearner: computed(() => user()?.role === 'ROLE_LEARNER'),
    displayRole: computed(() => (user()?.role ?? 'ROLE_LEARNER').replace('ROLE_', '')),
  })),
  withMethods((store, authService = inject(AuthService)) => ({
    async login(credentials: LoginRequest) {
      patchState(store, { isLoading: true, error: null });
      try {
        const response = await firstValueFrom(authService.login(credentials));
        patchState(store, {
          user: response.user,
          token: response.token,
          isLoading: false
        });
        persistAuthState({ user: response.user, token: response.token });
      } catch (err: any) {
        patchState(store, {
          isLoading: false,
          error: err.error?.message || 'Login failed'
        });
      }
    },
    setAuthState(user: AuthState['user'], token: string | null) {
      patchState(store, { ...emptyState, user, token });
      persistAuthState({ user, token });
    },
    logout() {
      patchState(store, emptyState);
      persistAuthState({ user: null, token: null });
    },
  }))
);
