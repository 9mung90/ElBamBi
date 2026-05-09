import { useMemo, useState, type KeyboardEvent } from 'react';
import {
  relicEffectsKo,
  relicItemColorMap,
  relics,
  type Relic,
  type RelicEffect,
} from '../data/relics';

const relicItemColorById = new Map(relicItemColorMap.map((entry) => [entry.itemId, entry]));
const relicEffectById = new Map(relicEffectsKo.map((effect) => [String(effect.id), effect]));

const relicAssetUrls = import.meta.glob('../assets/images/relics/**/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

function resolveRelicImageUrl(imageUrl: string | undefined) {
  if (!imageUrl) return undefined;
  if (!imageUrl.startsWith('/src/assets/images/relics/')) return imageUrl;

  const assetPath = imageUrl.replace('/src/assets/images/relics/', '../assets/images/relics/');
  return relicAssetUrls[assetPath] ?? imageUrl;
}

function getRelicEffects(relic: Relic) {
  const mappedRelic = relic.id >= 2000 ? relicItemColorById.get(relic.id) : undefined;
  if (mappedRelic?.effects?.length) return mappedRelic.effects;

  if (relic.effects?.length) return relic.effects;

  if (!relic.raw) return [];

  try {
    const rawRelic = JSON.parse(relic.raw) as { effects?: number[] };
    return rawRelic.effects ?? [];
  } catch {
    return [];
  }
}

function getRelicEffectDetails(relic: Relic): RelicEffect[] {
  if (relic.id < 2000) return [];

  return getRelicEffects(relic)
    .map((effectId) => relicEffectById.get(String(effectId)))
    .filter((effect): effect is RelicEffect => Boolean(effect));
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
    ...getRelicEffectDetails(relic).flatMap((effect) => [
      effect.name,
      effect.category,
      effect.desc,
    ]),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function RelicCard({ relic }: { relic: Relic }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const effects = getRelicEffects(relic);
  const effectDetails = getRelicEffectDetails(relic);
  const hasEffectDetails = effectDetails.length > 0;
  const relicImageUrl = resolveRelicImageUrl(relic.image);
  const toggleExpanded = () => {
    if (!hasEffectDetails) return;
    setIsExpanded((current) => !current);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!hasEffectDetails || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    toggleExpanded();
  };

  return (
    <article
      className={`option-card relic-card${hasEffectDetails ? ' is-expandable' : ''}${isExpanded ? ' is-expanded' : ''}`}
      role={hasEffectDetails ? 'button' : undefined}
      tabIndex={hasEffectDetails ? 0 : undefined}
      aria-expanded={hasEffectDetails ? isExpanded : undefined}
      onClick={toggleExpanded}
      onKeyDown={handleKeyDown}
    >
      <div className="option-card-header">
        <span className={`option-category relic-color-${relic.color.toLowerCase()}`}>
          {relic.color}
        </span>
        <span className="option-id">#{relic.id}</span>
      </div>

      <div className={`relic-card-main${relicImageUrl ? '' : ' has-no-image'}`}>
        {relicImageUrl ? (
          <img
            src={relicImageUrl}
            alt=""
            className="relic-catalog-image"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.closest('.relic-card-main')?.classList.add('has-no-image');
              event.currentTarget.hidden = true;
            }}
          />
        ) : null}
        <div>
          <h3>{relic.name}</h3>
          {relic.location ? <p>{relic.location}</p> : <p className="muted-text">획득 정보 없음</p>}
        </div>
      </div>

      <div className="option-meta-row">
        {relic.type ? <span>{relic.type}</span> : null}
        {effects.length ? <span>효과 {effects.length}개</span> : null}
      </div>

      {isExpanded && hasEffectDetails ? (
        <ul className="relic-effect-list">
          {effectDetails.map((effect) => (
            <li key={effect.id}>
              <div>
                <strong>{effect.name}</strong>
                {effect.category ? <span>{effect.category}</span> : null}
              </div>
              {effect.desc ? <p>{effect.desc}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
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
