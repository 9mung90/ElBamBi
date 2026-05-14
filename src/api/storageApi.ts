const defaultApiBaseUrl = 'https://k9e297bszl.execute-api.ap-northeast-2.amazonaws.com';
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl).replace(/\/$/, '');
const accessTokenStorageKey = 'accessToken';

type ApiBodyValue = string | number | boolean | null | undefined;

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

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

function getAccessToken() {
  try {
    return localStorage.getItem(accessTokenStorageKey);
  } catch {
    return null;
  }
}

function appendParams(params: URLSearchParams, values: Record<string, ApiBodyValue>) {
  Object.entries(values).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    params.append(key, String(value));
  });
}

function getMessageFromPayload(payload: unknown) {
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object') {
    const record = payload as { message?: unknown; error?: unknown };
    if (typeof record.message === 'string') return record.message;
    if (typeof record.error === 'string') return record.error;
  }
  return '';
}

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

export function getStorageErrorMessage(error: unknown, fallback: string) {
  if (isApiRequestError(error)) {
    if (error.status === 401) return 'Login is required.';
    return error.message ? `${error.status}: ${error.message}` : fallback;
  }
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

export function listRelics(userId: string, source: StoredRelicSourceFilter = 'all') {
  return requestStorageApi<StoredRelic[]>('/api/mi/relics', {
    query: {
      userId,
      source: source === 'all' ? undefined : source,
    },
  });
}

export function createBuilderRelic(input: BuilderRelicInput) {
  return requestStorageApi<StoredRelic>('/api/mi/relics', {
    method: 'POST',
    json: input,
  });
}

export function deleteRelic(userId: string, relicId: string) {
  return requestStorageApi<string>('/api/mi/deleteRelic', {
    method: 'POST',
    query: { userId, relicId },
  });
}
