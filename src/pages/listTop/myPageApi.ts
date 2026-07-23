import { getApiErrorMessage } from '../../api/apiError';
import { clearAuthStorage } from '../../api/authToken';
import { apiBaseUrl } from './apiConfig';
import { getStoredAccessToken } from './authStorage';
import { LoginRequiredError } from './authTypes';
import { getErrorMessageFromPayload } from './payloadUtils';

export type MyPageUpdateResponse = {
  accessToken?: string;
  userId?: string;
  loginId?: string;
  nickname?: string;
  role?: string;
  expiresIn?: number;
};

export type MyPageMeResponse = {
  userId?: string;
  loginId?: string;
  email?: string;
  nickname?: string;
  provider?: string;
  role?: string;
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
