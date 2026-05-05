import { useMemo } from 'react';
import { gestures, type Gesture } from '../data/gestures';

function matchesGestureSearch(gesture: Gesture, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [gesture.id, gesture.title, gesture.description, gesture.game]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function GestureCard({ gesture }: { gesture: Gesture }) {
  return (
    <article className="catalog-card compact-catalog-card">
      <div className="catalog-card-header">
        <img src={gesture.img} alt="" className="catalog-icon-image" />
        <div>
          <span className="option-category">제스처</span>
          <h3>{gesture.title}</h3>
        </div>
        <span className="option-id">#{gesture.id}</span>
      </div>
      <p>{gesture.description}</p>
    </article>
  );
}

function GesturesPage({ searchQuery }: { searchQuery: string }) {
  const filteredGestures = useMemo(
    () => gestures.filter((gesture) => matchesGestureSearch(gesture, searchQuery)),
    [searchQuery],
  );

  return (
    <section className="options-page" aria-labelledby="gestures-title">
      <div className="options-page-heading">
        <div>
          <p className="list-page-kicker">EGesturev1</p>
          <h2 id="gestures-title">제스처</h2>
        </div>
        <span className="option-count">
          {filteredGestures.length} / {gestures.length}
        </span>
      </div>

      <div className="catalog-card-grid">
        {filteredGestures.map((gesture) => (
          <GestureCard key={gesture.id} gesture={gesture} />
        ))}
      </div>
    </section>
  );
}

export default GesturesPage;
