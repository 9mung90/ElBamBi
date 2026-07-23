import { getApiErrorMessage } from '../../api/apiError';
import {
  accessTokenStorageKey,
  authUserIdStorageKey,
  clearAuthStorage,
  getUserIdFromAccessToken,
  isAccessTokenExpired,
} from '../../api/authToken';

const defaultApiBaseUrl = 'https://k9e297bszl.execute-api.ap-northeast-2.amazonaws.com';
export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl).replace(/\/$/, '');

export type AuthView = 'login' | 'signup' | null;

export type AuthRole = 'USER' | 'ADMIN';

export function normalizeAuthRole(role: unknown): AuthRole {
  return role === 'ADMIN' ? 'ADMIN' : 'USER';
}

export class LoginRequiredError extends Error {}

export const verifyEmailRoutePath = '/verify-email';

export function getStoredValue(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setStoredValue(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked in some browser modes. Refresh still works with the in-memory state.
  }
}

export function getStoredAuthUserId() {
  return getUserIdFromAccessToken(getStoredAccessToken()) ?? getStoredValue(authUserIdStorageKey);
}

export function getStoredAccessToken() {
  const accessToken = getStoredValue(accessTokenStorageKey);
  if (!accessToken) return null;
  if (isAccessTokenExpired(accessToken)) {
    clearAuthStorage();
    return null;
  }
  return accessToken;
}

export function getErrorMessageFromPayload(payload: unknown) {
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object') {
    const record = payload as { message?: unknown; error?: unknown };
    if (typeof record.message === 'string') return record.message;
    if (typeof record.error === 'string') return record.error;
  }
  return '';
}

export function getAccessTokenFromParams(params: URLSearchParams) {
  const accessToken = params.get('accessToken') ?? params.get('access_token') ?? params.get('token');
  return accessToken && accessToken.trim() ? accessToken : null;
}

export function getAccessTokenFromLocationSearch() {
  if (window.location.pathname === verifyEmailRoutePath) return null;
  return getAccessTokenFromParams(new URLSearchParams(window.location.search));
}

export function getGoogleLoginUrl() {
  return `${apiBaseUrl}/oauth2/authorization/google`;
}

export type MyPageUpdateResponse = {
  accessToken?: string;
  userId?: string;
  loginId?: string;
  nickname?: string;
  role?: string;
  expiresIn?: number;
};

export async function requestMyPageApi<T>(
  path: string,
  options: {
    method?: 'GET' | 'PATCH' | 'DELETE';
    form?: Record<string, string>;
  } = {},
): Promise<T> {
  const accessToken = getStoredAccessToken();
  if (!accessToken) {
    throw new LoginRequiredError('Login required');
  }

  const headers = new Headers({
    authorization: `Bearer ${accessToken}`,
  });
  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers,
  };

  if (options.form !== undefined) {
    headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
    init.body = new URLSearchParams(options.form);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
  });
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  const payload = contentType.includes('application/json') && text ? JSON.parse(text) : text;

  if (!response.ok) {
    const message = getErrorMessageFromPayload(payload) || text;
    if (response.status === 401) {
      clearAuthStorage();
      throw new LoginRequiredError('Login required');
    }
    throw new Error(getApiErrorMessage(response.status, message || `${response.status} ${response.statusText}`));
  }

  return payload as T;
}
