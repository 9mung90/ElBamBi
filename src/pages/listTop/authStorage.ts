import {
  accessTokenStorageKey,
  authUserIdStorageKey,
  clearAuthStorage,
  getUserIdFromAccessToken,
  isAccessTokenExpired,
} from '../../api/authToken';
import type { AuthView } from './authTypes';
import { authViewStorageKey } from './constants';
import { getStoredValue } from './storageUtils';

export function getStoredAuthView(): AuthView {
  const storedView = getStoredValue(authViewStorageKey);
  return storedView === 'login' || storedView === 'signup' ? storedView : null;
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
