// JWT 토큰 관련

// 키 이름
export const accessTokenStorageKey = 'accessToken';
export const authUserIdStorageKey = 'nightreign:auth-user-id';
export const authNicknameStorageKey = 'nightreign:auth-nickname';
export const authNicknameUserIdStorageKey = 'nightreign:auth-nickname-user-id';

// payload 디코딩
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) return null;

  try {
    const normalizedPayload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '=',
    );
    const binaryPayload = atob(paddedPayload);
    const bytes = Uint8Array.from(binaryPayload, (character) => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  } catch (error) {
    console.warn('[auth] Failed to decode access token payload', error);
    return null;
  }
}

// 유효한 토큰의 payload 가져옴
export function getAccessTokenPayload(token: string | null | undefined): Record<string, unknown> | null {
  if (!token || isAccessTokenExpired(token)) return null;
  return decodeJwtPayload(token);
}
// 토큰 만료 검사
export function isAccessTokenExpired(token: string | null | undefined): boolean {
  if (!token) return true;

  const payload = decodeJwtPayload(token);
  if (!payload) return true;

  const exp = payload.exp;
  if (exp === undefined || exp === null) return false;

  const expSeconds =
    typeof exp === 'number' && Number.isFinite(exp)
      ? exp
      : typeof exp === 'string'
        ? Number(exp)
        : NaN;

  if (!Number.isFinite(expSeconds)) return true;
  return expSeconds * 1000 <= Date.now();
}
// payload에서 사용자 꺼냄
export function getUserIdFromAccessToken(token: string | null | undefined): string | null {
  if (!token || isAccessTokenExpired(token)) return null;

  const payload = decodeJwtPayload(token);
  const userId = payload?.userId ?? payload?.sub;
  if (typeof userId === 'string' && userId) return userId;
  if (typeof userId === 'number' && Number.isFinite(userId)) return String(userId);
  return null;
}

// 인증 정보 삭제
export function clearAuthStorage(): void {
  try {
    localStorage.removeItem(accessTokenStorageKey);
    localStorage.removeItem(authUserIdStorageKey);
    localStorage.removeItem(authNicknameStorageKey);
    localStorage.removeItem(authNicknameUserIdStorageKey);
  } catch (error) {
    console.warn('[auth] Failed to clear auth storage', error);
  }
}
