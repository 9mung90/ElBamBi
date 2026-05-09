import { useMemo } from 'react';
import { talismans, type Talisman } from '../data/talismans';

const visibleTalismans = talismans.filter((talisman) => !Object.values(talisman).some((value) => String(value).includes('◇')));

function matchesTalismanSearch(talisman: Talisman, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    talisman.id,
    talisman.title,
    talisman.description,
    talisman.ability,
    talisman.game,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function TalismanCard({ talisman }: { talisman: Talisman }) {
  return (
    <article className="catalog-card">
      <div className="catalog-card-header">
        <img src={talisman.img} alt="" className="catalog-icon-image" />
        <div>
          <span className="option-category">탈리스만</span>
          <h3>{talisman.title}</h3>
        </div>
        <span className="option-id">#{talisman.id}</span>
      </div>
      {talisman.ability ? <p className="catalog-ability">{talisman.ability}</p> : null}
      <p>{talisman.description}</p>
    </article>
  );
}

function TalismansPage({ searchQuery }: { searchQuery: string }) {
  const filteredTalismans = useMemo(
    () => visibleTalismans.filter((talisman) => matchesTalismanSearch(talisman, searchQuery)),
    [searchQuery],
  );

  return (
    <section className="options-page" aria-labelledby="talismans-title">
      <div className="options-page-heading">
        <div>
          <p className="list-page-kicker">ETalismanv1</p>
          <h2 id="talismans-title">탈리스만</h2>
        </div>
        <span className="option-count">
          {filteredTalismans.length} / {visibleTalismans.length}
        </span>
      </div>

      <div className="catalog-card-grid">
        {filteredTalismans.map((talisman) => (
          <TalismanCard key={talisman.id} talisman={talisman} />
        ))}
      </div>
    </section>
  );
}

export default TalismansPage;
