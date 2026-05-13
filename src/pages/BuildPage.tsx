import { useEffect, useMemo, useState, type FormEvent } from 'react';
import './BuildPage.css';

type BuildPostCategory = '빌드 공유' | '공략' | '질문' | '파티 모집' | '기타';
type CategoryFilter = BuildPostCategory | '전체';

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
  category: BuildPostCategory;
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
const allCategory = '전체';
const categories: BuildPostCategory[] = ['빌드 공유', '공략', '질문', '파티 모집', '기타'];

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
    category: getString(post.category, '빌드 공유'),
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
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('ko-KR', {
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

function matchesPostSearch(post: BuildPost, searchQuery: string) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [post.title, post.content, post.category, `user ${post.userId}`].some((value) =>
    String(value).toLowerCase().includes(normalizedQuery),
  );
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

  return matchedPost?.id ?? posts[0]?.id ?? null;
}

function BuildPage({ searchQuery }: { searchQuery: string }) {
  const [posts, setPosts] = useState<BuildPost[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>(allCategory);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentParentId, setCommentParentId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BuildPostDraft>({
    title: '',
    category: '빌드 공유',
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

  const visiblePosts = useMemo(
    () =>
      posts
        .filter((post) => selectedCategory === allCategory || post.category === selectedCategory)
        .filter((post) => matchesPostSearch(post, searchQuery))
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [posts, searchQuery, selectedCategory],
  );

  const selectedPost =
    visiblePosts.find((post) => post.id === selectedPostId) ??
    posts.find((post) => post.id === selectedPostId) ??
    visiblePosts[0] ??
    null;

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
        category: '빌드 공유',
        content: '',
        imageUrls: '',
      });
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

  return (
    <section className="build-page" aria-labelledby="build-page-title">
      <div className="build-page-heading">
        <div>
          <p className="list-page-kicker">Community</p>
          <h2 id="build-page-title">빌드 공유</h2>
        </div>
        <div className="build-heading-actions">
          <span className="option-count">{visiblePosts.length} posts</span>
          <button type="button" className="build-secondary-button" onClick={() => loadCommunityData(selectedPost?.id)}>
            {isRefreshing ? '새로고침 중' : '새로고침'}
          </button>
        </div>
      </div>

      {notice ? <p className="build-notice">{notice}</p> : null}

      <div className="build-layout">
        <aside className="build-composer" aria-label="빌드 글 작성">
          <form onSubmit={handleCreatePost}>
            <p className="build-session-note">작성자는 백엔드 로그인 세션에서 자동으로 사용됩니다.</p>
            <label>
              카테고리
              <select
                value={draft.category}
                onChange={(event) => updateDraft('category', event.target.value as BuildPostCategory)}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              제목
              <input
                type="text"
                value={draft.title}
                onChange={(event) => updateDraft('title', event.target.value)}
                placeholder="예: 레이더 3전회 출혈 빌드"
                maxLength={80}
                required
              />
            </label>
            <label>
              내용
              <textarea
                value={draft.content}
                onChange={(event) => updateDraft('content', event.target.value)}
                placeholder="장비, 유물 옵션, 운영법을 적어주세요."
                rows={8}
                required
              />
            </label>
            <label>
              이미지 URL
              <textarea
                value={draft.imageUrls}
                onChange={(event) => updateDraft('imageUrls', event.target.value)}
                placeholder="여러 개면 줄바꿈 또는 쉼표로 구분"
                rows={3}
              />
            </label>
            <button type="submit" className="build-primary-button" disabled={isSubmitting}>
              {isSubmitting ? '등록 중' : '빌드 공유'}
            </button>
          </form>
        </aside>

        <div className="build-content">
          <div className="build-category-row" aria-label="빌드 카테고리">
            {([allCategory, ...categories] as CategoryFilter[]).map((category) => (
              <button
                key={category}
                type="button"
                className={`filter-chip${selectedCategory === category ? ' is-selected' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          {isLoading ? (
            <p className="build-empty">빌드 글을 불러오는 중입니다.</p>
          ) : visiblePosts.length ? (
            <div className="build-board">
              <div className="build-post-list" aria-label="빌드 글 목록">
                {visiblePosts.map((post) => (
                  <article
                    key={post.id}
                    className={`build-post-card${selectedPost?.id === post.id ? ' is-selected' : ''}`}
                  >
                    <button type="button" onClick={() => handleSelectPost(post)}>
                      <span className="option-category">{post.category}</span>
                      <strong>{post.title}</strong>
                      <span>{post.content}</span>
                    </button>
                    <div className="build-post-meta">
                      <span>유저 #{post.userId}</span>
                      <span>조회 {post.viewCount}</span>
                      <span>댓글 {post.comments.length}</span>
                      <span>{formatDate(post.createdAt)}</span>
                    </div>
                    <div className="build-action-row">
                      <button type="button" onClick={() => handleToggleLike(post)}>
                        {post.likedByMe ? '좋아요 취소' : '좋아요'} {post.likeCount}
                      </button>
                      <button type="button" onClick={() => handleToggleBookmark(post)}>
                        {post.bookmarkedByMe ? '북마크 해제' : '북마크'} {post.bookmarkCount}
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <article className="build-post-detail">
                {selectedPost ? (
                  <>
                    <div className="build-detail-heading">
                      <span className="option-category">{selectedPost.category}</span>
                      <h3>{selectedPost.title}</h3>
                      <div className="build-post-meta">
                        <span>작성자 유저 #{selectedPost.userId}</span>
                        <span>조회 {selectedPost.viewCount}</span>
                        <span>{formatDate(selectedPost.createdAt)}</span>
                      </div>
                      <div className="build-detail-tools">
                        <button type="button" onClick={() => handleToggleLike(selectedPost)}>
                          {selectedPost.likedByMe ? '좋아요 취소' : '좋아요'} {selectedPost.likeCount}
                        </button>
                        <button type="button" onClick={() => handleToggleBookmark(selectedPost)}>
                          {selectedPost.bookmarkedByMe ? '북마크 해제' : '북마크'} {selectedPost.bookmarkCount}
                        </button>
                        <button type="button" className="is-danger" onClick={() => handleDeletePost(selectedPost)}>
                          삭제
                        </button>
                      </div>
                    </div>

                    {selectedPost.images.length ? (
                      <div className="build-image-grid">
                        {selectedPost.images.map((image) => (
                          <img key={image.id} src={image.imageUrl} alt={`${selectedPost.title} 이미지`} />
                        ))}
                      </div>
                    ) : null}

                    <p className="build-detail-content">{selectedPost.content}</p>

                    <section className="build-comments" aria-label="댓글">
                      <div className="build-comments-heading">
                        <strong>댓글 {selectedPost.comments.length}</strong>
                      </div>

                      {selectedPost.comments.length ? (
                        selectedPost.comments.map((comment) => (
                          <div
                            key={comment.id}
                            className={`build-comment${comment.parentCommentId ? ' is-reply' : ''}`}
                          >
                            <div>
                              <strong>유저 #{comment.userId}</strong>
                              <span>{formatDate(comment.createdAt)}</span>
                            </div>
                            <p>{comment.content}</p>
                            <div className="build-comment-actions">
                              <button type="button" onClick={() => setCommentParentId(comment.id)}>
                                답글
                              </button>
                              <button type="button" className="is-danger" onClick={() => handleDeleteComment(comment)}>
                                삭제
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="build-empty">아직 댓글이 없습니다.</p>
                      )}

                      <form className="build-comment-form" onSubmit={handleCreateComment}>
                        {commentParentId ? (
                          <div className="build-reply-target">
                            <span>답글 대상: 댓글 #{commentParentId}</span>
                            <button type="button" onClick={() => setCommentParentId(null)}>
                              취소
                            </button>
                          </div>
                        ) : null}
                        <textarea
                          value={commentText}
                          onChange={(event) => setCommentText(event.target.value)}
                          placeholder="댓글을 입력하세요."
                          rows={3}
                        />
                        <button type="submit" className="build-secondary-button">
                          댓글 등록
                        </button>
                      </form>
                    </section>
                  </>
                ) : (
                  <p className="build-empty">왼쪽 목록에서 글을 선택하세요.</p>
                )}
              </article>
            </div>
          ) : (
            <p className="build-empty">조건에 맞는 빌드 글이 없습니다.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default BuildPage;
