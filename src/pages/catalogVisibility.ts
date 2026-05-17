const hiddenNameMarker = '◇';

export function hasHiddenNameMarker(value: unknown) {
  return typeof value === 'string' && value.includes(hiddenNameMarker);
}

export function isCatalogItemVisibleByName(item: { name?: unknown; name_kor?: unknown; title?: unknown } | undefined) {
  if (!item) return true;

  return ![item.name, item.name_kor, item.title].some(hasHiddenNameMarker);
}
