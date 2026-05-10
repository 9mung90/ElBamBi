import { useMemo, useState, type KeyboardEvent } from 'react';
import { spells, type Spell } from '../data/spells';

const visibleSpells = spells.filter((spell) => !Object.values(spell).some((value) => String(value).includes('◇')));

function matchesSpellSearch(spell: Spell, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    spell.id,
    spell.title,
    spell.type,
    spell.spell,
    spell.slot,
    spell.need,
    spell.description,
    spell.game,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function SpellCard({ spell }: { spell: Spell }) {
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
      className={`catalog-card spell-card is-expandable${isExpanded ? ' is-expanded' : ''}`}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={toggleExpanded}
      onKeyDown={handleKeyDown}
    >
      <div className="catalog-card-header">
        <img src={spell.img} alt="" className="catalog-icon-image" />
        <div>
          <div className="spell-badge-row">
            <span className="option-category">{spell.spell}</span>
            <span className="option-category spell-school-badge">{spell.type}</span>
          </div>
          <h3>{spell.title}</h3>
        </div>
      </div>
      {isExpanded ? <p>{spell.description}</p> : null}
      {isExpanded && spell.gif ? (
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
            <img src={spell.gif} alt="" className="catalog-gif-preview" loading="lazy" />
          ) : null}
        </>
      ) : null}
    </article>
  );
}

function SpellsPage({ searchQuery }: { searchQuery: string }) {
  const filteredSpells = useMemo(
    () => visibleSpells.filter((spell) => matchesSpellSearch(spell, searchQuery)),
    [searchQuery],
  );

  return (
    <section className="options-page" aria-labelledby="spells-title">
      <div className="options-page-heading">
        <div>
          <h2 id="spells-title">마술,기도</h2>
        </div>
        <span className="option-count">
          {filteredSpells.length} / {visibleSpells.length}
        </span>
      </div>

      <div className="catalog-card-grid">
        {filteredSpells.map((spell) => (
          <SpellCard key={spell.id} spell={spell} />
        ))}
      </div>
    </section>
  );
}

export default SpellsPage;
