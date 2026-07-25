import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { nightfarers } from '../data/nightfarers';
import type { TouchEvent as ReactTouchEvent } from 'react';
import { getApiErrorMessage } from '../api/apiError';
import {
  accessTokenStorageKey,
  authNicknameStorageKey,
  authNicknameUserIdStorageKey,
  authUserIdStorageKey,
  clearAuthStorage,
  getAccessTokenPayload,
  isAccessTokenExpired,
} from '../api/authToken';
import BuildPostWritePage from './build/BuildPostWritePage';
import BuildPostDetail from './build/BuildPostDetail';
import {
  buildPostPresetMarkerPrefix,
  buildPostPresetMarkerSuffix,
  formatDate,
  getAuthorLabel,
  getBuildContentImageCount,
  getBuildPostContentParts,
  getCategoryLabel,
  getNightfarerIconUrl,
  legacyCategoryLabels,
  sanitizeBuildPostHtml,
  writeCategories,
  type BuildComment,
  type BuildImage,
  type BuildPost,
  type BuildPostDraft,
  type BuildPostPreset,
  type WritableBuildPostCategory,
} from './build/buildShared';
import './BuildPage.css';

type BoardTabId = 'all' | 'popular' | 'class-builds' | 'strategy' | 'questions' | 'free-board';
export type SortKey = 'latest' | 'popular' | 'views';
type BoardMode = 'detail' | 'edit' | 'list' | 'write';
type AuthRole = 'USER' | 'ADMIN';

type BuildContentImagePayload = {
  alt: string;
  index: number;
  mimeType: string;
  sizeBytes: number | null;
  src?: string;
};

type CreatedPostLookupDraft = Pick<BuildPostDraft, 'title' | 'category'> & {
  content: string;
};

type CommunityPostResponse = {
  id?: unknown;
  userId?: unknown;
  nickname?: unknown;
  authorNickname?: unknown;
  userNickname?: unknown;
  writerNickname?: unknown;
  memberNickname?: unknown;
  user?: unknown;
  author?: unknown;
  writer?: unknown;
  title?: unknown;
  content?: unknown;
  contentHtml?: unknown;
  contentText?: unknown;
  embeddedImagesJson?: unknown;
  presetJson?: unknown;
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
  nickname?: unknown;
  authorNickname?: unknown;
  userNickname?: unknown;
  writerNickname?: unknown;
  memberNickname?: unknown;
  user?: unknown;
  author?: unknown;
  writer?: unknown;
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

type PresignedImageUploadResponse = {
  uploadUrl?: unknown;
  publicUrl?: unknown;
  objectKey?: unknown;
};

type PostRelationResponse = {
  id?: unknown;
  userId?: unknown;
  postId?: unknown;
};

type AuthUserProfile = {
  nickname: string;
  userId: string;
};

type ApiBodyValue = string | number | null | undefined;

// 게시판 기본 설정
const defaultApiBaseUrl = 'https://k9e297bszl.execute-api.ap-northeast-2.amazonaws.com';
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl).replace(/\/$/, '');
const postsPerPage = 15;
const maxCommunityPostRequestSize = 9 * 1024 * 1024;
// 탭마다 보여줄 게시글 카테고리
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

