import { useMemo, useState, type KeyboardEvent } from 'react';
import { ashes, type AshOfWar } from '../data/ashes';

const visibleAshes = ashes.filter((ash) => !Object.values(ash).some((value) => String(value).includes('◇')));

function matchesAshSearch(ash: AshOfWar, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [ash.id, ash.title, ash.property, ash.description, ash.game]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function AshCard({ ash }: { ash: AshOfWar }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMotionVisible, setIsMotionVisible] = useState(false);
  const toggleExpanded = () => {
    setIsExpanded((current) => {
      if (current) setIsMotionVisible(false);
      return !current;
    });
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleExpanded();
  };

  return (
    <article
      className={`catalog-card ash-card is-expandable${isExpanded ? ' is-expanded' : ''}`}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={toggleExpanded}
      onKeyDown={handleKeyDown}
    >
      <div className="catalog-card-header">
        <img src={ash.img} alt="" className="catalog-icon-image" />
        <div>
          <span className="option-category">{ash.property}</span>
          <h3>{ash.title}</h3>
        </div>
      </div>
      {isExpanded ? <p>{ash.description}</p> : null}
      {isExpanded && ash.gif ? (
        <>
          <button
            type="button"
            className="motion-toggle-button"
            onClick={(event) => {
              event.stopPropagation();
              setIsMotionVisible((current) => !current);
            }}
            onKeyDown={(event) => event.stopPropagation()}
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

function AshesPage({
  searchQuery,
  ashProperty,
}: {
  searchQuery: string;
  ashProperty: string | null;
}) {
  const filteredAshes = useMemo(() => {
    let result = visibleAshes.filter((ash) => matchesAshSearch(ash, searchQuery));
    if (ashProperty) {
      result = result.filter((ash) => ash.property === ashProperty);
    }
    return result;
  }, [searchQuery, ashProperty]);

  return (
    <section className="options-page" aria-labelledby="ashes-title">
      <div className="options-page-heading">
        <div>
          <h2 id="ashes-title">전회</h2>
        </div>
        <span className="option-count">
          {filteredAshes.length} / {visibleAshes.length}
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
