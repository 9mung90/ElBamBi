import { useState, type FormEvent } from 'react';
import {
  authNicknameStorageKey,
  authNicknameUserIdStorageKey,
  getUserIdFromAccessToken,
} from '../../api/authToken';
import { getStoredAccessToken } from './authStorage';
import { setStoredValue } from './storageUtils';

type NicknamePageProps = {
  accessToken?: string | null;
  onComplete: () => void;
  postNicknameForm: (
    nickname: string,
    accessTokenOverride?: string | null,
  ) => Promise<string>;
};

export default function NicknamePage({
  accessToken,
  onComplete,
  postNicknameForm,
}: NicknamePageProps) {
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
