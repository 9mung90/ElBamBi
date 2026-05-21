import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { nightfarers, type Nightfarer } from '../data/nightfarers';
import {
  getStorageErrorMessage,
  listRelicPresets,
  listRelics,
  type RelicPreset,
  type RelicPresetSlotInput,
  type StoredRelic,
  type StoredRelicOption,
} from '../api/storageApi';
import { getApiErrorMessage } from '../api/apiError';
import ResponsiveSelect from '../components/ResponsiveSelect';
import {
  accessTokenStorageKey,
  authNicknameStorageKey,
  authNicknameUserIdStorageKey,
  authUserIdStorageKey,
  clearAuthStorage,
  getAccessTokenPayload,
  isAccessTokenExpired,
} from '../api/authToken';
import {
  relicEffectsKo,
  relicItemColorMap,
  relicRollAppData,
  relics,
  type RelicRollEffect,
} from '../data/relics';
import { vessels, type Vessel } from '../data/vessels';
import './BuildPage.css';

type WritableBuildPostCategory = 'Class Builds' | 'Strategy' | 'Questions' | 'Free Board';
type BoardTabId = 'all' | 'popular' | 'class-builds' | 'strategy' | 'questions' | 'free-board';
type SortKey = 'latest' | 'popular' | 'views';
type BoardMode = 'detail' | 'edit' | 'list' | 'write';
type AuthRole = 'USER' | 'ADMIN';

