import type { Category } from './pageTypes';

type PlaceholderPageProps = {
  category: Category;
  searchQuery: string;
};

function PlaceholderPage({ category, searchQuery }: PlaceholderPageProps) {
  return (
    <section className="list-page-panel" aria-labelledby={`${category.id}-title`}>
      <div className="list-page-icon" aria-hidden="true">
        {category.icon}
      </div>
      <div>
        <p className="list-page-kicker">선택된 카테고리</p>
        <h2 id={`${category.id}-title`}>{category.label}</h2>
        <p>{category.description}</p>
        {searchQuery.trim() ? (
          <p className="list-page-search">
            현재 검색어: <strong>{searchQuery}</strong>
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default PlaceholderPage;
