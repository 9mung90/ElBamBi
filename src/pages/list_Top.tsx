import { useMemo, useState } from 'react';
import { ashes } from '../data/ashes';
import AshesPage from './AshesPage';
import BossesPage from './BossesPage';
import {
  bossFilterOptions,
  bossTypeLabels,
  createEmptyBossFilters,
  type BossFilters,
} from './bossFilters';
import CharactersPage from './CharactersPage';
import GesturesPage from './GesturesPage';
import ItemsPage from './ItemsPage';
import MapPage from './MapPage';
import OptionsPage, {
  createEmptyOptionFilters,
  optionCategoryLabels,
  optionFilterOptions,
  optionStackableLabels,
  optionTypeLabels,
  type OptionFilters,
} from './OptionsPage';
import PlaceholderPage from './PlaceholderPage';
import RelicBuilderPage from './RelicBuilderPage';
import RelicsPage from './RelicsPage';
import SaveParserPage from './SaveParserPage';
import SpellsPage from './SpellsPage';
import StatsCalculatorPage from './StatsCalculatorPage';
import TalismansPage from './TalismansPage';
import VesselsPage from './VesselsPage';
import WeaponsPage, {
  createEmptyWeaponFilters,
  weaponFilterOptions,
  type WeaponFilters,
} from './WeaponsPage';
import type { Category } from './pageTypes';
import './list_Top.css';

const categories: Category[] = [
  {
    id: 'characters',
    label: '캐릭터',
    icon: 'C',
    description: '캐릭터 목록입니다.',
  },
  {
    id: 'weapons',
    label: '무기',
    icon: 'W',
    description: '무기 목록 페이지 임시 영역입니다.',
  },
  {
    id: 'options',
    label: '옵션',
    icon: 'O',
    description: '유물 옵션 목록입니다.',
  },
  {
    id: 'stats-calculator',
    label: '계산기',
    icon: 'A',
    description: '스탯과 공격력 계산기입니다.',
  },
  {
    id: 'ashes',
    label: '전회',
    icon: 'S',
    description: '전회 목록 페이지 임시 영역입니다.',
  },
  {
    id: 'bosses',
    label: '보스',
    icon: 'B',
    description: '보스 목록입니다.',
  },
  {
    id: 'spells',
    label: '마술,기도',
    icon: 'M',
    description: '마술과 기도 목록 페이지 임시 영역입니다.',
  },
  {
    id: 'talismans',
    label: '탈리스만',
    icon: 'T',
    description: '탈리스만 목록 페이지 임시 영역입니다.',
  },
  {
    id: 'relics',
    label: '유물',
    icon: 'R',
    description: '유물 목록입니다.',
  },
  {
    id: 'map',
    label: '맵',
    icon: 'M',
    description: '맵 보기입니다.',
  },
  {
    id: 'relic-builder',
    label: '유물 제작',
    icon: 'B',
    description: '유물 옵션 3개를 규칙에 맞춰 조합합니다.',
  },
  {
    id: 'save-parser',
    label: 'Save',
    icon: 'P',
    description: 'Nightreign save relic parser test page.',
  },
  {
    id: 'vessels',
    label: '현기',
    icon: 'V',
    description: '현기 목록입니다.',
  },
  {
    id: 'items',
    label: '기타',
    icon: 'E',
    description: '기타 아이템 목록 페이지 임시 영역입니다.',
  },
  {
    id: 'gestures',
    label: '제스처',
    icon: 'G',
    description: '제스처 목록 페이지 임시 영역입니다.',
  },
];

function toggleFilterValue<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((currentValue) => currentValue !== value)
    : [...values, value];
}

