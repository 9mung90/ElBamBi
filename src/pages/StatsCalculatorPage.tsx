import { useMemo, useState } from 'react';
import { characterNames, characterStats, type CharacterStats } from '../data/characters';
import { nightfarers, type Nightfarer } from '../data/nightfarers';
import { relicEffectsKo, relicWeapons, type RelicEffect, type RelicWeapon } from '../data/relics';

type StatKey = 'STR' | 'DEX' | 'INT' | 'FAI' | 'ARC' | 'VIG' | 'MND' | 'END';
type DamageKey = 'Phys' | 'Magic' | 'Fire' | 'Lightning' | 'Holy';
type ResourceKey = 'HP' | 'FP' | 'Stamina';

type StatMap = Record<StatKey, number>;
type ResourceAdjustment = Record<ResourceKey, { flat: number; percent: number }>;

const statKeys: StatKey[] = ['STR', 'DEX', 'INT', 'FAI', 'ARC', 'VIG', 'MND', 'END'];
const attackStats: StatKey[] = ['STR', 'DEX', 'INT', 'FAI', 'ARC'];
const damageKeys: DamageKey[] = ['Phys', 'Magic', 'Fire', 'Lightning', 'Holy'];

const statLabels: Record<StatKey, string> = {
  STR: '근력',
  DEX: '기량',
  INT: '지력',
  FAI: '신앙',
  ARC: '신비',
  VIG: '생명력',
  MND: '정신력',
  END: '지구력',
};

const damageLabels: Record<DamageKey, string> = {
  Phys: '물리',
  Magic: '마력',
  Fire: '화염',
  Lightning: '벼락',
  Holy: '신성',
};

const statusLabels: Record<string, string> = {
  Poison: '독',
  ScarletRot: '부패',
  Bloodloss: '출혈',
  Frostbite: '동상',
  Sleep: '수면',
  Madness: '발광',
  DeathBlight: '죽음',
};

const koreanStatWords: Array<[RegExp, StatKey]> = [
  [/근력/g, 'STR'],
  [/기량/g, 'DEX'],
  [/지력/g, 'INT'],
  [/신앙/g, 'FAI'],
  [/신비/g, 'ARC'],
  [/생명력/g, 'VIG'],
  [/정신력/g, 'MND'],
  [/지구력/g, 'END'],
];

const fixedEffectStatOffsets: Record<string, Partial<StatMap>> = {
  '7000000': { VIG: 1 },
  '7000001': { VIG: 2 },
  '7000002': { VIG: 3 },
  '7000100': { MND: 1 },
  '7000101': { MND: 2 },
  '7000102': { MND: 3 },
  '7000200': { END: 1 },
  '7000201': { END: 2 },
  '7000202': { END: 3 },
  '7000300': { STR: 1 },
  '7000301': { STR: 2 },
  '7000302': { STR: 3 },
  '7000400': { DEX: 1 },
  '7000401': { DEX: 2 },
  '7000402': { DEX: 3 },
  '7000500': { INT: 1 },
  '7000501': { INT: 2 },
  '7000502': { INT: 3 },
  '7000600': { FAI: 1 },
  '7000601': { FAI: 2 },
  '7000602': { FAI: 3 },
  '7000700': { ARC: 1 },
  '7000701': { ARC: 2 },
  '7000702': { ARC: 3 },
  '6830000': { STR: -3, INT: -3 },
  '6830100': { DEX: -3, FAI: -3 },
  '6830200': { DEX: -3, INT: -3 },
  '6830300': { FAI: -3, STR: -3 },
  '6830400': { VIG: -3, ARC: -3 },
};

const emptyStats = (): StatMap => ({
  STR: 0,
  DEX: 0,
  INT: 0,
  FAI: 0,
  ARC: 0,
  VIG: 0,
  MND: 0,
  END: 0,
});

const emptyResources = (): ResourceAdjustment => ({
  HP: { flat: 0, percent: 0 },
  FP: { flat: 0, percent: 0 },
  Stamina: { flat: 0, percent: 0 },
});

function getCharacterDisplay(character: string) {
  const index = characterNames.indexOf(character);
  return nightfarers[index]?.name ?? character;
}

function getNightfarer(character: string): Nightfarer | undefined {
  const index = characterNames.indexOf(character);
  return nightfarers[index];
}

function getStats(character: string, level: number) {
  return characterStats.find((entry) => entry.character === character && entry.level === level);
}

function statMapFromStats(stats: CharacterStats): StatMap {
  return {
    STR: stats.STR,
    DEX: stats.DEX,
    INT: stats.INT,
    FAI: stats.FAI,
    ARC: stats.ARC,
    VIG: stats.VIG,
    MND: stats.MND,
    END: stats.END,
  };
}

