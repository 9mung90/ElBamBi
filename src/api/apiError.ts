export function getApiErrorMessage(status: number, fallback?: string): string {
  if (status === 401) return '로그인이 필요합니다.';
  if (status === 403) return '권한이 없습니다.';
  if (status === 429) return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  if (status === 413) return '파일이 너무 큽니다.';
  if (status === 415) return '지원하지 않는 파일 형식입니다.';
  if (status >= 500) return '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  return fallback || '요청 처리 중 오류가 발생했습니다.';
}
