import {
  accessTokenStorageKey,
  authUserIdStorageKey,
  getUserIdFromAccessToken,
} from '../../api/authToken';
import { apiBaseUrl } from './apiConfig';
import { AuthRequestError } from './authTypes';
import {
  getAccessTokenFromPayload,
  getCodeFromPayload,
  getErrorMessageFromPayload,
  getMessageFromPayload,
} from './payloadUtils';
import { setStoredValue } from './storageUtils';

export async function readResponsePayload(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  if (!text) return undefined;
  return contentType.includes('application/json') ? JSON.parse(text) : text;
}

export async function postPublicJson(path: string, data: Record<string, string>): Promise<unknown> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
    body: JSON.stringify(data),
  });
  const payload = await readResponsePayload(response);
  const message = getErrorMessageFromPayload(payload);

  if (!response.ok) {
    throw new AuthRequestError(
      response.status,
      message || '요청을 처리하지 못했습니다.',
      getCodeFromPayload(payload),
      payload,
    );
  }

  return payload;
}

export function postVerifyEmail(token: string) {
  return postPublicJson('/api/auth/verify-email', { token });
}

export function postResendVerification(email: string) {
  return postPublicJson('/api/auth/resend-verification', { email });
}

export async function postAuthForm(
  path: string,
  data: Record<string, string>,
  options: { storeAuth?: boolean } = {},
): Promise<string> {
  const body = new URLSearchParams(data);
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body,
  });
  const payload = await readResponsePayload(response);
  const message = getMessageFromPayload(payload);
  const code = getCodeFromPayload(payload);
  const accessToken = getAccessTokenFromPayload(payload);
  const userId = getUserIdFromAccessToken(accessToken);

  if (!response.ok || code === 'EMAIL_NOT_VERIFIED') {
    throw new AuthRequestError(
      response.status,
      getErrorMessageFromPayload(payload) || message || '요청을 처리하지 못했습니다.',
      code,
      payload,
    );
  }

  if ((options.storeAuth ?? true) && accessToken) {
    setStoredValue(accessTokenStorageKey, accessToken);
  }
  if ((options.storeAuth ?? true) && userId) {
    setStoredValue(authUserIdStorageKey, userId);
  }

  return message || (typeof payload === 'string' ? payload : '');
}
