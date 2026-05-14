import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { nightfarers, type Nightfarer } from '../data/nightfarers';
import './BuildPage.css';

type WritableBuildPostCategory = 'Class Builds' | 'Strategy' | 'Questions' | 'Free Board';
type BoardTabId = 'all' | 'popular' | 'class-builds' | 'strategy' | 'questions' | 'free-board';
type SortKey = 'latest' | 'popular' | 'views';
type BoardMode = 'list' | 'write';

const nightAssetUrls = import.meta.glob('../assets/images/night/**/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

const nightAssetUrlsByLower = new Map(
  Object.entries(nightAssetUrls).map(([path, url]) => [path.toLowerCase(), url]),
);

type BuildImage = {
  id: string;
  postId: string;
  imageUrl: string;
};

type BuildComment = {
  id: string;
  postId: string;
  userId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

type BuildPost = {
  id: string;
  userId: string;
  title: string;
  content: string;
  viewCount: number;
  category: string;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
  likeCount: number;
  bookmarkCount: number;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  comments: BuildComment[];
  images: BuildImage[];
};

type BuildPostDraft = {
  title: string;
  category: WritableBuildPostCategory;
  nightfarerIndex: number | null;
  content: string;
  imageUrls: string;
};

type CommunityPostResponse = {
  id?: unknown;
  userId?: unknown;
  title?: unknown;
  content?: unknown;
  viewCount?: unknown;
  category?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  deletedAt?: unknown;
};

type CommentResponse = {
  id?: unknown;
  postId?: unknown;
  userId?: unknown;
  parentCommentId?: unknown;
  content?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  deletedAt?: unknown;
};

type ImageResponse = {
  id?: unknown;
  postId?: unknown;
  imageUrl?: unknown;
};

type PostRelationResponse = {
  id?: unknown;
  userId?: unknown;
  postId?: unknown;
};

type ApiBodyValue = string | number | null | undefined;

const defaultApiBaseUrl = 'https://k9e297bszl.execute-api.ap-northeast-2.amazonaws.com';
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl).replace(/\/$/, '');
const accessTokenStorageKey = 'accessToken';
const postsPerPage = 15;
const writeCategories: WritableBuildPostCategory[] = [
  'Class Builds',
  'Strategy',
  'Questions',
  'Free Board',
];

const legacyCategoryLabels: Record<string, WritableBuildPostCategory> = {
  '빌드 공유': 'Class Builds',
  공략: 'Strategy',
  질문: 'Questions',
  '파티 모집': 'Free Board',
  기타: 'Free Board',
};

const categoryDisplayLabels: Record<string, string> = {
  'Class Builds': '캐릭터 빌드',
  'Weapon Builds': '무기 빌드',
  Strategy: '공략',
  Questions: '질문',
  'Free Board': '자유 게시판',
  free: '자유 게시판',
  '빌드 공유': '캐릭터 빌드',
  공략: '공략',
  질문: '질문',
  '파티 모집': '자유 게시판',
  기타: '자유 게시판',
};

const boardTabs: {
  id: BoardTabId;
  label: string;
  categories?: string[];
}[] = [
  { id: 'all', label: '전체' },
  { id: 'popular', label: '인기글' },
  { id: 'class-builds', label: '캐릭터 빌드', categories: ['Class Builds', '빌드 공유'] },
  { id: 'strategy', label: '공략', categories: ['Strategy', '공략'] },
  { id: 'questions', label: '질문', categories: ['Questions', '질문'] },
  { id: 'free-board', label: '자유 게시판', categories: ['Free Board', 'free', '파티 모집', '기타'] },
];

const communityApi = {
  posts: '/api/communityPosts',
  postsByUser: '/api/communityPostsByUser',
  addPost: '/api/addCommunityPost',
  editPost: '/api/editCommunityPost',
  deletePost: '/api/deleteCommunityPost',
  comments: '/api/comments',
  postComments: '/api/postComments',
  addComment: '/api/addComment',
  deleteComment: '/api/deleteComment',
  images: '/api/postImages',
  addImage: '/api/addPostImage',
  likes: '/api/postLikes',
  myLikes: '/api/userPostLikes',
  addLike: '/api/addPostLike',
  deleteLikeByPost: '/api/deletePostLikeByPost',
  bookmarks: '/api/bookmarks',
  myBookmarks: '/api/userBookmarks',
  addBookmark: '/api/addBookmark',
  deleteBookmarkByPost: '/api/deleteBookmarkByPost',
  addViewHistory: '/api/addPostViewHistory',
};

class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

function getNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function getString(value: unknown, fallback = '') {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function resolveNightAssetUrl(url: string) {
  if (!url.startsWith('/assets/images/night/')) return url;

  const assetPath = url.replace('/assets/images/night/', '../assets/images/night/');
  return nightAssetUrls[assetPath] ?? nightAssetUrlsByLower.get(assetPath.toLowerCase()) ?? url;
}

function getNightfarerIconUrl(nightfarer: Nightfarer) {
  return resolveNightAssetUrl(nightfarer.nameImageUrl);
}

function getNullableDate(value: unknown) {
  return typeof value === 'string' && value ? value : null;
}

function appendParams(params: URLSearchParams, values: Record<string, ApiBodyValue>) {
  Object.entries(values).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    params.append(key, String(value));
  });
}

