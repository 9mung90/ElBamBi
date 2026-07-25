import { useMemo } from 'react';
import { gestures, type Gesture } from '../data/gestures';
import { isCatalogItemVisibleByName } from './catalogVisibility';

// DLC 제스처 제외
const visibleGestures = gestures.filter((gesture) => isCatalogItemVisibleByName(gesture));

// 검색 함수
function matchesGestureSearch(gesture: Gesture, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  // 검색어가 없으면 전체 표시
  if (!normalizedQuery) return true;

  // 번호와 이름 및 설명과 게임에서 검색
  return [gesture.id, gesture.title, gesture.description, gesture.game]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

// 제스처 카드
function GestureCard({ gesture }: { gesture: Gesture }) {
  return (
    <article className="catalog-card compact-catalog-card gesture-card">
      <div className="catalog-card-header">
        <img src={gesture.img} alt="" className="catalog-icon-image" />
        <div>
          <span className="option-category">제스처</span>
          <h3>{gesture.title}</h3>
        </div>
      </div>
    </article>
  );
}

// 제스처 페이지 전체
function GesturesPage({ searchQuery }: { searchQuery: string }) {
  // 검색 조건에 맞는 제스처 목록
  const filteredGestures = useMemo(
    () => visibleGestures.filter((gesture) => matchesGestureSearch(gesture, searchQuery)),
    [searchQuery],
  );

  return (
    <section className="options-page" aria-labelledby="gestures-title">
      <div className="options-page-heading">
        <div>
          <h2 id="gestures-title">제스처</h2>
        </div>
        <span className="option-count">
          {filteredGestures.length} / {visibleGestures.length}
        </span>
      </div>

      {/* 제스처 카드 목록 */}
      <div className="catalog-card-grid">
        {filteredGestures.map((gesture) => (
          <GestureCard key={gesture.id} gesture={gesture} />
        ))}
      </div>
    </section>
  );
}

export default GesturesPage;