const nightAssetUrls = import.meta.glob('../assets/images/night/**/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

const nightAssetUrlsByLower = new Map(
  Object.entries(nightAssetUrls).map(([path, url]) => [path.toLowerCase(), url]),
);

const relicItemColorById = new Map(relicItemColorMap.map((entry) => [entry.itemId, entry]));
const relicEffectById = new Map(relicEffectsKo.map((effect) => [String(effect.id), effect]));
const relicCatalogById = new Map(relics.map((relic) => [relic.id, relic]));
const relicRollEffectById = new Map<string, RelicRollEffect>();
const relicRollDebuffById = new Map<string, RelicRollEffect>();

for (const mode of Object.values(relicRollAppData.modes)) {
  for (const effect of mode.effects) {
    relicRollEffectById.set(String(effect.id), effect);
  }
}

for (const debuffTable of Object.values(relicRollAppData.debuffTables)) {
  for (const effect of debuffTable.effects) {
    relicRollDebuffById.set(String(effect.id), effect);
  }
}

type BuildImage = {
  id: string;
  postId: string;
  imageUrl: string;
};

type BuildComment = {
  id: string;
  postId: string;
  userId: string;
  authorNickname: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

type BuildPost = {
  id: string;
  userId: string;
  authorNickname: string;
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
  preset: BuildPostPreset | null;
};

type PresetSlotRelics = Array<string | null>;

type BuildPostPreset = {
  preset: RelicPreset;
  storedRelics: StoredRelic[];
};

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

const defaultApiBaseUrl = 'https://k9e297bszl.execute-api.ap-northeast-2.amazonaws.com';
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl).replace(/\/$/, '');
const postsPerPage = 15;
const EMPTY_PRESET_SLOTS: PresetSlotRelics = [null, null, null, null, null, null];
const EMPTY_EFFECT_ID = 0xffffffff;
const buildPostPresetMarkerPrefix = '[[NIGHTREIGN_BUILD_PRESET:';
const buildPostPresetMarkerSuffix = ']]';
const maxBuildContentImageCount = 10;
const maxBuildContentImageSize = 20 * 1024 * 1024;
const maxCommunityPostRequestSize = 9 * 1024 * 1024;
const allowedBuildImageTypes = new Set([
  'image/avif',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
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
  const directNickname =
    getString(value.authorNickname) ||
    getString(value.nickname) ||
    getString(value.userNickname) ||
    getString(value.writerNickname) ||
    getString(value.memberNickname);

  if (directNickname) return directNickname;

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

function resolveNightAssetUrl(url: string) {
  if (!url.startsWith('/assets/images/night/')) return url;

  const assetPath = url.replace('/assets/images/night/', '../assets/images/night/');
  return nightAssetUrls[assetPath] ?? nightAssetUrlsByLower.get(assetPath.toLowerCase()) ?? url;
}

function getNightfarerIconUrl(nightfarer: Nightfarer) {
  return resolveNightAssetUrl(nightfarer.nameImageUrl);
}

function normalizeRelicColor(color: string | undefined) {
  return (color ?? '').trim().toLowerCase();
}

function getRelicColorLabel(color: string | undefined) {
  const labels: Record<string, string> = {
    red: '빨강',
    blue: '파랑',
    yellow: '노랑',
    green: '초록',
    white: '자유',
    builder: '제작',
  };
  const normalizedColor = normalizeRelicColor(color);

  return labels[normalizedColor] ?? color ?? '-';
}

function getRelicColorClass(color: string | undefined) {
  const normalizedColor = normalizeRelicColor(color);
  return normalizedColor ? `relic-color-${normalizedColor}` : '';
}

function splitPresetList(value: string | undefined) {
  if (!value) return [];

  return value
    .split(/[|/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getVesselColors(vessel: Vessel | undefined, colorMode: 'normal' | 'deep') {
  if (!vessel) return [];

  return splitPresetList(colorMode === 'deep' ? vessel.deepRelicColors : vessel.relicColors);
}

function getPresetVesselSlotColors(vessel: Vessel | undefined) {
  return [...getVesselColors(vessel, 'normal'), ...getVesselColors(vessel, 'deep')];
}

function getPresetVessel(vesselIndex: number) {
  return vessels.find((vessel) => vessel.index === vesselIndex);
}

function getPresetNightfarer(characterName: string) {
  return nightfarers.find((nightfarer) => nightfarer.name === characterName);
}

function getSavedPresetSlots(slots: RelicPresetSlotInput[]) {
  const slotsByIndex = new Map(slots.map((slot) => [slot.slotIndex, slot]));

  return EMPTY_PRESET_SLOTS.map((_, slotIndex) => slotsByIndex.get(slotIndex) ?? null);
}

function getRelicNameByItemId(itemId: number) {
  return relicItemColorById.get(itemId)?.name ?? relicCatalogById.get(itemId)?.name ?? `유물 ${itemId}`;
}

function getRelicColorByItemId(itemId: number) {
  return relicItemColorById.get(itemId)?.color ?? relicCatalogById.get(itemId)?.color ?? '';
}

function shouldIncludePresetDebuffs(slotIndex: number) {
  return slotIndex >= 3;
}

function isUsableEffectId(effectId: number) {
  return effectId !== EMPTY_EFFECT_ID && effectId !== -1;
}

function toPresetRelicOption(effectId: number, slotIndex: number): StoredRelicOption | null {
  if (!isUsableEffectId(effectId)) return null;

  const relicEffect = relicEffectById.get(String(effectId));
  const rollEffect = relicRollEffectById.get(String(effectId));
  const debuffEffect = relicRollDebuffById.get(String(effectId));
  const effect = rollEffect ?? debuffEffect;

  return {
    slot: slotIndex + 1,
    effectId,
    ...(effect?.key ? { effectKey: effect.key } : {}),
    name: relicEffect?.name ?? effect?.effect_kor ?? effect?.effect ?? `효과 ${effectId}`,
    detail: relicEffect?.desc ?? effect?.effect_detail_kor ?? '',
  };
}

function getSavePresetSlotOptionGroups(effectIds: number[], includeDebuffs = true) {
  return [1, 2, 3]
    .map((slot) => {
      const option = toPresetRelicOption(effectIds[slot - 1] ?? EMPTY_EFFECT_ID, slot - 1);
      const debuff = includeDebuffs
        ? toPresetRelicOption(effectIds[slot + 2] ?? EMPTY_EFFECT_ID, slot - 1)
        : null;

      if (!option && !debuff) return null;

      return { slot, option, debuff };
    })
    .filter((group): group is NonNullable<typeof group> => Boolean(group));
}

function getStoredRelicOptionGroups(relic: StoredRelic, includeDebuffs = true) {
  return [1, 2, 3]
    .map((slot) => {
      const option = relic.options.find((candidate) => candidate.slot === slot);
      const debuff = includeDebuffs
        ? relic.debuffs?.find((candidate) => candidate.slot === slot)
        : undefined;

      if (!option && !debuff) return null;

      return { slot, option, debuff };
    })
    .filter((group): group is NonNullable<typeof group> => Boolean(group));
}

function getPresetSlotOptionGroups(slot: RelicPresetSlotInput, relicsById: Map<string, StoredRelic>) {
  const storedRelic = slot.relicRefType === 'stored' ? relicsById.get(slot.relicId) : undefined;
  const includeDebuffs = shouldIncludePresetDebuffs(slot.slotIndex);

  if (slot.relicRefType === 'stored' && storedRelic) {
    return getStoredRelicOptionGroups(storedRelic, includeDebuffs);
  }

  if (slot.relicRefType === 'save') {
    return getSavePresetSlotOptionGroups(slot.effectIds, includeDebuffs);
  }

  return [];
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
    const accessToken = localStorage.getItem(accessTokenStorageKey);
    if (!accessToken) return null;
    if (isAccessTokenExpired(accessToken)) {
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

  if (!accessToken) {
    if (storedUserId && storedNickname && storedNicknameUserId === storedUserId) {
      return { nickname: storedNickname, userId: storedUserId };
    }

    return null;
  }

  const payload = getAccessTokenPayload(accessToken);
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

function applyCurrentUserNickname(posts: BuildPost[], authUserProfile: AuthUserProfile | null) {
  if (!authUserProfile) return posts;

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

function createBuildPostPreset(preset: RelicPreset, relicsById: Map<string, StoredRelic>): BuildPostPreset {
  const storedRelicIds = preset.slots
    .filter((slot): slot is Extract<RelicPresetSlotInput, { relicRefType: 'stored' }> => slot.relicRefType === 'stored')
    .map((slot) => slot.relicId);

  return {
    preset,
    storedRelics: Array.from(new Set(storedRelicIds))
      .map((relicId) => relicsById.get(relicId))
      .filter((relic): relic is StoredRelic => Boolean(relic)),
  };
}

function encodeBuildPostPreset(preset: BuildPostPreset) {
  return `${buildPostPresetMarkerPrefix}${btoa(encodeURIComponent(JSON.stringify(preset)))}${buildPostPresetMarkerSuffix}`;
}

function decodeBuildPostPreset(value: string): BuildPostPreset | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(value))) as BuildPostPreset;
    if (!parsed?.preset?.presetId || !Array.isArray(parsed.preset.slots)) return null;
    return {
      preset: parsed.preset,
      storedRelics: Array.isArray(parsed.storedRelics) ? parsed.storedRelics : [],
    };
  } catch {
    return null;
  }
}

function decodeBuildPostPresetJson(value: string): BuildPostPreset | null {
  try {
    const parsed = JSON.parse(value) as BuildPostPreset;
    if (!parsed?.preset?.presetId || !Array.isArray(parsed.preset.slots)) return null;
    return {
      preset: parsed.preset,
      storedRelics: Array.isArray(parsed.storedRelics) ? parsed.storedRelics : [],
    };
  } catch {
    return null;
  }
}

function getBuildPostContentParts(content: string) {
  if (!content.startsWith(buildPostPresetMarkerPrefix)) {
    return { preset: null as BuildPostPreset | null, content };
  }

  const markerEndIndex = content.indexOf(buildPostPresetMarkerSuffix, buildPostPresetMarkerPrefix.length);
  if (markerEndIndex === -1) {
    return { preset: null as BuildPostPreset | null, content };
  }

  const encodedPreset = content.slice(buildPostPresetMarkerPrefix.length, markerEndIndex);
  const preset = decodeBuildPostPreset(encodedPreset);
  if (!preset) {
    return { preset: null as BuildPostPreset | null, content };
  }

  return {
    preset,
    content: content.slice(markerEndIndex + buildPostPresetMarkerSuffix.length).replace(/^\r?\n/, ''),
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getBuildContentText(content: string) {
  if (typeof document === 'undefined') return content;

  const container = document.createElement('div');
  container.innerHTML = content;
  return container.textContent ?? '';
}

function getBuildContentImageCount(content: string) {
  if (typeof document === 'undefined') return 0;

  const container = document.createElement('div');
  container.innerHTML = content;
  return container.querySelectorAll('img').length;
}

function getDataUrlSizeBytes(src: string) {
  const base64Match = src.match(/^data:[^;]+;base64,(.*)$/);
  if (!base64Match) return null;

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

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: contentType });
}

function getBuildContentImages(content: string): BuildContentImagePayload[] {
  if (typeof document === 'undefined') return [];

  const container = document.createElement('div');
  container.innerHTML = content;

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

function sanitizeBuildPostHtml(content: string) {
  if (typeof document === 'undefined') return escapeHtml(content);

  const template = document.createElement('template');
  template.innerHTML = content;
  const allowedTags = new Set(['B', 'BR', 'DIV', 'EM', 'FIGCAPTION', 'FIGURE', 'I', 'IMG', 'LI', 'OL', 'P', 'SPAN', 'STRONG', 'U', 'UL']);

  function cleanNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) return;

    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.parentNode?.removeChild(node);
      return;
    }

    const element = node as HTMLElement;
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(document.createTextNode(element.textContent ?? ''));
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || name === 'style') {
        element.removeAttribute(attribute.name);
      }
    });

    if (element.tagName === 'IMG') {
      const image = element as HTMLImageElement;
      const src = image.getAttribute('src') ?? '';
      const isAllowedSrc = src.startsWith('data:image/') || src.startsWith('blob:') || src.startsWith('http://') || src.startsWith('https://');

      if (!isAllowedSrc) {
        image.remove();
        return;
      }

      Array.from(image.attributes).forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        if (!['alt', 'class', 'src'].includes(name)) {
          image.removeAttribute(attribute.name);
        }
      });
      image.classList.add('build-content-image');
    }

    Array.from(element.childNodes).forEach(cleanNode);
  }

  Array.from(template.content.childNodes).forEach(cleanNode);
  return template.innerHTML.trim();
}

