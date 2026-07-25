import { useMemo } from 'react';
import { talismans, type Talisman } from '../data/talismans';

// DLC 탈리스만 제외
const visibleTalismans = talismans.filter((talisman) => !Object.values(talisman).some((value) => String(value).includes('◇')));

// 검색 함수
function matchesTalismanSearch(talisman: Talisman, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  // 검색어가 없으면 전체 표시
  if (!normalizedQuery) return true;

  // 이름과 설명 및 게임에서 검색
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

// 탈리스만 카드
function TalismanCard({ talisman }: { talisman: Talisman }) {
  return (
    <article className="catalog-card">
      <div className="catalog-card-header">
        <img src={talisman.img} alt="" className="catalog-icon-image" />
        <div>
          <span className="option-category">탈리스만</span>
          <h3>{talisman.title}</h3>
        </div>
      </div>
      {talisman.ability ? <p className="catalog-ability">{talisman.ability}</p> : null}
      <p>{talisman.description}</p>
    </article>
  );
}

// 탈리스만 페이지 전체
function TalismansPage({ searchQuery }: { searchQuery: string }) {
  // 검색 조건에 맞는 탈리스만 목록
  const filteredTalismans = useMemo(
    () => visibleTalismans.filter((talisman) => matchesTalismanSearch(talisman, searchQuery)),
    [searchQuery],
  );

  return (
    <section className="options-page" aria-labelledby="talismans-title">
      <div className="options-page-heading">
        <div>
          <h2 id="talismans-title">탈리스만</h2>
        </div>
        <span className="option-count">
          {filteredTalismans.length} / {visibleTalismans.length}
        </span>
      </div>

      {/* 탈리스만 카드 목록 */}
      <div className="catalog-card-grid">
        {filteredTalismans.map((talisman) => (
          <TalismanCard key={talisman.id} talisman={talisman} />
        ))}
      </div>
    </section>
  );
}

export default TalismansPage;
