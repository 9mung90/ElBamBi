import { useMemo, useState, type KeyboardEvent } from 'react';
import { nightfarers, type Nightfarer } from '../data/nightfarers';
import { getWeaponGroupIdByName } from './WeaponsPage';

type CharactersPageProps = {
  searchQuery: string;
  onSelectWeapon?: (weaponGroupId: number) => void;
};

const nightAssetUrls = import.meta.glob('../assets/images/night/**/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

const nightAssetUrlsByLower = new Map(
  Object.entries(nightAssetUrls).map(([path, url]) => [path.toLowerCase(), url]),
);

const skinAssetUrls = import.meta.glob('../assets/images/skins/**/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

const commonSkinNames: Record<number, string> = {
  0: '일반',
  1: '여명',
  2: '암흑',
  3: '추억',
};

const characterSkinNames: Record<number, Record<number, string>> = {
  0: {
    4: '심연을 걷는 자',
    5: '사자기사',
  },
  1: {
    4: '태양의 기사',
    5: '방랑 기사',
  },
  2: {
    4: '약지',
    5: '용병 기사',
  },
  3: {
    4: '검은 가죽',
    5: '어둠',
  },
  4: {
    4: '바위와도 같은',
    5: '카타리나',
  },
  5: {
    4: '그림 속 수도녀',
    5: '용의 학원',
  },
  6: {
    4: '이단 마술사',
    5: '인과의 녹의',
  },
  7: {
    4: '가시',
    5: '흑교회',
  },
  8: {
    4: '교회사',
    5: '황의',
  },
  9: {
    4: '놋쇠',
    5: '왕의 칼날',
  },
};

function getSkinName(nightfarerIndex: number, skinIndex: number) {
  return commonSkinNames[skinIndex] ?? characterSkinNames[nightfarerIndex]?.[skinIndex] ?? '임시';
}

function resolveNightAssetUrl(url: string) {
  if (!url.startsWith('/assets/images/night/')) return url;

  const assetPath = url.replace('/assets/images/night/', '../assets/images/night/');
  return nightAssetUrls[assetPath] ?? nightAssetUrlsByLower.get(assetPath.toLowerCase()) ?? url;
}

function getSkinEntries(nightfarerIndex: number) {
  return Object.entries(skinAssetUrls)
    .map(([path, imageUrl]) => {
      const match = path.match(/\/skins\/(\d+)\/(\d+)\.webp$/);
      if (!match) return null;

      const characterIndex = Number(match[1]);
      const skinIndex = Number(match[2]);
      if (characterIndex !== nightfarerIndex) return null;

      return {
        imageUrl,
        index: skinIndex,
        name: getSkinName(nightfarerIndex, skinIndex),
      };
    })
    .filter((entry): entry is { imageUrl: string; index: number; name: string } => Boolean(entry))
    .sort((left, right) => left.index - right.index);
}

function splitUrls(urls: string) {
  return urls
    .split('|')
    .map((url) => url.trim())
    .filter(Boolean)
    .map(resolveNightAssetUrl);
}

function getSkillEntries(nightfarer: Nightfarer) {
  const names = [nightfarer.skills, nightfarer.skill1, nightfarer.skill2, nightfarer.skill3].filter(
    Boolean,
  );
  const descriptions = [
    nightfarer.description,
    nightfarer.description1,
    nightfarer.description2,
    '',
  ];
  const imageUrls = splitUrls(nightfarer.skillImageUrls);

  return names.map((name, index) => ({
    name,
    description: descriptions[index] ?? '',
    imageUrl: imageUrls[index] ?? '',
  }));
}

function getEquipmentEntries(nightfarer: Nightfarer) {
  const names = [nightfarer.equipment, nightfarer.equipment1, nightfarer.equipment2].filter(
    Boolean,
  ).filter((name) => !(nightfarer.index === 4 && name === "Raider's Greataxe"));
  const imageUrls = splitUrls(nightfarer.equipmentImageUrls);

  return names.map((name, index) => ({
    name,
    imageUrl: imageUrls[index] ?? '',
  }));
}

function matchesCharacterSearch(nightfarer: Nightfarer, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    nightfarer.name,
    nightfarer.skills,
    nightfarer.skill1,
    nightfarer.skill2,
    nightfarer.skill3,
    nightfarer.description,
    nightfarer.description1,
    nightfarer.description2,
    nightfarer.equipment,
    nightfarer.equipment1,
    nightfarer.equipment2,
    nightfarer.rawText,
    nightfarer.aboutText,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function isMobileCharacterCardLayout() {
  return window.matchMedia('(max-width: 760px)').matches;
}

function CharactersPage({ searchQuery, onSelectWeapon }: CharactersPageProps) {
  const [selectedNightfarerIndex, setSelectedNightfarerIndex] = useState<number | null>(null);
  const [expandedNightfarerIndex, setExpandedNightfarerIndex] = useState<number | null>(null);
  const filteredCharacters = useMemo(
    () => nightfarers.filter((nightfarer) => matchesCharacterSearch(nightfarer, searchQuery)),
    [searchQuery],
  );
  const selectedNightfarer =
    selectedNightfarerIndex === null
      ? null
      : nightfarers.find((nightfarer) => nightfarer.index === selectedNightfarerIndex) ?? null;
  const selectedSkins = useMemo(
    () => (selectedNightfarer ? getSkinEntries(selectedNightfarer.index) : []),
    [selectedNightfarer],
  );

  function handleCharacterCardKeyDown(event: KeyboardEvent<HTMLElement>, nightfarerIndex: number) {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;

    event.preventDefault();
    if (isMobileCharacterCardLayout()) {
      setExpandedNightfarerIndex((currentIndex) =>
        currentIndex === nightfarerIndex ? null : nightfarerIndex,
      );
      return;
    }
    setSelectedNightfarerIndex(nightfarerIndex);
  }

  if (selectedNightfarer) {
    return (
      <section className="options-page" aria-labelledby="character-skins-title">
        <div className="options-page-heading">
          <div>
            <h2 id="character-skins-title">{selectedNightfarer.name} 스킨</h2>
          </div>
          <button type="button" className="skin-back-button" onClick={() => setSelectedNightfarerIndex(null)}>
            캐릭터 목록
          </button>
        </div>

        <div className="skin-card-grid">
          {selectedSkins.map((skin) => (
            <article className="skin-card" key={`${selectedNightfarer.index}-${skin.index}`}>
              <img src={skin.imageUrl} alt={`${selectedNightfarer.name} ${skin.name}`} />
              <span className="skin-card-name">{skin.name}</span>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="options-page" aria-labelledby="characters-title">
      <div className="options-page-heading">
        <div>
          <h2 id="characters-title">캐릭터</h2>
        </div>
      </div>

      <div className="character-card-grid">
        {filteredCharacters.map((nightfarer) => {
          const skills = getSkillEntries(nightfarer);
          const equipment = getEquipmentEntries(nightfarer);
          const isExpanded = expandedNightfarerIndex === nightfarer.index;

          return (
            <article
              className={`character-card character-card-button${isExpanded ? ' is-expanded' : ''}`}
              key={nightfarer.index}
              role="button"
              tabIndex={0}
              aria-expanded={isExpanded}
              onClick={() => {
                if (isMobileCharacterCardLayout()) {
                  setExpandedNightfarerIndex((currentIndex) =>
                    currentIndex === nightfarer.index ? null : nightfarer.index,
                  );
                  return;
                }
                setSelectedNightfarerIndex(nightfarer.index);
              }}
              onKeyDown={(event) => handleCharacterCardKeyDown(event, nightfarer.index)}
            >
              <div className="character-card-top">
                <img
                  src={resolveNightAssetUrl(nightfarer.nameImageUrl)}
                  alt=""
                  className="character-portrait"
                />
                <div>
                  <h3>{nightfarer.name}</h3>
                  <p>{nightfarer.rawText}</p>
                </div>
              </div>

              <div className="character-card-details">
                {nightfarer.aboutText ? <p className="character-about">{nightfarer.aboutText}</p> : null}

              <div className="character-section">
                <h4>스킬</h4>
                <div className="character-list">
                  {skills.map((skill) => (
                    <div className="character-list-item" key={skill.name}>
                      {skill.imageUrl ? <img src={skill.imageUrl} alt="" /> : null}
                      <div>
                        <strong>{skill.name}</strong>
                        {skill.description ? <p>{skill.description}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {equipment.length ? (
                <div className="character-section">
                  <h4>장비</h4>
                  <div className="equipment-row">
                    {equipment.map((item) => {
                      const weaponGroupId = getWeaponGroupIdByName(item.name);
                      const content = (
                        <>
                          {item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}
                          {item.name}
                        </>
                      );

                      return weaponGroupId && onSelectWeapon ? (
                        <button
                          type="button"
                          className="equipment-pill equipment-pill-button"
                          key={item.name}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectWeapon(weaponGroupId);
                          }}
                        >
                          {content}
                        </button>
                      ) : (
                        <span className="equipment-pill" key={item.name}>
                          {content}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : null}

                <button
                  type="button"
                  className="character-skin-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedNightfarerIndex(nightfarer.index);
                  }}
                >
                  스킨 보기
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default CharactersPage;