function getAccessToken() {
  try {
    return localStorage.getItem(accessTokenStorageKey);
  } catch {
    return null;
  }
}

async function requestApi<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    query?: Record<string, ApiBodyValue>;
    body?: Record<string, ApiBodyValue>;
  } = {},
): Promise<T> {
  const query = new URLSearchParams();
  if (options.query) appendParams(query, options.query);

  const queryString = query.toString();
  const url = `${apiBaseUrl}${path}${queryString ? `?${queryString}` : ''}`;
  const headers = new Headers();
  const accessToken = getAccessToken();
  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }

  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers,
  };

  if (options.body) {
    const body = new URLSearchParams();
    appendParams(body, options.body);
    init.body = body;
    headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
  }

  const response = await fetch(url, init);
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();

  if (!response.ok) {
    throw new ApiRequestError(response.status, text || `${response.status} ${response.statusText}`);
  }

  if (!text) return undefined as T;
  if (contentType.includes('application/json')) return JSON.parse(text) as T;

  return text as T;
}

async function requestOptionalList<T>(path: string) {
  try {
    const payload = await requestApi<unknown>(path);
    return Array.isArray(payload) ? (payload as T[]) : [];
  } catch (error) {
    if (isApiRequestError(error) && error.status === 401) return [];
    throw error;
  }
}

function normalizePost(post: CommunityPostResponse): BuildPost {
  return {
    id: getString(post.id),
    userId: getString(post.userId),
    title: getString(post.title, '제목 없음'),
    content: getString(post.content),
    viewCount: getNumber(post.viewCount),
    category: getString(post.category, 'Class Builds'),
    createdAt: getString(post.createdAt, new Date().toISOString()),
    updatedAt: getNullableDate(post.updatedAt),
    deletedAt: getNullableDate(post.deletedAt),
    likeCount: 0,
    bookmarkCount: 0,
    likedByMe: false,
    bookmarkedByMe: false,
    comments: [],
    images: [],
  };
}

function normalizeComment(comment: CommentResponse): BuildComment {
  return {
    id: getString(comment.id),
    postId: getString(comment.postId),
    userId: getString(comment.userId),
    parentCommentId:
      comment.parentCommentId === null || comment.parentCommentId === undefined
        ? null
        : getString(comment.parentCommentId),
    content: getString(comment.content),
    createdAt: getString(comment.createdAt, new Date().toISOString()),
    updatedAt: getNullableDate(comment.updatedAt),
    deletedAt: getNullableDate(comment.deletedAt),
  };
}

function normalizeImage(image: ImageResponse): BuildImage | null {
  const imageUrl = getString(image.imageUrl);
  if (!imageUrl) return null;

  return {
    id: getString(image.id),
    postId: getString(image.postId),
    imageUrl,
  };
}

function getPostIdSet(relations: PostRelationResponse[]) {
  return new Set(relations.map((relation) => getString(relation.postId)).filter(Boolean));
}

function getPostCountMap(relations: PostRelationResponse[]) {
  return relations.reduce<Map<string, number>>((countMap, relation) => {
    const postId = getString(relation.postId);
    if (!postId) return countMap;
    countMap.set(postId, (countMap.get(postId) ?? 0) + 1);
    return countMap;
  }, new Map());
}

function groupByPostId<T extends { postId: string }>(items: T[]) {
  return items.reduce<Map<string, T[]>>((groupMap, item) => {
    const currentItems = groupMap.get(item.postId) ?? [];
    currentItems.push(item);
    groupMap.set(item.postId, currentItems);
    return groupMap;
  }, new Map());
}

