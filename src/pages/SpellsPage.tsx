import { useMemo, useState } from 'react';
import { spells, type Spell } from '../data/spells';

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
  const [isMotionVisible, setIsMotionVisible] = useState(false);

  return (
    <article className="catalog-card">
      <div className="catalog-card-header">
        <img src={spell.img} alt="" className="catalog-icon-image" />
        <div>
          <span className="option-category">{spell.spell}</span>
          <h3>{spell.title}</h3>
        </div>
        <span className="option-id">#{spell.id}</span>
      </div>
      <div className="option-meta-row">
        <span>{spell.type}</span>
        <span>슬롯 {spell.slot}</span>
        <span>{spell.need}</span>
      </div>
      <p>{spell.description}</p>
      {spell.gif ? (
        <>
          <button
            type="button"
            className="motion-toggle-button"
            onClick={() => setIsMotionVisible((current) => !current)}
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
    () => spells.filter((spell) => matchesSpellSearch(spell, searchQuery)),
    [searchQuery],
  );

  return (
    <section className="options-page" aria-labelledby="spells-title">
      <div className="options-page-heading">
        <div>
          <p className="list-page-kicker">ESpellv1</p>
          <h2 id="spells-title">마술,기도</h2>
        </div>
        <span className="option-count">
          {filteredSpells.length} / {spells.length}
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
