import {
  getFirstString,
  getRecord,
  getStringValue,
} from './payloadUtils';

export function formatMyPageDate(value: unknown) {
  const rawValue = getStringValue(value);
  if (!rawValue) return '';

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return rawValue;

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function getMyPagePostId(item: Record<string, unknown>) {
  return getFirstString(item, ['postId', 'communityPostId', 'id']);
}

export function getMyPagePostTitle(item: Record<string, unknown>) {
  return getFirstString(item, ['postTitle', 'title'], '제목 없음');
}

export function getMyPagePostPreview(item: Record<string, unknown>) {
  return getFirstString(item, ['contentText', 'content', 'commentText']);
}

export function getMyPageBookmarkPost(item: Record<string, unknown>) {
  return getRecord(item.post) ?? item;
}

export function getMyPageCommentPostLabel(item: Record<string, unknown>) {
  const postTitle = getFirstString(item, ['postTitle', 'title']);
  if (postTitle) return postTitle;

  const postId = getMyPagePostId(item);
  return postId ? `postId: ${postId}` : '';
}

export function getMyPageRelicTitle(item: Record<string, unknown>) {
  return getFirstString(item, ['itemName', 'name', 'relicName', 'title'], '이름 없는 유물');
}

export function getMyPagePresetTitle(item: Record<string, unknown>) {
  return getFirstString(item, ['name', 'presetName', 'title'], '이름 없는 프리셋');
}

export function getMyPageItemDate(item: Record<string, unknown>) {
  return formatMyPageDate(item.createdAt ?? item.updatedAt);
}

export function formatMyPageSlotSummary(slot: Record<string, unknown>) {
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
