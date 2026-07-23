import { getFirstString } from './payloadUtils';

export function getProfileEmail(profile: Record<string, unknown> | null) {
  return getFirstString(profile, ['email', 'userEmail']);
}

export function getProfileNickname(profile: Record<string, unknown> | null) {
  return getFirstString(profile, ['nickname', 'nickName', 'userNickname']);
}

export function getProfileLoginId(profile: Record<string, unknown> | null) {
  return getFirstString(profile, ['loginId', 'username', 'userId', 'id']);
}

export function getProfileProvider(profile: Record<string, unknown> | null) {
  return getFirstString(profile, ['provider', 'providerName', 'oauthProvider', 'socialProvider'], 'local');
}

export function isSocialLoginProfile(profile: Record<string, unknown> | null) {
  const provider = getProfileProvider(profile).trim().toLowerCase();
  const loginType = getFirstString(profile, ['loginType', 'accountType', 'type']).trim().toLowerCase();
  const isSocial = profile?.socialLogin ?? profile?.isSocialLogin ?? profile?.oauthLogin;

  return (
    isSocial === true ||
    loginType.includes('social') ||
    loginType.includes('oauth') ||
    Boolean(provider && provider !== 'local')
  );
}

export function isValidProfileNickname(nickname: string) {
  return /^[A-Za-z0-9가-힣]{1,10}$/.test(nickname);
}

export function isValidProfilePassword(password: string) {
  return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,20}$/.test(password);
}