function resourceFromStats(stats: StatMap): Record<ResourceKey, number> {
  return {
    HP: 80 + stats.VIG * 20,
    FP: 45 + stats.MND * 5,
    Stamina: 48 + stats.END * 2,
  };
}

function parseLastNumber(value: string) {
  const matches = value.match(/\d+(?:\.\d+)?/g);
  if (!matches?.length) return 0;
  return Number(matches[matches.length - 1]);
}

function addResourceFromDescription(
  adjustment: ResourceAdjustment,
  text: string,
  resource: ResourceKey,
  labelPattern: RegExp,
) {
  const escaped = labelPattern.source;
  const flatPattern = new RegExp(`${escaped}[^.。]*?(\\d+(?:\\.\\d+)?)(?!%)\\s*상승`, 'g');
  const downFlatPattern = new RegExp(
    `${escaped}[^.。]*?(\\d+(?:\\.\\d+)?)(?!%)\\s*(?:감소|저하)`,
    'g',
  );
  const percentPattern = new RegExp(`${escaped}[^.。]*?(\\d+(?:\\.\\d+)?)%\\s*상승`, 'g');
  const downPercentPattern = new RegExp(`${escaped}[^.。]*?(\\d+(?:\\.\\d+)?)%\\s*(?:감소|저하)`, 'g');

  for (const match of text.matchAll(percentPattern)) adjustment[resource].percent += Number(match[1]);
  for (const match of text.matchAll(downPercentPattern))
    adjustment[resource].percent -= Number(match[1]);
  for (const match of text.matchAll(flatPattern)) adjustment[resource].flat += Number(match[1]);
  for (const match of text.matchAll(downFlatPattern)) adjustment[resource].flat -= Number(match[1]);
}

function getEffectAdjustment(effect: RelicEffect) {
  const stats = emptyStats();
  const resources = emptyResources();
  const text = `${effect.name} ${effect.desc ?? ''}`;
  const id = String(effect.id);
  const fixed = fixedEffectStatOffsets[id];

  if (fixed) {
    for (const key of statKeys) stats[key] += fixed[key] ?? 0;
  }

  for (const [wordPattern, stat] of koreanStatWords) {
    const plusName = new RegExp(`${wordPattern.source}\\+(\\d+)`).exec(effect.name);
    if (plusName) stats[stat] += Number(plusName[1]);

    const upPattern = new RegExp(`${wordPattern.source}(?:이|가|을|과|/[^\\s]+)?[^.。]*?상승`, 'g');
    const downPattern = new RegExp(`${wordPattern.source}(?:이|가|을|과|/[^\\s]+)?[^.。]*?(?:저하|감소)`, 'g');

    for (const match of text.matchAll(upPattern)) {
      stats[stat] += parseLastNumber(match[0]);
    }
    for (const match of text.matchAll(downPattern)) {
      stats[stat] -= parseLastNumber(match[0]);
    }
  }

  addResourceFromDescription(resources, text, 'HP', /최대 HP/);
  addResourceFromDescription(resources, text, 'FP', /최대 FP/);
  addResourceFromDescription(resources, text, 'Stamina', /최대 스태미나/);

  return { stats, resources };
}

function mergeEffectAdjustments(effects: RelicEffect[]) {
  const stats = emptyStats();
  const resources = emptyResources();

  for (const effect of effects) {
    const adjustment = getEffectAdjustment(effect);
    for (const key of statKeys) stats[key] += adjustment.stats[key];
    for (const key of Object.keys(resources) as ResourceKey[]) {
      resources[key].flat += adjustment.resources[key].flat;
      resources[key].percent += adjustment.resources[key].percent;
    }
  }

  return { stats, resources };
}

function applyResourceAdjustment(baseValue: number, adjustment: ResourceAdjustment[ResourceKey]) {
  return Math.max(1, Math.trunc(baseValue * (1 + adjustment.percent / 100) + adjustment.flat));
}

function calculateWeaponAttack(weapon: RelicWeapon, stats: StatMap, twoHanding: boolean) {
  const breakdown: Partial<Record<DamageKey, number>> = {};
  let total = 0;

  for (const key of damageKeys) {
    const base = weapon.baseDamage?.[key] ?? 0;
    if (!base) continue;

    let scalingBonus = 0;
    for (const stat of attackStats) {
      const scaling = (weapon.scaling?.[stat] ?? 0) / 100;
      const statValue = stat === 'STR' && twoHanding ? Math.floor(stats.STR * 1.5) : stats[stat];
      scalingBonus += base * scaling * (statValue / 100);
    }

    const value = Math.trunc(base + scalingBonus);
    breakdown[key] = value;
    total += value;
  }

  return { breakdown, total };
}