function ListTop() {
  const [selectedId, setSelectedId] = useState(categories[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [weaponFilters, setWeaponFilters] = useState<WeaponFilters>(() => createEmptyWeaponFilters());
  const [optionFilters, setOptionFilters] = useState<OptionFilters>(() => createEmptyOptionFilters());
  const [bossFilters, setBossFilters] = useState<BossFilters>(() => createEmptyBossFilters());
  const [selectedWeaponGroupId, setSelectedWeaponGroupId] = useState<number | null>(null);
  const [focusedWeaponGroupId, setFocusedWeaponGroupId] = useState<number | null>(null);
  const [ashProperty, setAshProperty] = useState<string | null>(null);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedId) ?? categories[0],
    [selectedId],
  );
  const hasActiveWeaponFilters =
    weaponFilters.levels.length > 0 ||
    weaponFilters.types.length > 0 ||
    weaponFilters.genres.length > 0;
  const hasActiveOptionFilters =
    optionFilters.categories.length > 0 ||
    optionFilters.types.length > 0 ||
    optionFilters.stackable.length > 0;
  const hasActiveBossFilters = bossFilters.types.length > 0;
  const hasActiveAshFilters = ashProperty !== null;
  const canUseFilters =
    selectedId === 'weapons' || selectedId === 'options' || selectedId === 'ashes' || selectedId === 'bosses';

  const updateWeaponLevelFilter = (level: number) => {
    setWeaponFilters((currentFilters) => ({
      ...currentFilters,
      levels: toggleFilterValue(currentFilters.levels, level),
    }));
  };

  const updateWeaponTextFilter = (key: 'types' | 'genres', value: string) => {
    setWeaponFilters((currentFilters) => ({
      ...currentFilters,
      [key]: toggleFilterValue(currentFilters[key], value),
    }));
  };

  const updateOptionTextFilter = (key: 'categories' | 'types', value: string) => {
    setOptionFilters((currentFilters) => ({
      ...currentFilters,
      [key]: toggleFilterValue(currentFilters[key], value),
    }));
  };

  const updateOptionStackableFilter = (value: boolean) => {
    setOptionFilters((currentFilters) => ({
      ...currentFilters,
      stackable: toggleFilterValue(currentFilters.stackable, value),
    }));
  };

  const updateBossTypeFilter = (value: string) => {
    setBossFilters((currentFilters) => ({
      ...currentFilters,
      types: toggleFilterValue(currentFilters.types, value),
    }));
  };

  return (
    <main className="list-top-shell">
      <header className="list-top-header">
        <div className="game-title-row">
          <div className="game-title-icon" aria-hidden="true">
            N
          </div>
          <h1>Nightreign Data App</h1>
        </div>

        <div className="search-row">
          <span className="search-icon" aria-hidden="true">
            &#128269;
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="아이템 이름으로 검색..."
            aria-label="아이템 이름으로 검색"
          />
          <button
            type="button"
            className={`icon-button${canUseFilters && isFilterPanelOpen ? ' is-active' : ''}`}
            aria-label={`${selectedCategory.label} 필터`}
            aria-pressed={canUseFilters && isFilterPanelOpen}
            onClick={() => {
              if (!canUseFilters) return;
              setIsFilterPanelOpen((isOpen) => !isOpen);
            }}
          >
            &#9881;
          </button>
          <button type="button" className="icon-button" aria-label="카테고리 필터">
            &#9776;
          </button>
        </div>

        {selectedId === 'weapons' && isFilterPanelOpen ? (
          <section className="filter-panel" aria-label="Weapon filters">
            <div className="filter-panel-heading">
              <strong>Weapon Filters</strong>
              <button
                type="button"
                className="filter-reset-button"
                disabled={!hasActiveWeaponFilters}
                onClick={() => setWeaponFilters(createEmptyWeaponFilters())}
              >
                Reset
              </button>
            </div>

            <div className="filter-group">
              <span>Level</span>
              <div className="filter-chip-row">
                {weaponFilterOptions.levels.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`filter-chip${weaponFilters.levels.includes(level) ? ' is-selected' : ''}`}
                    onClick={() => updateWeaponLevelFilter(level)}
                  >
                    Lv. {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span>Type</span>
              <div className="filter-chip-row">
                {weaponFilterOptions.types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`filter-chip${weaponFilters.types.includes(type) ? ' is-selected' : ''}`}
                    onClick={() => updateWeaponTextFilter('types', type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span>Genre</span>
              <div className="filter-chip-row">
                {weaponFilterOptions.genres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    className={`filter-chip${weaponFilters.genres.includes(genre) ? ' is-selected' : ''}`}
                    onClick={() => updateWeaponTextFilter('genres', genre)}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {selectedId === 'ashes' && isFilterPanelOpen ? (
          <section className="filter-panel" aria-label="Ash filters">
            <div className="filter-panel-heading">
              <strong>속성</strong>
              <button
                type="button"
                className="filter-reset-button"
                disabled={!hasActiveAshFilters}
                onClick={() => setAshProperty(null)}
              >
                초기화
              </button>
            </div>

            <div className="filter-group">
              <span>속성</span>
              <div className="filter-chip-row">
                {Array.from(new Set(ashes.map((ash) => ash.property)))
                  .sort()
                  .map((prop) => (
                    <button
                      key={prop}
                      type="button"
                      className={`filter-chip${ashProperty === prop ? ' is-selected' : ''}`}
                      onClick={() => setAshProperty(ashProperty === prop ? null : prop)}
                    >
                      {prop}
                    </button>
                  ))}
              </div>
            </div>
          </section>
        ) : null}

        {selectedId === 'options' && isFilterPanelOpen ? (
          <section className="filter-panel" aria-label="Option filters">
            <div className="filter-panel-heading">
              <strong>옵션 필터</strong>
              <button
                type="button"
                className="filter-reset-button"
                disabled={!hasActiveOptionFilters}
                onClick={() => setOptionFilters(createEmptyOptionFilters())}
              >
                초기화
              </button>
            </div>

            <div className="filter-group">
              <span>분류</span>
              <div className="filter-chip-row">
                {optionFilterOptions.categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`filter-chip${optionFilters.categories.includes(category) ? ' is-selected' : ''}`}
                    onClick={() => updateOptionTextFilter('categories', category)}
                  >
                    {optionCategoryLabels[category] ?? category}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span>옵션 종류</span>
              <div className="filter-chip-row">
                {optionFilterOptions.types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`filter-chip${optionFilters.types.includes(type) ? ' is-selected' : ''}`}
                    onClick={() => updateOptionTextFilter('types', type)}
                  >
                    {optionTypeLabels[type] ?? type}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span>중첩 여부</span>
              <div className="filter-chip-row">
                {optionFilterOptions.stackable.map((stackable) => (
                  <button
                    key={String(stackable)}
                    type="button"
                    className={`filter-chip${optionFilters.stackable.includes(stackable) ? ' is-selected' : ''}`}
                    onClick={() => updateOptionStackableFilter(stackable)}
                  >
                    {optionStackableLabels[String(stackable)]}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {selectedId === 'bosses' && isFilterPanelOpen ? (
          <section className="filter-panel" aria-label="Boss filters">
            <div className="filter-panel-heading">
              <strong>보스 필터</strong>
              <button
                type="button"
                className="filter-reset-button"
                disabled={!hasActiveBossFilters}
                onClick={() => setBossFilters(createEmptyBossFilters())}
              >
                초기화
              </button>
            </div>

            <div className="filter-group">
              <span>보스 종류</span>
              <div className="filter-chip-row">
                {bossFilterOptions.types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`filter-chip${bossFilters.types.includes(type) ? ' is-selected' : ''}`}
                    onClick={() => updateBossTypeFilter(type)}
                  >
                    {bossTypeLabels[type] ?? type}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <nav className="category-tabs" aria-label="아이템 카테고리">
          {categories.map((category) => {
            const isSelected = category.id === selectedId;

            return (
              <button
                key={category.id}
                type="button"
                className={`category-tab${isSelected ? ' is-selected' : ''}`}
                onClick={() => {
                  setSelectedId(category.id);
                  setSearchQuery('');
                  setIsFilterPanelOpen(false);
                  setSelectedWeaponGroupId(null);
                  setFocusedWeaponGroupId(null);
                }}
                aria-pressed={isSelected}
              >
                <span className="category-icon" aria-hidden="true">
                  {category.icon}
                </span>
                <span>{category.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {selectedId === 'characters' ? (
        <CharactersPage
          searchQuery={searchQuery}
          onSelectWeapon={(weaponGroupId) => {
            setSelectedId('weapons');
            setSelectedWeaponGroupId(null);
            setFocusedWeaponGroupId(weaponGroupId);
            setSearchQuery('');
          }}
        />
      ) : selectedId === 'weapons' ? (
        <WeaponsPage
          searchQuery={searchQuery}
          filters={weaponFilters}
          selectedGroupId={selectedWeaponGroupId}
          focusedGroupId={focusedWeaponGroupId}
          onSelectGroup={(groupId) => {
            setSelectedWeaponGroupId(groupId);
            setFocusedWeaponGroupId(null);
            setSearchQuery('');
          }}
          onBack={() => {
            setSelectedWeaponGroupId(null);
            setFocusedWeaponGroupId(null);
          }}
        />
      ) : selectedId === 'options' ? (
        <OptionsPage searchQuery={searchQuery} filters={optionFilters} />
      ) : selectedId === 'stats-calculator' ? (
        <StatsCalculatorPage searchQuery={searchQuery} />
      ) : selectedId === 'ashes' ? (
        <AshesPage searchQuery={searchQuery} ashProperty={ashProperty} />
      ) : selectedId === 'bosses' ? (
        <BossesPage searchQuery={searchQuery} filters={bossFilters} />
      ) : selectedId === 'spells' ? (
        <SpellsPage searchQuery={searchQuery} />
      ) : selectedId === 'talismans' ? (
        <TalismansPage searchQuery={searchQuery} />
      ) : selectedId === 'relics' ? (
        <RelicsPage searchQuery={searchQuery} />
      ) : selectedId === 'map' ? (
        <MapPage />
      ) : selectedId === 'relic-builder' ? (
        <RelicBuilderPage searchQuery={searchQuery} />
      ) : selectedId === 'save-parser' ? (
        <SaveParserPage />
      ) : selectedId === 'vessels' ? (
        <VesselsPage searchQuery={searchQuery} />
      ) : selectedId === 'items' ? (
        <ItemsPage searchQuery={searchQuery} />
      ) : selectedId === 'gestures' ? (
        <GesturesPage searchQuery={searchQuery} />
      ) : (
        <PlaceholderPage category={selectedCategory} searchQuery={searchQuery} />
      )}
    </main>
  );
}

export default ListTop;
