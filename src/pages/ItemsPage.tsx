import { useMemo } from 'react';
import { items, type EtcItem } from '../data/items';

function matchesItemSearch(item: EtcItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [item.id, item.title, item.type, item.description, item.ability, item.game]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function ItemCard({ item }: { item: EtcItem }) {
  return (
    <article className="catalog-card">
      <div className="catalog-card-header">
        <img src={item.img} alt="" className="catalog-icon-image" />
        <div>
          <span className="option-category">{item.type}</span>
          <h3>{item.title}</h3>
        </div>
        <span className="option-id">#{item.id}</span>
      </div>
      {item.ability ? <p className="catalog-ability">{item.ability}</p> : null}
      <p>{item.description}</p>
    </article>
  );
}

function ItemsPage({ searchQuery }: { searchQuery: string }) {
  const filteredItems = useMemo(
    () => items.filter((item) => matchesItemSearch(item, searchQuery)),
    [searchQuery],
  );

  return (
    <section className="options-page" aria-labelledby="items-title">
      <div className="options-page-heading">
        <div>
          <p className="list-page-kicker">EEtcv1</p>
          <h2 id="items-title">기타</h2>
        </div>
        <span className="option-count">
          {filteredItems.length} / {items.length}
        </span>
      </div>

      <div className="catalog-card-grid">
        {filteredItems.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

export default ItemsPage;