// 게시판 API 주소
const communityApi = {
  posts: '/api/communityPosts',
  postsByUser: '/api/communityPostsByUser',
  addPost: '/api/addCommunityPost',
  editPost: '/api/editCommunityPost',
  deletePost: '/api/deleteCommunityPost',
  adminPosts: '/api/admin/posts',
  comments: '/api/comments',
  postComments: '/api/postComments',
  addComment: '/api/addComment',
  deleteComment: '/api/deleteComment',
  adminComments: '/api/admin/comments',
  images: '/api/postImages',
  addImage: '/api/addPostImage',
  presignImage: '/api/communityPosts/images/presign',
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

// API 오류
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

// API 데이터 변환
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

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function getAuthorNickname(value: {
  author?: unknown;
  authorNickname?: unknown;
  memberNickname?: unknown;
  nickname?: unknown;
  user?: unknown;
  userNickname?: unknown;
  writer?: unknown;
  writerNickname?: unknown;
}) {
  // 응답에 바로 들어있는 닉네임 확인
  const directNickname =
    getString(value.authorNickname) ||
    getString(value.nickname) ||
    getString(value.userNickname) ||
    getString(value.writerNickname) ||
    getString(value.memberNickname);

  if (directNickname) return directNickname;

  // 사용자 객체 안에 들어있는 닉네임 확인
  const user = getRecord(value.user);
  const author = getRecord(value.author);
  const writer = getRecord(value.writer);

  return (
    getString(user?.nickname) ||
    getString(user?.userNickname) ||
    getString(author?.nickname) ||
    getString(author?.authorNickname) ||
    getString(writer?.nickname) ||
    getString(writer?.writerNickname)
  );
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

// 로그인 정보 가져오기
function getAccessToken() {
  try {
    const accessToken = localStorage.getItem(accessTokenStorageKey);
    if (!accessToken) return null;
    if (isAccessTokenExpired(accessToken)) {
      // 만료된 로그인 정보 정리
      clearAuthStorage();
      return null;
    }
    return accessToken;
  } catch {
    return null;
  }
}

function getStoredValue(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getAuthUserProfile(): AuthUserProfile | null {
  const accessToken = getAccessToken();
  const storedUserId = getStoredValue(authUserIdStorageKey);
  const storedNickname = getStoredValue(authNicknameStorageKey);
  const storedNicknameUserId = getStoredValue(authNicknameUserIdStorageKey);

  // 토큰이 없으면 저장된 사용자 정보 사용
  if (!accessToken) {
    if (storedUserId && storedNickname && storedNicknameUserId === storedUserId) {
      return { nickname: storedNickname, userId: storedUserId };
    }

    return null;
  }

  const payload = getAccessTokenPayload(accessToken);
  // 토큰 해석 실패 시 저장된 사용자 정보 사용
  if (!payload) {
    if (storedUserId && storedNickname && storedNicknameUserId === storedUserId) {
      return { nickname: storedNickname, userId: storedUserId };
    }

    return null;
  }

  const userId = getString(payload.userId) || getString(payload.sub) || getString(payload.id) || storedUserId || '';
  const nickname =
    getString(payload.nickname) ||
    getString(payload.nickName) ||
    getString(payload.userNickname) ||
    getString(payload.authorNickname) ||
    (storedNicknameUserId === userId ? storedNickname ?? '' : '');

  if (!userId || !nickname) return null;

  return { nickname, userId };
}

function isPostAuthor(post: BuildPost, authUserId: string | null) {
  const authUserProfile = getAuthUserProfile();
  return Boolean(post.userId && (post.userId === authUserId || post.userId === authUserProfile?.userId));
}

function getAdminPostPath(postId: string) {
  return `${communityApi.adminPosts}/${encodeURIComponent(postId)}`;
}

function getAdminCommentPath(commentId: string) {
  return `${communityApi.adminComments}/${encodeURIComponent(commentId)}`;
}

// API 요청 함수
async function requestApi<T>(
  path: string,
  options: {
    includeAuth?: boolean;
    bodyAsJson?: boolean;
    method?: 'DELETE' | 'GET' | 'POST';
    query?: Record<string, ApiBodyValue>;
    body?: Record<string, ApiBodyValue>;
  } = {},
): Promise<T> {
  const query = new URLSearchParams();
  if (options.query) appendParams(query, options.query);

  // 요청 주소와 로그인 헤더 만들기
  const queryString = query.toString();
  const url = `${apiBaseUrl}${path}${queryString ? `?${queryString}` : ''}`;
  const headers = new Headers();
  const accessToken = getAccessToken();
  if (options.includeAuth !== false && accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }

  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers,
  };

  // JSON 또는 폼 형식으로 요청 내용 만들기
  if (options.body) {
    if (options.bodyAsJson) {
      init.body = JSON.stringify(
        Object.fromEntries(Object.entries(options.body).filter(([, value]) => value !== null && value !== undefined && value !== '')),
      );
      headers.set('content-type', 'application/json;charset=UTF-8');
    } else {
      const body = new URLSearchParams();
      appendParams(body, options.body);
      init.body = body;
      headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
    }
  }

  const response = await fetch(url, init);
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();

  // 인증 실패 시 저장된 로그인 정보 정리
  if (!response.ok) {
    if (response.status === 401) {
      clearAuthStorage();
    }
    throw new ApiRequestError(response.status, text || `${response.status} ${response.statusText}`);
  }

  if (!text) return undefined as T;
  if (contentType.includes('application/json')) return JSON.parse(text) as T;

  return text as T;
}

async function requestOptionalList<T>(path: string, options: { includeAuth?: boolean } = {}) {
  try {
    const payload = await requestApi<unknown>(path, { includeAuth: options.includeAuth });
    return Array.isArray(payload) ? (payload as T[]) : [];
  } catch (error) {
    if (isApiRequestError(error) && error.status === 401) return [];
    throw error;
  }
}

// 게시판 데이터 정리
function normalizePost(post: CommunityPostResponse): BuildPost {
  return {
    id: getString(post.id),
    userId: getString(post.userId),
    authorNickname: getAuthorNickname(post),
    title: getString(post.title, '제목 없음'),
    content: normalizePostContent(post),
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

function normalizePostContent(post: CommunityPostResponse) {
  const content = getString(post.contentHtml, getString(post.content));
  const presetJson = getString(post.presetJson);
  // 이미 프리셋이 들어있는 게시글은 그대로 사용
  if (!presetJson || content.startsWith(buildPostPresetMarkerPrefix)) return content;

  const preset = decodeBuildPostPresetJson(presetJson);
  if (!preset) return content;

  return content ? `${encodeBuildPostPreset(preset)}\n${content}` : encodeBuildPostPreset(preset);
}

function normalizeComment(comment: CommentResponse): BuildComment {
  return {
    id: getString(comment.id),
    postId: getString(comment.postId),
    userId: getString(comment.userId),
    authorNickname: getAuthorNickname(comment),
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

// 게시판 데이터 합치기
function buildPosts(
  rawPosts: CommunityPostResponse[],
  rawComments: CommentResponse[],
  rawImages: ImageResponse[],
  rawLikes: PostRelationResponse[],
  rawBookmarks: PostRelationResponse[],
  rawMyLikes: PostRelationResponse[],
  rawMyBookmarks: PostRelationResponse[],
) {
  // 댓글과 이미지를 게시글 번호별로 묶기
  const commentsByPostId = groupByPostId(
    rawComments.map(normalizeComment).filter((comment) => Boolean(comment.id) && Boolean(comment.postId)),
  );
  const imagesByPostId = groupByPostId(
    rawImages
      .map(normalizeImage)
      .filter((image): image is BuildImage => Boolean(image) && Boolean(image?.postId)),
  );
  // 좋아요와 북마크 개수 및 내 상태 정리
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

function applyCurrentUserNickname(posts: BuildPost[], authUserProfile: AuthUserProfile | null) {
  if (!authUserProfile) return posts;

  // 내 게시글과 댓글에 빠진 닉네임 채우기
  return posts.map((post) => ({
    ...post,
    authorNickname:
      post.authorNickname || post.userId !== authUserProfile.userId
        ? post.authorNickname
        : authUserProfile.nickname,
    comments: post.comments.map((comment) => ({
      ...comment,
      authorNickname:
        comment.authorNickname || comment.userId !== authUserProfile.userId
          ? comment.authorNickname
          : authUserProfile.nickname,
    })),
  }));
}

// 프리셋 데이터 변환
function encodeBuildPostPreset(preset: BuildPostPreset) {
  return `${buildPostPresetMarkerPrefix}${btoa(encodeURIComponent(JSON.stringify(preset)))}${buildPostPresetMarkerSuffix}`;
}

function decodeBuildPostPresetJson(value: string): BuildPostPreset | null {
  try {
    const parsed = JSON.parse(value) as BuildPostPreset;
    // 프리셋 필수 데이터 확인
    if (!parsed?.preset?.presetId || !Array.isArray(parsed.preset.slots)) return null;
    return {
      preset: parsed.preset,
      storedRelics: Array.isArray(parsed.storedRelics) ? parsed.storedRelics : [],
    };
  } catch {
    return null;
  }
}

// 게시글 내용과 이미지 처리
function getBuildContentText(content: string) {
  if (typeof document === 'undefined') return content;

  const container = document.createElement('div');
  container.innerHTML = content;
  return container.textContent ?? '';
}

function getDataUrlSizeBytes(src: string) {
  const base64Match = src.match(/^data:[^;]+;base64,(.*)$/);
  if (!base64Match) return null;

  // base64 길이와 패딩으로 실제 이미지 크기 계산
  const base64 = base64Match[1].replace(/\s/g, '');
  if (!base64) return 0;

  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function getDataUrlContentType(src: string) {
  return src.match(/^data:([^;]+);base64,/)?.[1] ?? '';
}

function getSafeUploadFileName(fileName: string, fallbackIndex: number, contentType: string) {
  const trimmedName = fileName.trim();
  if (trimmedName) return trimmedName;

  const extensionByType: Record<string, string> = {
    'image/avif': 'avif',
    'image/bmp': 'bmp',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };

  return `build-image-${fallbackIndex + 1}.${extensionByType[contentType] ?? 'png'}`;
}

function dataUrlToBlob(src: string) {
  const match = src.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) throw new Error('이미지 데이터를 읽을 수 없습니다.');

  const contentType = match[1];
  const binary = window.atob(match[2].replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);

  // base64 문자열을 업로드할 파일 데이터로 변환
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: contentType });
}

function getBuildContentImages(content: string): BuildContentImagePayload[] {
  if (typeof document === 'undefined') return [];

  const container = document.createElement('div');
  container.innerHTML = content;

  // 게시글 안의 모든 이미지 정보 가져오기
  return Array.from(container.querySelectorAll('img'))
    .map((image, index) => {
      const src = image.getAttribute('src') ?? '';
      const mimeType = src.match(/^data:([^;]+);/)?.[1] ?? '';

      return {
        alt: image.getAttribute('alt') ?? '',
        index,
        mimeType,
        sizeBytes: getDataUrlSizeBytes(src),
        src,
      };
    })
    .filter((image) => image.src);
}

function getBuildContentImageMetadata(content: string): BuildContentImagePayload[] {
  return getBuildContentImages(content).map(({ src: _src, ...metadata }) => metadata);
}

function isBuildContentEmpty(content: string) {
  return !getBuildContentText(content).trim() && getBuildContentImageCount(content) === 0;
}

function composeBuildPostContent(draft: BuildPostDraft) {
  const cleanContent = sanitizeBuildPostHtml(draft.content);
  if (!draft.preset) return cleanContent;

  // 프리셋과 작성 내용을 하나의 게시글 내용으로 합치기
  const presetContent = encodeBuildPostPreset(draft.preset);
  return cleanContent ? `${presetContent}\n${cleanContent}` : presetContent;
}

function getSearchableBuildContent(content: string) {
  const contentParts = getBuildPostContentParts(content);
  return getBuildContentText(contentParts.content);
}

function createBuildPostRequestBody(draft: BuildPostDraft, postContent: string, authorNickname = '') {
  const cleanContentHtml = sanitizeBuildPostHtml(draft.content);
  const embeddedImages = getBuildContentImageMetadata(cleanContentHtml);
  const contentText = getBuildContentText(cleanContentHtml).trim();

  // API에 보낼 게시글 데이터 만들기
  return {
    title: draft.title,
    content: contentText,
    contentHtml: postContent,
    contentText,
    category: draft.category,
    presetJson: draft.preset ? JSON.stringify(draft.preset) : undefined,
    presetId: draft.preset?.preset.presetId,
    nickname: authorNickname || undefined,
    authorNickname: authorNickname || undefined,
    embeddedImagesJson: embeddedImages.length ? JSON.stringify(embeddedImages) : undefined,
    embeddedImageCount: embeddedImages.length,
  };
}

function getWritableCategory(category: string): WritableBuildPostCategory {
  const normalizedCategory = legacyCategoryLabels[category.trim()] ?? category.trim();
  return writeCategories.includes(normalizedCategory as WritableBuildPostCategory)
    ? (normalizedCategory as WritableBuildPostCategory)
    : 'Free Board';
}

// 이미지 업로드 주소 발급
async function presignBuildPostImageUpload({
  contentType,
  fileName,
  sizeBytes,
  userId,
}: {
  contentType: string;
  fileName: string;
  sizeBytes: number;
  userId: string;
}) {
  const response = await requestApi<PresignedImageUploadResponse>(communityApi.presignImage, {
    method: 'POST',
    bodyAsJson: true,
    body: {
      userId,
      fileName,
      contentType,
      sizeBytes,
    },
  });
  const uploadUrl = getString(response.uploadUrl);
  const publicUrl = getString(response.publicUrl);

  if (!uploadUrl || !publicUrl) {
    throw new Error('이미지 업로드 URL을 발급받지 못했습니다.');
  }

  return {
    objectKey: getString(response.objectKey),
    publicUrl,
    uploadUrl,
  };
}

// S3 이미지 업로드
async function uploadBuildPostImageToS3({
  contentType,
  file,
  uploadUrl,
}: {
  contentType: string;
  file: Blob;
  uploadUrl: string;
}) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'content-type': contentType,
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, `이미지 업로드 실패: ${response.status} ${response.statusText}`));
  }
}

// 게시글 이미지 업로드
async function uploadEmbeddedBuildImages(content: string, userId: string) {
  if (typeof document === 'undefined') return content;

  const template = document.createElement('template');
  template.innerHTML = sanitizeBuildPostHtml(content);
  const images = Array.from(template.content.querySelectorAll('img')).filter((image) =>
    (image.getAttribute('src') ?? '').startsWith('data:image/'),
  );

  // 본문 이미지를 차례로 업로드
  for (const [index, image] of images.entries()) {
    const src = image.getAttribute('src') ?? '';
    const contentType = getDataUrlContentType(src);
    const sizeBytes = getDataUrlSizeBytes(src) ?? 0;
    const fileName = getSafeUploadFileName(image.getAttribute('alt') ?? '', index, contentType);
    const file = dataUrlToBlob(src);
    const { publicUrl, uploadUrl } = await presignBuildPostImageUpload({
      contentType,
      fileName,
      sizeBytes,
      userId,
    });

    await uploadBuildPostImageToS3({
      contentType,
      file,
      uploadUrl,
    });
    // 본문의 임시 이미지를 업로드된 주소로 교체
    image.setAttribute('src', publicUrl);
  }

  return template.innerHTML.trim();
}

function getRequestBodySize(body: Record<string, ApiBodyValue>) {
  const jsonBody = JSON.stringify(
    Object.fromEntries(Object.entries(body).filter(([, value]) => value !== null && value !== undefined && value !== '')),
  );

  return new TextEncoder().encode(jsonBody).length;
}

// 게시글 캐릭터 찾기
function getPostNightfarer(post: BuildPost) {
  // TODO: Currently UI only. Connect this to the DB/API later.
  // 제목과 내용에서 캐릭터 이름 확인
  const searchableText = [post.title, getSearchableBuildContent(post.content), post.category, getCategoryLabel(post.category)]
    .join(' ')
    .toLowerCase();

  return nightfarers.find((nightfarer) => searchableText.includes(nightfarer.name.toLowerCase())) ?? null;
}

function createDraftFromPost(post: BuildPost): BuildPostDraft {
  const contentParts = getBuildPostContentParts(post.content);

  return {
    title: post.title,
    category: getWritableCategory(post.category),
    nightfarerIndex: getPostNightfarer(post)?.index ?? null,
    content: contentParts.content,
    preset: contentParts.preset,
  };
}

function matchesNightfarerFilter(post: BuildPost, selectedNightfarerIndex: number | null) {
  if (selectedNightfarerIndex === null) return true;

  return getPostNightfarer(post)?.index === selectedNightfarerIndex;
}

function getPostScore(post: BuildPost) {
  // 좋아요와 댓글에 가중치를 준 인기 점수
  return post.likeCount * 4 + post.comments.length * 2 + post.viewCount;
}

function isPopularPost(post: BuildPost) {
  return getPostScore(post) > 0;
}

function getPostTime(post: BuildPost) {
  const timestamp = new Date(post.createdAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

// 검색 함수
function matchesPostSearch(post: BuildPost, searchQuery: string) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) return true;

  // 제목과 내용 및 분류와 작성자에서 검색
  return [
    post.title,
    getSearchableBuildContent(post.content),
    getCategoryLabel(post.category),
    post.category,
    getAuthorLabel(post.userId, post.authorNickname),
  ].some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

// 게시판 탭 필터
function matchesBoardTab(post: BuildPost, selectedTab: BoardTabId) {
  if (selectedTab === 'all') return true;
  if (selectedTab === 'popular') return isPopularPost(post);

  const tab = boardTabs.find((boardTab) => boardTab.id === selectedTab);
  if (!tab?.categories) return true;

  const label = getCategoryLabel(post.category);
  return tab.categories.some((category) => category === post.category || category === label);
}

// 게시글 정렬
function sortPosts(posts: BuildPost[], sortKey: SortKey) {
  return [...posts].sort((left, right) => {
    // 인기순은 점수가 같으면 최신 글 우선
    if (sortKey === 'popular') {
      return getPostScore(right) - getPostScore(left) || getPostTime(right) - getPostTime(left);
    }

    // 조회순은 조회수가 같으면 최신 글 우선
    if (sortKey === 'views') {
      return right.viewCount - left.viewCount || getPostTime(right) - getPostTime(left);
    }

    return getPostTime(right) - getPostTime(left);
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (isApiRequestError(error)) {
    return getApiErrorMessage(error.status, error.message || fallback);
  }
  return fallback;
}

function getAdminDeleteErrorMessage(error: unknown, fallback: string) {
  if (isApiRequestError(error)) {
    return getApiErrorMessage(error.status, error.message || fallback);
  }
  return fallback;
}

// 등록한 게시글 찾기
async function findCreatedPostId(draft: CreatedPostLookupDraft) {
  const userPosts = await requestApi<CommunityPostResponse[]>(communityApi.postsByUser);
  const posts = Array.isArray(userPosts) ? userPosts.map(normalizePost) : [];
  const matchedPost = posts.find(
    (post) => post.title === draft.title && post.content === draft.content && post.category === draft.category,
  );
  const categoryNormalizedPost = posts.find((post) => post.title === draft.title && post.content === draft.content);

  return matchedPost?.id ?? categoryNormalizedPost?.id ?? posts[0]?.id ?? null;
}

// 게시판 카테고리
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

// 캐릭터 필터
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

// 게시판 목록 메뉴
function BoardListToolbar({
  totalCount,
  isRefreshing,
  onRefresh,
}: {
  totalCount: number;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="build-board-controls">
      <span className="build-board-count">글 {totalCount}개</span>
      <button type="button" className="build-secondary-button" onClick={onRefresh}>
        {isRefreshing ? '새로고침 중' : '새로고침'}
      </button>
    </div>
  );
}

// 게시글 목록
function BoardPostList({
  isAdmin,
  posts,
  selectedPostId,
  totalCount,
  pageStartIndex,
  onSelectPost,
  onAdminDeletePost,
  onToggleLike,
}: {
  isAdmin: boolean;
  posts: BuildPost[];
  selectedPostId: string | null;
  totalCount: number;
  pageStartIndex: number;
  onSelectPost: (post: BuildPost) => void;
  onAdminDeletePost: (post: BuildPost) => void;
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
            {isAdmin ? <th>관리</th> : null}
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
                  <td data-build-date={formatDate(post.createdAt)}>{getAuthorLabel(post.userId, post.authorNickname)}</td>
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
                  {isAdmin ? (
                    <td>
                      <button
                        type="button"
                        className="build-admin-delete-button is-danger"
                        onClick={() => onAdminDeletePost(post)}
                      >
                        관리자 삭제
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={isAdmin ? 10 : 9} className="build-table-empty">
                조건에 맞는 빌드 글이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// 페이지 이동
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
    // 처음과 마지막 및 현재 페이지 주변만 표시
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

// 빌드 페이지 전체
function BuildPage({
  authRole,
  authUserId,
  focusPostId,
  onInternalBackChange,
  onLoginRequired,
  searchQuery,
  sortKey,
}: {
  authRole?: AuthRole;
  authUserId: string | null;
  focusPostId?: string | null;
  onInternalBackChange?: (handler: (() => boolean) | null) => void;
  onLoginRequired?: () => void;
  searchQuery: string;
  sortKey: SortKey;
}) {
  const [posts, setPosts] = useState<BuildPost[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [boardMode, setBoardMode] = useState<BoardMode>('list');
  // TODO: Currently UI only. Connect this to the DB/API later.
  const [selectedBoardTab, setSelectedBoardTab] = useState<BoardTabId>('all');
  const [selectedNightfarerIndex, setSelectedNightfarerIndex] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentParentId, setCommentParentId] = useState<string | null>(null);
  const boardSwipeStartRef = useRef<{
    x: number;
    y: number;
    time: number;
    tabIndex: number;
    axis: 'horizontal' | 'vertical' | null;
  } | null>(null);
  const [draft, setDraft] = useState<BuildPostDraft>({
    title: '',
    category: 'Class Builds',
    nightfarerIndex: null,
    content: '',
    preset: null,
  });

  // 게시판 데이터 불러오기
  async function loadCommunityData(focusPostId?: string | null) {
    const shouldShowInitialLoading = posts.length === 0;
    if (shouldShowInitialLoading) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      // 게시글과 관련 데이터를 동시에 불러오기
      const [rawPosts, rawComments, rawImages, rawLikes, rawBookmarks, rawMyLikes, rawMyBookmarks] =
        await Promise.all([
          requestApi<CommunityPostResponse[]>(communityApi.posts, { includeAuth: false }),
          requestOptionalList<CommentResponse>(communityApi.comments, { includeAuth: false }),
          requestOptionalList<ImageResponse>(communityApi.images, { includeAuth: false }),
          requestOptionalList<PostRelationResponse>(communityApi.likes, { includeAuth: false }),
          requestOptionalList<PostRelationResponse>(communityApi.bookmarks, { includeAuth: false }),
          requestOptionalList<PostRelationResponse>(communityApi.myLikes),
          requestOptionalList<PostRelationResponse>(communityApi.myBookmarks),
        ]);

      const nextPosts = applyCurrentUserNickname(
        buildPosts(
          Array.isArray(rawPosts) ? rawPosts : [],
          rawComments,
          rawImages,
          rawLikes,
          rawBookmarks,
          rawMyLikes,
          rawMyBookmarks,
        ),
        getAuthUserProfile(),
      );

      setPosts(nextPosts);
      // 요청한 글 또는 현재 글이 없으면 첫 글 선택
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

  // 게시판 처음 불러오기
  useEffect(() => {
    loadCommunityData(focusPostId);
    if (focusPostId) {
      setBoardMode('detail');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPostId]);

  // 검색 조건 변경 시 첫 페이지
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBoardTab, selectedNightfarerIndex, sortKey]);

  // 캐릭터 필터 초기화
  useEffect(() => {
    if (selectedBoardTab !== 'class-builds') {
      setSelectedNightfarerIndex(null);
    }
  }, [selectedBoardTab]);

  // 내부 뒤로가기
  useEffect(() => {
    if (!onInternalBackChange) return undefined;

    if (boardMode === 'list') {
      onInternalBackChange(null);
      return () => onInternalBackChange(null);
    }

    onInternalBackChange(() => {
      if (boardMode === 'write') {
        setBoardMode('list');
        return true;
      }

      if (boardMode === 'edit') {
        setBoardMode('detail');
        return true;
      }

      if (boardMode === 'detail') {
        setBoardMode('list');
        return true;
      }

      return false;
    });

    return () => onInternalBackChange(null);
  }, [boardMode, onInternalBackChange]);

  // 게시글 필터 적용
  const visiblePosts = useMemo(
    () =>
      sortPosts(
        // 선택한 탭과 캐릭터 및 검색어 조건 적용
        posts
          .filter((post) => matchesBoardTab(post, selectedBoardTab))
          .filter((post) => selectedBoardTab !== 'class-builds' || matchesNightfarerFilter(post, selectedNightfarerIndex))
          .filter((post) => matchesPostSearch(post, searchQuery)),
        sortKey,
      ),
    [posts, searchQuery, selectedBoardTab, selectedNightfarerIndex, sortKey],
  );

  const pageCount = Math.max(1, Math.ceil(visiblePosts.length / postsPerPage));

  // 페이지 범위 맞추기
  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  const pageStartIndex = (currentPage - 1) * postsPerPage;
  const pagedPosts = visiblePosts.slice(pageStartIndex, pageStartIndex + postsPerPage);
  const selectedPost = selectedPostId ? posts.find((post) => post.id === selectedPostId) ?? null : null;
  const isAdmin = authRole === 'ADMIN';
  const authUserProfile = getAuthUserProfile();
  const authorLabel = authUserProfile?.nickname ?? (authUserId ? getAuthorLabel(authUserId) : '로그인 필요');
  const selectedBoardTabIndex = boardTabs.findIndex((tab) => tab.id === selectedBoardTab);

  // 게시판 스와이프
  function isBoardSwipeTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.closest('.build-board-tabs')) return true;
    // 입력과 버튼에서는 게시판 스와이프 막기
    return !target.closest(
      [
        'input',
        'textarea',
        'select',
        'button',
        'a',
        '[contenteditable="true"]',
        '[data-no-board-swipe]',
        '.responsive-select-overlay',
      ].join(', '),
    );
  }

  function handleBoardSwipeStart(event: ReactTouchEvent<HTMLElement>) {
    if (event.touches.length !== 1 || !isBoardSwipeTarget(event.target)) {
      boardSwipeStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    boardSwipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: performance.now(),
      tabIndex: Math.max(0, selectedBoardTabIndex),
      axis: null,
    };
  }

  function handleBoardSwipeMove(event: ReactTouchEvent<HTMLElement>) {
    const start = boardSwipeStartRef.current;
    if (!start || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!start.axis) {
      if (absX < 10 && absY < 10) return;
      start.axis = absX > absY * 1.18 ? 'horizontal' : 'vertical';
    }

    if (start.axis === 'horizontal' && absX > 12) {
      event.preventDefault();
    }
  }

  function handleBoardSwipeEnd(event: ReactTouchEvent<HTMLElement>) {
    const start = boardSwipeStartRef.current;
    boardSwipeStartRef.current = null;
    if (!start || start.axis !== 'horizontal') return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const elapsed = Math.max(1, performance.now() - start.time);
    const velocity = Math.abs(deltaX) / elapsed;
    // 충분히 멀리 또는 빠르게 움직인 경우만 탭 변경
    const shouldChangeTab = Math.abs(deltaY) <= 80 && (Math.abs(deltaX) >= 86 || velocity >= 0.45);

    if (!shouldChangeTab) return;

    const nextIndex = deltaX < 0 ? start.tabIndex + 1 : start.tabIndex - 1;
    const nextTab = boardTabs[Math.max(0, Math.min(boardTabs.length - 1, nextIndex))];
    if (!nextTab || nextTab.id === selectedBoardTab) return;
    setSelectedBoardTab(nextTab.id);
  }

  // API 오류 안내
  function handleApiError(error: unknown, fallback: string, options: { admin?: boolean } = {}) {
    if (isApiRequestError(error) && error.status === 401) {
      onLoginRequired?.();
    }
    setNotice(options.admin ? getAdminDeleteErrorMessage(error, fallback) : getErrorMessage(error, fallback));
  }

  // 작성 내용 변경
  function updateDraft<K extends keyof BuildPostDraft>(key: K, value: BuildPostDraft[K]) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
    }));
  }

  // 게시글 등록
  async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanDraft: BuildPostDraft = {
      ...draft,
      title: draft.title.trim(),
      content: draft.content.trim(),
    };
    const hasEmbeddedDataImages = getBuildContentImages(cleanDraft.content).some((image) =>
      image.src?.startsWith('data:image/'),
    );

    // 제목과 내용 및 로그인 상태 확인
    if (!cleanDraft.title || (!cleanDraft.preset && isBuildContentEmpty(cleanDraft.content))) return;

    if (hasEmbeddedDataImages && !authUserId) {
      setNotice('이미지를 업로드하려면 로그인이 필요합니다.');
      return;
    }

    const authUserProfile = getAuthUserProfile();
    let postContent = composeBuildPostContent(cleanDraft);
    let requestBody = createBuildPostRequestBody(cleanDraft, postContent, authUserProfile?.nickname);
    const requestBodySize = getRequestBodySize(requestBody);
    if (!hasEmbeddedDataImages && requestBodySize > maxCommunityPostRequestSize) {
      setNotice('이미지 용량이 너무 커서 등록할 수 없습니다. 큰 이미지는 S3 직접 업로드 방식이 필요합니다.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 본문 이미지가 있으면 먼저 업로드
      if (hasEmbeddedDataImages && authUserId) {
        setNotice('이미지를 업로드하는 중입니다...');
        const uploadedContent = await uploadEmbeddedBuildImages(cleanDraft.content, authUserId);
        const uploadDraft = {
          ...cleanDraft,
          content: uploadedContent,
        };

        postContent = composeBuildPostContent(uploadDraft);
        requestBody = createBuildPostRequestBody(uploadDraft, postContent, authUserProfile?.nickname);

        if (getRequestBodySize(requestBody) > maxCommunityPostRequestSize) {
          setNotice('게시글 내용이 너무 커서 등록할 수 없습니다.');
          setIsSubmitting(false);
          return;
        }
      }

      await requestApi<string>(communityApi.addPost, {
        method: 'POST',
        body: requestBody,
        bodyAsJson: true,
      });

      const createdPostId = await findCreatedPostId({ ...cleanDraft, content: postContent });

      setDraft({
        title: '',
        category: 'Class Builds',
        nightfarerIndex: null,
        content: '',
        preset: null,
      });
      setSelectedBoardTab('all');
      setBoardMode('list');
      await loadCommunityData(createdPostId);
      setNotice('빌드 글을 등록했습니다.');
    } catch (error) {
      handleApiError(error, '빌드 글 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // 게시글 수정
  async function handleEditPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = selectedPost;
    if (!selected) return;

    const cleanDraft: BuildPostDraft = {
      ...draft,
      title: draft.title.trim(),
      content: draft.content.trim(),
    };
    const hasEmbeddedDataImages = getBuildContentImages(cleanDraft.content).some((image) =>
      image.src?.startsWith('data:image/'),
    );

    // 입력 내용과 작성 권한 확인
    if (!cleanDraft.title || (!cleanDraft.preset && isBuildContentEmpty(cleanDraft.content))) {
      setNotice('제목과 내용을 입력해 주세요.');
      return;
    }

    if (!isPostAuthor(selected, authUserId)) {
      setNotice('이 글을 수정할 권한이 없습니다.');
      return;
    }

    if (hasEmbeddedDataImages && !authUserId) {
      setNotice('이미지를 업로드하려면 로그인이 필요합니다.');
      return;
    }

    const authUserProfile = getAuthUserProfile();
    let postContent = composeBuildPostContent(cleanDraft);
    let requestBody = createBuildPostRequestBody(cleanDraft, postContent, authUserProfile?.nickname);
    const requestBodySize = getRequestBodySize({ ...requestBody, id: selected.id });

    if (!hasEmbeddedDataImages && requestBodySize > maxCommunityPostRequestSize) {
      setNotice('이미지 용량이 너무 커서 수정할 수 없습니다. 큰 이미지는 S3 직접 업로드 방식이 필요합니다.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (hasEmbeddedDataImages && authUserId) {
        setNotice('이미지를 업로드하는 중입니다...');
        const uploadedContent = await uploadEmbeddedBuildImages(cleanDraft.content, authUserId);
        const uploadDraft = {
          ...cleanDraft,
          content: uploadedContent,
        };

        postContent = composeBuildPostContent(uploadDraft);
        requestBody = createBuildPostRequestBody(uploadDraft, postContent, authUserProfile?.nickname);

        if (getRequestBodySize({ ...requestBody, id: selected.id }) > maxCommunityPostRequestSize) {
          setNotice('게시글 내용이 너무 커서 수정할 수 없습니다.');
          setIsSubmitting(false);
          return;
        }
      }

      await requestApi<string>(communityApi.editPost, {
        method: 'POST',
        body: {
          ...requestBody,
          id: selected.id,
        },
        bodyAsJson: true,
      });

      await loadCommunityData(selected.id);
      setBoardMode('detail');
      setNotice('빌드 글을 수정했습니다.');
    } catch (error) {
      handleApiError(error, '빌드 글 수정에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // 게시글 상세 보기
  async function handleSelectPost(post: BuildPost) {
    setSelectedPostId(post.id);
    setBoardMode('detail');

    try {
      // 상세 화면을 열면서 조회 기록 저장
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

  // 좋아요 변경
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
      handleApiError(error, '좋아요 상태 저장에 실패했습니다.');
    }
  }

  // 북마크 변경
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
      handleApiError(error, '북마크 상태 저장에 실패했습니다.');
    }
  }

  // 게시글 삭제
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
      setSelectedPostId(null);
      setBoardMode('list');
      setNotice('빌드 글을 삭제했습니다.');
    } catch (error) {
      handleApiError(error, '빌드 글 삭제에 실패했습니다.');
    }
  }

  // 관리자 게시글 삭제
  async function handleAdminDeletePost(post: BuildPost) {
    if (!window.confirm('관리자 권한으로 이 게시글을 삭제하시겠습니까?')) return;

    try {
      await requestApi<string>(getAdminPostPath(post.id), {
        method: 'DELETE',
      });
      setPosts((currentPosts) => currentPosts.filter((currentPost) => currentPost.id !== post.id));
      if (selectedPostId === post.id) {
        setSelectedPostId(null);
        setBoardMode('list');
      }
      setNotice('게시글이 관리자 권한으로 삭제되었습니다.');
    } catch (error) {
      handleApiError(error, '게시글 관리자 삭제에 실패했습니다.', { admin: true });
    }
  }

  // 게시글 수정 시작
  function handleStartEditPost(post: BuildPost) {
    if (!isPostAuthor(post, authUserId)) {
      setNotice('이 글을 수정할 권한이 없습니다.');
      return;
    }

    setSelectedPostId(post.id);
    setDraft(createDraftFromPost(post));
    setNotice(null);
    setBoardMode('edit');
  }

  // 게시글 신고
  function handleReportPost(post: BuildPost) {
    // TODO: Currently UI only. Connect this to the DB/API later.
    setNotice(`신고 기능은 아직 연결되지 않았습니다. "${post.title}" 글은 신고되지 않았습니다.`);
  }

  // 댓글 등록
  async function handleCreateComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = selectedPost;
    const content = commentText.trim();
    if (!selected || !content) return;

    try {
      const authUserProfile = getAuthUserProfile();
      await requestApi<string>(communityApi.addComment, {
        method: 'POST',
        body: {
          postId: selected.id,
          parentCommentId: commentParentId,
          content,
          nickname: authUserProfile?.nickname,
          authorNickname: authUserProfile?.nickname,
        },
      });
      setCommentText('');
      setCommentParentId(null);
      await loadCommunityData(selected.id);
    } catch (error) {
      handleApiError(error, '댓글 등록에 실패했습니다.');
    }
  }

  // 댓글 삭제
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
      handleApiError(error, '댓글 삭제에 실패했습니다.');
    }
  }

  // 관리자 댓글 삭제
  async function handleAdminDeleteComment(comment: BuildComment) {
    if (!window.confirm('관리자 권한으로 이 댓글을 삭제하시겠습니까?')) return;

    try {
      await requestApi<string>(getAdminCommentPath(comment.id), {
        method: 'DELETE',
      });
      setPosts((currentPosts) =>
        currentPosts.map((post) => ({
          ...post,
          comments: post.comments.filter((currentComment) => currentComment.id !== comment.id),
        })),
      );
      setNotice('댓글이 관리자 권한으로 삭제되었습니다.');
    } catch (error) {
      handleApiError(error, '댓글 관리자 삭제에 실패했습니다.', { admin: true });
    }
  }

  // 게시글 작성 페이지
  if (boardMode === 'write') {
    return (
      <BuildPostWritePage
        authorLabel={authorLabel}
        authUserId={authUserId}
        draft={draft}
        isSubmitting={isSubmitting}
        onDraftChange={updateDraft}
        onSubmit={handleCreatePost}
        onCancel={() => setBoardMode('list')}
      />
    );
  }

  // 게시글 수정 페이지
  if (boardMode === 'edit') {
    return (
      <BuildPostWritePage
        authorLabel={authorLabel}
        authUserId={authUserId}
        draft={draft}
        isSubmitting={isSubmitting}
        mode="edit"
        onDraftChange={updateDraft}
        onSubmit={handleEditPost}
        onCancel={() => setBoardMode('detail')}
      />
    );
  }

  // 게시글 상세 페이지
  if (boardMode === 'detail') {
    return (
      <section className="build-page" aria-labelledby="build-detail-page-title">
        <div className="build-page-heading">
          <div>
            <h2 id="build-detail-page-title">빌드 글</h2>
          </div>
          <button type="button" className="build-secondary-button" onClick={() => setBoardMode('list')}>
            목록으로
          </button>
        </div>

        {notice ? <p className="build-notice">{notice}</p> : null}

        {selectedPost ? (
          <BuildPostDetail
            canEdit={isPostAuthor(selectedPost, authUserId)}
            isAdmin={isAdmin}
            post={selectedPost}
            commentText={commentText}
            commentParentId={commentParentId}
            onCommentTextChange={setCommentText}
            onSetCommentParentId={setCommentParentId}
            onCreateComment={handleCreateComment}
            onAdminDeleteComment={handleAdminDeleteComment}
            onAdminDeletePost={handleAdminDeletePost}
            onDeleteComment={handleDeleteComment}
            onToggleLike={handleToggleLike}
            onToggleBookmark={handleToggleBookmark}
            onDeletePost={handleDeletePost}
            onEditPost={handleStartEditPost}
            onReportPost={handleReportPost}
          />
        ) : (
          <p className="build-empty">선택한 글을 찾을 수 없습니다.</p>
        )}
      </section>
    );
  }

  // 게시글 목록 페이지
  return (
    <section className="build-page" aria-label="빌드 공유">
      {notice ? <p className="build-notice">{notice}</p> : null}

      <div
        className="build-board-swipe-zone"
        onTouchStart={handleBoardSwipeStart}
        onTouchMove={handleBoardSwipeMove}
        onTouchEnd={handleBoardSwipeEnd}
        onTouchCancel={() => {
          boardSwipeStartRef.current = null;
        }}
      >
        <BoardCategoryTabs selectedTab={selectedBoardTab} onSelectTab={setSelectedBoardTab} />
        {selectedBoardTab === 'class-builds' ? (
          <BoardNightfarerFilter
            selectedNightfarerIndex={selectedNightfarerIndex}
            onSelectNightfarer={setSelectedNightfarerIndex}
          />
        ) : null}

        <section className="build-board-panel" aria-label="빌드 공유 글 목록">
        <BoardListToolbar
          totalCount={visiblePosts.length}
          isRefreshing={isRefreshing}
          onRefresh={() => loadCommunityData(selectedPost?.id)}
        />

        {isLoading ? (
          <p className="build-empty">빌드 글을 불러오는 중입니다.</p>
        ) : (
          <BoardPostList
            isAdmin={isAdmin}
            posts={pagedPosts}
            selectedPostId={selectedPostId}
            totalCount={visiblePosts.length}
            pageStartIndex={pageStartIndex}
            onSelectPost={handleSelectPost}
            onAdminDeletePost={handleAdminDeletePost}
            onToggleLike={handleToggleLike}
          />
        )}

        <div className="build-list-footer">
          <BoardPagination currentPage={currentPage} pageCount={pageCount} onPageChange={setCurrentPage} />
        </div>
        </section>
      </div>

      <button
        type="button"
        className="build-write-fab"
        aria-label="글쓰기"
        title="글쓰기"
        onClick={() => setBoardMode('write')}
      >
        <span aria-hidden="true">✎</span>
      </button>
    </section>
  );
}

export default BuildPage;