function composeBuildPostContent(draft: BuildPostDraft) {
  const cleanContent = sanitizeBuildPostHtml(draft.content);
  if (!draft.preset) return cleanContent;

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

async function uploadEmbeddedBuildImages(content: string, userId: string) {
  if (typeof document === 'undefined') return content;

  const template = document.createElement('template');
  template.innerHTML = sanitizeBuildPostHtml(content);
  const images = Array.from(template.content.querySelectorAll('img')).filter((image) =>
    (image.getAttribute('src') ?? '').startsWith('data:image/'),
  );

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

function getCategoryLabel(category: string) {
  const cleanCategory = category.trim();
  const normalizedCategory = legacyCategoryLabels[cleanCategory] ?? cleanCategory;
  return categoryDisplayLabels[normalizedCategory] ?? categoryDisplayLabels[cleanCategory] ?? (normalizedCategory || '캐릭터 빌드');
}

function getWritableCategory(category: string): WritableBuildPostCategory {
  const normalizedCategory = legacyCategoryLabels[category.trim()] ?? category.trim();
  return writeCategories.includes(normalizedCategory as WritableBuildPostCategory)
    ? (normalizedCategory as WritableBuildPostCategory)
    : 'Free Board';
}

function getAuthorLabel(userId: string, nickname = '') {
  const cleanNickname = nickname.trim();
  if (cleanNickname) return cleanNickname;
  return userId ? `사용자 #${userId}` : '알 수 없음';
}

function getCommentById(comments: BuildComment[], commentId: string | null) {
  if (!commentId) return null;
  return comments.find((comment) => comment.id === commentId) ?? null;
}

function getReplyMention(comment: BuildComment, comments: BuildComment[]) {
  const parentComment = getCommentById(comments, comment.parentCommentId);
  if (!parentComment) return '';
  return `@${getAuthorLabel(parentComment.userId, parentComment.authorNickname)}`;
}

function getPostNightfarer(post: BuildPost) {
  // TODO: Currently UI only. Connect this to the DB/API later.
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

  return [
    post.title,
    getSearchableBuildContent(post.content),
    getCategoryLabel(post.category),
    post.category,
    getAuthorLabel(post.userId, post.authorNickname),
  ].some((value) => String(value).toLowerCase().includes(normalizedQuery));
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

async function findCreatedPostId(draft: CreatedPostLookupDraft) {
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
        <ResponsiveSelect
          value={sortKey}
          ariaLabel="정렬"
          sheetTitle="정렬 선택"
          options={[
            { value: 'latest', label: '최신순' },
            { value: 'popular', label: '인기순' },
            { value: 'views', label: '조회순' },
          ]}
          onChange={(nextSortKey) => onSortChange(nextSortKey as SortKey)}
        />
      </label>

      <span className="build-board-count">글 {totalCount}개</span>
      <button type="button" className="build-secondary-button" onClick={onRefresh}>
        {isRefreshing ? '새로고침 중' : '새로고침'}
      </button>
    </div>
  );
}

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

function BuildPresetVesselPreview({ vessel }: { vessel: Vessel | undefined }) {
  const slotColors = getPresetVesselSlotColors(vessel);

  return (
    <div className="saved-preset-vessel-preview">
      <div className="saved-preset-vessel-colors" aria-hidden="true">
        {slotColors.slice(0, 6).map((color, colorIndex) => (
          <span
            key={`${color}-${colorIndex}`}
            className={`relic-preset-color-dot ${getRelicColorClass(color)}${colorIndex === 3 ? ' is-deep-start' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}

function BuildPresetOptionList({
  optionGroups,
}: {
  optionGroups: ReturnType<typeof getPresetSlotOptionGroups>;
}) {
  if (!optionGroups.length) {
    return <em>옵션 정보 없음</em>;
  }

  return (
    <ol className="relic-preset-summary-options">
      {optionGroups.map((group) => (
        <li key={group.slot}>
          <span>{group.slot}</span>
          <div>
            {group.option ? <strong>{group.option.name}</strong> : null}
            {group.option?.detail ? <p>{group.option.detail}</p> : null}
            {group.debuff ? (
              <div className="relic-builder-result-debuff">
                <em>디버프</em>
                <strong>{group.debuff.name}</strong>
                {group.debuff.detail ? <p>{group.debuff.detail}</p> : null}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function BuildPresetSlotSummary({
  hideRelicSource = false,
  onSelect,
  relicsById,
  slot,
  slotIndex,
}: {
  hideRelicSource?: boolean;
  onSelect: () => void;
  relicsById: Map<string, StoredRelic>;
  slot: RelicPresetSlotInput | null;
  slotIndex: number;
}) {
  if (!slot) {
    return <li className="saved-preset-slot is-empty" aria-label={`empty slot ${slotIndex + 1}`} />;
  }

  const storedRelic = slot.relicRefType === 'stored' ? relicsById.get(slot.relicId) : undefined;
  const relicName =
    slot.relicRefType === 'stored'
      ? storedRelic?.itemName ?? `저장 유물 ${slot.relicId}`
      : getRelicNameByItemId(slot.itemId);
  const relicColor =
    slot.relicRefType === 'stored' ? storedRelic?.color ?? '' : getRelicColorByItemId(slot.itemId);

  return (
    <li
      className="saved-preset-slot"
      role="button"
      tabIndex={0}
      aria-label={`${relicName} 옵션 상세`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <span>{slot.slotIndex + 1}</span>
      <div>
        <div className="relic-preset-summary-top">
          <strong className={getRelicColorClass(relicColor)}>{getRelicColorLabel(relicColor)}</strong>
          {hideRelicSource ? null : <em>{slot.relicRefType === 'stored' ? '저장 유물' : '세이브 유물'}</em>}
        </div>
        <p>{relicName}</p>
      </div>
    </li>
  );
}

function BuildPresetCard({
  hideRelicSource = false,
  onSelectPreset,
  onSelectSlot,
  preset,
  relicsById,
}: {
  hideRelicSource?: boolean;
  onSelectPreset?: (preset: RelicPreset) => void;
  onSelectSlot?: (preset: RelicPreset, slotIndex: number) => void;
  preset: RelicPreset;
  relicsById: Map<string, StoredRelic>;
}) {
  const nightfarer = getPresetNightfarer(preset.characterName);
  const nightfarerIconUrl = nightfarer ? getNightfarerIconUrl(nightfarer) : undefined;
  const vessel = getPresetVessel(preset.vesselIndex);

  return (
    <article
      className={`option-card saved-preset-card build-preset-card${onSelectPreset ? ' is-selectable' : ''}`}
      role={onSelectPreset ? 'button' : undefined}
      tabIndex={onSelectPreset ? 0 : undefined}
      onClick={onSelectPreset ? () => onSelectPreset(preset) : undefined}
      onKeyDown={(event) => {
        if (!onSelectPreset || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onSelectPreset(preset);
      }}
    >
      <div className="saved-preset-card-top">
        <div className="saved-preset-character-icon">
          {nightfarerIconUrl ? <img src={nightfarerIconUrl} alt="" aria-hidden="true" /> : null}
        </div>
        <div className="saved-preset-card-heading">
          <h3>{preset.name}</h3>
        </div>
        <BuildPresetVesselPreview vessel={vessel} />
      </div>
      <ol className="relic-builder-result-list saved-preset-slot-list">
        {getSavedPresetSlots(preset.slots).map((slot, slotIndex) => (
          <BuildPresetSlotSummary
            key={`${preset.presetId}-${slotIndex}`}
            hideRelicSource={hideRelicSource}
            onSelect={() => (onSelectSlot ? onSelectSlot(preset, slotIndex) : onSelectPreset?.(preset))}
            relicsById={relicsById}
            slot={slot}
            slotIndex={slotIndex}
          />
        ))}
      </ol>
    </article>
  );
}

function BuildPostPresetBlock({
  embeddedPreset,
  onRemove,
}: {
  embeddedPreset: BuildPostPreset;
  onRemove?: () => void;
}) {
  const [activePresetSlotKey, setActivePresetSlotKey] = useState<string | null>(null);
  const relicsById = useMemo(
    () => new Map(embeddedPreset.storedRelics.map((relic) => [relic.relicId, relic])),
    [embeddedPreset.storedRelics],
  );
  const activePresetSlot = useMemo(() => {
    if (!activePresetSlotKey) return null;

    const savedSlots = getSavedPresetSlots(embeddedPreset.preset.slots);
    return (
      savedSlots.find(
        (slot, slotIndex) => slot && activePresetSlotKey === `${embeddedPreset.preset.presetId}-${slotIndex}`,
      ) ?? null
    );
  }, [activePresetSlotKey, embeddedPreset.preset]);
  const activePresetSlotOptionGroups = useMemo(
    () => (activePresetSlot ? getPresetSlotOptionGroups(activePresetSlot, relicsById) : []),
    [activePresetSlot, relicsById],
  );

  useEffect(() => {
    if (!activePresetSlotKey) return undefined;

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setActivePresetSlotKey(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePresetSlotKey]);

  return (
    <section className="build-inserted-preset">
      <div className="build-inserted-preset-heading">
        <strong>선택한 프리셋</strong>
        {onRemove ? (
          <button
            type="button"
            className="build-secondary-button is-danger"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            삭제
          </button>
        ) : null}
      </div>
      <BuildPresetCard
        onSelectSlot={(preset, slotIndex) => setActivePresetSlotKey(`${preset.presetId}-${slotIndex}`)}
        preset={embeddedPreset.preset}
        relicsById={relicsById}
      />

      {activePresetSlot ? (
        <div
          className="saved-preset-modal-overlay"
          role="presentation"
          onClick={() => setActivePresetSlotKey(null)}
        >
          <div
            className="saved-preset-modal"
            role="dialog"
            aria-modal="true"
            aria-label="유물 옵션 상세"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="saved-preset-modal-close"
              aria-label="닫기"
              onClick={() => setActivePresetSlotKey(null)}
            >
              x
            </button>
            <BuildPresetOptionList optionGroups={activePresetSlotOptionGroups} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function BuildPresetInsertSection({
  authUserId,
  onSelectPreset,
}: {
  authUserId: string | null;
  onSelectPreset: (preset: BuildPostPreset) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [presets, setPresets] = useState<RelicPreset[]>([]);
  const [storedRelics, setStoredRelics] = useState<StoredRelic[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  const [presetNotice, setPresetNotice] = useState<string | null>(null);
  const relicsById = useMemo(
    () => new Map(storedRelics.map((relic) => [relic.relicId, relic])),
    [storedRelics],
  );

  useEffect(() => {
    if (!isOpen) return undefined;

    let isCurrentRequest = true;

    if (!authUserId) {
      setPresets([]);
      setStoredRelics([]);
      setPresetNotice('로그인 후 저장된 프리셋을 불러올 수 있습니다.');
      return () => {
        isCurrentRequest = false;
      };
    }

    setIsLoadingPresets(true);
    setPresetNotice(null);

    Promise.all([listRelicPresets(authUserId), listRelics(authUserId, 'all')])
      .then(([nextPresets, nextRelics]) => {
        if (!isCurrentRequest) return;

        setPresets(Array.isArray(nextPresets) ? nextPresets : []);
        setStoredRelics(Array.isArray(nextRelics) ? nextRelics : []);
      })
      .catch((error) => {
        if (!isCurrentRequest) return;

        setPresets([]);
        setStoredRelics([]);
        setPresetNotice(getStorageErrorMessage(error, '저장된 프리셋을 불러오지 못했습니다.'));
      })
      .finally(() => {
        if (isCurrentRequest) setIsLoadingPresets(false);
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [authUserId, isOpen]);

  return (
    <section className="build-preset-insert">
      <button
        type="button"
        className="build-secondary-button build-preset-insert-button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
      >
        {isOpen ? '프리셋 닫기' : '프리셋 넣기'}
      </button>

      {isOpen ? (
        <div className="build-preset-insert-panel">
          <div className="build-preset-insert-heading">
            <strong>저장된 프리셋 보기</strong>
            <span>{presets.length}개</span>
          </div>
          {presetNotice ? <p className="build-notice">{presetNotice}</p> : null}
          {isLoadingPresets ? <p className="build-preset-muted">저장된 프리셋을 불러오는 중...</p> : null}
          {!isLoadingPresets && !presetNotice && !presets.length ? (
            <p className="build-preset-muted">저장된 프리셋이 없습니다.</p>
          ) : null}
          {presets.length ? (
            <div className="saved-preset-grid build-preset-grid">
              {presets.map((preset) => (
                <BuildPresetCard
                  key={preset.presetId}
                  hideRelicSource
                  onSelectPreset={(selectedPreset) => {
                    onSelectPreset(createBuildPostPreset(selectedPreset, relicsById));
                    setIsOpen(false);
                  }}
                  preset={preset}
                  relicsById={relicsById}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

    </section>
  );
}

function BuildRichContentEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastSelectionRef = useRef<Range | null>(null);
  const [imageNotice, setImageNotice] = useState<string | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor || editor.innerHTML === value) return;
    editor.innerHTML = value;
  }, [value]);

  function saveSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      lastSelectionRef.current = range.cloneRange();
    }
  }

  function syncEditorContent() {
    const editor = editorRef.current;
    if (!editor) return;
    onChange(editor.innerHTML);
  }

  function restoreSelection() {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();

    if (lastSelectionRef.current) {
      selection?.addRange(lastSelectionRef.current);
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection?.addRange(range);
  }

  function insertImage(dataUrl: string, file: File) {
    const editor = editorRef.current;
    if (!editor) return;

    restoreSelection();

    const image = document.createElement('img');
    image.src = dataUrl;
    image.alt = file.name;
    image.className = 'build-content-image';

    const wrapper = document.createElement('figure');
    wrapper.className = 'build-content-image-block';
    wrapper.appendChild(image);

    const spacer = document.createElement('div');
    spacer.appendChild(document.createElement('br'));

    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (range) {
      range.deleteContents();
      range.insertNode(spacer);
      range.insertNode(wrapper);
      range.setStartAfter(spacer);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } else {
      editor.append(wrapper, spacer);
    }

    saveSelection();
    syncEditorContent();
  }

  function readImageFile(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('파일을 읽지 못했습니다.'));
      };
      reader.onerror = () => reject(reader.error ?? new Error('파일을 읽지 못했습니다.'));
      reader.readAsDataURL(file);
    });
  }

  async function handleImageFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;

    const currentImageCount = getBuildContentImageCount(editorRef.current?.innerHTML ?? value);
    const remainingImageCount = maxBuildContentImageCount - currentImageCount;
    const acceptedFiles: File[] = [];
    const rejectedMessages: string[] = [];

    if (remainingImageCount <= 0) {
      setImageNotice(`이미지는 최대 ${maxBuildContentImageCount}개까지 넣을 수 있습니다.`);
      return;
    }

    for (const file of files) {
      if (acceptedFiles.length >= remainingImageCount) {
        rejectedMessages.push(`최대 ${maxBuildContentImageCount}개까지만 추가됩니다.`);
        break;
      }

      if (!file.type.startsWith('image/') || !allowedBuildImageTypes.has(file.type)) {
        rejectedMessages.push(`${file.name}: 지원하지 않는 이미지 형식입니다.`);
        continue;
      }

      if (file.size > maxBuildContentImageSize) {
        rejectedMessages.push(`${file.name}: 20MB를 넘는 이미지는 넣을 수 없습니다.`);
        continue;
      }

      acceptedFiles.push(file);
    }

    try {
      for (const file of acceptedFiles) {
        const dataUrl = await readImageFile(file);
        insertImage(dataUrl, file);
      }
      setImageNotice(rejectedMessages[0] ?? null);
    } catch {
      setImageNotice('이미지를 본문에 넣지 못했습니다.');
    }
  }

  return (
    <div className="build-rich-editor">
      <div className="build-editor-toolbar">
        <button
          type="button"
          className="build-secondary-button"
          onMouseDown={saveSelection}
          onClick={() => fileInputRef.current?.click()}
        >
          이미지 넣기
        </button>
        <span>webp, gif, png, jpg 등 이미지/움짤 최대 20MB, 최대 10개</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/avif,image/bmp,image/gif,image/jpeg,image/png,image/webp"
          multiple
          onChange={handleImageFiles}
        />
      </div>
      {imageNotice ? <p className="build-preset-muted">{imageNotice}</p> : null}
      <div
        ref={editorRef}
        id="build-post-content"
        className="build-content-editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="내용"
        data-placeholder="장비, 유물 옵션, 운용법, 루트, 보스별 팁을 적어주세요."
        onBlur={saveSelection}
        onClick={saveSelection}
        onInput={syncEditorContent}
        onKeyUp={saveSelection}
      />
    </div>
  );
}

function BuildPostContent({ content }: { content: string }) {
  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(content);
  const sanitizedContent = useMemo(() => (hasHtml ? sanitizeBuildPostHtml(content) : content), [content, hasHtml]);

  if (!sanitizedContent) return null;

  if (!hasHtml) {
    return <p className="build-detail-content">{sanitizedContent}</p>;
  }

  return <div className="build-detail-content" dangerouslySetInnerHTML={{ __html: sanitizedContent }} />;
}

function BuildPostWritePage({
  authorLabel,
  authUserId,
  draft,
  isSubmitting,
  mode = 'create',
  onDraftChange,
  onSubmit,
  onCancel,
}: {
  authorLabel: string;
  authUserId: string | null;
  draft: BuildPostDraft;
  isSubmitting: boolean;
  mode?: 'create' | 'edit';
  onDraftChange: <K extends keyof BuildPostDraft>(key: K, value: BuildPostDraft[K]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const isEdit = mode === 'edit';

  return (
    <section className="build-page build-write-page" aria-labelledby="build-write-title">
      <div className="build-page-heading">
        <div>
          <p className="list-page-kicker">커뮤니티</p>
          <h2 id="build-write-title">{isEdit ? '글 수정' : '글쓰기'}</h2>
        </div>
        <button type="button" className="build-secondary-button" onClick={onCancel}>
          {isEdit ? '글로 돌아가기' : '게시판으로 돌아가기'}
        </button>
      </div>

      <form className="build-write-form" onSubmit={onSubmit}>
        <p className="build-session-note">작성자: {authorLabel}</p>
        <label>
          카테고리
          <ResponsiveSelect
            value={draft.category}
            ariaLabel="카테고리"
            sheetTitle="카테고리 선택"
            options={writeCategories.map((category) => ({
              value: category,
              label: getCategoryLabel(category),
            }))}
            onChange={(nextCategory) => onDraftChange('category', nextCategory as WritableBuildPostCategory)}
          />
        </label>
        <label>
          캐릭터
          {/* TODO: Currently UI only. Connect this form to the DB/API later. */}
          <ResponsiveSelect
            value={draft.nightfarerIndex == null ? '' : String(draft.nightfarerIndex)}
            ariaLabel="캐릭터"
            sheetTitle="캐릭터 선택"
            options={[
              { value: '', label: '선택 안 함' },
              ...nightfarers.map((nightfarer) => ({
                value: String(nightfarer.index),
                label: nightfarer.name,
              })),
            ]}
            onChange={(nextNightfarerIndex) =>
              onDraftChange('nightfarerIndex', nextNightfarerIndex === '' ? null : Number(nextNightfarerIndex))
            }
          />
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
        <div className="build-write-field">
          <label htmlFor="build-post-content">내용</label>
          {draft.preset ? (
            <BuildPostPresetBlock
              embeddedPreset={draft.preset}
              onRemove={() => onDraftChange('preset', null)}
            />
          ) : null}
          <BuildRichContentEditor value={draft.content} onChange={(content) => onDraftChange('content', content)} />
        </div>
        <BuildPresetInsertSection authUserId={authUserId} onSelectPreset={(preset) => onDraftChange('preset', preset)} />

        <div className="build-write-actions">
          <button type="button" className="build-secondary-button" onClick={onCancel}>
            취소
          </button>
          <button type="submit" className="build-primary-button" disabled={isSubmitting}>
            {isSubmitting ? (isEdit ? '저장 중' : '등록 중') : isEdit ? '저장' : '등록'}
          </button>
        </div>
      </form>
    </section>
  );
}

function BuildPostDetail({
  canEdit,
  isAdmin,
  post,
  commentText,
  commentParentId,
  onCommentTextChange,
  onSetCommentParentId,
  onCreateComment,
  onAdminDeleteComment,
  onAdminDeletePost,
  onDeleteComment,
  onToggleLike,
  onToggleBookmark,
  onDeletePost,
  onEditPost,
  onReportPost,
}: {
  canEdit: boolean;
  isAdmin: boolean;
  post: BuildPost;
  commentText: string;
  commentParentId: string | null;
  onCommentTextChange: (value: string) => void;
  onSetCommentParentId: (commentId: string | null) => void;
  onCreateComment: (event: FormEvent<HTMLFormElement>) => void;
  onAdminDeleteComment: (comment: BuildComment) => void;
  onAdminDeletePost: (post: BuildPost) => void;
  onDeleteComment: (comment: BuildComment) => void;
  onToggleLike: (post: BuildPost) => void;
  onToggleBookmark: (post: BuildPost) => void;
  onDeletePost: (post: BuildPost) => void;
  onEditPost: (post: BuildPost) => void;
  onReportPost: (post: BuildPost) => void;
}) {
  const contentParts = useMemo(() => getBuildPostContentParts(post.content), [post.content]);
  const replyTargetComment = getCommentById(post.comments, commentParentId);

  return (
    <article className="build-post-detail" aria-label="선택한 빌드 글">
      <div className="build-detail-heading">
        <div className="build-detail-title">
          <span className="build-category-badge">{getCategoryLabel(post.category)}</span>
          <h3>{post.title}</h3>
        </div>
        <div className="build-post-meta">
          <span>{getAuthorLabel(post.userId, post.authorNickname)}</span>
          <span>조회 {post.viewCount}</span>
          <span>추천 {post.likeCount}</span>
          <span>댓글 {post.comments.length}</span>
          <span>{formatDate(post.createdAt)}</span>
        </div>
        <div className="build-detail-tools">
          {canEdit ? (
            <button type="button" onClick={() => onEditPost(post)}>
              수정
            </button>
          ) : null}
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
          {isAdmin ? (
            <button type="button" className="is-danger" onClick={() => onAdminDeletePost(post)}>
              관리자 삭제
            </button>
          ) : null}
        </div>
      </div>

      {post.images.length ? (
        <div className="build-image-grid">
          {post.images.map((image) => (
            <img key={`${image.id}-${image.imageUrl}`} src={image.imageUrl} alt={`${post.title} 이미지`} />
          ))}
        </div>
      ) : null}

      {contentParts.preset ? <BuildPostPresetBlock embeddedPreset={contentParts.preset} /> : null}
      <BuildPostContent content={contentParts.content} />

      <section className="build-comments" aria-label="댓글">
        <div className="build-comments-heading">
          <strong>댓글 {post.comments.length}</strong>
        </div>

        {post.comments.length ? (
          post.comments.map((comment) => {
            const replyMention = getReplyMention(comment, post.comments);

            return (
              <div key={comment.id} className={`build-comment${comment.parentCommentId ? ' is-reply' : ''}`}>
                <div>
                  <strong>{getAuthorLabel(comment.userId, comment.authorNickname)}</strong>
                  <span>{formatDate(comment.createdAt)}</span>
                </div>
                <p>
                  {replyMention ? <span className="build-reply-mention">{replyMention}</span> : null}
                  {comment.content}
                </p>
                <div className="build-comment-actions">
                  <button type="button" onClick={() => onSetCommentParentId(comment.id)}>
                    답글
                  </button>
                  <button type="button" className="is-danger" onClick={() => onDeleteComment(comment)}>
                    삭제
                  </button>
                  {isAdmin ? (
                    <button type="button" className="is-danger" onClick={() => onAdminDeleteComment(comment)}>
                      관리자 삭제
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <p className="build-empty">아직 댓글이 없습니다.</p>
        )}

        <form className="build-comment-form" onSubmit={onCreateComment}>
          {commentParentId ? (
            <div className="build-reply-target">
              <span>
                답글 대상: {replyTargetComment ? `@${getAuthorLabel(replyTargetComment.userId, replyTargetComment.authorNickname)}` : `댓글 #${commentParentId}`}
              </span>
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

function BuildPage({
  authRole,
  authUserId,
  focusPostId,
  onLoginRequired,
  searchQuery,
}: {
  authRole?: AuthRole;
  authUserId: string | null;
  focusPostId?: string | null;
  onLoginRequired?: () => void;
  searchQuery: string;
}) {
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
    preset: null,
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
    loadCommunityData(focusPostId);
    if (focusPostId) {
      setBoardMode('detail');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPostId]);

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
  const selectedPost = selectedPostId ? posts.find((post) => post.id === selectedPostId) ?? null : null;
  const isAdmin = authRole === 'ADMIN';
  const authUserProfile = getAuthUserProfile();
  const authorLabel = authUserProfile?.nickname ?? (authUserId ? getAuthorLabel(authUserId) : '로그인 필요');

  function handleApiError(error: unknown, fallback: string, options: { admin?: boolean } = {}) {
    if (isApiRequestError(error) && error.status === 401) {
      onLoginRequired?.();
    }
    setNotice(options.admin ? getAdminDeleteErrorMessage(error, fallback) : getErrorMessage(error, fallback));
  }

  function updateDraft<K extends keyof BuildPostDraft>(key: K, value: BuildPostDraft[K]) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
    }));
  }

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

  async function handleSelectPost(post: BuildPost) {
    setSelectedPostId(post.id);
    setBoardMode('detail');

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
      handleApiError(error, '좋아요 상태 저장에 실패했습니다.');
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
      handleApiError(error, '북마크 상태 저장에 실패했습니다.');
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
      setSelectedPostId(null);
      setBoardMode('list');
      setNotice('빌드 글을 삭제했습니다.');
    } catch (error) {
      handleApiError(error, '빌드 글 삭제에 실패했습니다.');
    }
  }

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

  if (boardMode === 'detail') {
    return (
      <section className="build-page" aria-labelledby="build-detail-page-title">
        <div className="build-page-heading">
          <div>
            <p className="list-page-kicker">커뮤니티 게시판</p>
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
          <button type="button" className="build-primary-button build-write-button" onClick={() => setBoardMode('write')}>
            글쓰기
          </button>
        </div>
      </section>

    </section>
  );
}

export default BuildPage;
