// 제작 유물 검색,필터링,삭제

import { useEffect, useMemo, useState } from 'react';

// 유물 관련 정보 가져옴
import {
  deleteRelic,
  getStorageErrorMessage,
  listRelics,
  type StoredRelic,
  type StoredRelicSourceFilter,
} from '../api/storageApi';
import {
  getRelicBorderClass,
  getRelicColorClass,
  getRelicColorLabel as getNormalizedRelicColorLabel,
} from '../utils/relicColor';

const sourceFilters: Array<{ id: StoredRelicSourceFilter; label: string }> = [
  { id: 'all', label: '전체 유물' },
  { id: 'save', label: '기본 유물' },
  { id: 'builder', label: '제작 유물' },
];

// 색상 이름
function getRelicColorLabel(color: string | undefined) {
  return getNormalizedRelicColorLabel(color);
}

function getStoredRelicSourceLabel(source: StoredRelic['source']) {
  return source === 'builder' ? '제작' : '세이브';
}

// 날짜
function formatStorageDate(value: string) {
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

// 검색
function matchesRelicStorageSearch(relic: StoredRelic, searchQuery: string) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    relic.itemName,
    relic.color,
    relic.source,
    relic.modeId,
    relic.isValid ? 'valid' : 'invalid',
    ...relic.options.flatMap((option) => [option.name, option.detail, option.effectKey, option.effectId]),
    ...(relic.debuffs ?? []).flatMap((debuff) => [debuff.name, debuff.detail, debuff.effectKey, debuff.effectId]),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

// 유물 한개를 카드로 보여줌
// 수정날짜, 카드 색상, 유물이름같은 카드 정보들임
function RelicStorageCard({
  relic,
  isDeleting,
  onDelete,
}: {
  relic: StoredRelic;
  isDeleting: boolean;
  onDelete: (relic: StoredRelic) => void;
}) {
  const updatedAt = relic.updatedAt || relic.createdAt;

  return (
    <article className={`option-card stored-relic-card ${getRelicBorderClass(relic.color)}`}>
      <div className="option-card-header">
        <span className={`option-category ${getRelicColorClass(relic.color)}`}>
          {getRelicColorLabel(relic.color)}
        </span>
        <span className="stored-relic-source">{getStoredRelicSourceLabel(relic.source)}</span>
      </div>

      <h3>{relic.itemName || `유물 ${relic.itemId}`}</h3>

      <div className="option-meta-row stored-relic-meta">
        <span>{relic.isValid ? '사용 가능' : '사용 불가'}</span>
        <span>{formatStorageDate(updatedAt)}</span>
      </div>

      <ol className="stored-relic-options">
        {[1, 2, 3].map((slot) => {
          const option = relic.options.find((candidate) => candidate.slot === slot);
          const debuff = relic.debuffs?.find((candidate) => candidate.slot === slot);

          return (
            <li key={slot}>
              <span>{slot}</span>
              {option ? (
                <div>
                  <strong>{option.name}</strong>
                  {option.detail ? <p>{option.detail}</p> : null}
                  {debuff ? (
                    <div className="stored-relic-debuff">
                      <em>디버프</em>
                      <strong>{debuff.name}</strong>
                      {debuff.detail ? <p>{debuff.detail}</p> : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div>
                  <strong>옵션 없음</strong>
                  {debuff ? (
                    <div className="stored-relic-debuff">
                      <em>디버프</em>
                      <strong>{debuff.name}</strong>
                      {debuff.detail ? <p>{debuff.detail}</p> : null}
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        className="stored-relic-delete-button"
        disabled={isDeleting}
        onClick={() => onDelete(relic)}
      >
        {isDeleting ? '삭제 중...' : '삭제'}
      </button>
    </article>
  );
}

// 유물 보관함 전체
function RelicStorageSection({
  authUserId,
  searchQuery = '',
  refreshKey = 0,
  sourceFilter: controlledSourceFilter,
  showSourceFilters = true,
  emptyText = '저장된 유물이 없습니다.',
  onRelicsChanged,
}: {
  authUserId: string | null;
  searchQuery?: string;
  refreshKey?: number;
  sourceFilter?: StoredRelicSourceFilter;
  showSourceFilters?: boolean;
  emptyText?: string;
  onRelicsChanged?: () => void;
}) {
  const [internalSourceFilter, setInternalSourceFilter] = useState<StoredRelicSourceFilter>('all');
  const sourceFilter = controlledSourceFilter ?? internalSourceFilter;
  const [relics, setRelics] = useState<StoredRelic[]>([]);
  const [allRelicCount, setAllRelicCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingRelicId, setDeletingRelicId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadRelicStorage() {
    if (!authUserId) {
      setRelics([]);
      setAllRelicCount(0);
      setNotice(null);
      return;
    }

    setIsLoading(true);

    try {
      const [filteredRelics, allRelics] =
        sourceFilter === 'all'
          ? await listRelics(authUserId, 'all').then((items) => [items, items] as const)
          : await Promise.all([listRelics(authUserId, sourceFilter), listRelics(authUserId, 'all')]);

      setRelics(Array.isArray(filteredRelics) ? filteredRelics : []);
      setAllRelicCount(Array.isArray(allRelics) ? allRelics.length : 0);
      setNotice(null);
    } catch (error) {
      setRelics([]);
      setAllRelicCount(0);
      setNotice(getStorageErrorMessage(error, '저장된 유물을 불러오지 못했습니다.'));
    } finally {
      setIsLoading(false);
    }
  }

  // 사용자,필터,새로고침이 바뀌면 리로딩
  useEffect(() => {
    void loadRelicStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId, sourceFilter, refreshKey]);

  const visibleRelics = useMemo(
    () => relics.filter((relic) => matchesRelicStorageSearch(relic, searchQuery)),
    [relics, searchQuery],
  );

  async function handleDeleteRelic(relic: StoredRelic) {
    if (!authUserId || !window.confirm(`${relic.itemName || '이 유물'}을 삭제할까요?`)) return;

    setDeletingRelicId(relic.relicId);

    try {
      await deleteRelic(authUserId, relic.relicId);
      setNotice('유물을 삭제했습니다.');
      await loadRelicStorage();
      onRelicsChanged?.();
    } catch (error) {
      setNotice(getStorageErrorMessage(error, '유물을 삭제하지 못했습니다.'));
    } finally {
      setDeletingRelicId(null);
    }
  }

  return (
    <section className="relic-storage-section" aria-labelledby="relic-storage-title">
      <div className="relic-storage-heading">
        <div>
          <p className="list-page-kicker">보관함</p>
          <h3 id="relic-storage-title">유물 보관함</h3>
        </div>
        <span className="option-count">{allRelicCount} / 50</span>
      </div>

      {!authUserId ? (
        <p className="storage-notice">저장된 유물을 보려면 로그인이 필요합니다.</p>
      ) : (
        <>
          {showSourceFilters ? (
            <div className="relic-storage-filters" aria-label="저장 유물 필터">
              {sourceFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={sourceFilter === filter.id ? 'is-selected' : ''}
                  aria-pressed={sourceFilter === filter.id}
                  onClick={() => setInternalSourceFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          ) : null}

          {notice ? <p className="storage-notice">{notice}</p> : null}

          {isLoading ? (
            <p className="muted-text">저장된 유물을 불러오는 중...</p>
          ) : visibleRelics.length ? (
            <div className="option-card-grid stored-relic-grid">
              {visibleRelics.map((relic) => (
                <RelicStorageCard
                  key={relic.relicId}
                  relic={relic}
                  isDeleting={deletingRelicId === relic.relicId}
                  onDelete={handleDeleteRelic}
                />
              ))}
            </div>
          ) : (
            <p className="muted-text">{emptyText}</p>
          )}
        </>
      )}
    </section>
  );
}

export default RelicStorageSection;