function calculateStatus(weapon: RelicWeapon, stats: StatMap) {
  const status: Record<string, number> = {};

  for (const [key, values] of Object.entries(weapon.statusDamage ?? {})) {
    const base = values.find((value) => value > 0) ?? 0;
    if (!base) continue;
    status[key] = Math.trunc(base * (1 + stats.ARC / 250));
  }

  return status;
}

function getRepresentativeWeapons(character: string) {
  const nightfarer = getNightfarer(character);
  const names = [nightfarer?.equipment, nightfarer?.equipment1, nightfarer?.equipment2]
    .filter(Boolean)
    .map((name) => String(name).trim());

  return relicWeapons.filter((weapon) => names.includes(weapon.name));
}

function getEffectSearchText(effect: RelicEffect) {
  return `${effect.name} ${effect.desc ?? ''} ${effect.category ?? ''}`.toLowerCase();
}

function StatusBar({
  label,
  base,
  value,
  color,
}: {
  label: string;
  base: number;
  value: number;
  color: string;
}) {
  const delta = value - base;
  const width = Math.min(100, (value / Math.max(base, value, 1)) * 100);

  return (
    <div className="calc-status-bar">
      <div className="calc-status-row">
        <span>{label}</span>
        <strong>
          {value}
          {delta ? <em>{delta > 0 ? ` +${delta}` : ` ${delta}`}</em> : null}
        </strong>
      </div>
      <div className="calc-bar-track">
        <span style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  );
}

