export function getStoredValue(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setStoredValue(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked in some browser modes. Refresh still works with the in-memory state.
  }
}

export function removeStoredValue(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures for the same reason as setStoredValue.
  }
}
