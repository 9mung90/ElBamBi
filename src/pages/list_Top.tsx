import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { RelicScanResult, CharacterSlot } from '../utils/nightreignSaveParser';
import { useCallback, type MouseEvent } from 'react';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { useRef, type TouchEvent as ReactTouchEvent } from 'react';
import { ashes } from '../data/ashes';
import AshesPage from './AshesPage';
import BossesPage from './BossesPage';
import BuildPage, { type SortKey as BuildSortKey } from './BuildPage';
import {
  bossFilterOptions,
  bossTypeLabels,
  createEmptyBossFilters,
  type BossFilters,
} from './bossFilters';
import CharactersPage from './CharactersPage';
import GesturesPage from './GesturesPage';
import ItemsPage from './ItemsPage';
import MapPage from './MapPage';
import OptionsPage, {
  createEmptyOptionFilters,
  optionCategoryLabels,
  optionFilterOptions,
  optionStackableLabels,
  optionTypeLabels,
  type OptionFilters,
} from './OptionsPage';
import PlaceholderPage from './PlaceholderPage';
import RelicBuilderPage from './RelicBuilderPage';
import RelicsPage from './RelicsPage';
import SaveParserPage from './SaveParserPage';
import SpellsPage, {
  createEmptySpellFilters,
  spellFilterOptions,
  type SpellFilters,
} from './SpellsPage';
import StatsCalculatorPage from './StatsCalculatorPage';
import TalismansPage from './TalismansPage';
import VesselsPage from './VesselsPage';
import WeaponsPage, {
  createEmptyWeaponFilters,
  weaponFilterOptions,
  type WeaponFilters,
} from './WeaponsPage';
import { getApiErrorMessage } from '../api/apiError';
import {
  accessTokenStorageKey,
  authNicknameStorageKey,
  authNicknameUserIdStorageKey,
  authUserIdStorageKey,
  clearAuthStorage,
  getUserIdFromAccessToken,
  isAccessTokenExpired,
} from '../api/authToken';
import logoImage from '../assets/images/top_icon/logo.png';
import loginImage from '../assets/images/top_icon/login.webp';
import { categories } from './listTop/categoryConfig';
import { categoryIconAssets } from './listTop/categoryIcons';
import {
  authViewStorageKey,
  emailVerifiedSignalStorageKey,
  lastPageStorageKey,
  mainRoutePath,
  nicknameRoutePath,
  officialWebsiteUrl,
  playStoreUrl,
  pullToRefreshThreshold,
  verifyEmailRoutePath,
} from './listTop/constants';
import {
  getAccessTokenFromPayload,
  getArrayFromPayload,
  getCodeFromPayload,
  getErrorMessageFromPayload,
  getFirstRecord,
  getFirstString,
  getMessageFromPayload,
  getNumberValue,
  getRecord,
  getStringValue,
} from './listTop/payloadUtils';
import './list_Top.css';

function toggleFilterValue<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((currentValue) => currentValue !== value)
    : [...values, value];
}

type AuthView = 'login' | 'signup' | null;
type MyPageView = 'overview' | 'posts' | 'comments' | 'bookmarks' | 'relics' | 'presets';
type AuthRole = 'USER' | 'ADMIN';
const defaultApiBaseUrl = 'https://k9e297bszl.execute-api.ap-northeast-2.amazonaws.com';
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl).replace(/\/$/, '');
const verifyingEmailTokens = new Map<string, Promise<unknown>>();