function StatsCalculatorPage({ searchQuery }: { searchQuery: string }) {
  const [selectedCharacter, setSelectedCharacter] = useState(characterNames[0]);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [effectQuery, setEffectQuery] = useState('');
  const [selectedEffectIds, setSelectedEffectIds] = useState<Array<string | number>>([]);
  const [weaponQuery, setWeaponQuery] = useState('');
  const [manualStats, setManualStats] = useState<StatMap>(emptyStats);
  const [twoHanding, setTwoHanding] = useState(false);

  const baseStatsEntry = getStats(selectedCharacter, selectedLevel) ?? characterStats[0];
  const baseStats = statMapFromStats(baseStatsEntry);

  const selectedEffects = useMemo(
    () => relicEffectsKo.filter((effect) => selectedEffectIds.includes(effect.id)),
    [selectedEffectIds],
  );
  const effectAdjustment = useMemo(() => mergeEffectAdjustments(selectedEffects), [selectedEffects]);

  const finalStats = useMemo(() => {
    const next = emptyStats();
    for (const key of statKeys) {
      next[key] = Math.max(1, baseStats[key] + effectAdjustment.stats[key] + manualStats[key]);
    }
    return next;
  }, [baseStatsEntry, effectAdjustment, manualStats]);

  const baseResources = resourceFromStats(baseStats);
  const finalResources = resourceFromStats(finalStats);
  const adjustedResources: Record<ResourceKey, number> = {
    HP: applyResourceAdjustment(finalResources.HP, effectAdjustment.resources.HP),
    FP: applyResourceAdjustment(finalResources.FP, effectAdjustment.resources.FP),
    Stamina: applyResourceAdjustment(finalResources.Stamina, effectAdjustment.resources.Stamina),
  };

  const effectMatches = useMemo(() => {
    const normalized = effectQuery.trim().toLowerCase();
    if (!normalized) return relicEffectsKo.slice(0, 12);

    return relicEffectsKo
      .filter((effect) => getEffectSearchText(effect).includes(normalized))
      .slice(0, 12);
  }, [effectQuery]);

  const weapons = useMemo(() => {
    const normalized = (weaponQuery || searchQuery).trim().toLowerCase();
    if (!normalized) return getRepresentativeWeapons(selectedCharacter);

    return relicWeapons
      .filter((weapon) => weapon.name.toLowerCase().includes(normalized))
      .slice(0, 40);
  }, [selectedCharacter, weaponQuery, searchQuery]);

  const weaponRows = weapons.map((weapon) => {
    const baseAttack = calculateWeaponAttack(weapon, baseStats, twoHanding);
    const finalAttack = calculateWeaponAttack(weapon, finalStats, twoHanding);
    return {
      weapon,
      baseAttack,
      finalAttack,
      status: calculateStatus(weapon, finalStats),
    };
  });

  const addEffect = (effect: RelicEffect) => {
    setSelectedEffectIds((current) =>
      current.includes(effect.id) ? current : [...current, effect.id],
    );
  };

  const removeEffect = (effectId: string | number) => {
    setSelectedEffectIds((current) => current.filter((id) => id !== effectId));
  };

  return (
    <section className="options-page calc-page" aria-labelledby="stats-calculator-title">
      <div className="options-page-heading">
        <div>
          <p className="list-page-kicker">attack_power</p>
          <h2 id="stats-calculator-title">스탯 계산기</h2>
        </div>
        <span className="option-count">AP / 스탯 / 상태이상</span>
      </div>

      <div className="calc-layout">
        <aside className="calc-panel">
          <div className="calc-control-grid">
            <label>
              캐릭터
              <select
                value={selectedCharacter}
                onChange={(event) => {
                  setSelectedCharacter(event.target.value);
                  setWeaponQuery('');
                }}
              >
                {characterNames.map((name) => (
                  <option key={name} value={name}>
                    {getCharacterDisplay(name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              레벨
              <input
                type="number"
                min={1}
                max={15}
                value={selectedLevel}
                onChange={(event) => setSelectedLevel(Math.max(1, Math.min(15, Number(event.target.value))))}
              />
            </label>
          </div>

          <div className="calc-toggle-row">
            <label>
              <input
                type="checkbox"
                checked={twoHanding}
                onChange={(event) => setTwoHanding(event.target.checked)}
              />
              양손잡기 STR 1.5배
            </label>
            <button
              type="button"
              onClick={() => {
                setSelectedEffectIds([]);
                setManualStats(emptyStats());
              }}
            >
              초기화
            </button>
          </div>

          <div className="calc-status-section">
            <StatusBar label="HP" base={baseResources.HP} value={adjustedResources.HP} color="#cc5531" />
            <StatusBar label="FP" base={baseResources.FP} value={adjustedResources.FP} color="#3d89a5" />
            <StatusBar
              label="스태미나"
              base={baseResources.Stamina}
              value={adjustedResources.Stamina}
              color="#67b04e"
            />
          </div>

          <div className="calc-stat-table">
            <div className="calc-stat-head">
              <span>스탯</span>
              <span>기본</span>
              <span>옵션</span>
              <span>수동</span>
              <span>결과</span>
            </div>
            {statKeys.map((key) => (
              <div className="calc-stat-row" key={key}>
                <span title={statLabels[key]}>{key}</span>
                <span>{baseStats[key]}</span>
                <span>{effectAdjustment.stats[key]}</span>
                <input
                  type="number"
                  value={manualStats[key]}
                  onChange={(event) =>
                    setManualStats((current) => ({
                      ...current,
                      [key]: Number(event.target.value),
                    }))
                  }
                />
                <strong>{finalStats[key]}</strong>
              </div>
            ))}
          </div>
        </aside>

        <div className="calc-main">
          <section className="calc-panel">
            <div className="calc-section-heading">
              <h3>활성 옵션</h3>
              <input
                type="search"
                value={effectQuery}
                onChange={(event) => setEffectQuery(event.target.value)}
                placeholder="옵션 검색..."
              />
            </div>

            <div className="calc-active-effects">
              {selectedEffects.length ? (
                selectedEffects.map((effect) => (
                  <button key={effect.id} type="button" onClick={() => removeEffect(effect.id)}>
                    {effect.name}
                    <span>삭제</span>
                  </button>
                ))
              ) : (
                <p>선택된 옵션 없음</p>
              )}
            </div>

            <div className="calc-effect-results">
              {effectMatches.map((effect) => (
                <button key={effect.id} type="button" onClick={() => addEffect(effect)}>
                  <strong>{effect.name}</strong>
                  <span>{effect.desc ?? ''}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="calc-panel">
            <div className="calc-section-heading">
              <h3>무기 공격력</h3>
              <input
                type="search"
                value={weaponQuery}
                onChange={(event) => setWeaponQuery(event.target.value)}
                placeholder="무기 검색..."
              />
            </div>

            <div className="calc-table-wrap">
              <table className="calc-weapon-table">
                <thead>
                  <tr>
                    <th>무기</th>
                    <th>AP</th>
                    {damageKeys.map((key) => (
                      <th key={key}>{damageLabels[key]}</th>
                    ))}
                    <th>상태이상</th>
                  </tr>
                </thead>
                <tbody>
                  {weaponRows.map(({ weapon, baseAttack, finalAttack, status }) => {
                    const delta = finalAttack.total - baseAttack.total;
                    return (
                      <tr key={weapon.id}>
                        <td>{weapon.name}</td>
                        <td>
                          <strong>{finalAttack.total}</strong>
                          {delta ? <span className={delta > 0 ? 'is-positive' : 'is-negative'}>{delta > 0 ? `+${delta}` : delta}</span> : null}
                        </td>
                        {damageKeys.map((key) => (
                          <td key={key}>{finalAttack.breakdown[key] ?? '-'}</td>
                        ))}
                        <td>
                          {Object.keys(status).length
                            ? Object.entries(status)
                                .map(([key, value]) => `${statusLabels[key] ?? key} ${value}`)
                                .join(' / ')
                            : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

export default StatsCalculatorPage;
