// 로그인 정보 저장 조회 Oauth나 마이 페이지 api 요청 등등

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

// 사용자 권한 타입
export type AuthRole = 'USER' | 'ADMIN';

export function normalizeAuthRole(role: unknown): AuthRole {
  return role === 'ADMIN' ? 'ADMIN' : 'USER';
}

// 로그인 에러
export class LoginRequiredError extends Error {}

// 이메일 인증 경로
export const verifyEmailRoutePath = '/verify-email';

export function getStoredValue(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// localStorage에 값 저장
export function setStoredValue(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
  }
}

// 저장된 사용자 ID 가져옴
export function getStoredAuthUserId() {
  return getUserIdFromAccessToken(getStoredAccessToken()) ?? getStoredValue(authUserIdStorageKey);
}

// 저장된 accessToken 가져옴
export function getStoredAccessToken() {
  const accessToken = getStoredValue(accessTokenStorageKey);
  if (!accessToken) return null;
  if (isAccessTokenExpired(accessToken)) {
    clearAuthStorage();
    return null;
  }
  return accessToken;
}


// 서버 오류 메세지
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


// URL 파라미터에서 토큰 꺼냄
export function getAccessTokenFromLocationSearch() {
  if (window.location.pathname === verifyEmailRoutePath) return null;
  return getAccessTokenFromParams(new URLSearchParams(window.location.search));
}

// 사용자가 백엔드의 Google 로그인 경로로 이동
export function getGoogleLoginUrl() {
  return `${apiBaseUrl}/oauth2/authorization/google`;
}

// 마이 페이지 수정
export type MyPageUpdateResponse = {
  accessToken?: string;
  userId?: string;
  loginId?: string;
  nickname?: string;
  role?: string;
  expiresIn?: number;
};


// my page 관련 api 요청을 공통으로 처리
export async function requestMyPageApi<T>(
  path: string,
  options: {
    method?: 'GET' | 'PATCH' | 'DELETE';
    form?: Record<string, string>;
  } = {},
): Promise<T> {
  // 로그인 토큰 검사
  const accessToken = getStoredAccessToken();
  if (!accessToken) {
    throw new LoginRequiredError('Login required');
  }

  // jwt를 요청 헤더에 넣음
  const headers = new Headers({
    authorization: `Bearer ${accessToken}`,
  });
  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers,
  };

  // 폼 데이터 처리
  if (options.form !== undefined) {
    headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
    init.body = new URLSearchParams(options.form);
  }

  // api 기본 주소와 전달받은 경로를 합침
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
  });
  // 서버 응답 읽음
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  const payload = contentType.includes('application/json') && text ? JSON.parse(text) : text;

  // 오류
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
