import { useMemo } from 'react';
import { relics, type Relic } from '../data/relics';

function getRelicEffects(relic: Relic) {
  if (relic.effects?.length) return relic.effects;

  if (!relic.raw) return [];

  try {
    const rawRelic = JSON.parse(relic.raw) as { effects?: number[] };
    return rawRelic.effects ?? [];
  } catch {
    return [];
  }
}

function matchesRelicSearch(relic: Relic, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    relic.id,
    relic.name,
    relic.nameOrNull,
    relic.color,
    relic.location,
    relic.type,
    relic.obtainable,
    relic.group,
    relic.description,
    ...getRelicEffects(relic),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function RelicCard({ relic }: { relic: Relic }) {
  const effects = getRelicEffects(relic);

  return (
    <article className="option-card">
      <div className="option-card-header">
        <span className={`option-category relic-color-${relic.color.toLowerCase()}`}>
          {relic.color}
        </span>
        <span className="option-id">#{relic.id}</span>
      </div>
      <h3>{relic.name}</h3>
      {relic.location ? <p>{relic.location}</p> : <p className="muted-text">획득 정보 없음</p>}
      <div className="option-meta-row">
        {relic.type ? <span>{relic.type}</span> : null}
        {effects.length ? <span>효과 {effects.length}개</span> : null}
      </div>
    </article>
  );
}

function RelicsPage({ searchQuery }: { searchQuery: string }) {
  const filteredRelics = useMemo(
    () => relics.filter((relic) => matchesRelicSearch(relic, searchQuery)),
    [searchQuery],
  );

  return (
    <section className="options-page" aria-labelledby="relics-title">
      <div className="options-page-heading">
        <div>
          <p className="list-page-kicker">relics_raw</p>
          <h2 id="relics-title">유물</h2>
        </div>
        <span className="option-count">
          {filteredRelics.length} / {relics.length}
        </span>
      </div>

      <div className="option-card-grid">
        {filteredRelics.map((relic) => (
          <RelicCard key={relic.id} relic={relic} />
        ))}
      </div>
    </section>
  );
}

export default RelicsPage;
