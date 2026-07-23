export function getMessageFromPayload(payload: unknown) {
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

export function getErrorMessageFromPayload(payload: unknown) {
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object') {
    const record = payload as { message?: unknown; error?: unknown };
    if (typeof record.message === 'string') return record.message;
    if (typeof record.error === 'string') return record.error;
  }
  return '';
}

export function getCodeFromPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return '';
  const code = (payload as { code?: unknown }).code;
  return typeof code === 'string' ? code : '';
}

export function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function getStringValue(value: unknown, fallback = '') {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

export function getNumberValue(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function getFirstString(record: Record<string, unknown> | null, keys: string[], fallback = '') {
  if (!record) return fallback;
  for (const key of keys) {
    const value = getStringValue(record[key]);
    if (value) return value;
  }
  return fallback;
}

export function getFirstRecord(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const value = getRecord(record[key]);
    if (value) return value;
  }
  return null;
}

export function getArrayFromPayload(payload: unknown, keys: string[]) {
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

export function getAccessTokenFromPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const token = (payload as { accessToken?: unknown }).accessToken;
  return typeof token === 'string' && token ? token : null;
}
