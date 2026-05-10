import { useMemo } from 'react';
import ashIcon from '../assets/images/Icon/ash.webp';
import attackIcon from '../assets/images/Icon/attack.webp';
import bowIcon from '../assets/images/Icon/bow.webp';
import characterActiveIcon from '../assets/images/Icon/c_active.webp';
import characterSkillIcon from '../assets/images/Icon/c_skill.webp';
import fpIcon from '../assets/images/Icon/FP.webp';
import hpIcon from '../assets/images/Icon/HP.webp';
import hpImpairmentIcon from '../assets/images/Icon/HP1.webp';
import itemIcon from '../assets/images/Icon/item.webp';
import luneIcon from '../assets/images/Icon/lune.webp';
import staminaIcon from '../assets/images/Icon/SM.webp';
import spellIcon from '../assets/images/Icon/spell.webp';
import walkIcon from '../assets/images/Icon/walk.webp';
import { relicEffectsKo, type RelicEffect } from '../data/relics';

export type OptionFilters = {
  categories: string[];
  types: string[];
  stackable: boolean[];
};

export const optionCategoryLabels: Record<string, string> = {
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

export const optionTypeLabels: Record<string, string> = {
  relic: '유물 옵션',
  weapon: '무기 옵션',
  talisman: '탈리스만 옵션',
};

export const optionStackableLabels: Record<string, string> = {
  true: '중첩 가능',
  false: '중첩 불가',
};

const obtainableRelicEffects = relicEffectsKo.filter((option) => !option.unobtainable);

export const optionFilterOptions = buildOptionFilterOptions(obtainableRelicEffects);

function buildOptionFilterOptions(options: RelicEffect[]) {
  const categories: string[] = [];
  const types: string[] = [];

  options.forEach((option) => {
    if (option.category && !categories.includes(option.category)) categories.push(option.category);
    if (option.type && !types.includes(option.type)) types.push(option.type);
  });

  return {
    categories,
    types,
    stackable: [true, false],
  };
}

export function createEmptyOptionFilters(): OptionFilters {
  return {
    categories: [],
    types: [],
    stackable: [],
  };
}

function matchesOptionSearch(option: RelicEffect, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [option.id, option.name, option.category, option.type, option.desc]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function matchesOptionFilters(option: RelicEffect, filters: OptionFilters) {
  const stackable = Boolean(option.stackable);
  const matchesCategory =
    filters.categories.length === 0 || Boolean(option.category && filters.categories.includes(option.category));
  const matchesType = filters.types.length === 0 || filters.types.includes(option.type);
  const matchesStackable =
    filters.stackable.length === 0 || filters.stackable.includes(stackable);

  return matchesCategory && matchesType && matchesStackable;
}

function getOptionText(option: RelicEffect) {
  return [option.name, option.desc, option.category].filter(Boolean).join(' ');
}

function getOptionHeaderIcon(option: RelicEffect) {
  const text = getOptionText(option);

  if (option.category === 'Impairment' && text.includes('HP')) {
    return { src: hpImpairmentIcon, alt: 'HP 상태 이상' };
  }

  if (option.category === 'Character Specific' && text.includes('스킬')) {
    return { src: characterSkillIcon, alt: '캐릭터 스킬' };
  }

  if (
    option.category === 'Character Specific' &&
    (text.includes('어빌리티') || text.includes('패시브'))
  ) {
    return { src: characterActiveIcon, alt: '캐릭터 어빌리티' };
  }

  if (text.includes('HP')) return { src: hpIcon, alt: 'HP' };
  if (text.includes('FP')) return { src: fpIcon, alt: 'FP' };
  if (text.includes('룬')) return { src: luneIcon, alt: '룬' };
  if (option.category === 'Sorceries' || text.includes('마술') || text.includes('기도')) {
    return { src: spellIcon, alt: '마술/기도' };
  }
  if (text.includes('스태미나') || text.includes('스태미너')) {
    return { src: staminaIcon, alt: '스태미나' };
  }
  if (option.category === 'Starting Items' || text.includes('아이템')) {
    return { src: itemIcon, alt: '아이템' };
  }
  if (text.includes('걷기')) return { src: walkIcon, alt: '걷기' };
  if (
    ['활', '화살', '볼트', '대궁', '석궁', '발리스타'].some((keyword) =>
      text.includes(keyword),
    )
  ) {
    return { src: bowIcon, alt: '원거리' };
  }
  if (option.category === 'Armament Skills' || text.includes('전투 기술')) {
    return { src: ashIcon, alt: '전투 기술' };
  }
  if (option.category === 'Offensive' && option.desc?.includes('공격력')) {
    return { src: attackIcon, alt: '공격력' };
  }

  return { src: itemIcon, alt: '아이템' };
}

function OptionCard({ option }: { option: RelicEffect }) {
  const category = option.category ?? '기타';
  const categoryLabel = optionCategoryLabels[category] ?? category;
  const headerIcon = getOptionHeaderIcon(option);

  return (
    <article className="option-card">
      <div className="option-card-header">
        <span className="option-category">{categoryLabel}</span>
        <img className="option-header-icon" src={headerIcon.src} alt={headerIcon.alt} />
      </div>
      <h3>{option.name}</h3>
      <p>{option.desc ?? ''}</p>
      <div className="option-meta-row">
        <span>{optionTypeLabels[option.type] ?? option.type}</span>
        <span>{option.stackable ? optionStackableLabels.true : optionStackableLabels.false}</span>
      </div>
    </article>
  );
}

function OptionsPage({ searchQuery, filters }: { searchQuery: string; filters: OptionFilters }) {
  const filteredOptions = useMemo(
    () =>
      obtainableRelicEffects.filter(
        (option) => matchesOptionSearch(option, searchQuery) && matchesOptionFilters(option, filters),
      ),
    [filters, searchQuery],
  );

  return (
    <section className="options-page" aria-labelledby="options-title">
      <div className="options-page-heading">
        <div>
          <h2 id="options-title">옵션</h2>
        </div>
        <span className="option-count">
          {filteredOptions.length} / {obtainableRelicEffects.length}
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
