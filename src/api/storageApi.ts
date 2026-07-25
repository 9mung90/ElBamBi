// 유물 저장소 및 유물 프리셋 관련 서버 API


import { getApiErrorMessage } from './apiError';
import { accessTokenStorageKey, clearAuthStorage, isAccessTokenExpired } from './authToken';

const defaultApiBaseUrl = 'https://k9e297bszl.execute-api.ap-northeast-2.amazonaws.com';
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl).replace(/\/$/, '');

type ApiBodyValue = string | number | boolean | null | undefined;

//유물 타입 정의 (세이브파일껀지 제작꺼인지)
export type StoredRelicSource = 'save' | 'builder';
export type StoredRelicSourceFilter = StoredRelicSource | 'all';

export type StoredRelicOption = {
  slot: number;
  effectId?: number;
  effectKey?: string;
  name: string;
  detail: string;
};

export type StoredRelicDebuff = StoredRelicOption;

// 유물 전체 데이터
export type StoredRelic = {
  relicId: string;
  userId: string;
  saveId: string | null;
  source: StoredRelicSource;
  slotIndex: number;
  itemId: number;
  itemName: string;
  color: string;
  modeId: string;
  isValid: boolean;
  options: StoredRelicOption[];
  debuffs?: StoredRelicDebuff[];
  createdAt: string;
  updatedAt: string;
};

// 일반/심도
export type RelicPresetColorMode = 'normal' | 'deep';
// 프리셋에 넣는 유물 종류
export type RelicPresetSlotInput =
  | {
      slotIndex: number;
      relicRefType: 'stored';
      relicId: string;
    }
  | {
      slotIndex: number;
      relicRefType: 'save';
      itemId: number;
      effectIds: number[];
    };
// 서버 전달 프리셋 데이터
export type RelicPresetInput = {
  presetId?: string;
  userId: string;
  name: string;
  characterName: string;
  vesselIndex: number;
  colorMode: RelicPresetColorMode;
  slots: RelicPresetSlotInput[];
};
//생성,수정 시간 추가
export type RelicPreset = RelicPresetInput & {
  presetId: string;
  createdAt: string;
  updatedAt: string;
};
// 서버 전달 제작 유물 데이터
export type BuilderRelicInput = {
  userId: string;
  slotIndex: number;
  itemId: number;
  itemName: string;
  color: string;
  modeId: string;
  isValid: boolean;
  options: StoredRelicOption[];
  debuffs: StoredRelicDebuff[];
};
//에러
export class ApiRequestError extends Error {
  status: number;
  path: string;
  payload: unknown;

  constructor(status: number, message: string, path: string, payload: unknown) {
    super(message);
    this.status = status;
    this.path = path;
    this.payload = payload;
  }
}
// API 요청 에러인지 확인
export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

// 로그인 토큰 가져오기
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
// 객체 -> URL 파라미터
function appendParams(params: URLSearchParams, values: Record<string, ApiBodyValue>) {
  Object.entries(values).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    params.append(key, String(value));
  });
}
// 서버 응답에서 오류 메세지 추출
function getMessageFromPayload(payload: unknown) {
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object') {
    const record = payload as { message?: unknown; error?: unknown };
    if (typeof record.message === 'string') return record.message;
    if (typeof record.error === 'string') return record.error;
  }
  return '';
}
// 서버 응답 본문 읽고 반환
async function parseResponsePayload(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  if (!text) return undefined;
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  return text;
}

// 서버에 요청 보내고 응답 처리 
async function requestStorageApi<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    query?: Record<string, ApiBodyValue>;
    json?: unknown;
  } = {},
): Promise<T> {
  const query = new URLSearchParams();
  if (options.query) appendParams(query, options.query);

  const queryString = query.toString();
  const headers = new Headers();
  const accessToken = getAccessToken();
  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }

  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers,
  };

  if (options.json !== undefined) {
    headers.set('content-type', 'application/json;charset=UTF-8');
    init.body = JSON.stringify(options.json);
  }

  const response = await fetch(`${apiBaseUrl}${path}${queryString ? `?${queryString}` : ''}`, init);
  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthStorage();
    }

    console.error('[storageApi] Request failed', {
      path,
      status: response.status,
      statusText: response.statusText,
      response: payload,
    });

    throw new ApiRequestError(
      response.status,
      getMessageFromPayload(payload) || `${response.status} ${response.statusText}`,
      path,
      payload,
    );
  }

  return payload as T;
}
// 에러
export function getStorageErrorMessage(error: unknown, fallback: string) {
  if (isApiRequestError(error)) {
    return getApiErrorMessage(error.status, error.message || fallback);
  }
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}
// 저장 유물 조회
export function listRelics(userId: string, source: StoredRelicSourceFilter = 'all') {
  return requestStorageApi<StoredRelic[]>('/api/mi/relics', {
    query: {
      userId,
      source: source === 'all' ? undefined : source,
    },
  });
}
// 제작 유물 저장
export function createBuilderRelic(input: BuilderRelicInput) {
  return requestStorageApi<StoredRelic>('/api/mi/relics', {
    method: 'POST',
    json: input,
  });
}
// 프리셋 저장
export function saveRelicPreset(input: RelicPresetInput) {
  return requestStorageApi<RelicPreset>('/api/mi/presets', {
    method: 'POST',
    json: input,
  });
}
// 프리셋 목록 조회
export function listRelicPresets(userId: string) {
  return requestStorageApi<RelicPreset[]>('/api/mi/presets', {
    query: { userId },
  });
}
// 프리셋 삭제
export function deleteRelicPreset(userId: string, presetId: string) {
  return requestStorageApi<string>('/api/mi/deletePreset', {
    method: 'POST',
    query: { userId, presetId },
  });
}
// 유물 삭제
export function deleteRelic(userId: string, relicId: string) {
  return requestStorageApi<string>('/api/mi/deleteRelic', {
    method: 'POST',
    query: { userId, relicId },
  });
}
