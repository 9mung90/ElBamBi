import { useMemo } from 'react';
import { bosses, bossesData, type Boss } from '../data/bosses';

const tokenLabels: Record<string, string> = {
  Bloodloss: '출혈',
  Fire: '화염',
  Frostbite: '동상',
  Holy: '신성',
  Immune: '면역',
  Lightning: '벼락',
  Madness: '발광',
  Magic: '마력',
  'No resistances': '저항 없음',
  'No weaknesses': '약점 없음',
  Pierce: '관통',
  Poison: '독',
  'Scarlet Rot': '붉은 부패',
  Slash: '참격',
  Sleep: '수면',
  Standard: '표준',
  Strike: '타격',
};

const bossTypeLabels: Record<string, string> = {
  'Evergoal Boss': '봉인감옥 보스',
  'Field Boss': '필드 보스',
  'Location Boss': '지역 보스',
  'Night Boss': '밤 보스',
};

const resistanceNames = new Set([
  'Poison',
  'Scarlet Rot',
  'Bloodloss',
  'Frostbite',
  'Sleep',
  'Madness',
]);

function labelToken(token: string) {
  return tokenLabels[token] ?? token;
}

function formatBossType(type: string) {
  return bossTypeLabels[type] ?? type;
}

function formatPairs(tokens: string[]) {
  if (!tokens.length) return [];
  if (tokens.length === 1) return [labelToken(tokens[0])];

  const pairs: string[] = [];
  for (let index = 0; index < tokens.length; index += 2) {
    const name = tokens[index];
    const value = tokens[index + 1];
    pairs.push(value ? `${labelToken(name)} ${value}` : labelToken(name));
  }
  return pairs;
}

function formatResistances(tokens: string[]) {
  const entries: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const name = tokens[index];
    if (!resistanceNames.has(name)) continue;

    const value = tokens[index + 1];
    const detail = tokens[index + 2];
    const hasDetail = detail && !resistanceNames.has(detail);

    entries.push(
      [labelToken(name), value ? labelToken(value) : null, hasDetail ? detail : null]
        .filter(Boolean)
        .join(' '),
    );

    index += hasDetail ? 2 : 1;
  }

  return entries;
}

function matchesBossSearch(boss: Boss, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    boss.name,
    boss.bossType,
    formatBossType(boss.bossType),
    boss.ids.bossId,
    boss.ids.npcId,
    boss.ids.instance,
    boss.hp.raw,
    boss.runes.raw,
    ...boss.weakAgainst,
    ...boss.strongAgainst,
    ...boss.resistances,
    ...formatPairs(boss.weakAgainst),
    ...formatPairs(boss.strongAgainst),
    ...formatResistances(boss.resistances),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function BossChipList({
  title,
  values,
  emptyText,
}: {
  title: string;
  values: string[];
  emptyText: string;
}) {
  return (
    <div className="boss-info-section">
      <strong>{title}</strong>
      <div className="boss-chip-row">
        {values.length ? (
          values.map((value) => <span key={value}>{value}</span>)
        ) : (
          <span className="is-muted">{emptyText}</span>
        )}
      </div>
    </div>
  );
}

function BossCard({ boss }: { boss: Boss }) {
  const weakAgainst = formatPairs(boss.weakAgainst);
  const strongAgainst = formatPairs(boss.strongAgainst);
  const resistances = formatResistances(boss.resistances);

  return (
    <article className="option-card boss-card">
      <div className="option-card-header">
        <span className="option-category">{formatBossType(boss.bossType)}</span>
      </div>

      <div>
        <h3>{boss.name}</h3>
        {boss.ids.instance ? <p className="muted-text">{boss.ids.instance}</p> : null}
      </div>

      <div className="boss-stat-grid" aria-label={`${boss.name} 보스 능력치`}>
        <div>
          <span>HP</span>
          <strong>{boss.hp.raw}</strong>
          <small>트리오 / 듀오 / 솔로</small>
        </div>
        <div>
          <span>룬</span>
          <strong>{boss.runes.raw}</strong>
          <small>트리오 / 듀오 / 솔로</small>
        </div>
      </div>

      <BossChipList title="약점" values={weakAgainst} emptyText="약점 없음" />
      <BossChipList title="강함" values={strongAgainst} emptyText="저항 없음" />
      <BossChipList title="상태 내성" values={resistances} emptyText="정보 없음" />

    </article>
  );
}

function BossesPage({ searchQuery }: { searchQuery: string }) {
  const filteredBosses = useMemo(
    () => bosses.filter((boss) => matchesBossSearch(boss, searchQuery)),
    [searchQuery],
  );

  return (
    <section className="options-page" aria-labelledby="bosses-title">
      <div className="options-page-heading">
        <div>
          <h2 id="bosses-title">보스</h2>
        </div>
        <span className="option-count">
          {filteredBosses.length} / {bossesData.count}
        </span>
      </div>

      <div className="boss-card-grid">
        {filteredBosses.map((boss, index) => (
          <BossCard key={`${boss.ids.bossId}-${boss.ids.instance ?? index}`} boss={boss} />
        ))}
      </div>
    </section>
  );
}

export default BossesPage;
