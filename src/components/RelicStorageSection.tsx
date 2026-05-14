import { useEffect, useMemo, useState } from 'react';
import {
  deleteRelic,
  getStorageErrorMessage,
  listRelics,
  type StoredRelic,
  type StoredRelicSourceFilter,
} from '../api/storageApi';

const sourceFilters: Array<{ id: StoredRelicSourceFilter; label: string }> = [
  { id: 'all', label: 'All relics' },
  { id: 'save', label: 'Save-imported' },
  { id: 'builder', label: 'Builder-created' },
];

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
    <article className="option-card stored-relic-card">
      <div className="option-card-header">
        <span className={`option-category relic-color-${relic.color.toLowerCase()}`}>{relic.color}</span>
        <span className="stored-relic-source">{relic.source}</span>
      </div>

      <h3>{relic.itemName || `Relic ${relic.itemId}`}</h3>

      <div className="option-meta-row stored-relic-meta">
        <span>{relic.isValid ? 'Valid' : 'Invalid'}</span>
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
                  <strong>No option</strong>
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
        {isDeleting ? 'Deleting...' : 'Delete'}
      </button>
    </article>
  );
}

function RelicStorageSection({
  authUserId,
  searchQuery = '',
  refreshKey = 0,
  onRelicsChanged,
}: {
  authUserId: string | null;
  searchQuery?: string;
  refreshKey?: number;
  onRelicsChanged?: () => void;
}) {
  const [sourceFilter, setSourceFilter] = useState<StoredRelicSourceFilter>('all');
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
      setNotice(getStorageErrorMessage(error, 'Failed to load stored relics.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRelicStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId, sourceFilter, refreshKey]);

  const visibleRelics = useMemo(
    () => relics.filter((relic) => matchesRelicStorageSearch(relic, searchQuery)),
    [relics, searchQuery],
  );

  async function handleDeleteRelic(relic: StoredRelic) {
    if (!authUserId || !window.confirm(`Delete ${relic.itemName || 'this relic'}?`)) return;

    setDeletingRelicId(relic.relicId);

    try {
      await deleteRelic(authUserId, relic.relicId);
      setNotice('Relic deleted.');
      await loadRelicStorage();
      onRelicsChanged?.();
    } catch (error) {
      setNotice(getStorageErrorMessage(error, 'Failed to delete relic.'));
    } finally {
      setDeletingRelicId(null);
    }
  }

  return (
    <section className="relic-storage-section" aria-labelledby="relic-storage-title">
      <div className="relic-storage-heading">
        <div>
          <p className="list-page-kicker">Storage</p>
          <h3 id="relic-storage-title">Relic Storage</h3>
        </div>
        <span className="option-count">{allRelicCount} / 50</span>
      </div>

      {!authUserId ? (
        <p className="storage-notice">Login is required to view stored relics.</p>
      ) : (
        <>
          <div className="relic-storage-filters" aria-label="Stored relic filters">
            {sourceFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={sourceFilter === filter.id ? 'is-selected' : ''}
                aria-pressed={sourceFilter === filter.id}
                onClick={() => setSourceFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {notice ? <p className="storage-notice">{notice}</p> : null}

          {isLoading ? (
            <p className="muted-text">Loading stored relics...</p>
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
            <p className="muted-text">No stored relics found.</p>
          )}
        </>
      )}
    </section>
  );
}

export default RelicStorageSection;
