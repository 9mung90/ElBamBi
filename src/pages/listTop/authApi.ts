import { apiBaseUrl } from './apiConfig';
import { AuthRequestError } from './authTypes';
import {
  getCodeFromPayload,
  getErrorMessageFromPayload,
} from './payloadUtils';

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
