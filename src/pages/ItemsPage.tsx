import { useMemo } from 'react';
import gradeFrame0 from '../assets/images/grade/0.webp';
import gradeFrame1 from '../assets/images/grade/1.webp';
import gradeFrame2 from '../assets/images/grade/2.webp';
import gradeFrame3 from '../assets/images/grade/3.webp';
import wendingGraceImage from '../assets/images/items/grace.webp';
import { consumables, items, type ConsumableItem, type EtcItem } from '../data/items';
import { isCatalogItemVisibleByName } from './catalogVisibility';

// DLC 아이템 제외
const visibleConsumables = consumables.filter((item) => isCatalogItemVisibleByName(item));

// 검색 함수
function matchesItemSearch(item: ConsumableItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  // 검색어가 없으면 전체 표시
  if (!normalizedQuery) return true;

  // 이름과 설명 및 분류와 제작 정보에서 검색
  return [
    item.id,
    item.name,
    item.name_kor,
    item.type_kor,
    item.description,
    item.description_kor,
    item.ability_kor,
    item.rarity,
    item.maxStack,
    item.bagcraftMaxStack,
    item.bagcraftExperience,
    item.bagcraftCategory,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

// 아이템 이미지 찾기
function getConsumableImage(item: ConsumableItem, imageLookup: Map<string, EtcItem>) {
  // 은총은 별도 이미지 사용
  if (item.name === 'Wending Grace') return wendingGraceImage;
  if (item.image) return item.image;

  // 이미지가 없으면 한글 이름으로 다시 찾기
  return item.name_kor ? imageLookup.get(item.name_kor)?.img : undefined;
}

// 희귀도 테두리 찾기
function getItemGradeFrameUrl(rarity: string) {
  if (rarity === 'legendary' || rarity === 'unique') return gradeFrame3;
  if (rarity === 'rare') return gradeFrame2;
  if (rarity === 'uncommon') return gradeFrame1;
  return gradeFrame0;
}

// 아이템 카드
function ItemCard({ item, imageLookup }: { item: ConsumableItem; imageLookup: Map<string, EtcItem> }) {
  const image = getConsumableImage(item, imageLookup);
  const gradeFrame = getItemGradeFrameUrl(item.rarity);
  // 한글 이름과 설명 우선 표시
  const title = item.name_kor || item.name;
  const description = item.description_kor || item.description;

  return (
    <article className="catalog-card item-card">
      <div className="catalog-card-header">
        {image ? (
          <span className="catalog-image-frame" aria-hidden="true">
            <img src={gradeFrame} alt="" className="catalog-grade-frame" loading="lazy" />
            <img src={image} alt="" className="catalog-icon-image" loading="lazy" />
          </span>
        ) : null}
        <div>
          {item.type_kor ? <span className="option-category">{item.type_kor}</span> : null}
          <h3>{title}</h3>
        </div>
      </div>
      <p className={item.ability_kor ? "catalog-ability" : "catalog-ability-empty"}>
        {item.ability_kor || <span aria-hidden="true">&nbsp;</span>}
      </p>
      <p>{description}</p>
    </article>
  );
}

// 아이템 페이지 전체
function ItemsPage({ searchQuery }: { searchQuery: string }) {
  // 한글 이름으로 이미지를 찾기 위한 목록
  const imageLookup = useMemo(
    () => new Map(items.map((item) => [item.title, item] as const)),
    [],
  );

  // 검색 조건에 맞는 아이템 목록
  const filteredItems = useMemo(
    () => visibleConsumables.filter((item) => matchesItemSearch(item, searchQuery)),
    [searchQuery],
  );

  return (
    <section className="options-page" aria-labelledby="items-title">
      <div className="options-page-heading">
        <div>
          <h2 id="items-title">기타</h2>
        </div>
        <span className="option-count">
          {filteredItems.length} / {visibleConsumables.length}
        </span>
      </div>

      {/* 아이템 카드 목록 */}
      <div className="catalog-card-grid">
        {filteredItems.map((item) => (
          <ItemCard key={item.id} item={item} imageLookup={imageLookup} />
        ))}
      </div>
    </section>
  );
}

export default ItemsPage;