function buildPosts(
  rawPosts: CommunityPostResponse[],
  rawComments: CommentResponse[],
  rawImages: ImageResponse[],
  rawLikes: PostRelationResponse[],
  rawBookmarks: PostRelationResponse[],
  rawMyLikes: PostRelationResponse[],
  rawMyBookmarks: PostRelationResponse[],
) {
  const commentsByPostId = groupByPostId(
    rawComments.map(normalizeComment).filter((comment) => Boolean(comment.id) && Boolean(comment.postId)),
  );
  const imagesByPostId = groupByPostId(
    rawImages
      .map(normalizeImage)
      .filter((image): image is BuildImage => Boolean(image) && Boolean(image?.postId)),
  );
  const likeCountByPostId = getPostCountMap(rawLikes);
  const bookmarkCountByPostId = getPostCountMap(rawBookmarks);
  const likedPostIds = getPostIdSet(rawMyLikes);
  const bookmarkedPostIds = getPostIdSet(rawMyBookmarks);

  return rawPosts
    .map(normalizePost)
    .filter((post) => Boolean(post.id) && !post.deletedAt)
    .map((post) => ({
      ...post,
      comments: commentsByPostId.get(post.id) ?? [],
      images: imagesByPostId.get(post.id) ?? [],
      likeCount: likeCountByPostId.get(post.id) ?? 0,
      bookmarkCount: bookmarkCountByPostId.get(post.id) ?? 0,
      likedByMe: likedPostIds.has(post.id),
      bookmarkedByMe: bookmarkedPostIds.has(post.id),
    }));
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '-';

  return new Intl.DateTimeFormat('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getImageUrls(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((url) => url.trim())
    .filter(Boolean);
}

function getCategoryLabel(category: string) {
  const cleanCategory = category.trim();
  const normalizedCategory = legacyCategoryLabels[cleanCategory] ?? cleanCategory;
  return categoryDisplayLabels[normalizedCategory] ?? categoryDisplayLabels[cleanCategory] ?? (normalizedCategory || '캐릭터 빌드');
}

function getAuthorLabel(userId: string) {
  return userId ? `사용자 #${userId}` : '알 수 없음';
}

function getPostNightfarer(post: BuildPost) {
  // TODO: Currently UI only. Connect this to the DB/API later.
  const searchableText = [post.title, post.content, post.category, getCategoryLabel(post.category)]
    .join(' ')
    .toLowerCase();

  return nightfarers.find((nightfarer) => searchableText.includes(nightfarer.name.toLowerCase())) ?? null;
}

function matchesNightfarerFilter(post: BuildPost, selectedNightfarerIndex: number | null) {
  if (selectedNightfarerIndex === null) return true;

  return getPostNightfarer(post)?.index === selectedNightfarerIndex;
}

function getPostScore(post: BuildPost) {
  return post.likeCount * 4 + post.comments.length * 2 + post.viewCount;
}

function isPopularPost(post: BuildPost) {
  return getPostScore(post) > 0;
}

function getPostTime(post: BuildPost) {
  const timestamp = new Date(post.createdAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function matchesPostSearch(post: BuildPost, searchQuery: string) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [post.title, post.content, getCategoryLabel(post.category), post.category, getAuthorLabel(post.userId)].some(
    (value) => String(value).toLowerCase().includes(normalizedQuery),
  );
}

function matchesBoardTab(post: BuildPost, selectedTab: BoardTabId) {
  if (selectedTab === 'all') return true;
  if (selectedTab === 'popular') return isPopularPost(post);

  const tab = boardTabs.find((boardTab) => boardTab.id === selectedTab);
  if (!tab?.categories) return true;

  const label = getCategoryLabel(post.category);
  return tab.categories.some((category) => category === post.category || category === label);
}

function sortPosts(posts: BuildPost[], sortKey: SortKey) {
  return [...posts].sort((left, right) => {
    if (sortKey === 'popular') {
      return getPostScore(right) - getPostScore(left) || getPostTime(right) - getPostTime(left);
    }

    if (sortKey === 'views') {
      return right.viewCount - left.viewCount || getPostTime(right) - getPostTime(left);
    }

    return getPostTime(right) - getPostTime(left);
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (isApiRequestError(error)) {
    if (error.status === 401) return '로그인이 필요합니다.';
    return error.message || fallback;
  }
  return fallback;
}

async function findCreatedPostId(draft: BuildPostDraft) {
  const userPosts = await requestApi<CommunityPostResponse[]>(communityApi.postsByUser);
  const posts = Array.isArray(userPosts) ? userPosts.map(normalizePost) : [];
  const matchedPost = posts.find(
    (post) => post.title === draft.title && post.content === draft.content && post.category === draft.category,
  );
  const categoryNormalizedPost = posts.find((post) => post.title === draft.title && post.content === draft.content);

  return matchedPost?.id ?? categoryNormalizedPost?.id ?? posts[0]?.id ?? null;
}

function BoardCategoryTabs({
  selectedTab,
  onSelectTab,
}: {
  selectedTab: BoardTabId;
  onSelectTab: (tabId: BoardTabId) => void;
}) {
  return (
    <nav className="build-board-tabs" aria-label="빌드 게시판 카테고리">
      {boardTabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={selectedTab === tab.id ? 'is-selected' : ''}
          aria-pressed={selectedTab === tab.id}
          onClick={() => onSelectTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function BoardNightfarerFilter({
  selectedNightfarerIndex,
  onSelectNightfarer,
}: {
  selectedNightfarerIndex: number | null;
  onSelectNightfarer: (index: number | null) => void;
}) {
  return (
    <div className="build-nightfarer-filter" aria-label="캐릭터 빌드 필터">
      {/* TODO: Currently UI only. Connect this to the DB/API later. */}
      <button
        type="button"
        className={selectedNightfarerIndex === null ? 'is-selected' : ''}
        aria-pressed={selectedNightfarerIndex === null}
        onClick={() => onSelectNightfarer(null)}
      >
        전체 캐릭터
      </button>
      {nightfarers.map((nightfarer) => (
        <button
          key={nightfarer.index}
          type="button"
          className={selectedNightfarerIndex === nightfarer.index ? 'is-selected' : ''}
          aria-pressed={selectedNightfarerIndex === nightfarer.index}
          onClick={() => onSelectNightfarer(nightfarer.index)}
        >
          <img src={getNightfarerIconUrl(nightfarer)} alt="" aria-hidden="true" />
          <span>{nightfarer.name}</span>
        </button>
      ))}
    </div>
  );
}

function BoardSearchBar({
  boardSearchQuery,
  sortKey,
  totalCount,
  isRefreshing,
  onSearchChange,
  onSortChange,
  onRefresh,
}: {
  boardSearchQuery: string;
  sortKey: SortKey;
  totalCount: number;
  isRefreshing: boolean;
  onSearchChange: (value: string) => void;
  onSortChange: (value: SortKey) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="build-board-controls">
      <label className="build-board-search">
        <span>검색</span>
        <input
          type="search"
          value={boardSearchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="제목, 내용, 카테고리, 작성자 검색"
        />
      </label>

      <label className="build-sort-control">
        <span>정렬</span>
        <select value={sortKey} onChange={(event) => onSortChange(event.target.value as SortKey)}>
          <option value="latest">최신순</option>
          <option value="popular">인기순</option>
          <option value="views">조회순</option>
        </select>
      </label>

      <span className="build-board-count">글 {totalCount}개</span>
      <button type="button" className="build-secondary-button" onClick={onRefresh}>
        {isRefreshing ? '새로고침 중' : '새로고침'}
      </button>
    </div>
  );
}

function BoardPostList({
  posts,
  selectedPostId,
  totalCount,
  pageStartIndex,
  onSelectPost,
  onToggleLike,
}: {
  posts: BuildPost[];
  selectedPostId: string | null;
  totalCount: number;
  pageStartIndex: number;
  onSelectPost: (post: BuildPost) => void;
  onToggleLike: (post: BuildPost) => void;
}) {
  return (
    <div className="build-table-wrap">
      <table className="build-post-table">
        <thead>
          <tr>
            <th>번호</th>
            <th>분류</th>
            <th>캐릭터</th>
            <th>제목</th>
            <th>작성자</th>
            <th>작성일</th>
            <th>조회</th>
            <th>추천</th>
            <th>댓글</th>
          </tr>
        </thead>
        <tbody>
          {posts.length ? (
            posts.map((post, index) => {
              const nightfarer = getPostNightfarer(post);

              return (
                <tr key={post.id} className={selectedPostId === post.id ? 'is-selected' : ''}>
                  <td>{totalCount - pageStartIndex - index}</td>
                  <td>
                    <span className="build-category-badge">{getCategoryLabel(post.category)}</span>
                  </td>
                  <td>
                    {nightfarer ? (
                      <span className="build-nightfarer-cell">
                        <img src={getNightfarerIconUrl(nightfarer)} alt="" aria-hidden="true" />
                        <span>{nightfarer.name}</span>
                      </span>
                    ) : (
                      <span className="build-muted-cell">-</span>
                    )}
                  </td>
                  <td className="build-title-cell">
                    <button type="button" onClick={() => onSelectPost(post)}>
                      <span>
                        {post.title}
                        {post.images.length ? <small> +{post.images.length}</small> : null}
                      </span>
                      {/* TODO: Currently UI only. Connect this to the DB/API later. */}
                      {isPopularPost(post) ? <em>인기</em> : null}
                    </button>
                  </td>
                  <td>{getAuthorLabel(post.userId)}</td>
                  <td>{formatDate(post.createdAt)}</td>
                  <td>{post.viewCount}</td>
                  <td>
                    <button
                      type="button"
                      className={`build-recommend-button${post.likedByMe ? ' is-active' : ''}`}
                      onClick={() => onToggleLike(post)}
                    >
                      {post.likeCount}
                    </button>
                  </td>
                  <td>{post.comments.length}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={9} className="build-table-empty">
                조건에 맞는 빌드 글이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function BoardPagination({
  currentPage,
  pageCount,
  onPageChange,
}: {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1).filter(
    (page) => page === 1 || page === pageCount || Math.abs(page - currentPage) <= 2,
  );

  return (
    <div className="build-pagination" aria-label="게시판 페이지 이동">
      <button type="button" disabled={currentPage === 1} onClick={() => onPageChange(1)}>
        처음
      </button>
      <button type="button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
        이전
      </button>
      {pages.map((page, index) => {
        const previousPage = pages[index - 1];
        const needsGap = previousPage !== undefined && page - previousPage > 1;

        return (
          <span key={page} className="build-page-number-group">
            {needsGap ? <span className="build-page-gap">...</span> : null}
            <button
              type="button"
              className={currentPage === page ? 'is-current' : ''}
              aria-current={currentPage === page ? 'page' : undefined}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          </span>
        );
      })}
      <button type="button" disabled={currentPage === pageCount} onClick={() => onPageChange(currentPage + 1)}>
        다음
      </button>
      <button type="button" disabled={currentPage === pageCount} onClick={() => onPageChange(pageCount)}>
        마지막
      </button>
    </div>
  );
}

function BuildPostWritePage({
  draft,
  isSubmitting,
  onDraftChange,
  onSubmit,
  onCancel,
}: {
  draft: BuildPostDraft;
  isSubmitting: boolean;
  onDraftChange: <K extends keyof BuildPostDraft>(key: K, value: BuildPostDraft[K]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <section className="build-page build-write-page" aria-labelledby="build-write-title">
      <div className="build-page-heading">
        <div>
          <p className="list-page-kicker">커뮤니티</p>
          <h2 id="build-write-title">글쓰기</h2>
        </div>
        <button type="button" className="build-secondary-button" onClick={onCancel}>
          게시판으로 돌아가기
        </button>
      </div>

      <form className="build-write-form" onSubmit={onSubmit}>
        <p className="build-session-note">작성자는 백엔드 로그인 세션에서 자동으로 사용됩니다.</p>
        <label>
          카테고리
          <select
            value={draft.category}
            onChange={(event) => onDraftChange('category', event.target.value as WritableBuildPostCategory)}
          >
            {writeCategories.map((category) => (
              <option key={category} value={category}>
                {getCategoryLabel(category)}
              </option>
            ))}
          </select>
        </label>
        <label>
          캐릭터
          {/* TODO: Currently UI only. Connect this form to the DB/API later. */}
          <select
            value={draft.nightfarerIndex ?? ''}
            onChange={(event) =>
              onDraftChange('nightfarerIndex', event.target.value === '' ? null : Number(event.target.value))
            }
          >
            <option value="">선택 안 함</option>
            {nightfarers.map((nightfarer) => (
              <option key={nightfarer.index} value={nightfarer.index}>
                {nightfarer.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          제목
          <input
            type="text"
            value={draft.title}
            onChange={(event) => onDraftChange('title', event.target.value)}
            placeholder="예: 레이더 출혈 빌드와 3일차 운영"
            maxLength={80}
            required
          />
        </label>
        <label>
          내용
          <textarea
            value={draft.content}
            onChange={(event) => onDraftChange('content', event.target.value)}
            placeholder="장비, 유물 옵션, 운용법, 루트, 보스별 팁을 적어주세요."
            rows={13}
            required
          />
        </label>
        <label>
          이미지 URL
          <textarea
            value={draft.imageUrls}
            onChange={(event) => onDraftChange('imageUrls', event.target.value)}
            placeholder="여러 개면 줄바꿈 또는 쉼표로 구분하세요."
            rows={3}
          />
        </label>

        <div className="build-write-actions">
          <button type="button" className="build-secondary-button" onClick={onCancel}>
            취소
          </button>
          <button type="submit" className="build-primary-button" disabled={isSubmitting}>
            {isSubmitting ? '등록 중' : '등록'}
          </button>
        </div>
      </form>
    </section>
  );
}

function BuildPostDetail({
  post,
  commentText,
  commentParentId,
  onCommentTextChange,
  onSetCommentParentId,
  onCreateComment,
  onDeleteComment,
  onToggleLike,
  onToggleBookmark,
  onDeletePost,
  onReportPost,
}: {
  post: BuildPost;
  commentText: string;
  commentParentId: string | null;
  onCommentTextChange: (value: string) => void;
  onSetCommentParentId: (commentId: string | null) => void;
  onCreateComment: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteComment: (comment: BuildComment) => void;
  onToggleLike: (post: BuildPost) => void;
  onToggleBookmark: (post: BuildPost) => void;
  onDeletePost: (post: BuildPost) => void;
  onReportPost: (post: BuildPost) => void;
}) {
  return (
    <article className="build-post-detail" aria-label="선택한 빌드 글">
      <div className="build-detail-heading">
        <div className="build-detail-title">
          <span className="build-category-badge">{getCategoryLabel(post.category)}</span>
          <h3>{post.title}</h3>
        </div>
        <div className="build-post-meta">
          <span>{getAuthorLabel(post.userId)}</span>
          <span>조회 {post.viewCount}</span>
          <span>추천 {post.likeCount}</span>
          <span>댓글 {post.comments.length}</span>
          <span>{formatDate(post.createdAt)}</span>
        </div>
        <div className="build-detail-tools">
          <button type="button" onClick={() => onToggleLike(post)}>
            {post.likedByMe ? '추천 취소' : '추천'} {post.likeCount}
          </button>
          <button type="button" onClick={() => onToggleBookmark(post)}>
            {post.bookmarkedByMe ? '북마크 해제' : '북마크'} {post.bookmarkCount}
          </button>
          <button type="button" onClick={() => onReportPost(post)}>
            신고
          </button>
          <button type="button" className="is-danger" onClick={() => onDeletePost(post)}>
            삭제
          </button>
        </div>
      </div>

      {post.images.length ? (
        <div className="build-image-grid">
          {post.images.map((image) => (
            <img key={`${image.id}-${image.imageUrl}`} src={image.imageUrl} alt={`${post.title} 이미지`} />
          ))}
        </div>
      ) : null}

      <p className="build-detail-content">{post.content}</p>

      <section className="build-comments" aria-label="댓글">
        <div className="build-comments-heading">
          <strong>댓글 {post.comments.length}</strong>
        </div>

        {post.comments.length ? (
          post.comments.map((comment) => (
            <div key={comment.id} className={`build-comment${comment.parentCommentId ? ' is-reply' : ''}`}>
              <div>
                <strong>{getAuthorLabel(comment.userId)}</strong>
                <span>{formatDate(comment.createdAt)}</span>
              </div>
              <p>{comment.content}</p>
              <div className="build-comment-actions">
                <button type="button" onClick={() => onSetCommentParentId(comment.id)}>
                  답글
                </button>
                <button type="button" className="is-danger" onClick={() => onDeleteComment(comment)}>
                  삭제
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="build-empty">아직 댓글이 없습니다.</p>
        )}

        <form className="build-comment-form" onSubmit={onCreateComment}>
          {commentParentId ? (
            <div className="build-reply-target">
              <span>답글 대상: 댓글 #{commentParentId}</span>
              <button type="button" onClick={() => onSetCommentParentId(null)}>
                취소
              </button>
            </div>
          ) : null}
          <textarea
            value={commentText}
            onChange={(event) => onCommentTextChange(event.target.value)}
            placeholder="댓글을 입력하세요."
            rows={3}
          />
          <button type="submit" className="build-secondary-button">
            댓글 등록
          </button>
        </form>
      </section>
    </article>
  );
}

function BuildPage({ searchQuery }: { searchQuery: string }) {
  const [posts, setPosts] = useState<BuildPost[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [boardMode, setBoardMode] = useState<BoardMode>('list');
  // TODO: Currently UI only. Connect this to the DB/API later.
  const [selectedBoardTab, setSelectedBoardTab] = useState<BoardTabId>('all');
  const [selectedNightfarerIndex, setSelectedNightfarerIndex] = useState<number | null>(null);
  const [boardSearchQuery, setBoardSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('latest');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentParentId, setCommentParentId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BuildPostDraft>({
    title: '',
    category: 'Class Builds',
    nightfarerIndex: null,
    content: '',
    imageUrls: '',
  });

  async function loadCommunityData(focusPostId?: string | null) {
    const shouldShowInitialLoading = posts.length === 0;
    if (shouldShowInitialLoading) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const [rawPosts, rawComments, rawImages, rawLikes, rawBookmarks, rawMyLikes, rawMyBookmarks] =
        await Promise.all([
          requestApi<CommunityPostResponse[]>(communityApi.posts),
          requestOptionalList<CommentResponse>(communityApi.comments),
          requestOptionalList<ImageResponse>(communityApi.images),
          requestOptionalList<PostRelationResponse>(communityApi.likes),
          requestOptionalList<PostRelationResponse>(communityApi.bookmarks),
          requestOptionalList<PostRelationResponse>(communityApi.myLikes),
          requestOptionalList<PostRelationResponse>(communityApi.myBookmarks),
        ]);

      const nextPosts = buildPosts(
        Array.isArray(rawPosts) ? rawPosts : [],
        rawComments,
        rawImages,
        rawLikes,
        rawBookmarks,
        rawMyLikes,
        rawMyBookmarks,
      );

      setPosts(nextPosts);
      setSelectedPostId((currentPostId) => {
        const targetId = focusPostId ?? currentPostId;
        if (targetId && nextPosts.some((post) => post.id === targetId)) return targetId;
        return nextPosts[0]?.id ?? null;
      });
      setNotice(null);
    } catch (error) {
      setNotice(getErrorMessage(error, '커뮤니티 글을 불러오지 못했습니다.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadCommunityData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [boardSearchQuery, searchQuery, selectedBoardTab, selectedNightfarerIndex, sortKey]);

  useEffect(() => {
    if (selectedBoardTab !== 'class-builds') {
      setSelectedNightfarerIndex(null);
    }
  }, [selectedBoardTab]);

  const visiblePosts = useMemo(
    () =>
      sortPosts(
        posts
          .filter((post) => matchesBoardTab(post, selectedBoardTab))
          .filter((post) => selectedBoardTab !== 'class-builds' || matchesNightfarerFilter(post, selectedNightfarerIndex))
          .filter((post) => matchesPostSearch(post, searchQuery))
          .filter((post) => matchesPostSearch(post, boardSearchQuery)),
        sortKey,
      ),
    [boardSearchQuery, posts, searchQuery, selectedBoardTab, selectedNightfarerIndex, sortKey],
  );

  const pageCount = Math.max(1, Math.ceil(visiblePosts.length / postsPerPage));

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  const pageStartIndex = (currentPage - 1) * postsPerPage;
  const pagedPosts = visiblePosts.slice(pageStartIndex, pageStartIndex + postsPerPage);
  const selectedPost = visiblePosts.find((post) => post.id === selectedPostId) ?? pagedPosts[0] ?? null;

  function updateDraft<K extends keyof BuildPostDraft>(key: K, value: BuildPostDraft[K]) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
    }));
  }

  async function addImages(postId: string, imageUrls: string[]) {
    const results = await Promise.allSettled(
      imageUrls.map((imageUrl) =>
        requestApi<string>(communityApi.addImage, {
          method: 'POST',
          body: {
            postId,
            imageUrl,
          },
        }),
      ),
    );

    return results.some((result) => result.status === 'rejected');
  }

  async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanDraft: BuildPostDraft = {
      ...draft,
      title: draft.title.trim(),
      content: draft.content.trim(),
      imageUrls: draft.imageUrls.trim(),
    };

    if (!cleanDraft.title || !cleanDraft.content) return;

    setIsSubmitting(true);

    try {
      await requestApi<string>(communityApi.addPost, {
        method: 'POST',
        body: {
          title: cleanDraft.title,
          content: cleanDraft.content,
          category: cleanDraft.category,
        },
      });

      const createdPostId = await findCreatedPostId(cleanDraft);
      const imageUrls = getImageUrls(cleanDraft.imageUrls);
      const hasImageFailure = createdPostId ? await addImages(createdPostId, imageUrls) : imageUrls.length > 0;

      setDraft({
        title: '',
        category: 'Class Builds',
        nightfarerIndex: null,
        content: '',
        imageUrls: '',
      });
      setSelectedBoardTab('all');
      setBoardMode('list');
      await loadCommunityData(createdPostId);
      setNotice(hasImageFailure ? '글은 등록했지만 일부 이미지를 저장하지 못했습니다.' : '빌드 글을 등록했습니다.');
    } catch (error) {
      setNotice(getErrorMessage(error, '빌드 글 등록에 실패했습니다.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSelectPost(post: BuildPost) {
    setSelectedPostId(post.id);

    try {
      await requestApi<string>(communityApi.addViewHistory, {
        method: 'POST',
        body: {
          postId: post.id,
        },
      });
      await loadCommunityData(post.id);
    } catch (error) {
      if (!isApiRequestError(error) || error.status !== 401) {
        setNotice(getErrorMessage(error, '조회 기록 저장에 실패했습니다.'));
      }
    }
  }

  async function handleToggleLike(post: BuildPost) {
    try {
      await requestApi<string>(post.likedByMe ? communityApi.deleteLikeByPost : communityApi.addLike, {
        method: 'POST',
        body: {
          postId: post.id,
        },
      });
      await loadCommunityData(post.id);
    } catch (error) {
      setNotice(getErrorMessage(error, '좋아요 상태 저장에 실패했습니다.'));
    }
  }

  async function handleToggleBookmark(post: BuildPost) {
    try {
      await requestApi<string>(post.bookmarkedByMe ? communityApi.deleteBookmarkByPost : communityApi.addBookmark, {
        method: 'POST',
        body: {
          postId: post.id,
        },
      });
      await loadCommunityData(post.id);
    } catch (error) {
      setNotice(getErrorMessage(error, '북마크 상태 저장에 실패했습니다.'));
    }
  }

  async function handleDeletePost(post: BuildPost) {
    if (!window.confirm('이 빌드 글을 삭제할까요?')) return;

    try {
      await requestApi<string>(communityApi.deletePost, {
        method: 'POST',
        body: {
          id: post.id,
        },
      });
      await loadCommunityData(null);
      setNotice('빌드 글을 삭제했습니다.');
    } catch (error) {
      setNotice(getErrorMessage(error, '빌드 글 삭제에 실패했습니다.'));
    }
  }

  function handleReportPost(post: BuildPost) {
    // TODO: Currently UI only. Connect this to the DB/API later.
    setNotice(`신고 기능은 아직 연결되지 않았습니다. "${post.title}" 글은 신고되지 않았습니다.`);
  }

  async function handleCreateComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = selectedPost;
    const content = commentText.trim();
    if (!selected || !content) return;

    try {
      await requestApi<string>(communityApi.addComment, {
        method: 'POST',
        body: {
          postId: selected.id,
          parentCommentId: commentParentId,
          content,
        },
      });
      setCommentText('');
      setCommentParentId(null);
      await loadCommunityData(selected.id);
    } catch (error) {
      setNotice(getErrorMessage(error, '댓글 등록에 실패했습니다.'));
    }
  }

  async function handleDeleteComment(comment: BuildComment) {
    const selected = selectedPost;
    if (!selected || !window.confirm('이 댓글을 삭제할까요?')) return;

    try {
      await requestApi<string>(communityApi.deleteComment, {
        method: 'POST',
        body: {
          id: comment.id,
        },
      });
      await loadCommunityData(selected.id);
      setNotice('댓글을 삭제했습니다.');
    } catch (error) {
      setNotice(getErrorMessage(error, '댓글 삭제에 실패했습니다.'));
    }
  }

  if (boardMode === 'write') {
    return (
      <BuildPostWritePage
        draft={draft}
        isSubmitting={isSubmitting}
        onDraftChange={updateDraft}
        onSubmit={handleCreatePost}
        onCancel={() => setBoardMode('list')}
      />
    );
  }

  return (
    <section className="build-page" aria-labelledby="build-page-title">
      <div className="build-page-heading">
        <div>
          <p className="list-page-kicker">커뮤니티 게시판</p>
          <h2 id="build-page-title">빌드 공유</h2>
        </div>
        <button type="button" className="build-primary-button" onClick={() => setBoardMode('write')}>
          글쓰기
        </button>
      </div>

      <div className="build-board-notice">
        <strong>공지</strong>
        <span>나이트파러 빌드, 무기 세팅, 루트, 질문을 공유하는 게시판입니다. 글 목록은 현재 커뮤니티 API에서 불러옵니다.</span>
      </div>

      {notice ? <p className="build-notice">{notice}</p> : null}

      <BoardCategoryTabs selectedTab={selectedBoardTab} onSelectTab={setSelectedBoardTab} />
      {selectedBoardTab === 'class-builds' ? (
        <BoardNightfarerFilter
          selectedNightfarerIndex={selectedNightfarerIndex}
          onSelectNightfarer={setSelectedNightfarerIndex}
        />
      ) : null}

      <section className="build-board-panel" aria-label="빌드 공유 글 목록">
        <BoardSearchBar
          boardSearchQuery={boardSearchQuery}
          sortKey={sortKey}
          totalCount={visiblePosts.length}
          isRefreshing={isRefreshing}
          onSearchChange={setBoardSearchQuery}
          onSortChange={setSortKey}
          onRefresh={() => loadCommunityData(selectedPost?.id)}
        />

        {isLoading ? (
          <p className="build-empty">빌드 글을 불러오는 중입니다.</p>
        ) : (
          <BoardPostList
            posts={pagedPosts}
            selectedPostId={selectedPost?.id ?? null}
            totalCount={visiblePosts.length}
            pageStartIndex={pageStartIndex}
            onSelectPost={handleSelectPost}
            onToggleLike={handleToggleLike}
          />
        )}

        <div className="build-list-footer">
          <BoardPagination currentPage={currentPage} pageCount={pageCount} onPageChange={setCurrentPage} />
          <button type="button" className="build-primary-button build-write-button" onClick={() => setBoardMode('write')}>
            글쓰기
          </button>
        </div>
      </section>

      {selectedPost && !isLoading ? (
        <BuildPostDetail
          post={selectedPost}
          commentText={commentText}
          commentParentId={commentParentId}
          onCommentTextChange={setCommentText}
          onSetCommentParentId={setCommentParentId}
          onCreateComment={handleCreateComment}
          onDeleteComment={handleDeleteComment}
          onToggleLike={handleToggleLike}
          onToggleBookmark={handleToggleBookmark}
          onDeletePost={handleDeletePost}
          onReportPost={handleReportPost}
        />
      ) : null}
    </section>
  );
}

export default BuildPage;
