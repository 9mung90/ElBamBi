import { useEffect, useState } from 'react';
import { postVerifyEmail } from './authApi';
import { emailVerifiedSignalStorageKey } from './constants';
import { setStoredValue } from './storageUtils';

const verifyingEmailTokens = new Map<string, Promise<unknown>>();

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

export default VerifyEmailPage;
