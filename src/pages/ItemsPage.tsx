import { useMemo } from 'react';
import gradeFrame0 from '../assets/images/grade/0.webp';
import gradeFrame1 from '../assets/images/grade/1.webp';
import gradeFrame2 from '../assets/images/grade/2.webp';
import gradeFrame3 from '../assets/images/grade/3.webp';
import wendingGraceImage from '../assets/images/items/grace.webp';
import { consumables, items, type ConsumableItem, type EtcItem } from '../data/items';

function matchesItemSearch(item: ConsumableItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

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

function getConsumableImage(item: ConsumableItem, imageLookup: Map<string, EtcItem>) {
  if (item.name === 'Wending Grace') return wendingGraceImage;
  if (item.image) return item.image;

  return item.name_kor ? imageLookup.get(item.name_kor)?.img : undefined;
}

function getItemGradeFrameUrl(rarity: string) {
  if (rarity === 'legendary' || rarity === 'unique') return gradeFrame3;
  if (rarity === 'rare') return gradeFrame2;
  if (rarity === 'uncommon') return gradeFrame1;
  return gradeFrame0;
}

function ItemCard({ item, imageLookup }: { item: ConsumableItem; imageLookup: Map<string, EtcItem> }) {
  const image = getConsumableImage(item, imageLookup);
  const gradeFrame = getItemGradeFrameUrl(item.rarity);
  const title = item.name_kor || item.name;
  const description = item.description_kor || item.description;

  return (
    <article className="catalog-card">
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

function ItemsPage({ searchQuery }: { searchQuery: string }) {
  const imageLookup = useMemo(
    () => new Map(items.map((item) => [item.title, item] as const)),
    [],
  );

  const filteredItems = useMemo(
    () => consumables.filter((item) => matchesItemSearch(item, searchQuery)),
    [searchQuery],
  );

  return (
    <section className="options-page" aria-labelledby="items-title">
      <div className="options-page-heading">
        <div>
          <h2 id="items-title">기타</h2>
        </div>
        <span className="option-count">
          {filteredItems.length} / {consumables.length}
        </span>
      </div>

      <div className="catalog-card-grid">
        {filteredItems.map((item) => (
          <ItemCard key={item.id} item={item} imageLookup={imageLookup} />
        ))}
      </div>
    </section>
  );
}

export default ItemsPage;
