import { useMemo, useState } from 'react';
import { ashes, type AshOfWar } from '../data/ashes';

function matchesAshSearch(ash: AshOfWar, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [ash.id, ash.title, ash.property, ash.description, ash.game]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function AshCard({ ash }: { ash: AshOfWar }) {
  const [isMotionVisible, setIsMotionVisible] = useState(false);

  return (
    <article className="catalog-card">
      <div className="catalog-card-header">
        <img src={ash.img} alt="" className="catalog-icon-image" />
        <div>
          <span className="option-category">{ash.property}</span>
          <h3>{ash.title}</h3>
        </div>
        <span className="option-id">#{ash.id}</span>
      </div>
      <p>{ash.description}</p>
      {ash.gif ? (
        <>
          <button
            type="button"
            className="motion-toggle-button"
            onClick={() => setIsMotionVisible((current) => !current)}
          >
            {isMotionVisible ? '시전 모션 숨기기' : '시전 모션 보기'}
          </button>
          {isMotionVisible ? (
            <img src={ash.gif} alt="" className="catalog-gif-preview" loading="lazy" />
          ) : null}
        </>
      ) : null}
    </article>
  );
}

function AshesPage({ searchQuery }: { searchQuery: string }) {
  const filteredAshes = useMemo(
    () => ashes.filter((ash) => matchesAshSearch(ash, searchQuery)),
    [searchQuery],
  );

  return (
    <section className="options-page" aria-labelledby="ashes-title">
      <div className="options-page-heading">
        <div>
          <p className="list-page-kicker">EAshv1</p>
          <h2 id="ashes-title">전회</h2>
        </div>
        <span className="option-count">
          {filteredAshes.length} / {ashes.length}
        </span>
      </div>

      <div className="catalog-card-grid">
        {filteredAshes.map((ash) => (
          <AshCard key={ash.id} ash={ash} />
        ))}
      </div>
    </section>
  );
}

export default AshesPage;
