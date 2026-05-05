import { useMemo } from 'react';
import { relicEffectsKo, type RelicEffect } from '../data/relics';

const categoryLabels: Record<string, string> = {
  Utility: '유틸리티',
  Offensive: '공격',
  Attributes: '능력치',
  Defensive: '방어',
  Sorceries: '마술/기도',
  'Character Specific': '캐릭터 전용',
  'Starting Items': '시작 아이템',
  Impairment: '상태 이상',
  'Status Effect': '상태 효과',
  'Armament Skills': '무기 기술',
};

function matchesOptionSearch(option: RelicEffect, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [option.id, option.name, option.category, option.type, option.desc]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function OptionCard({ option }: { option: RelicEffect }) {
  const category = option.category ?? '기타';
  const categoryLabel = categoryLabels[category] ?? category;

  return (
    <article className="option-card">
      <div className="option-card-header">
        <span className="option-category">{categoryLabel}</span>
        <span className="option-id">#{option.id}</span>
      </div>
      <h3>{option.name}</h3>
      {option.desc ? <p>{option.desc}</p> : <p className="muted-text">설명 없음</p>}
      <div className="option-meta-row">
        <span>{option.type === 'weapon' ? '무기 옵션' : '유물 옵션'}</span>
        <span>{option.stackable ? '중첩 가능' : '중첩 불가'}</span>
        {option.unobtainable ? <span>획득 불가</span> : null}
      </div>
    </article>
  );
}

function OptionsPage({ searchQuery }: { searchQuery: string }) {
  const filteredOptions = useMemo(
    () => relicEffectsKo.filter((option) => matchesOptionSearch(option, searchQuery)),
    [searchQuery],
  );

  return (
    <section className="options-page" aria-labelledby="options-title">
      <div className="options-page-heading">
        <div>
          <p className="list-page-kicker">relic_desc_ko</p>
          <h2 id="options-title">옵션</h2>
        </div>
        <span className="option-count">
          {filteredOptions.length} / {relicEffectsKo.length}
        </span>
      </div>

      <div className="option-card-grid">
        {filteredOptions.map((option) => (
          <OptionCard key={`${option.type}-${option.id}`} option={option} />
        ))}
      </div>
    </section>
  );
}

export default OptionsPage;
