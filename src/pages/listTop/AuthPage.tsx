import {
  useEffect,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react';
import {
  postAuthForm,
  postResendVerification,
} from './authApi';
import { getStoredAuthUserId } from './authStorage';
import {
  AuthRequestError,
  type AuthView,
} from './authTypes';
import { emailVerifiedSignalStorageKey } from './constants';

function AuthPage({
  initialError,
  view,
  onChangeView,
  onGoogleLoginClick,
  onLoginSuccess,
  getGoogleLoginUrl,
}: {
  initialError?: string | null;
  view: Exclude<AuthView, null>;
  onChangeView: (view: Exclude<AuthView, null>) => void;
  onGoogleLoginClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  onLoginSuccess: (loginId: string) => void;
  getGoogleLoginUrl: () => string;
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

export default AuthPage;
