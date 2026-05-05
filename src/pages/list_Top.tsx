import { useMemo, useState } from 'react';
import AshesPage from './AshesPage';
import CharactersPage from './CharactersPage';
import GesturesPage from './GesturesPage';
import ItemsPage from './ItemsPage';
import OptionsPage from './OptionsPage';
import PlaceholderPage from './PlaceholderPage';
import RelicsPage from './RelicsPage';
import SpellsPage from './SpellsPage';
import StatsCalculatorPage from './StatsCalculatorPage';
import TalismansPage from './TalismansPage';
import VesselsPage from './VesselsPage';
import WeaponsPage from './WeaponsPage';
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

function ListTop() {
  const [selectedId, setSelectedId] = useState(categories[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWeaponGroupId, setSelectedWeaponGroupId] = useState<number | null>(null);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedId) ?? categories[0],
    [selectedId],
  );

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
          <button type="button" className="icon-button" aria-label="추가 필터">
            &#9881;
          </button>
          <button type="button" className="icon-button" aria-label="카테고리 필터">
            &#9776;
          </button>
        </div>

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
                  setSelectedWeaponGroupId(null);
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
        <CharactersPage searchQuery={searchQuery} />
      ) : selectedId === 'weapons' ? (
        <WeaponsPage
          searchQuery={searchQuery}
          selectedGroupId={selectedWeaponGroupId}
          onSelectGroup={(groupId) => {
            setSelectedWeaponGroupId(groupId);
            setSearchQuery('');
          }}
          onBack={() => setSelectedWeaponGroupId(null)}
        />
      ) : selectedId === 'options' ? (
        <OptionsPage searchQuery={searchQuery} />
      ) : selectedId === 'stats-calculator' ? (
        <StatsCalculatorPage searchQuery={searchQuery} />
      ) : selectedId === 'ashes' ? (
        <AshesPage searchQuery={searchQuery} />
      ) : selectedId === 'spells' ? (
        <SpellsPage searchQuery={searchQuery} />
      ) : selectedId === 'talismans' ? (
        <TalismansPage searchQuery={searchQuery} />
      ) : selectedId === 'relics' ? (
        <RelicsPage searchQuery={searchQuery} />
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