type MyPageOverviewData = {
  profile: Record<string, unknown> | null;
  posts: Record<string, unknown>[];
  comments: Record<string, unknown>[];
  bookmarks: Record<string, unknown>[];
  relics: Record<string, unknown>[];
  presets: Record<string, unknown>[];
};
type MyPageProfileForm = {
  nickname: string;
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

type MyPageUpdateResponse = {
  accessToken?: string;
  userId?: string;
  loginId?: string;
  nickname?: string;
  role?: string;
  expiresIn?: number;
};

type MyPageMeResponse = {
  userId?: string;
  loginId?: string;
  email?: string;
  nickname?: string;
  provider?: string;
  role?: string;
};

class LoginRequiredError extends Error {}

class AuthRequestError extends Error {
  code: string;
  status: number;
  payload: unknown;

  constructor(status: number, message: string, code: string, payload: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

function getStoredPageId() {
  const storedId = getStoredValue(lastPageStorageKey);
  if (storedId && categories.some((category) => category.id === storedId)) {
    return storedId;
  }
  return categories[0].id;
}

function getStoredAuthView(): AuthView {
  const storedView = getStoredValue(authViewStorageKey);
  return storedView === 'login' || storedView === 'signup' ? storedView : null;
}

function getStoredAuthUserId() {
  return getUserIdFromAccessToken(getStoredAccessToken()) ?? getStoredValue(authUserIdStorageKey);
}

function getStoredValue(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getStoredAccessToken() {
  const accessToken = getStoredValue(accessTokenStorageKey);
  if (!accessToken) return null;
  if (isAccessTokenExpired(accessToken)) {
    clearAuthStorage();
    return null;
  }
  return accessToken;
}

function setStoredValue(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked in some browser modes. Refresh still works with the in-memory state.
  }
}

function removeStoredValue(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures for the same reason as setStoredValue.
  }
}

function resetPageScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function formatMyPageDate(value: unknown) {
  const rawValue = getStringValue(value);
  if (!rawValue) return '';

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return rawValue;

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function getProfileEmail(profile: Record<string, unknown> | null) {
  return getFirstString(profile, ['email', 'userEmail']);
}

function getProfileNickname(profile: Record<string, unknown> | null) {
  return getFirstString(profile, ['nickname', 'nickName', 'userNickname']);
}

function getProfileLoginId(profile: Record<string, unknown> | null) {
  return getFirstString(profile, ['loginId', 'username', 'userId', 'id']);
}

function getProfileProvider(profile: Record<string, unknown> | null) {
  return getFirstString(profile, ['provider', 'providerName', 'oauthProvider', 'socialProvider'], 'local');
}

function normalizeAuthRole(role: unknown): AuthRole {
  return role === 'ADMIN' ? 'ADMIN' : 'USER';
}

function getProfileRole(profile: Record<string, unknown> | null): AuthRole {
  return normalizeAuthRole(profile?.role);
}

function isSocialLoginProfile(profile: Record<string, unknown> | null) {
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

function isValidProfileNickname(nickname: string) {
  return /^[A-Za-z0-9가-힣]{1,10}$/.test(nickname);
}

function isValidProfilePassword(password: string) {
  return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,20}$/.test(password);
}

function getAccessTokenFromParams(params: URLSearchParams) {
  const accessToken = params.get('accessToken') ?? params.get('access_token') ?? params.get('token');
  return accessToken && accessToken.trim() ? accessToken : null;
}

function getAccessTokenFromLocationSearch() {
  if (window.location.pathname === verifyEmailRoutePath) return null;
  return getAccessTokenFromParams(new URLSearchParams(window.location.search));
}

function getNeedsNicknameFromParams(params: URLSearchParams) {
  return params.get('needsNickname') === 'true';
}

function getNeedsNicknameFromLocationSearch() {
  return getNeedsNicknameFromParams(new URLSearchParams(window.location.search));
}

function hasOAuthRedirectParamsInSearch(params: URLSearchParams) {
  return (
    params.has('oauthError') ||
    params.has('accessToken') ||
    params.has('access_token') ||
    params.has('token') ||
    params.has('needsNickname')
  );
}

function hasOAuthRedirectParams() {
  if (window.location.pathname === verifyEmailRoutePath) return false;
  return hasOAuthRedirectParamsInSearch(new URLSearchParams(window.location.search));
}

function getGoogleLoginUrl() {
  return `${apiBaseUrl}/oauth2/authorization/google`;
}

function getAndroidGoogleLoginUrl() {
  const url = new URL(getGoogleLoginUrl());
  url.searchParams.set('redirectTarget', 'android');
  return url.toString();
}

function getOAuthErrorMessage(errorCode: string | null) {
  if (errorCode === 'google_email_already_exists') {
    return '이미 사용하신 이메일 주소 입니다';
  }

  return '구글 로그인에 실패했습니다. 다시 시도해 주세요.';
}

async function postNicknameForm(nickname: string, accessTokenOverride?: string | null): Promise<string> {
  const body = new URLSearchParams({ nickname });
  const headers = new Headers({
    'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
  });
  const accessToken =
    accessTokenOverride ?? getStoredAccessToken() ?? getAccessTokenFromLocationSearch();

  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${apiBaseUrl}/api/inputNick`, {
    method: 'POST',
    headers,
    body,
  });
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  const payload = contentType.includes('application/json') && text ? JSON.parse(text) : text;
  const message = getMessageFromPayload(payload) || (typeof payload === 'string' ? payload : '');

  if (!response.ok) {
    throw new Error(message || '닉네임 저장에 실패했습니다.');
  }

  return message || '닉네임이 저장되었습니다.';
}

async function readResponsePayload(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  if (!text) return undefined;
  return contentType.includes('application/json') ? JSON.parse(text) : text;
}

async function postPublicJson(path: string, data: Record<string, string>): Promise<unknown> {
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

function postVerifyEmail(token: string) {
  return postPublicJson('/api/auth/verify-email', { token });
}

function postResendVerification(email: string) {
  return postPublicJson('/api/auth/resend-verification', { email });
}

async function postAuthForm(
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

async function requestMyPageApi<T>(
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

function NicknamePage({
  accessToken,
  onComplete,
}: {
  accessToken?: string | null;
  onComplete: () => void;
}) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedNickname = nickname.trim();
  const isNicknameValid = /^[A-Za-z0-9가-힣]{1,10}$/.test(trimmedNickname);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!isNicknameValid) {
      setError('닉네임은 한글, 영문, 숫자만 사용해서 1~10자로 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    let didComplete = false;

    try {
      await postNicknameForm(trimmedNickname, accessToken);
      const userId = getUserIdFromAccessToken(accessToken ?? getStoredAccessToken());
      setStoredValue(authNicknameStorageKey, trimmedNickname);
      if (userId) {
        setStoredValue(authNicknameUserIdStorageKey, userId);
      }
      didComplete = true;
      onComplete();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      if (!didComplete) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <main className="list-top-shell nickname-shell">
      <section className="nickname-page" aria-labelledby="nickname-page-title">
        <div className="auth-panel nickname-panel">
          <p className="list-page-kicker">Google OAuth</p>
          <h1 id="nickname-page-title">닉네임 설정</h1>
          <p className="nickname-description">
            처음 로그인한 계정입니다. 서비스에서 사용할 닉네임을 입력해 주세요.
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              닉네임
              <input
                type="text"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                autoComplete="nickname"
                maxLength={10}
                pattern="[A-Za-z0-9가-힣]{1,10}"
                required
                autoFocus
              />
            </label>
            <p className="auth-help-text">한글, 영문, 숫자만 사용할 수 있습니다. 최대 10자까지 입력해 주세요.</p>
            {error ? <p className="auth-message is-error">{error}</p> : null}
            <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
              {isSubmitting ? '저장 중...' : '저장하고 시작하기'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function VerifyEmailPage({ onGoToLogin }: { onGoToLogin: () => void }) {
  const [status, setStatus] = useState<'missing' | 'loading' | 'success' | 'error'>(() => {
    const token = new URLSearchParams(window.location.search).get('token')?.trim();
    return token ? 'loading' : 'missing';
  });

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')?.trim();
    if (!token) {
      setStatus('missing');
      return;
    }

    let isMounted = true;
    setStatus('loading');

    const request = verifyingEmailTokens.get(token) ?? postVerifyEmail(token);
    verifyingEmailTokens.set(token, request);

    request
      .then(() => {
        if (isMounted) {
          setStoredValue(emailVerifiedSignalStorageKey, String(Date.now()));
          setStatus('success');
        }
      })
      .catch(() => {
        verifyingEmailTokens.delete(token);
        if (isMounted) setStatus('error');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const title =
    status === 'success'
      ? '이메일 인증 완료'
      : status === 'loading'
        ? '이메일 인증 중'
        : '이메일 인증 실패';
  const message =
    status === 'success'
      ? '이메일 인증이 완료되었습니다.'
      : status === 'loading'
        ? '이메일 인증을 확인하고 있습니다.'
        : status === 'missing'
          ? '인증 토큰이 없습니다. 이메일의 인증 링크를 다시 확인해주세요.'
          : '인증 링크가 만료되었거나 올바르지 않습니다.';

  return (
    <main className="list-top-shell verify-email-shell">
      <section className="auth-page" aria-labelledby="verify-email-title">
        <div className="auth-panel verify-email-panel">
          <p className="list-page-kicker">Email Verification</p>
          <h1 id="verify-email-title">{title}</h1>
          <p className={`auth-message ${status === 'success' ? 'is-success' : status === 'loading' ? '' : 'is-error'}`}>
            {message}
          </p>
          {status !== 'loading' ? (
            <button type="button" className="auth-submit-button" onClick={onGoToLogin}>
              로그인 페이지로 이동
            </button>
          ) : null}
          {status === 'error' ? (
            <p className="auth-help-text">
              로그인 페이지에서 계정 정보를 입력한 뒤 인증 메일을 다시 받을 수 있습니다.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function AuthPage({
  initialError,
  view,
  onChangeView,
  onGoogleLoginClick,
  onLoginSuccess,
}: {
  initialError?: string | null;
  view: Exclude<AuthView, null>;
  onChangeView: (view: Exclude<AuthView, null>) => void;
  onGoogleLoginClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  onLoginSuccess: (loginId: string) => void;
}) {
  const isLogin = view === 'login';
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const enableEmailPasswordAuthAfterSesRestore = false;

  const resendEmail = verificationEmail.trim() || (loginId.includes('@') ? loginId.trim() : '');

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  useEffect(() => {
    const handleEmailVerified = (event: StorageEvent) => {
      if (event.key !== emailVerifiedSignalStorageKey || !event.newValue) return;

      setError(null);
      setResendError(null);
      setNeedsEmailVerification(false);
      setMessage('이메일 인증이 완료되었습니다. 로그인해 주세요.');
      onChangeView('login');
    };

    window.addEventListener('storage', handleEmailVerified);
    return () => window.removeEventListener('storage', handleEmailVerified);
  }, [onChangeView]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setResendMessage(null);
    setResendError(null);
    setNeedsEmailVerification(false);
    setIsSubmitting(true);

    try {
      if (isLogin) {
        const result = await postAuthForm('/api/login', { loginId, password });
        setMessage(result || '로그인되었습니다.');
        onLoginSuccess(getStoredAuthUserId() ?? loginId);
        return;
      }

      await postAuthForm('/api/sign', {
        loginId,
        password,
        confirmPassword,
        email,
        nickname,
      }, { storeAuth: false });
      setNeedsEmailVerification(true);
      setVerificationEmail(email);
      setMessage(
        '회원가입이 완료되었습니다. 이메일 인증 링크를 확인해주세요. 메일이 없다면 아래에서 다시 받을 수 있습니다.',
      );
      setPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      if (isLogin && requestError instanceof AuthRequestError && requestError.code === 'EMAIL_NOT_VERIFIED') {
        setNeedsEmailVerification(true);
        setVerificationEmail(loginId.includes('@') ? loginId : '');
        setError('이메일 인증 후 로그인할 수 있습니다.');
        return;
      }
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    setResendError(null);
    setResendMessage(null);
    const emailToSend = resendEmail;

    if (!emailToSend) {
      setResendError('인증 메일을 받을 이메일을 입력해주세요.');
      return;
    }

    setIsResendingVerification(true);

    try {
      await postResendVerification(emailToSend);
      setResendMessage('인증 메일을 다시 보냈습니다. 메일함을 확인해주세요.');
    } catch (requestError) {
      setResendError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setIsResendingVerification(false);
    }
  };

  return (
    <section className="auth-page" aria-labelledby="auth-page-title">
      <div className="auth-panel">
        <p className="list-page-kicker">Account</p>
        <h2 id="auth-page-title">로그인</h2>

        {/* SES 인증 복구 후 다시 노출할 이메일/비밀번호 로그인 및 회원가입 폼입니다. */}
        {enableEmailPasswordAuthAfterSesRestore ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              아이디
              <input
                type="text"
                value={loginId}
                onChange={(event) => setLoginId(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            {!isLogin ? (
              <label>
                닉네임
                <input
                  type="text"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  autoComplete="nickname"
                  required
                />
              </label>
            ) : null}
            {!isLogin ? (
              <label>
                이메일
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
            ) : null}
            <label>
              비밀번호
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
              />
            </label>
            {!isLogin ? (
              <label>
                비밀번호 확인
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
            ) : null}
            {!isLogin ? (
              <p className="auth-help-text">아이디는 영문 소문자/숫자/밑줄 4~20자, 비밀번호는 영문/숫자/특수문자 포함 8~20자입니다.</p>
            ) : null}
            {message ? <p className="auth-message is-success">{message}</p> : null}
            <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
              {isSubmitting ? '처리 중...' : isLogin ? '로그인' : '회원가입'}
            </button>
          </form>
        ) : null}
        {error ? <p className="auth-message is-error">{error}</p> : null}

        {/* SES 인증 복구 후 다시 노출할 인증 메일 재전송 영역입니다. */}
        {enableEmailPasswordAuthAfterSesRestore && needsEmailVerification ? (
          <div className="auth-resend-box">
            <p className="auth-help-text">
              인증 메일을 받지 못했다면 이메일 주소를 확인한 뒤 다시 전송하세요.
            </p>
            <label>
              이메일
              <input
                type="email"
                value={verificationEmail}
                onChange={(event) => setVerificationEmail(event.target.value)}
                placeholder={loginId.includes('@') ? loginId : '가입한 이메일'}
                autoComplete="email"
              />
            </label>
            <button
              type="button"
              className="auth-secondary-button"
              disabled={isResendingVerification}
              onClick={handleResendVerification}
            >
              {isResendingVerification ? '전송 중...' : '인증 메일 다시 보내기'}
            </button>
            {resendMessage ? <p className="auth-message is-success">{resendMessage}</p> : null}
            {resendError ? <p className="auth-message is-error">{resendError}</p> : null}
          </div>
        ) : null}

        <div className="auth-oauth-area">
          {enableEmailPasswordAuthAfterSesRestore ? (
            <div className="auth-divider">
              <span>또는</span>
            </div>
          ) : null}
          <a className="auth-google-button" href={getGoogleLoginUrl()} onClick={onGoogleLoginClick}>
            <span aria-hidden="true">G</span>
            Google로 로그인
          </a>
        </div>

        {/* SES 인증 복구 후 다시 노출할 로그인/회원가입 전환 버튼입니다. */}
        {enableEmailPasswordAuthAfterSesRestore ? (
          <div className="auth-switch-row">
            <span>{isLogin ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}</span>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMessage(null);
                setNeedsEmailVerification(false);
                setResendMessage(null);
                setResendError(null);
                onChangeView(isLogin ? 'signup' : 'login');
              }}
            >
              {isLogin ? '회원가입' : '로그인'}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
function getMyPageProfileLabel(profile: Record<string, unknown> | null, authUserId: string | null) {
  return {
    nickname: getProfileNickname(profile) || '닉네임 없음',
    loginId: getProfileLoginId(profile) || getProfileEmail(profile) || (authUserId ?? '-'),
    email: getProfileEmail(profile) || '-',
    provider: getProfileProvider(profile),
    role: getProfileRole(profile),
  };
}

function getMyPagePostId(item: Record<string, unknown>) {
  return getFirstString(item, ['postId', 'communityPostId', 'id']);
}

function getMyPagePostTitle(item: Record<string, unknown>) {
  return getFirstString(item, ['postTitle', 'title'], '제목 없음');
}

function getMyPagePostPreview(item: Record<string, unknown>) {
  return getFirstString(item, ['contentText', 'content', 'commentText']);
}

function getMyPageBookmarkPost(item: Record<string, unknown>) {
  return getRecord(item.post) ?? item;
}

function getMyPageCommentPostLabel(item: Record<string, unknown>) {
  const postTitle = getFirstString(item, ['postTitle', 'title']);
  if (postTitle) return postTitle;

  const postId = getMyPagePostId(item);
  return postId ? `postId: ${postId}` : '';
}

function getMyPageRelicTitle(item: Record<string, unknown>) {
  return getFirstString(item, ['itemName', 'name', 'relicName', 'title'], '이름 없는 유물');
}

function getMyPagePresetTitle(item: Record<string, unknown>) {
  return getFirstString(item, ['name', 'presetName', 'title'], '이름 없는 프리셋');
}

function getMyPageItemDate(item: Record<string, unknown>) {
  return formatMyPageDate(item.createdAt ?? item.updatedAt);
}

function formatMyPageSlotSummary(slot: Record<string, unknown>) {
  const slotIndex = getStringValue(slot.slotIndex, '-');
  const relicRefType = getFirstString(slot, ['relicRefType'], 'slot');
  const relicId = getFirstString(slot, ['relicId']);
  const itemId = getStringValue(slot.itemId);
  const effectIds = Array.isArray(slot.effectIds) ? slot.effectIds.filter(Boolean).join('/') : '';
  const refText = relicId || itemId ? `${relicId || `item ${itemId}`}` : '';

  return [`${slotIndex}`, relicRefType, refText, effectIds ? `effects ${effectIds}` : '']
    .filter(Boolean)
    .join(' · ');
}

function MyPageSection({
  title,
  emptyMessage,
  isLoading,
  error,
  children,
  onMore,
}: {
  title: string;
  emptyMessage: string;
  isLoading: boolean;
  error: string | null;
  children: ReactNode;
  onMore?: () => void;
}) {
  return (
    <section className="my-page-card" aria-label={title}>
      <div className="my-page-card-header">
        <h3>{title}</h3>
        {onMore ? (
          <button type="button" className="my-page-more-button" onClick={onMore}>
            더보기
          </button>
        ) : null}
      </div>
      {isLoading ? <p className="my-page-muted">불러오는 중...</p> : null}
      {!isLoading && error ? <p className="my-page-message is-error">{error}</p> : null}
      {!isLoading && !error ? children : null}
      {!isLoading && !error && !children ? <p className="my-page-muted">{emptyMessage}</p> : null}
    </section>
  );
}

function MyPageItemList({
  items,
  emptyMessage,
  renderItem,
}: {
  items: Record<string, unknown>[];
  emptyMessage: string;
  renderItem: (item: Record<string, unknown>, index: number) => ReactNode;
}) {
  if (items.length === 0) {
    return <p className="my-page-muted">{emptyMessage}</p>;
  }

  return <div className="my-page-item-list">{items.map(renderItem)}</div>;
}

function MyPagePostItem({
  item,
  onOpenPost,
}: {
  item: Record<string, unknown>;
  onOpenPost: (postId: string) => void;
}) {
  const postId = getMyPagePostId(item);
  const createdAt = getMyPageItemDate(item);
  const preview = getMyPagePostPreview(item);

  return (
    <button
      type="button"
      className="my-page-list-item is-clickable"
      disabled={!postId}
      onClick={() => postId && onOpenPost(postId)}
    >
      <strong>{getMyPagePostTitle(item)}</strong>
      <span>
        {getFirstString(item, ['category']) || '분류 없음'}
        {createdAt ? ` · ${createdAt}` : ''}
      </span>
      <small>
        조회 {getNumberValue(item.viewCount)} · 추천 {getNumberValue(item.likeCount)} · 댓글{' '}
        {getNumberValue(item.commentCount)}
      </small>
      {preview ? <small>{preview}</small> : null}
    </button>
  );
}

function MyPageBookmarkItem({
  item,
  onOpenPost,
}: {
  item: Record<string, unknown>;
  onOpenPost: (postId: string) => void;
}) {
  const post = getMyPageBookmarkPost(item);
  const postId = getMyPagePostId(post);
  const createdAt = formatMyPageDate(post.createdAt);
  const bookmarkedAt = formatMyPageDate(item.bookmarkedAt);
  const preview = getMyPagePostPreview(post);

  return (
    <button
      type="button"
      className="my-page-list-item is-clickable"
      disabled={!postId}
      onClick={() => postId && onOpenPost(postId)}
    >
      <strong>{getMyPagePostTitle(post)}</strong>
      <span>
        {getFirstString(post, ['category']) || '분류 없음'}
        {createdAt ? ` · 작성 ${createdAt}` : ''}
        {bookmarkedAt ? ` · 북마크 ${bookmarkedAt}` : ''}
      </span>
      <small>
        조회 {getNumberValue(post.viewCount)} · 추천 {getNumberValue(post.likeCount)} · 북마크{' '}
        {getNumberValue(post.bookmarkCount)} · 댓글 {getNumberValue(post.commentCount)}
      </small>
      {preview ? <small>{preview}</small> : null}
    </button>
  );
}

function MyPageCommentItem({
  item,
  onOpenPost,
}: {
  item: Record<string, unknown>;
  onOpenPost: (postId: string) => void;
}) {
  const postId = getMyPagePostId(item);
  const postLabel = getMyPageCommentPostLabel(item);
  const createdAt = getMyPageItemDate(item);

  return (
    <button
      type="button"
      className="my-page-list-item is-clickable"
      disabled={!postId}
      onClick={() => postId && onOpenPost(postId)}
    >
      <strong>{getFirstString(item, ['content', 'comment', 'commentText'], '내용 없음')}</strong>
      {postLabel ? <span>{postLabel}</span> : null}
      {createdAt ? <small>{createdAt}</small> : null}
    </button>
  );
}

function MyPageRelicItem({ item }: { item: Record<string, unknown> }) {
  const options = getArrayFromPayload(item.options, ['options']);
  const debuffs = getArrayFromPayload(item.debuffs, ['debuffs']);
  const updatedAt = formatMyPageDate(item.updatedAt);
  const optionSummary = options
    .map((option) => {
      const name = getFirstString(option, ['name', 'effectName']);
      const detail = getFirstString(option, ['detail', 'desc']);
      return [name, detail].filter(Boolean).join(': ');
    })
    .filter(Boolean)
    .join(' / ');

  return (
    <article className="my-page-list-item">
      <strong>{getMyPageRelicTitle(item)}</strong>
      <span>
        {getFirstString(item, ['color'], '색상 없음')} · {getFirstString(item, ['modeId'], 'mode 없음')} · 슬롯{' '}
        {getStringValue(item.slotIndex, '-')} · {item.isValid === false ? '사용 불가' : '사용 가능'}
        {updatedAt ? ` · ${updatedAt}` : ''}
      </span>
      {optionSummary ? <small>{optionSummary}</small> : null}
      {debuffs.length ? <small>디버프 {debuffs.map((debuff) => getFirstString(debuff, ['name'])).filter(Boolean).join(' / ')}</small> : null}
    </article>
  );
}

function MyPagePresetItem({ item }: { item: Record<string, unknown> }) {
  const slots = getArrayFromPayload(item.slots, ['slots']);
  const createdAt = getMyPageItemDate(item);
  const updatedAt = formatMyPageDate(item.updatedAt);
  const slotSummary = slots.slice(0, 3).map(formatMyPageSlotSummary).filter(Boolean).join(' / ');

  return (
    <article className="my-page-list-item">
      <strong>{getMyPagePresetTitle(item)}</strong>
      <small>
        {createdAt ? `작성 ${createdAt}` : ''}
        {updatedAt ? `${createdAt ? ' · ' : ''}수정 ${updatedAt}` : ''}
      </small>
      <small>{slotSummary || `슬롯 ${slots.length || getNumberValue(item.slotCount)}`}</small>
    </article>
  );
}

function MyPage({
  authUserId,
  onAuthUpdated,
  onAccountDeleted,
  onLoginRequired,
  onLogout,
  onOpenPost,
}: {
  authUserId: string | null;
  onAuthUpdated: (response: MyPageUpdateResponse) => void;
  onAccountDeleted: () => void;
  onLoginRequired: () => void;
  onLogout: () => void;
  onOpenPost: (postId: string) => void;
}) {
  const [view, setView] = useState<MyPageView>('overview');
  const [overviewData, setOverviewData] = useState<MyPageOverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<Record<string, unknown>[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<MyPageProfileForm>({
    nickname: '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [deleteCurrentPassword, setDeleteCurrentPassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    if (view !== 'overview') return;

    let isMounted = true;
    setOverviewLoading(true);
    setOverviewError(null);

    Promise.all([
      requestMyPageApi<unknown>('/api/me'),
      requestMyPageApi<unknown>('/api/me/summary?limit=6'),
    ])
      .then(([mePayload, summaryPayload]) => {
        if (!isMounted) return;

        const summary = getRecord(summaryPayload);
        const profile =
          getFirstRecord(summary, ['profile', 'account', 'me', 'user']) ??
          getFirstRecord(getRecord(mePayload), ['profile', 'account', 'me', 'user']) ??
          getRecord(mePayload);

        setOverviewData({
          profile,
          posts: getArrayFromPayload(summaryPayload, ['posts', 'recentPosts', 'communityPosts', 'myPosts']),
          comments: getArrayFromPayload(summaryPayload, ['comments', 'recentComments', 'myComments']),
          bookmarks: getArrayFromPayload(summaryPayload, ['bookmarks', 'recentBookmarks', 'myBookmarks']),
          relics: getArrayFromPayload(summaryPayload, ['relics', 'recentRelics', 'myRelics']),
          presets: getArrayFromPayload(summaryPayload, ['presets', 'recentPresets', 'myPresets']),
        });
      })
      .catch((error) => {
        if (!isMounted) return;
        if (error instanceof LoginRequiredError) {
          onLoginRequired();
          return;
        }
        setOverviewError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (isMounted) setOverviewLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [onLoginRequired, view]);

  useEffect(() => {
    if (view === 'overview') return;

    const pathByView: Record<Exclude<MyPageView, 'overview'>, string> = {
      posts: '/api/me/posts?limit=20',
      comments: '/api/me/comments?limit=20',
      bookmarks: '/api/me/bookmarks?limit=20',
      relics: '/api/me/relics?source=builder',
      presets: '/api/me/presets',
    };
    const keysByView: Record<Exclude<MyPageView, 'overview'>, string[]> = {
      posts: ['posts', 'communityPosts', 'myPosts'],
      comments: ['comments', 'myComments'],
      bookmarks: ['bookmarks', 'myBookmarks'],
      relics: ['relics', 'myRelics'],
      presets: ['presets', 'myPresets'],
    };
    const detailView = view;
    let isMounted = true;

    setDetailLoading(true);
    setDetailError(null);
    setDetailItems([]);

    requestMyPageApi<unknown>(pathByView[detailView])
      .then((payload) => {
        if (isMounted) setDetailItems(getArrayFromPayload(payload, keysByView[detailView]));
      })
      .catch((error) => {
        if (error instanceof LoginRequiredError) {
          onLoginRequired();
          return;
        }
        if (isMounted) setDetailError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (isMounted) setDetailLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [onLoginRequired, view]);

  useEffect(() => {
    const profile = overviewData?.profile ?? null;
    setProfileForm((currentForm) => ({
      ...currentForm,
      nickname: getProfileNickname(profile),
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    }));
    setProfileMessage(null);
    setProfileError(null);
  }, [overviewData?.profile]);

  const profileRecord = overviewData?.profile ?? null;
  const isSocialLogin = isSocialLoginProfile(profileRecord);
  const profile = getMyPageProfileLabel(profileRecord, authUserId);

  function updateProfileForm(field: keyof MyPageProfileForm, value: string) {
    setProfileForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileMessage(null);
    setProfileError(null);

    const nickname = profileForm.nickname.trim();
    const currentPassword = profileForm.currentPassword;
    const newPassword = profileForm.newPassword;
    const confirmNewPassword = profileForm.confirmNewPassword;

    if (nickname && !isValidProfileNickname(nickname)) {
      setProfileError('닉네임은 한글, 영문, 숫자 1~10자여야 합니다.');
      return;
    }

    if (!isSocialLogin && (newPassword || confirmNewPassword)) {
      if (newPassword !== confirmNewPassword) {
        setProfileError('새 비밀번호와 확인 값이 일치하지 않습니다.');
        return;
      }

      if (!isValidProfilePassword(newPassword)) {
        setProfileError('비밀번호는 영문, 숫자, 특수문자를 포함해 8~20자여야 합니다.');
        return;
      }

      if (!currentPassword) {
        setProfileError('현재 비밀번호를 입력해 주세요.');
        return;
      }
    }

    const body: Record<string, string> = {};
    if (nickname && nickname !== getProfileNickname(profileRecord)) body.nickname = nickname;
    if (!isSocialLogin && newPassword) {
      body.currentPassword = currentPassword;
      body.newPassword = newPassword;
    }

    if (Object.keys(body).length === 0) {
      setProfileError('변경할 정보를 입력해 주세요.');
      return;
    }

    setIsProfileSaving(true);

    try {
      const response = await requestMyPageApi<MyPageUpdateResponse>('/api/me', {
        method: 'PATCH',
        form: body,
      });
      onAuthUpdated(response);
      setProfileMessage('프로필을 저장했습니다.');
      setProfileForm((currentForm) => ({
        ...currentForm,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
        nickname: response.nickname ?? currentForm.nickname,
      }));
      setOverviewData((currentData) => {
        if (!currentData) return currentData;
        const nextEmail = getProfileEmail(currentData.profile);
        const nextNickname = response.nickname ?? body.nickname ?? getProfileNickname(currentData.profile);

        return {
          ...currentData,
          profile: {
            ...(currentData.profile ?? {}),
            email: nextEmail,
            ...(response.loginId ? { loginId: response.loginId } : {}),
            ...(nextNickname ? { nickname: nextNickname } : {}),
            ...(response.userId ? { userId: response.userId } : {}),
          },
        };
      });
    } catch (error) {
      if (error instanceof LoginRequiredError) {
        onLoginRequired();
        return;
      }
      setProfileError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsProfileSaving(false);
    }
  }

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeleteMessage(null);

    if (deleteConfirmText !== 'DELETE') {
      setDeleteMessage('삭제하려면 DELETE를 입력해 주세요.');
      return;
    }

    if (!isSocialLogin && !deleteCurrentPassword) {
      setDeleteMessage('현재 비밀번호를 입력해 주세요.');
      return;
    }

    if (!window.confirm('계정을 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    setIsDeletingAccount(true);

    try {
      await requestMyPageApi<string>('/api/me', {
        method: 'DELETE',
        form: isSocialLogin ? {} : { currentPassword: deleteCurrentPassword },
      });
      window.alert('계정이 삭제되었습니다.');
      onAccountDeleted();
    } catch (error) {
      if (error instanceof LoginRequiredError) {
        onLoginRequired();
        return;
      }
      setDeleteMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsDeletingAccount(false);
    }
  }

  const detailTitle: Record<MyPageView, string> = {
    overview: '마이페이지',
    posts: '내가 쓴 글',
    comments: '내가 쓴 댓글',
    bookmarks: '북마크한 글',
    relics: '내 제작 유물',
    presets: '내 프리셋',
  };
  const emptyMessages: Record<Exclude<MyPageView, 'overview'>, string> = {
    posts: '작성한 글이 없습니다.',
    comments: '작성한 댓글이 없습니다.',
    bookmarks: '북마크한 글이 없습니다.',
    relics: '제작한 유물이 없습니다.',
    presets: '저장된 프리셋이 없습니다.',
  };

  const renderDetailItem = (item: Record<string, unknown>, index: number) => {
    const key = getFirstString(item, ['bookmarkId', 'id', 'postId', 'commentId', 'relicId', 'presetId'], String(index));
    if (view === 'posts') return <MyPagePostItem key={key} item={item} onOpenPost={onOpenPost} />;
    if (view === 'comments') return <MyPageCommentItem key={key} item={item} onOpenPost={onOpenPost} />;
    if (view === 'bookmarks') return <MyPageBookmarkItem key={key} item={item} onOpenPost={onOpenPost} />;
    if (view === 'relics') return <MyPageRelicItem key={key} item={item} />;
    return <MyPagePresetItem key={key} item={item} />;
  };

  if (view !== 'overview') {
    return (
      <section className="my-page" aria-labelledby="my-page-detail-title">
        <div className="my-page-heading">
          <div>
            <h2 id="my-page-detail-title">{detailTitle[view]}</h2>
          </div>
          <button type="button" className="my-page-more-button" onClick={() => setView('overview')}>
            돌아가기
          </button>
        </div>

        <section className="my-page-card">
          {detailLoading ? <p className="my-page-muted">불러오는 중...</p> : null}
          {!detailLoading && detailError ? <p className="my-page-message is-error">{detailError}</p> : null}
          {!detailLoading && !detailError ? (
            <MyPageItemList
              items={detailItems}
              emptyMessage={emptyMessages[view]}
              renderItem={renderDetailItem}
            />
          ) : null}
        </section>
      </section>
    );
  }

  return (
    <section className="my-page" aria-labelledby="my-page-title">
      <div className="my-page-heading">
        <div>
          <h2 id="my-page-title">마이페이지</h2>
        </div>
        <button type="button" className="my-page-logout-button" onClick={onLogout}>
          로그아웃
        </button>
      </div>

      <div className="my-page-grid">
        <section className="my-page-card my-page-profile-card" aria-label="내 정보">
          <div className="my-page-card-header">
            <h3>내 정보</h3>
          </div>
          {overviewLoading ? <p className="my-page-muted">불러오는 중...</p> : null}
          {!overviewLoading && overviewError ? <p className="my-page-message is-error">{overviewError}</p> : null}
          {!overviewLoading && !overviewError ? (
            <dl className="my-page-profile-list">
              <div>
                <dt>닉네임</dt>
                <dd>{profile.nickname}</dd>
              </div>
              <div>
                <dt>이메일</dt>
                <dd>{profile.email}</dd>
              </div>
              <div>
                <dt>로그인 방식</dt>
                <dd>{profile.provider}</dd>
              </div>
            </dl>
          ) : null}
        </section>

        <MyPageSection
          title="내가 쓴 글"
          emptyMessage="작성한 글이 없습니다."
          isLoading={overviewLoading}
          error={overviewError}
          onMore={() => setView('posts')}
        >
          <MyPageItemList
            items={overviewData?.posts ?? []}
            emptyMessage="작성한 글이 없습니다."
            renderItem={(item, index) => (
              <MyPagePostItem
                key={getFirstString(item, ['id', 'postId'], String(index))}
                item={item}
                onOpenPost={onOpenPost}
              />
            )}
          />
        </MyPageSection>

        <MyPageSection
          title="내가 쓴 댓글"
          emptyMessage="작성한 댓글이 없습니다."
          isLoading={overviewLoading}
          error={overviewError}
          onMore={() => setView('comments')}
        >
          <MyPageItemList
            items={overviewData?.comments ?? []}
            emptyMessage="작성한 댓글이 없습니다."
            renderItem={(item, index) => (
              <MyPageCommentItem
                key={getFirstString(item, ['id', 'commentId'], String(index))}
                item={item}
                onOpenPost={onOpenPost}
              />
            )}
          />
        </MyPageSection>

        <MyPageSection
          title="북마크한 글"
          emptyMessage="북마크한 글이 없습니다."
          isLoading={overviewLoading}
          error={overviewError}
          onMore={() => setView('bookmarks')}
        >
          <MyPageItemList
            items={overviewData?.bookmarks ?? []}
            emptyMessage="북마크한 글이 없습니다."
            renderItem={(item, index) => (
              <MyPageBookmarkItem
                key={getFirstString(item, ['bookmarkId', 'id'], String(index))}
                item={item}
                onOpenPost={onOpenPost}
              />
            )}
          />
        </MyPageSection>

        <MyPageSection
          title="내 제작 유물"
          emptyMessage="제작한 유물이 없습니다."
          isLoading={overviewLoading}
          error={overviewError}
          onMore={() => setView('relics')}
        >
          <MyPageItemList
            items={overviewData?.relics ?? []}
            emptyMessage="제작한 유물이 없습니다."
            renderItem={(item, index) => (
              <MyPageRelicItem key={getFirstString(item, ['relicId', 'id'], String(index))} item={item} />
            )}
          />
        </MyPageSection>

        <MyPageSection
          title="내 프리셋"
          emptyMessage="저장된 프리셋이 없습니다."
          isLoading={overviewLoading}
          error={overviewError}
          onMore={() => setView('presets')}
        >
          <MyPageItemList
            items={overviewData?.presets ?? []}
            emptyMessage="저장된 프리셋이 없습니다."
            renderItem={(item, index) => (
              <MyPagePresetItem key={getFirstString(item, ['presetId', 'id'], String(index))} item={item} />
            )}
          />
        </MyPageSection>

        <section className="my-page-card my-page-edit-card" aria-labelledby="my-page-edit-title">
          <div className="my-page-card-header">
            <h3 id="my-page-edit-title">프로필 수정</h3>
          </div>
          <form className="my-page-form" onSubmit={handleSaveProfile}>
            <label>
              닉네임
              <input
                type="text"
                value={profileForm.nickname}
                onChange={(event) => updateProfileForm('nickname', event.target.value)}
                maxLength={10}
                autoComplete="nickname"
              />
            </label>

            {isSocialLogin ? (
              <p className="my-page-muted">소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.</p>
            ) : (
              <div className="my-page-password-fields">
                <label>
                  현재 비밀번호
                  <input
                    type="password"
                    value={profileForm.currentPassword}
                    onChange={(event) => updateProfileForm('currentPassword', event.target.value)}
                    autoComplete="current-password"
                  />
                </label>
                <label>
                  새 비밀번호
                  <input
                    type="password"
                    value={profileForm.newPassword}
                    onChange={(event) => updateProfileForm('newPassword', event.target.value)}
                    autoComplete="new-password"
                  />
                </label>
                <label>
                  새 비밀번호 확인
                  <input
                    type="password"
                    value={profileForm.confirmNewPassword}
                    onChange={(event) => updateProfileForm('confirmNewPassword', event.target.value)}
                    autoComplete="new-password"
                  />
                </label>
              </div>
            )}

            {profileError ? <p className="my-page-message is-error">{profileError}</p> : null}
            {profileMessage ? <p className="my-page-message is-success">{profileMessage}</p> : null}
            <button type="submit" className="my-page-submit-button" disabled={isProfileSaving}>
              {isProfileSaving ? '저장 중...' : '변경 저장'}
            </button>
          </form>
        </section>

        <section className="my-page-card my-page-danger-card" aria-labelledby="my-page-danger-title">
          <div className="my-page-card-header">
            <h3 id="my-page-danger-title">계정 삭제</h3>
          </div>
          <form className="my-page-form" onSubmit={handleDeleteAccount}>
            <p className="my-page-muted">
              계정을 삭제하면 프로필, 게시글, 댓글, 저장 유물, 프리셋 등 소유 데이터가 영구 삭제됩니다.
            </p>
            {!isSocialLogin ? (
              <label>
                현재 비밀번호
                <input
                  type="password"
                  value={deleteCurrentPassword}
                  onChange={(event) => setDeleteCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </label>
            ) : null}
            <label>
              확인 문구
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                placeholder="DELETE"
              />
            </label>
            {deleteMessage ? <p className="my-page-message is-error">{deleteMessage}</p> : null}
            <button
              type="submit"
              className="my-page-delete-button"
              disabled={isDeletingAccount || deleteConfirmText !== 'DELETE' || (!isSocialLogin && !deleteCurrentPassword)}
            >
              {isDeletingAccount ? '삭제 중...' : '계정 영구 삭제'}
            </button>
          </form>
        </section>
      </div>
    </section>
  );
}
function ListTop() {
  const [selectedId, setSelectedId] = useState(getStoredPageId);
  const [authView, setAuthView] = useState<AuthView>(getStoredAuthView);
  const [authUserId, setAuthUserId] = useState<string | null>(getStoredAuthUserId);
  const [authRole, setAuthRole] = useState<AuthRole>('USER');
  const [authInitialError, setAuthInitialError] = useState<string | null>(null);
  const [isMyPageOpen, setIsMyPageOpen] = useState(false);
  const [buildFocusPostId, setBuildFocusPostId] = useState<string | null>(null);
  const [isNicknameRoute, setIsNicknameRoute] = useState(
    () =>
      window.location.pathname === nicknameRoutePath ||
      Boolean(getAccessTokenFromLocationSearch() && getNeedsNicknameFromLocationSearch()),
  );
  const [isVerifyEmailRoute, setIsVerifyEmailRoute] = useState(
    () => window.location.pathname === verifyEmailRoutePath,
  );
  const [nicknameAccessToken, setNicknameAccessToken] = useState(() => getAccessTokenFromLocationSearch());
  const [relicStorageRefreshKey, setRelicStorageRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [weaponFilters, setWeaponFilters] = useState<WeaponFilters>(() => createEmptyWeaponFilters());
  const [optionFilters, setOptionFilters] = useState<OptionFilters>(() => createEmptyOptionFilters());
  const [bossFilters, setBossFilters] = useState<BossFilters>(() => createEmptyBossFilters());
  const [spellFilters, setSpellFilters] = useState<SpellFilters>(() => createEmptySpellFilters());
  const [buildSortKey, setBuildSortKey] = useState<BuildSortKey>('latest');
  const [selectedWeaponGroupId, setSelectedWeaponGroupId] = useState<number | null>(null);
  const [focusedWeaponGroupId, setFocusedWeaponGroupId] = useState<number | null>(null);
  const [ashProperty, setAshProperty] = useState<string | null>(null);
  const categoryTabsRef = useRef<HTMLElement | null>(null);
  const nativeBackButtonHandlerRef = useRef<(canGoBack: boolean) => void>(() => {});
  const buildInternalBackHandlerRef = useRef<(() => boolean) | null>(null);
  const pageSwipeStartRef = useRef<{
    x: number;
    y: number;
    index: number;
    width: number;
    time: number;
    axis: 'horizontal' | 'vertical' | null;
  } | null>(null);
  const suppressNextPageClickRef = useRef(false);
  const [visitedCategoryIds, setVisitedCategoryIds] = useState<Set<string>>(() => new Set([getStoredPageId()]));
  const [pageDrag, setPageDrag] = useState<{
    offset: number;
    isDragging: boolean;
    targetIndex: number | null;
  }>({
    offset: 0,
    isDragging: false,
    targetIndex: null,
  });

  // SaveParserPage state
  const [characterSlot, setCharacterSlot] = useState<CharacterSlot>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saveParserResult, setSaveParserResult] = useState<RelicScanResult | null>(null);
  const [saveParserLogs, setSaveParserLogs] = useState<string[]>([]);
  const [saveParserError, setSaveParserError] = useState<string | null>(null);
  const [isSaveParserParsing, setIsSaveParserParsing] = useState(false);

  const CACHE_KEY = 'nightreign_save_parser_result';

  useEffect(() => {
    setStoredValue(lastPageStorageKey, selectedId);
    resetPageScroll();
  }, [selectedId]);

  useEffect(() => {
    if (authView) {
      setStoredValue(authViewStorageKey, authView);
      return;
    }
    removeStoredValue(authViewStorageKey);
  }, [authView]);

  useEffect(() => {
    const tokenUserId = getUserIdFromAccessToken(getStoredAccessToken());
    if (tokenUserId && tokenUserId !== authUserId) {
      setAuthUserId(tokenUserId);
      return;
    }
    if (!tokenUserId && authUserId && !getStoredAccessToken()) {
      setAuthUserId(null);
    }
  }, [authUserId]);

  useEffect(() => {
    if (authUserId) {
      setStoredValue(authUserIdStorageKey, authUserId);
      return;
    }
    removeStoredValue(authUserIdStorageKey);
  }, [authUserId]);

  useEffect(() => {
    if (!getStoredAccessToken()) {
      setAuthRole('USER');
      return;
    }

    let isMounted = true;

    requestMyPageApi<MyPageMeResponse>('/api/me')
      .then((me) => {
        if (!isMounted) return;

        setAuthRole(normalizeAuthRole(me.role));
        if (me.userId) {
          setAuthUserId(me.userId);
          setStoredValue(authUserIdStorageKey, me.userId);
        }
        if (me.nickname) {
          setStoredValue(authNicknameStorageKey, me.nickname);
          if (me.userId) setStoredValue(authNicknameUserIdStorageKey, me.userId);
        }
      })
      .catch((error) => {
        if (!isMounted) return;
        setAuthRole('USER');
        if (error instanceof LoginRequiredError) {
          clearAuthStorage();
          setAuthUserId(null);
          return;
        }
        console.warn('[auth] Failed to load current user role', error);
      });

    return () => {
      isMounted = false;
    };
  }, [authUserId]);

  useEffect(() => {
    const handlePopState = () => {
      setIsNicknameRoute(window.location.pathname === nicknameRoutePath);
      setIsVerifyEmailRoute(window.location.pathname === verifyEmailRoutePath);
      setNicknameAccessToken(getAccessTokenFromLocationSearch());
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleOAuthRedirectParams = useCallback(
    (params: URLSearchParams, currentPath = mainRoutePath) => {
      if (!hasOAuthRedirectParamsInSearch(params)) {
        return { handled: false, success: false, route: currentPath || mainRoutePath };
      }

      const routeAfterError =
        currentPath === nicknameRoutePath ? mainRoutePath : currentPath || mainRoutePath;
      const oauthError = params.get('oauthError');
      const accessToken = getAccessTokenFromParams(params);
      const needsNickname = getNeedsNicknameFromParams(params);

      if (oauthError) {
        setAuthInitialError(getOAuthErrorMessage(oauthError));
        setAuthView('login');
        setIsMyPageOpen(false);
        return { handled: true, success: false, route: routeAfterError };
      }

      if (accessToken) {
        setStoredValue(accessTokenStorageKey, accessToken);
        setNicknameAccessToken(accessToken);

        const userId = getUserIdFromAccessToken(accessToken);
        if (userId) {
          setAuthUserId(userId);
          setStoredValue(authUserIdStorageKey, userId);
        }
      }

      if (needsNickname || currentPath === nicknameRoutePath) {
        setAuthView(null);
        setIsMyPageOpen(false);
        setSearchQuery('');
        setIsFilterPanelOpen(false);
        setIsVerifyEmailRoute(false);
        setIsNicknameRoute(true);
        return { handled: true, success: true, route: nicknameRoutePath };
      }

      setSelectedId('characters');
      setAuthView(null);
      setIsMyPageOpen(false);
      setSearchQuery('');
      setIsFilterPanelOpen(false);
      setIsVerifyEmailRoute(false);
      setIsNicknameRoute(false);
      setStoredValue(lastPageStorageKey, 'characters');
      return { handled: true, success: true, route: mainRoutePath };
    },
    [],
  );

  useEffect(() => {
    if (!hasOAuthRedirectParams()) return;

    const result = handleOAuthRedirectParams(
      new URLSearchParams(window.location.search),
      window.location.pathname,
    );
    if (result.handled) {
      window.history.replaceState(null, '', result.route);
    }
  }, [handleOAuthRedirectParams]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let removeListener: (() => Promise<void>) | null = null;
    let isMounted = true;

    const handleAppUrlOpen = (url: string) => {
      let params: URLSearchParams;
      try {
        params = new URL(url).searchParams;
      } catch {
        return;
      }

      const result = handleOAuthRedirectParams(params, window.location.pathname || mainRoutePath);
      if (result.success) {
        void Browser.close();
      }
      if (result.handled) {
        window.history.replaceState(null, '', result.route);
      }
    };

    void App.addListener('appUrlOpen', ({ url }) => {
      handleAppUrlOpen(url);
    }).then((listener) => {
      if (!isMounted) {
        void listener.remove();
        return;
      }
      removeListener = () => listener.remove();
    });

    void App.getLaunchUrl().then((launchUrl) => {
      if (isMounted && launchUrl?.url) {
        handleAppUrlOpen(launchUrl.url);
      }
    });

    return () => {
      isMounted = false;
      if (removeListener) void removeListener();
    };
  }, [handleOAuthRedirectParams]);

  const handleGoogleLoginClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

    event.preventDefault();
    void Browser.open({ url: getAndroidGoogleLoginUrl() });
  }, []);

  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints <= 0) {
      return undefined;
    }

    let startY: number | null = null;
    let shouldRefresh = false;

    const isFormTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (window.scrollY > 0 || isFormTarget(event.target)) {
        startY = null;
        shouldRefresh = false;
        return;
      }
      startY = event.touches[0]?.clientY ?? null;
      shouldRefresh = false;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (startY === null || window.scrollY > 0) {
        return;
      }
      const currentY = event.touches[0]?.clientY;
      if (currentY === undefined) {
        return;
      }
      shouldRefresh = currentY - startY >= pullToRefreshThreshold;
    };

    const handleTouchEnd = () => {
      if (shouldRefresh) {
        window.location.reload();
      }
      startY = null;
      shouldRefresh = false;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, []);

  // localStorage에 결과 저장
  const setSaveParserResultWithCache = (newResult: RelicScanResult | null) => {
    setSaveParserResult(newResult);
    if (newResult) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(newResult));
      } catch (e) {
        console.warn('Failed to save to localStorage:', e);
      }
    }
  };

  // 마운트 시 localStorage에서 이전 결과 로드
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as RelicScanResult;
        setSaveParserResult(parsed);
      }
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
    }
  }, []);

  const clearSaveParserCache = () => {
    setSaveParserResult(null);
    setSelectedFile(null);
    setSaveParserLogs([]);
    setSaveParserError(null);
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (e) {
      console.warn('Failed to clear localStorage:', e);
    }
  };

  const selectedIndex = useMemo(() => {
    const index = categories.findIndex((category) => category.id === selectedId);
    return index >= 0 ? index : 0;
  }, [selectedId]);

  const selectedCategory = categories[selectedIndex] ?? categories[0];

  useEffect(() => {
    const selectedCategoryId = selectedCategory.id;
    setVisitedCategoryIds((currentIds) => {
      if (currentIds.has(selectedCategoryId)) return currentIds;
      const nextIds = new Set(currentIds);
      nextIds.add(selectedCategoryId);
      return nextIds;
    });
  }, [selectedCategory.id]);

  useEffect(() => {
    const currentTab = categoryTabsRef.current?.querySelector<HTMLElement>(
      `[data-category-id="${selectedId}"]`,
    );
    currentTab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedId]);
  const hasActiveWeaponFilters =
    weaponFilters.levels.length > 0 ||
    weaponFilters.types.length > 0 ||
    weaponFilters.genres.length > 0;
  const hasActiveOptionFilters =
    optionFilters.categories.length > 0 ||
    optionFilters.types.length > 0 ||
    optionFilters.stackable.length > 0;
  const hasActiveBossFilters = bossFilters.types.length > 0;
  const hasActiveAshFilters = ashProperty !== null;
  const hasActiveSpellFilters = spellFilters.spell !== null || spellFilters.type !== null;
  const hasActiveBuildSort = buildSortKey !== 'latest';
  const canUseFilters =
    selectedId === 'weapons' ||
    selectedId === 'options' ||
    selectedId === 'ashes' ||
    selectedId === 'bosses' ||
    selectedId === 'spells' ||
    selectedId === 'builds';

  const updateWeaponLevelFilter = (level: number) => {
    setWeaponFilters((currentFilters) => ({
      ...currentFilters,
      levels: toggleFilterValue(currentFilters.levels, level),
    }));
  };

  const updateWeaponTextFilter = (key: 'types' | 'genres', value: string) => {
    setWeaponFilters((currentFilters) => ({
      ...currentFilters,
      [key]: toggleFilterValue(currentFilters[key], value),
    }));
  };

  const updateOptionTextFilter = (key: 'categories' | 'types', value: string) => {
    setOptionFilters((currentFilters) => ({
      ...currentFilters,
      [key]: toggleFilterValue(currentFilters[key], value),
    }));
  };

  const updateOptionStackableFilter = (value: boolean) => {
    setOptionFilters((currentFilters) => ({
      ...currentFilters,
      stackable: toggleFilterValue(currentFilters.stackable, value),
    }));
  };

  const updateBossTypeFilter = (value: string) => {
    setBossFilters((currentFilters) => ({
      ...currentFilters,
      types: toggleFilterValue(currentFilters.types, value),
    }));
  };

  const updateSpellFilter = (value: string) => {
    setSpellFilters((currentFilters) => ({
      spell: currentFilters.spell === value ? null : value,
      type: null,
    }));
  };

  const updateSpellTypeFilter = (value: string) => {
    setSpellFilters((currentFilters) => ({
      ...currentFilters,
      type: currentFilters.type === value ? null : value,
    }));
  };

  const closeOverlayPages = () => {
    setAuthView(null);
    setIsMyPageOpen(false);
  };

  const selectCategory = (categoryId: string) => {
    if (categoryId !== selectedId) {
      resetPageScroll();
    }
    closeOverlayPages();
    setVisitedCategoryIds((currentIds) => {
      if (currentIds.has(categoryId)) return currentIds;
      const nextIds = new Set(currentIds);
      nextIds.add(categoryId);
      return nextIds;
    });
    setSelectedId(categoryId);
    setSearchQuery('');
    setIsFilterPanelOpen(false);
    setBuildFocusPostId(null);
    setSelectedWeaponGroupId(null);
    setFocusedWeaponGroupId(null);
  };

  const selectCategoryByIndex = (index: number) => {
    const category = categories[Math.max(0, Math.min(categories.length - 1, index))];
    if (!category || category.id === selectedCategory.id) return;
    selectCategory(category.id);
  };

  const isPageSwipeTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const allowedInteractiveSwipeTarget = target.closest('[data-page-swipe-allowed]');
    const blockedSelectors = [
      'input',
      'textarea',
      'select',
      allowedInteractiveSwipeTarget ? null : 'button',
      allowedInteractiveSwipeTarget ? null : 'a',
      '[contenteditable="true"]',
      '[role="dialog"]',
      '[aria-modal="true"]',
      '[data-no-page-swipe]',
      '[data-interactive]',
      '.responsive-select-overlay',
    ].filter((selector): selector is string => Boolean(selector));

    if (
      target.closest(blockedSelectors.join(', '))
    ) {
      return false;
    }

    let element: HTMLElement | null = target;
    while (element) {
      const style = window.getComputedStyle(element);
      const canScrollHorizontally =
        (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
        element.scrollWidth > element.clientWidth;
      if (canScrollHorizontally) return false;
      element = element.parentElement;
    }

    return true;
  };

  const handlePageSwipeStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (
      event.touches.length !== 1 ||
      authView ||
      isMyPageOpen ||
      !isPageSwipeTarget(event.target)
    ) {
      pageSwipeStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    pageSwipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      index: selectedIndex,
      width: event.currentTarget.clientWidth,
      time: performance.now(),
      axis: null,
    };
    setPageDrag({ offset: 0, isDragging: true, targetIndex: null });
  };

  const handlePageSwipeMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = pageSwipeStartRef.current;
    if (!start || start.index !== selectedIndex || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!start.axis) {
      if (absX < 10 && absY < 10) return;
      start.axis = absX > absY * 1.18 ? 'horizontal' : 'vertical';
    }

    if (start.axis === 'vertical') return;

    if (absX > 12) {
      suppressNextPageClickRef.current = true;
    }

    const targetIndex = deltaX < 0 ? Math.min(categories.length - 1, start.index + 1) : Math.max(0, start.index - 1);
    const targetCategory = categories[targetIndex];
    if (!targetCategory || targetIndex === start.index) {
      setPageDrag({ offset: deltaX * 0.18, isDragging: true, targetIndex: null });
      return;
    }

    event.preventDefault();
    const limit = Math.max(1, start.width);
    const offset = Math.max(-limit, Math.min(limit, deltaX));
    setPageDrag({ offset, isDragging: true, targetIndex });
  };

  const handlePageSwipeEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = pageSwipeStartRef.current;
    pageSwipeStartRef.current = null;
    if (!start || start.index !== selectedIndex) {
      setPageDrag({ offset: 0, isDragging: false, targetIndex: null });
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) {
      setPageDrag({ offset: 0, isDragging: false, targetIndex: null });
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const elapsed = Math.max(1, performance.now() - start.time);
    const velocity = Math.abs(deltaX) / elapsed;
    const fallbackTargetIndex =
      deltaX < 0 ? Math.min(categories.length - 1, start.index + 1) : Math.max(0, start.index - 1);
    const targetIndex = pageDrag.targetIndex ?? (fallbackTargetIndex !== start.index ? fallbackTargetIndex : null);
    const shouldCommitSwipe =
      targetIndex !== null &&
      start.axis === 'horizontal' &&
      Math.abs(deltaY) <= Math.max(80, start.width * 0.35) &&
      (Math.abs(deltaX) >= Math.min(110, start.width * 0.24) || velocity >= 0.45);

    if (start.axis === 'horizontal' && Math.abs(deltaX) > 12) {
      suppressNextPageClickRef.current = true;
      window.setTimeout(() => {
        suppressNextPageClickRef.current = false;
      }, 350);
    }

    setPageDrag({ offset: 0, isDragging: false, targetIndex: null });
    if (shouldCommitSwipe && targetIndex !== null) {
      selectCategoryByIndex(targetIndex);
    }
  };

  const handlePageClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!suppressNextPageClickRef.current) return;

    suppressNextPageClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const clearAuthState = () => {
    clearAuthStorage();
    setAuthUserId(null);
    setAuthRole('USER');
  };

  const handleLogout = () => {
    clearAuthState();
    setIsMyPageOpen(false);
    setAuthView('login');
  };

  const handleAuthUpdated = (response: MyPageUpdateResponse) => {
    if (response.accessToken) {
      setStoredValue(accessTokenStorageKey, response.accessToken);
    }

    const nextUserId =
      response.userId ??
      getUserIdFromAccessToken(response.accessToken ?? getStoredAccessToken());

    if (nextUserId) {
      setAuthUserId(nextUserId);
      setStoredValue(authUserIdStorageKey, nextUserId);
    }

    if (response.nickname) {
      setStoredValue(authNicknameStorageKey, response.nickname);
      if (nextUserId) setStoredValue(authNicknameUserIdStorageKey, nextUserId);
    }

    if (response.role) {
      setAuthRole(normalizeAuthRole(response.role));
    }
  };

  const handleAccountDeleted = () => {
    clearAuthState();
    setIsMyPageOpen(false);
    setAuthView('login');
    setSelectedId('characters');
    setSearchQuery('');
    setIsFilterPanelOpen(false);
    setStoredValue(lastPageStorageKey, 'characters');
  };

  const handleLoginRequired = () => {
    clearAuthState();
    setIsMyPageOpen(false);
    setAuthView('login');
  };

  const openLoginPage = () => {
    setIsVerifyEmailRoute(false);
    setIsNicknameRoute(false);
    setIsMyPageOpen(false);
    setAuthView('login');
    setSearchQuery('');
    setIsFilterPanelOpen(false);
    window.history.replaceState(null, '', mainRoutePath);
  };

  const handleOpenMyPagePost = (postId: string) => {
    setBuildFocusPostId(postId);
    setSelectedId('builds');
    closeOverlayPages();
    setSearchQuery('');
    setIsFilterPanelOpen(false);
  };

  const handleBuildInternalBackChange = useCallback((handler: (() => boolean) | null) => {
    buildInternalBackHandlerRef.current = handler;
  }, []);

  nativeBackButtonHandlerRef.current = (canGoBack) => {
    if (isNicknameRoute || isVerifyEmailRoute) {
      setIsNicknameRoute(false);
      setIsVerifyEmailRoute(false);
      setNicknameAccessToken(null);
      setAuthView(null);
      setIsMyPageOpen(false);
      setSearchQuery('');
      setIsFilterPanelOpen(false);
      window.history.replaceState(null, '', mainRoutePath);
      return;
    }

    if (authView) {
      setAuthInitialError(null);
      setAuthView(null);
      return;
    }

    if (isMyPageOpen) {
      setIsMyPageOpen(false);
      return;
    }

    if (isFilterPanelOpen) {
      setIsFilterPanelOpen(false);
      return;
    }

    if (selectedWeaponGroupId !== null || focusedWeaponGroupId !== null) {
      setSelectedWeaponGroupId(null);
      setFocusedWeaponGroupId(null);
      return;
    }

    if (buildFocusPostId) {
      setBuildFocusPostId(null);
      return;
    }

    if (selectedId === 'builds' && buildInternalBackHandlerRef.current?.()) {
      return;
    }

    if (searchQuery) {
      setSearchQuery('');
      return;
    }

    if (selectedId !== categories[0].id) {
      selectCategory(categories[0].id);
      return;
    }

    if (canGoBack) {
      window.history.back();
      return;
    }

    void App.minimizeApp();
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return undefined;

    let removeListener: (() => Promise<void>) | null = null;
    let isMounted = true;

    void App.addListener('backButton', ({ canGoBack }) => {
      nativeBackButtonHandlerRef.current(canGoBack);
    }).then((listener) => {
      if (!isMounted) {
        void listener.remove();
        return;
      }
      removeListener = () => listener.remove();
    });

    return () => {
      isMounted = false;
      if (removeListener) void removeListener();
    };
  }, []);

  if (isVerifyEmailRoute) {
    return <VerifyEmailPage onGoToLogin={openLoginPage} />;
  }

  if (isNicknameRoute) {
    return (
      <NicknamePage
        accessToken={nicknameAccessToken}
        onComplete={() => {
          setSelectedId('characters');
          setAuthView(null);
          setSearchQuery('');
          setIsFilterPanelOpen(false);
          setIsNicknameRoute(false);
          window.history.replaceState(null, '', mainRoutePath);
          setStoredValue(lastPageStorageKey, 'characters');
        }}
      />
    );
  }

  const renderOverlayContent = (): ReactNode => {
    if (authView) {
      return (
        <AuthPage
          initialError={authInitialError}
          view={authView}
          onChangeView={(nextView) => {
            setAuthInitialError(null);
            setAuthView(nextView);
          }}
          onGoogleLoginClick={handleGoogleLoginClick}
          onLoginSuccess={(loginId) => {
            setAuthInitialError(null);
            setAuthUserId(loginId);
            setAuthView(null);
            setIsMyPageOpen(false);
          }}
        />
      );
    }

    if (isMyPageOpen) {
      return (
        <MyPage
          authUserId={authUserId}
          onAuthUpdated={handleAuthUpdated}
          onAccountDeleted={handleAccountDeleted}
          onLoginRequired={handleLoginRequired}
          onLogout={handleLogout}
          onOpenPost={handleOpenMyPagePost}
        />
      );
    }

    return null;
  };

  const renderPageContent = (categoryId: string): ReactNode => {
    if (categoryId === 'characters') {
      return (
        <CharactersPage
          searchQuery={searchQuery}
          onSelectWeapon={(weaponGroupId) => {
            setSelectedId('weapons');
            setSelectedWeaponGroupId(null);
            setFocusedWeaponGroupId(weaponGroupId);
            setSearchQuery('');
          }}
        />
      );
    }
    if (categoryId === 'weapons') {
      return (
        <WeaponsPage
          searchQuery={searchQuery}
          filters={weaponFilters}
          selectedGroupId={selectedWeaponGroupId}
          focusedGroupId={focusedWeaponGroupId}
          onSelectGroup={(groupId) => {
            setSelectedWeaponGroupId(groupId);
            setFocusedWeaponGroupId(null);
            setSearchQuery('');
          }}
          onBack={() => {
            setSelectedWeaponGroupId(null);
            setFocusedWeaponGroupId(null);
          }}
        />
      );
    }
    if (categoryId === 'options') return <OptionsPage searchQuery={searchQuery} filters={optionFilters} />;
    if (categoryId === 'stats-calculator') return <StatsCalculatorPage searchQuery={searchQuery} />;
    if (categoryId === 'ashes') return <AshesPage searchQuery={searchQuery} ashProperty={ashProperty} />;
    if (categoryId === 'bosses') return <BossesPage searchQuery={searchQuery} filters={bossFilters} />;
    if (categoryId === 'spells') return <SpellsPage searchQuery={searchQuery} filters={spellFilters} />;
    if (categoryId === 'talismans') return <TalismansPage searchQuery={searchQuery} />;
    if (categoryId === 'relics') {
      return (
        <RelicsPage
          searchQuery={searchQuery}
          authUserId={authUserId}
          storageRefreshKey={relicStorageRefreshKey}
          onRelicsChanged={() => setRelicStorageRefreshKey((currentKey) => currentKey + 1)}
        />
      );
    }
    if (categoryId === 'map') return <MapPage />;
    if (categoryId === 'builds') {
      return (
        <BuildPage
          searchQuery={searchQuery}
          authUserId={authUserId}
          authRole={authRole}
          focusPostId={buildFocusPostId}
          onInternalBackChange={handleBuildInternalBackChange}
          onLoginRequired={handleLoginRequired}
          sortKey={buildSortKey}
        />
      );
    }
    if (categoryId === 'relic-builder') {
      return (
        <RelicBuilderPage
          searchQuery={searchQuery}
          authUserId={authUserId}
          onRelicsChanged={() => setRelicStorageRefreshKey((currentKey) => currentKey + 1)}
        />
      );
    }
    if (categoryId === 'save-parser') {
      return (
        <SaveParserPage
          characterSlot={characterSlot}
          setCharacterSlot={setCharacterSlot}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          result={saveParserResult}
          setResult={setSaveParserResultWithCache}
          logs={saveParserLogs}
          setLogs={setSaveParserLogs}
          error={saveParserError}
          setError={setSaveParserError}
          isParsing={isSaveParserParsing}
          setIsParsing={setIsSaveParserParsing}
          clearCache={clearSaveParserCache}
        />
      );
    }
    if (categoryId === 'vessels') return <VesselsPage searchQuery={searchQuery} />;
    if (categoryId === 'items') return <ItemsPage searchQuery={searchQuery} />;
    if (categoryId === 'gestures') return <GesturesPage searchQuery={searchQuery} />;

    return (
      <PlaceholderPage
        category={categories.find((category) => category.id === categoryId) ?? selectedCategory}
        searchQuery={searchQuery}
      />
    );
  };

  const overlayContent = renderOverlayContent();
  const isOverlayOpen = Boolean(overlayContent);
  const pageTrackTransform = `calc(${-selectedIndex * 100}% + ${pageDrag.offset}px)`;
  const isNativeApp = Capacitor.isNativePlatform();
  const externalProductUrl = isNativeApp ? officialWebsiteUrl : playStoreUrl;
  const externalProductLabel = isNativeApp ? '엘밤 비 웹사이트 열기' : 'Google Play에서 엘밤 비 앱 보기';

  const handleExternalProductClick = () => {
    if (isNativeApp) {
      void Browser.open({ url: externalProductUrl });
      return;
    }

    window.open(externalProductUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="list-top-shell">
      <header className="list-top-header">
        <div className="game-title-row">
          <div className="game-title-icon" aria-hidden="true">
            <img className="game-title-logo-image" src={logoImage} alt="" />
          </div>
          <h1>엘밤 비</h1>
          <button
            type="button"
            className="external-product-button"
            aria-label={externalProductLabel}
            title={externalProductLabel}
            onClick={handleExternalProductClick}
          >
            {isNativeApp ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.4 2.5 3.7 5.6 3.7 9s-1.3 6.5-3.7 9M12 3c-2.4 2.5-3.7 5.6-3.7 9s1.3 6.5 3.7 9" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
                <path className="external-product-play-mark" d="m10 8 5.5 4-5.5 4Z" />
                <path d="M10 18.5h4" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className={`account-icon-button${authView || isMyPageOpen ? ' is-active' : ''}`}
            aria-label={authUserId ? `${authUserId} 계정` : '로그인 페이지로 이동'}
            title={authUserId ? `${authUserId} 로그인됨` : '로그인'}
            onClick={() => {
              if (getStoredAccessToken()) {
                setAuthView(null);
                setIsMyPageOpen(true);
              } else {
                setIsMyPageOpen(false);
                setAuthView('login');
              }
              setSearchQuery('');
              setIsFilterPanelOpen(false);
            }}
          >
           <img className="account-icon-image" src={loginImage} alt="" aria-hidden="true" />
          </button>
        </div>

        <div className="search-row">
          <span className="search-icon" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="통합 검색 (아이템, 옵션, 무기 등)"
            aria-label="통합 검색"
          />
          <button
            type="button"
            className={`icon-button${canUseFilters && isFilterPanelOpen ? ' is-active' : ''}`}
            aria-label={selectedId === 'builds' ? '빌드 정렬' : `${selectedCategory.label} 필터`}
            aria-pressed={canUseFilters && isFilterPanelOpen}
            onClick={() => {
              if (!canUseFilters) return;
              setIsFilterPanelOpen((isOpen) => !isOpen);
            }}
          >
            &#9776;
          </button>
        </div>

        {selectedId === 'weapons' && isFilterPanelOpen ? (
          <section className="filter-panel" aria-label="무기 필터">
            <div className="filter-panel-heading">
              <strong>무기 필터</strong>
              <button
                type="button"
                className="filter-reset-button"
                disabled={!hasActiveWeaponFilters}
                onClick={() => setWeaponFilters(createEmptyWeaponFilters())}
              >
                초기화
              </button>
            </div>

            <div className="filter-group">
              <span>레벨</span>
              <div className="filter-chip-row">
                {weaponFilterOptions.levels.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`filter-chip${weaponFilters.levels.includes(level) ? ' is-selected' : ''}`}
                    onClick={() => updateWeaponLevelFilter(level)}
                  >
                    Lv. {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span>종류</span>
              <div className="filter-chip-row">
                {weaponFilterOptions.genres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    className={`filter-chip${weaponFilters.genres.includes(genre) ? ' is-selected' : ''}`}
                    onClick={() => updateWeaponTextFilter('genres', genre)}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span>무기군</span>
              <div className="filter-chip-row">
                {weaponFilterOptions.types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`filter-chip${weaponFilters.types.includes(type) ? ' is-selected' : ''}`}
                    onClick={() => updateWeaponTextFilter('types', type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {selectedId === 'ashes' && isFilterPanelOpen ? (
          <section className="filter-panel" aria-label="Ash filters">
            <div className="filter-panel-heading">
              <strong>전회 필터</strong>
              <button
                type="button"
                className="filter-reset-button"
                disabled={!hasActiveAshFilters}
                onClick={() => setAshProperty(null)}
              >
                초기화
              </button>
            </div>

            <div className="filter-group">
              <span>속성</span>
              <div className="filter-chip-row">
                {Array.from(new Set(ashes.map((ash) => ash.property)))
                  .sort()
                  .map((prop) => (
                    <button
                      key={prop}
                      type="button"
                      className={`filter-chip${ashProperty === prop ? ' is-selected' : ''}`}
                      onClick={() => setAshProperty(ashProperty === prop ? null : prop)}
                    >
                      {prop}
                    </button>
                  ))}
              </div>
            </div>
          </section>
        ) : null}

        {selectedId === 'spells' && isFilterPanelOpen ? (
          <section className="filter-panel" aria-label="Spell filters">
            <div className="filter-panel-heading">
              <strong>마술/기도 필터</strong>
              <button
                type="button"
                className="filter-reset-button"
                disabled={!hasActiveSpellFilters}
                onClick={() => setSpellFilters(createEmptySpellFilters())}
              >
                초기화
              </button>
            </div>

            <div className="filter-group">
              <span>분류</span>
              <div className="filter-chip-row">
                {spellFilterOptions.spells.map((spell) => (
                  <button
                    key={spell}
                    type="button"
                    className={`filter-chip${spellFilters.spell === spell ? ' is-selected' : ''}`}
                    onClick={() => updateSpellFilter(spell)}
                  >
                    {spell}
                  </button>
                ))}
              </div>
            </div>

            {spellFilters.spell ? (
              <div className="filter-group">
                <span>세부 분류</span>
                <div className="filter-chip-row">
                  {(spellFilterOptions.typesBySpell[spellFilters.spell] ?? []).map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`filter-chip${spellFilters.type === type ? ' is-selected' : ''}`}
                      onClick={() => updateSpellTypeFilter(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {selectedId === 'options' && isFilterPanelOpen ? (
          <section className="filter-panel" aria-label="Option filters">
            <div className="filter-panel-heading">
              <strong>옵션 필터</strong>
              <button
                type="button"
                className="filter-reset-button"
                disabled={!hasActiveOptionFilters}
                onClick={() => setOptionFilters(createEmptyOptionFilters())}
              >
                초기화
              </button>
            </div>

            <div className="filter-group">
              <span>분류</span>
              <div className="filter-chip-row">
                {optionFilterOptions.categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`filter-chip${optionFilters.categories.includes(category) ? ' is-selected' : ''}`}
                    onClick={() => updateOptionTextFilter('categories', category)}
                  >
                    {optionCategoryLabels[category] ?? category}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span>옵션 종류</span>
              <div className="filter-chip-row">
                {optionFilterOptions.types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`filter-chip${optionFilters.types.includes(type) ? ' is-selected' : ''}`}
                    onClick={() => updateOptionTextFilter('types', type)}
                  >
                    {optionTypeLabels[type] ?? type}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span>중첩 여부</span>
              <div className="filter-chip-row">
                {optionFilterOptions.stackable.map((stackable) => (
                  <button
                    key={String(stackable)}
                    type="button"
                    className={`filter-chip${optionFilters.stackable.includes(stackable) ? ' is-selected' : ''}`}
                    onClick={() => updateOptionStackableFilter(stackable)}
                  >
                    {optionStackableLabels[String(stackable)]}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {selectedId === 'bosses' && isFilterPanelOpen ? (
          <section className="filter-panel" aria-label="Boss filters">
            <div className="filter-panel-heading">
              <strong>보스 필터</strong>
              <button
                type="button"
                className="filter-reset-button"
                disabled={!hasActiveBossFilters}
                onClick={() => setBossFilters(createEmptyBossFilters())}
              >
                초기화
              </button>
            </div>

            <div className="filter-group">
              <span>보스 종류</span>
              <div className="filter-chip-row">
                {bossFilterOptions.types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`filter-chip${bossFilters.types.includes(type) ? ' is-selected' : ''}`}
                    onClick={() => updateBossTypeFilter(type)}
                  >
                    {bossTypeLabels[type] ?? type}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {selectedId === 'builds' && isFilterPanelOpen ? (
          <section className="filter-panel" aria-label="빌드 정렬">
            <div className="filter-panel-heading">
              <strong>빌드 정렬</strong>
              <button
                type="button"
                className="filter-reset-button"
                disabled={!hasActiveBuildSort}
                onClick={() => setBuildSortKey('latest')}
              >
                초기화
              </button>
            </div>

            <div className="filter-group">
              <span>정렬</span>
              <div className="filter-chip-row">
                {[
                  { value: 'latest', label: '최신순' },
                  { value: 'popular', label: '인기순' },
                  { value: 'views', label: '조회순' },
                ].map((sortOption) => (
                  <button
                    key={sortOption.value}
                    type="button"
                    className={`filter-chip${buildSortKey === sortOption.value ? ' is-selected' : ''}`}
                    onClick={() => setBuildSortKey(sortOption.value as BuildSortKey)}
                  >
                    {sortOption.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <nav ref={categoryTabsRef} className="category-tabs" aria-label="아이템 카테고리">
          {categories.map((category) => {
            const isSelected = category.id === selectedId;
            const iconAsset = categoryIconAssets[category.id];

            return (
              <button
                key={category.id}
                type="button"
                data-category-id={category.id}
                className={`category-tab${isSelected ? ' is-selected' : ''}`}
                onClick={() => selectCategory(category.id)}
                aria-pressed={isSelected}
              >
                {iconAsset ? (
                  <img className="category-icon category-icon-image" src={iconAsset} alt="" aria-hidden="true" />
                ) : (
                  <span className="category-icon" aria-hidden="true">
                    {category.icon}
                  </span>
                )}
                <span>{category.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {isOverlayOpen ? (
        <div className="page-view-viewport">
          <div className="page-view-track">
            <section className="page-view-panel is-active">{overlayContent}</section>
          </div>
        </div>
      ) : (
        <div
          className={`page-view-viewport${pageDrag.isDragging ? ' is-dragging' : ''}`}
          onClickCapture={handlePageClickCapture}
          onTouchStart={handlePageSwipeStart}
          onTouchMove={handlePageSwipeMove}
          onTouchEnd={handlePageSwipeEnd}
          onTouchCancel={() => {
            pageSwipeStartRef.current = null;
            setPageDrag({ offset: 0, isDragging: false, targetIndex: null });
          }}
        >
          <div
            className={`page-view-track${pageDrag.isDragging ? ' is-dragging' : ''}`}
            style={{ transform: `translate3d(${pageTrackTransform}, 0, 0)` }}
          >
            {categories.map((category, index) => {
              const isActive = index === selectedIndex;
              const isSwipePreview = pageDrag.targetIndex === index;
              const shouldMount =
                isActive || visitedCategoryIds.has(category.id) || pageDrag.targetIndex === index;

              return (
                <section
                  key={category.id}
                  className={`page-view-panel${isActive ? ' is-active' : ' is-inactive'}${isSwipePreview ? ' is-preview' : ''}`}
                  aria-hidden={!isActive}
                >
                  {shouldMount ? renderPageContent(category.id) : null}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

export default ListTop;
