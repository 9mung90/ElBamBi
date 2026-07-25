// MyPage 전체

import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  LoginRequiredError, // 오류 구분
  normalizeAuthRole, // 권한
  requestMyPageApi, // jwt 넣어 마이페이지 api 호출
  type AuthRole,
  type MyPageUpdateResponse,
} from './listTopShared';

// get 종류 = 서버에서 온걸 안전하게 읽음
function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getStringValue(value: unknown, fallback = '') {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

function getNumberValue(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}
// 여러 이름중 첫번째 값 찾음(서버 응답 다르게 올 때 용도)
function getFirstString(record: Record<string, unknown> | null, keys: string[], fallback = '') {
  if (!record) return fallback;
  for (const key of keys) {
    const value = getStringValue(record[key]);
    if (value) return value;
  }
  return fallback;
}

function getFirstRecord(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const value = getRecord(record[key]);
    if (value) return value;
  }
  return null;
}

// 배열 데이터 꺼냄
function getArrayFromPayload(payload: unknown, keys: string[]) {
  if (Array.isArray(payload)) return payload.filter(getRecord);

  const record = getRecord(payload);
  if (!record) return [];

  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value.filter(getRecord);

    const nestedRecord = getRecord(value);
    const nestedItems = nestedRecord?.items ?? nestedRecord?.content ?? nestedRecord?.data;
    if (Array.isArray(nestedItems)) return nestedItems.filter(getRecord);
  }

  const fallbackItems = record.items ?? record.content ?? record.data;
  return Array.isArray(fallbackItems) ? fallbackItems.filter(getRecord) : [];
}

// 날짜 표시
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

// 게시글 ID나 제목 유물 등등 추출 코드
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


// Oauth와 일반 로그인 구분
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


// 닉네임 입력 검증 코드
function isValidProfileNickname(nickname: string) {
  return /^[A-Za-z0-9가-힣]{1,10}$/.test(nickname);
}

function isValidProfilePassword(password: string) {
  return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,20}$/.test(password);
}

// 마이페이지의 화면들
type MyPageView = 'overview' | 'posts' | 'comments' | 'bookmarks' | 'relics' | 'presets';

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

function getProfileRole(profile: Record<string, unknown> | null): AuthRole {
  return normalizeAuthRole(profile?.role);
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

// my page 섹션 관련 코드들
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

type MyPageProps = {
  authUserId: string | null;
  onAuthUpdated: (response: MyPageUpdateResponse) => void;
  onAccountDeleted: () => void;
  onLoginRequired: () => void;
  onLogout: () => void;
  onOpenPost: (postId: string) => void;
};

function MyPage({
  authUserId,
  onAuthUpdated,
  onAccountDeleted,
  onLoginRequired,
  onLogout,
  onOpenPost,
}: MyPageProps) {
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
      requestMyPageApi<unknown>('/api/me/relics?source=builder'),
      requestMyPageApi<unknown>('/api/me/presets'),
    ])
      .then(([mePayload, summaryPayload, relicsPayload, presetsPayload]) => {
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
          relics: getArrayFromPayload(relicsPayload, ['relics', 'myRelics']).slice(0, 6),
          presets: getArrayFromPayload(presetsPayload, ['presets', 'myPresets']).slice(0, 6),
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


  // 더보기 화면 API 요청
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

  // 프로필 데이터 바뀌면 폼 초기화
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

  // 닉 변경
  function updateProfileForm(field: keyof MyPageProfileForm, value: string) {
    setProfileForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }
  // 저장 및 검증코드
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

  // 계정 삭제
  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeleteMessage(null);

    if (deleteConfirmText !== 'DELETE') {
      setDeleteMessage('삭제하려면 DELETE를 입력해 주세요.');
      return;
    }

    // 비번 검증
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

  // 디테일 페이지 기본 값
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

export default MyPage;
