import { useMemo } from 'react';
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

function resolveNightAssetUrl(url: string) {
  if (!url.startsWith('/assets/images/night/')) return url;

  const assetPath = url.replace('/assets/images/night/', '../assets/images/night/');
  return nightAssetUrls[assetPath] ?? nightAssetUrlsByLower.get(assetPath.toLowerCase()) ?? url;
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
  );
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

function CharactersPage({ searchQuery, onSelectWeapon }: CharactersPageProps) {
  const filteredCharacters = useMemo(
    () => nightfarers.filter((nightfarer) => matchesCharacterSearch(nightfarer, searchQuery)),
    [searchQuery],
  );

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

          return (
            <article className="character-card" key={nightfarer.index}>
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
                          onClick={() => onSelectWeapon(weaponGroupId)}
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
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default CharactersPage;
