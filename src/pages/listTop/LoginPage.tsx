// 로그인, 회원가입 Google Oauth등 처리
// 현재 회원가입 기능은 SES 인증 후 다시 기능 복원 예정

import {
  useEffect,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react';
import {
  accessTokenStorageKey,
  authNicknameStorageKey,
  authNicknameUserIdStorageKey,
  authUserIdStorageKey,
  getUserIdFromAccessToken,
} from '../../api/authToken';
import {
  apiBaseUrl,
  getErrorMessageFromPayload,
  getAccessTokenFromLocationSearch,
  getGoogleLoginUrl,
  getStoredAccessToken,
  getStoredAuthUserId,
  setStoredValue,
  type AuthView,
} from './listTopShared';

// 에러
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

// 이메일 인증 완료 신호키, 한 탭에서 성공하면 다른 탭에 알려줌
const emailVerifiedSignalStorageKey = 'nightreign:email-verified-at';

function getMessageFromPayload(payload: unknown) {
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

// 오류 코드
function getCodeFromPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return '';
  const code = (payload as { code?: unknown }).code;
  return typeof code === 'string' ? code : '';
}

// 엑세스 토큰 가져옴
function getAccessTokenFromPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const token = (payload as { accessToken?: unknown }).accessToken;
  return typeof token === 'string' && token ? token : null;
}

// 응답 본문 읽음
async function readResponsePayload(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  if (!text) return undefined;
  return contentType.includes('application/json') ? JSON.parse(text) : text;
}

// 로그인 없어도 호출 가능한 API(이메일 인증용)
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

// 이메일 링크에 있는 인증 토큰 서버에 전달
function postVerifyEmail(token: string) {
  return postPublicJson('/api/auth/verify-email', { token });
}

// 인증메일 재전송
function postResendVerification(email: string) {
  return postPublicJson('/api/auth/resend-verification', { email });
}

// 폼 데이터 생성
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

type AuthContentProps = {
  initialError?: string | null;
  view: Exclude<AuthView, null>;
  onChangeView: (view: Exclude<AuthView, null>) => void;
  onGoogleLoginClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  onLoginSuccess: (loginId: string) => void;
};

function AuthContent({
  initialError,
  view,
  onChangeView,
  onGoogleLoginClick,
  onLoginSuccess,
}: AuthContentProps) {
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

type NicknameContentProps = {
  accessToken?: string | null;
  onComplete: () => void;
};

function NicknameContent({
  accessToken,
  onComplete,
}: NicknameContentProps) {
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

const verifyingEmailTokens = new Map<string, Promise<unknown>>();

function VerifyEmailContent({ onGoToLogin }: { onGoToLogin: () => void }) {
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

type LoginPageProps =
  | ({
      mode: 'auth';
    } & AuthContentProps)
  | {
      mode: 'nickname';
      accessToken?: string | null;
      onComplete: () => void;
    }
  | {
      mode: 'verify-email';
      onGoToLogin: () => void;
    };

function LoginPage(props: LoginPageProps) {
  if (props.mode === 'nickname') {
    return (
      <NicknameContent
        accessToken={props.accessToken}
        onComplete={props.onComplete}
      />
    );
  }

  if (props.mode === 'verify-email') {
    return <VerifyEmailContent onGoToLogin={props.onGoToLogin} />;
  }

  return (
    <AuthContent
      initialError={props.initialError}
      view={props.view}
      onChangeView={props.onChangeView}
      onGoogleLoginClick={props.onGoogleLoginClick}
      onLoginSuccess={props.onLoginSuccess}
    />
  );
}

export default LoginPage;
