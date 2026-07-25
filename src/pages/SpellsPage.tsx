import { useMemo, useState, type KeyboardEvent } from 'react';
import { spells, type Spell } from '../data/spells';

// DLC 마술과 기도 제외
const visibleSpells = spells.filter((spell) => !Object.values(spell).some((value) => String(value).includes('◇')));

// 마술과 기도 필터
export type SpellFilters = {
  spell: string | null;
  type: string | null;
};

// 필터에 표시할 분류 목록
export const spellFilterOptions = {
  spells: Array.from(new Set(visibleSpells.map((spell) => spell.spell))).sort((a, b) =>
    a.localeCompare(b, 'ko'),
  ),
  typesBySpell: visibleSpells.reduce<Record<string, string[]>>((options, spell) => {
    const current = options[spell.spell] ?? [];
    if (!current.includes(spell.type)) {
      options[spell.spell] = [...current, spell.type].sort((a, b) => a.localeCompare(b, 'ko'));
    }
    return options;
  }, {}),
};

// 빈 필터 만들기
export function createEmptySpellFilters(): SpellFilters {
  return {
    spell: null,
    type: null,
  };
}

// 검색 함수
function matchesSpellSearch(spell: Spell, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  // 검색어가 없으면 전체 표시
  if (!normalizedQuery) return true;

  // 이름과 설명 및 분류와 게임에서 검색
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

// 선택한 필터와 마술 및 기도 비교
function matchesSpellFilters(spell: Spell, filters: SpellFilters) {
  const matchesSpell = !filters.spell || spell.spell === filters.spell;
  const matchesType = !filters.type || spell.type === filters.type;

  return matchesSpell && matchesType;
}

// 마술과 기도 카드
function SpellCard({ spell }: { spell: Spell }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMotionVisible, setIsMotionVisible] = useState(false);

  // 카드 펼침 및 모션 초기화
  const toggleExpanded = () => {
    setIsExpanded((current) => {
      if (current) setIsMotionVisible(false);
      return !current;
    });
  };

  // 키보드로 카드 펼치기
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

// 마술과 기도 페이지 전체
function SpellsPage({ searchQuery, filters }: { searchQuery: string; filters: SpellFilters }) {
  // 검색과 필터 조건에 맞는 목록
  const filteredSpells = useMemo(
    () => visibleSpells.filter((spell) => matchesSpellSearch(spell, searchQuery) && matchesSpellFilters(spell, filters)),
    [filters, searchQuery],
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

      {/* 마술과 기도 카드 목록 */}
      <div className="catalog-card-grid">
        {filteredSpells.map((spell) => (
          <SpellCard key={spell.id} spell={spell} />
        ))}
      </div>
    </section>
  );
}

export default SpellsPage;
