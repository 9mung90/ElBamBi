import { useMemo, useRef, useState } from 'react';
import { characterNames, characterStats, type CharacterStats } from '../data/characters';
import { nightfarers, type Nightfarer } from '../data/nightfarers';
import { relicEffectsKo, relicWeapons, type RelicEffect, type RelicWeapon } from '../data/relics';
import ResponsiveSelect from '../components/ResponsiveSelect';

type StatKey = 'STR' | 'DEX' | 'INT' | 'FAI' | 'ARC' | 'VIG' | 'MND' | 'END';
type DamageKey = 'Phys' | 'Magic' | 'Fire' | 'Lightning' | 'Holy';
type ResourceKey = 'HP' | 'FP' | 'Stamina';
type CombatMetric = 'attack' | 'reduction';

type StatMap = Record<StatKey, number>;
type ResourceAdjustment = Record<ResourceKey, { flat: number; percent: number }>;
type SelectedEffect = { entryId: number; id: string | number; valueIndex: number };
type CombatModifier = {
  metric: CombatMetric;
  targets: string[];
  rates: number[];
  direction: 1 | -1;
};
type CombatSummaryRow = {
  target: string;
  metric: CombatMetric;
  factor: number;
  percent: number;
  count: number;
};

const statKeys: StatKey[] = ['STR', 'DEX', 'INT', 'FAI', 'ARC', 'VIG', 'MND', 'END'];
const attackStats: StatKey[] = ['STR', 'DEX', 'INT', 'FAI', 'ARC'];
const damageKeys: DamageKey[] = ['Phys', 'Magic', 'Fire', 'Lightning', 'Holy'];
const resourceBarMaxValues: Record<ResourceKey, number> = {
  HP: 2500,
  FP: 1500,
  Stamina: 1000,
};
const maxSelectedEffectCount = 25;

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
const elementalDamageLabels = ['마력', '화염', '벼락', '신성'];

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

function formatPercent(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatMultiplier(value: number) {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(3).replace(/0+$/g, '').replace(/\.$/g, '');
}

function getEffectStackGroup(effect: RelicEffect) {
  return effect.name
    .replace(/\+\d+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSameOptionStackBlocked(effect: RelicEffect) {
  return effect.stackable === false || /같은 효과끼리는 중첩되지 않습니다/.test(effect.desc ?? '');
}

function extractPercentRates(value: string) {
  return [...value.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((match) => Number(match[1]));
}

function normalizeCombatTargets(rawTarget: string, metric: CombatMetric) {
  const cleaned = rawTarget
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/.*동안\s*/g, '')
    .replace(/.*후\s*/g, '')
    .replace(/.*시\s*/g, '')
    .replace(/.*때\s*/g, '')
    .replace(/[,\s]+$/g, '')
    .trim();
  const suffix = metric === 'attack' ? '공격력' : '경감률';

  if (!cleaned || cleaned === '자신과 주위 아군의' || cleaned === '주위 아군의') {
    return [`전체 ${suffix}`];
  }

  if (cleaned.includes('물리/마력/화염/벼락/신성')) {
    return ['물리', ...elementalDamageLabels].map((label) => `${label} ${suffix}`);
  }

  if (cleaned.includes('마력/화염/벼락/신성') || cleaned.includes('속성')) {
    return elementalDamageLabels.map((label) => `${label} ${suffix}`);
  }

  for (const label of ['물리', '마력', '화염', '벼락', '신성']) {
    if (cleaned.includes(label)) return [`${label} ${suffix}`];
  }

  const knownTargets = [
    '근접',
    '양손 잡기',
    '이도류',
    '전투 기술',
    '캐릭터 스킬',
    '마술/기도',
    '마술',
    '기도',
    '차지 강공격',
    '차지 공격',
    '점프 공격',
    '대시 공격',
    '구르기 공격',
    '가드 카운터',
    '관통 카운터',
    '치명적인 일격',
    '사격',
    '화살/볼트',
    '투척 항아리',
    '투척 나이프',
    '휘석/중력석 아이템',
    '포효와 브레스',
    '조향술',
  ];
  const known = knownTargets.find((target) => cleaned.includes(target));
  if (!known && /(받으면|발생하면|있을|미만|최대|쓰러뜨릴|쓰러뜨리|명중하면|사용하면)/.test(cleaned)) {
    return [`전체 ${suffix}`];
  }

  return [`${known ?? cleaned} ${suffix}`];
}

function parseCombatModifiers(effect: RelicEffect): CombatModifier[] {
  const text = `${effect.name}. ${effect.desc ?? ''}`;
  const modifiers: CombatModifier[] = [];
  const sentences = text.split(/[.。]/g).map((sentence) => sentence.trim()).filter(Boolean);

  for (const sentence of sentences) {
    const pattern =
      /([가-힣A-Za-z0-9/·,\s[\]]{0,52}?)(공격력|경감률)(?:이|가|을|를)?\s*((?:\d+(?:\.\d+)?\s*%\s*(?:\/\s*)?)+)\s*(상승|저하|감소|증가|낮춥니다?)/g;
    const inheritedAction = /(상승|저하|감소|증가|낮춥니다?)/.exec(sentence)?.[1];
    const candidateSentences = [
      sentence,
      ...(inheritedAction
        ? sentence
            .split(',')
            .map((part) => part.trim())
            .filter((part) => part && !/(상승|저하|감소|증가|낮춥니다?)/.test(part))
            .map((part) => `${part} ${inheritedAction}`)
        : []),
    ];
    const seenSegments = new Set<string>();

    for (const candidate of candidateSentences) {
      for (const match of candidate.matchAll(pattern)) {
        const rates = extractPercentRates(match[3]);
        if (!rates.length) continue;

        const metric: CombatMetric = match[2] === '공격력' ? 'attack' : 'reduction';
        const action = match[4];
        const direction: 1 | -1 = action.includes('상승') || action.includes('증가') ? 1 : -1;
        const targets = normalizeCombatTargets(match[1], metric);
        const segmentKey = `${metric}:${targets.join('/')}:${rates.join('/')}:${direction}`;
        if (seenSegments.has(segmentKey)) continue;

        seenSegments.add(segmentKey);
        modifiers.push({
          metric,
          targets,
          rates,
          direction,
        });
      }
    }

    if (!sentence.includes('경감률') && /받는 피해|피해를/.test(sentence)) {
      const rates = extractPercentRates(sentence);
      if (!rates.length) continue;

      const direction: 1 | -1 = /증가|더 받/.test(sentence) ? -1 : 1;
      let target = '';
      for (const label of ['물리', '마력', '화염', '벼락', '신성']) {
        if (sentence.includes(label)) target = label;
      }

      modifiers.push({
        metric: 'reduction',
        targets: target ? [`${target} 경감률`] : ['전체 경감률'],
        rates,
        direction,
      });
    }
  }

  return modifiers;
}

function getCombatModifierValueCount(effect: RelicEffect) {
  return Math.max(1, ...parseCombatModifiers(effect).map((modifier) => modifier.rates.length));
}

function getModifierRate(modifier: CombatModifier, valueIndex: number) {
  return modifier.rates[Math.min(valueIndex, modifier.rates.length - 1)] ?? 0;
}

function getEffectImpactSummary(effect: RelicEffect, valueIndex: number) {
  const parts = parseCombatModifiers(effect).map((modifier) => {
    const rate = getModifierRate(modifier, valueIndex);
    const sign = modifier.direction > 0 ? '+' : '-';
    return `${modifier.targets.join('/')} ${sign}${formatPercent(rate)}%`;
  });

  return parts.join(' · ');
}

function mergeCombatSummary(selectedEffects: Array<{ effect: RelicEffect; valueIndex: number }>) {
  const attack = new Map<string, { factor: number; count: number }>();
  const reduction = new Map<string, { damageTakenFactor: number; count: number }>();

  for (const { effect, valueIndex } of selectedEffects) {
    for (const modifier of parseCombatModifiers(effect)) {
      const rate = getModifierRate(modifier, valueIndex) / 100;

      for (const target of modifier.targets) {
        if (modifier.metric === 'attack') {
          const current = attack.get(target) ?? { factor: 1, count: 0 };
          current.factor *= Math.max(0, 1 + modifier.direction * rate);
          current.count += 1;
          attack.set(target, current);
        } else {
          const current = reduction.get(target) ?? { damageTakenFactor: 1, count: 0 };
          current.damageTakenFactor *= Math.max(0, modifier.direction > 0 ? 1 - rate : 1 + rate);
          current.count += 1;
          reduction.set(target, current);
        }
      }
    }
  }

  const attackRows: CombatSummaryRow[] = [...attack.entries()].map(([target, value]) => ({
    target,
    metric: 'attack',
    factor: value.factor,
    percent: (value.factor - 1) * 100,
    count: value.count,
  }));
  const reductionRows: CombatSummaryRow[] = [...reduction.entries()].map(([target, value]) => ({
    target,
    metric: 'reduction',
    factor: value.damageTakenFactor,
    percent: (1 - value.damageTakenFactor) * 100,
    count: value.count,
  }));

  return {
    attackRows: attackRows.sort((a, b) => a.target.localeCompare(b.target, 'ko')),
    reductionRows: reductionRows.sort((a, b) => a.target.localeCompare(b.target, 'ko')),
  };
}

function getWeaponDamageAttackFactor(summaryRows: CombatSummaryRow[], damageKey: DamageKey) {
  const damageTarget = `${damageLabels[damageKey]} 공격력`;
  return summaryRows.reduce((factor, row) => {
    if (row.target === '전체 공격력' || row.target === '근접 공격력' || row.target === damageTarget) {
      return factor * row.factor;
    }

    return factor;
  }, 1);
}

function applyAttackSummaryToWeapon(
  attack: ReturnType<typeof calculateWeaponAttack>,
  attackRows: CombatSummaryRow[],
) {
  const breakdown: Partial<Record<DamageKey, number>> = {};
  let total = 0;

  for (const key of damageKeys) {
    const value = attack.breakdown[key];
    if (!value) continue;

    const adjusted = Math.trunc(value * getWeaponDamageAttackFactor(attackRows, key));
    breakdown[key] = adjusted;
    total += adjusted;
  }

  return { breakdown, total };
}

function StatusBar({
  label,
  maxValue,
  base,
  value,
  color,
}: {
  label: string;
  maxValue: number;
  base: number;
  value: number;
  color: string;
}) {
  const delta = value - base;
  const width = Math.max(0, Math.min(100, (value / maxValue) * 100));

  return (
    <div className="calc-status-bar">
      <div className="calc-status-row">
        <span>{label}</span>
        <strong>
          {value}
          <small> / {maxValue}</small>
          {delta ? (
            <em className={delta > 0 ? 'is-positive' : 'is-negative'}>
              {delta > 0 ? ` +${delta}` : ` ${delta}`}
            </em>
          ) : null}
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
  const [selectedEffectEntries, setSelectedEffectEntries] = useState<SelectedEffect[]>([]);
  const nextSelectedEffectEntryId = useRef(1);
  const [weaponQuery, setWeaponQuery] = useState('');
  const [manualStats, setManualStats] = useState<Record<StatKey, number | null>>(() => {
    const stats: Record<string, number | null> = {};
    for (const key of statKeys) stats[key] = null;
    return stats as Record<StatKey, number | null>;
  });
  const [twoHanding, setTwoHanding] = useState(false);

  const baseStatsEntry = getStats(selectedCharacter, selectedLevel) ?? characterStats[0];
  const baseStats = statMapFromStats(baseStatsEntry);

  const selectedEffects = useMemo(
    () =>
      selectedEffectEntries
        .map((entry) => ({
          entryId: entry.entryId,
          effect: relicEffectsKo.find((effect) => effect.id === entry.id),
          valueIndex: entry.valueIndex,
        }))
        .filter((entry): entry is { entryId: number; effect: RelicEffect; valueIndex: number } =>
          Boolean(entry.effect),
        ),
    [selectedEffectEntries],
  );
  const selectedRelicEffects = useMemo(
    () => selectedEffects.map((entry) => entry.effect),
    [selectedEffects],
  );
  const effectAdjustment = useMemo(() => mergeEffectAdjustments(selectedRelicEffects), [selectedRelicEffects]);
  const combatSummary = useMemo(() => mergeCombatSummary(selectedEffects), [selectedEffects]);
  const combatOptionEffects = useMemo(
    () => relicEffectsKo.filter((effect) => parseCombatModifiers(effect).length > 0),
    [],
  );

  const finalStats = useMemo(() => {
    const next = emptyStats();
    for (const key of statKeys) {
      const manualValue = manualStats[key] ?? 0;
      next[key] = Math.max(1, baseStats[key] + effectAdjustment.stats[key] + manualValue);
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
    if (!normalized) return combatOptionEffects;

    return combatOptionEffects
      .filter((effect) => getEffectSearchText(effect).includes(normalized));
  }, [combatOptionEffects, effectQuery]);

  const weapons = useMemo(() => {
    const normalized = (weaponQuery || searchQuery).trim().toLowerCase();
    if (!normalized) return getRepresentativeWeapons(selectedCharacter);

    return relicWeapons
      .filter((weapon) => weapon.name.toLowerCase().includes(normalized))
      .slice(0, 40);
  }, [selectedCharacter, weaponQuery, searchQuery]);

  const weaponRows = weapons.map((weapon) => {
    const baseAttack = calculateWeaponAttack(weapon, baseStats, twoHanding);
    const statAttack = calculateWeaponAttack(weapon, finalStats, twoHanding);
    const finalAttack = applyAttackSummaryToWeapon(statAttack, combatSummary.attackRows);
    return {
      weapon,
      baseAttack,
      finalAttack,
      status: calculateStatus(weapon, finalStats),
    };
  });

  const addEffect = (effect: RelicEffect) => {
    setSelectedEffectEntries((current) => {
      if (current.length >= maxSelectedEffectCount) return current;

      const entryId = nextSelectedEffectEntryId.current;
      nextSelectedEffectEntryId.current += 1;

      return [...current, { entryId, id: effect.id, valueIndex: 0 }];
    });
  };

  const removeEffect = (entryId: number) => {
    setSelectedEffectEntries((current) => current.filter((entry) => entry.entryId !== entryId));
  };

  const updateEffectValue = (entryId: number, valueIndex: number) => {
    setSelectedEffectEntries((current) =>
      current.map((entry) => (entry.entryId === entryId ? { ...entry, valueIndex } : entry)),
    );
  };

  const getDisabledReason = (effect: RelicEffect) => {
    void getEffectStackGroup(effect);
    void isSameOptionStackBlocked(effect);

    return selectedEffectEntries.length >= maxSelectedEffectCount ? `최대 ${maxSelectedEffectCount}개` : '';
  };

  return (
    <section className="options-page calc-page" aria-labelledby="stats-calculator-title">
      <div className="options-page-heading">
        <div>
          <h2 id="stats-calculator-title">스탯 계산기</h2>
        </div>
      </div>

      <div className="calc-layout">
        <aside className="calc-panel">
          <div className="calc-control-grid">
            <label className="calc-character-control">
              캐릭터
              <ResponsiveSelect
                className="calc-character-select"
                value={selectedCharacter}
                ariaLabel="캐릭터"
                sheetTitle="캐릭터 선택"
                options={characterNames.map((name) => ({
                  value: name,
                  label: getCharacterDisplay(name),
                }))}
                onChange={(nextCharacter) => {
                  setSelectedCharacter(nextCharacter);
                  setWeaponQuery('');
                }}
              />
            </label>
            <div className="calc-level-control">
              <span>레벨</span>
              <div className="calc-level-stepper" aria-label="레벨 선택">
                <span>{selectedLevel}</span>
                <div className="calc-level-stepper-buttons">
                  <button
                    type="button"
                    aria-label="레벨 올리기"
                    disabled={selectedLevel >= 15}
                    onClick={() => setSelectedLevel((level) => Math.min(15, level + 1))}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label="레벨 내리기"
                    disabled={selectedLevel <= 1}
                    onClick={() => setSelectedLevel((level) => Math.max(1, level - 1))}
                  >
                    ▼
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="calc-toggle-row">
            <label>
              <input
                type="checkbox"
                checked={twoHanding}
                onChange={(event) => setTwoHanding(event.target.checked)}
              />
              양손잡기 근력 1.5배
            </label>
            <button
              type="button"
              onClick={() => {
                setSelectedLevel(1);
                setSelectedEffectEntries([]);
                setManualStats(() => {
                  const stats: Record<string, number | null> = {};
                  for (const key of statKeys) stats[key] = null;
                  return stats as Record<StatKey, number | null>;
                });
              }}
            >
              초기화
            </button>
          </div>

          <div className="calc-status-section">
            <StatusBar
              label="HP"
              maxValue={resourceBarMaxValues.HP}
              base={baseResources.HP}
              value={adjustedResources.HP}
              color="#cc5531"
            />
            <StatusBar
              label="FP"
              maxValue={resourceBarMaxValues.FP}
              base={baseResources.FP}
              value={adjustedResources.FP}
              color="#3d89a5"
            />
            <StatusBar
              label="스태미나"
              maxValue={resourceBarMaxValues.Stamina}
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
                <span title={key}>{statLabels[key]}</span>
                <span>{baseStats[key]}</span>
                <span>{effectAdjustment.stats[key]}</span>
                <input
                  type="number"
                  value={manualStats[key] ?? ''}
                  onChange={(event) =>
                    setManualStats((current) => ({
                      ...current,
                      [key]: event.target.value === '' ? null : Number(event.target.value),
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
              <h3>공격/경감 옵션</h3>
              <input
                type="search"
                value={effectQuery}
                onChange={(event) => setEffectQuery(event.target.value)}
                placeholder="공격력, 경감률 옵션 검색..."
              />
            </div>

            <div className="calc-combat-summary">
              <div>
                <strong>공격력</strong>
                {combatSummary.attackRows.length ? (
                  combatSummary.attackRows.map((row) => (
                    <span key={`${row.metric}-${row.target}`}>
                      {row.target} {row.percent >= 0 ? '+' : ''}
                      {formatPercent(row.percent)}%
                      <em>{row.count}개 곱연산</em>
                    </span>
                  ))
                ) : (
                  <p>적용된 공격력 옵션 없음</p>
                )}
              </div>
              <div>
                <strong>경감률</strong>
                {combatSummary.reductionRows.length ? (
                  combatSummary.reductionRows.map((row) => (
                    <span key={`${row.metric}-${row.target}`}>
                      {row.target} {row.percent >= 0 ? '+' : ''}
                      {formatPercent(row.percent)}%
                      <em>받는 피해 x{formatMultiplier(row.factor)}</em>
                    </span>
                  ))
                ) : (
                  <p>적용된 경감률 옵션 없음</p>
                )}
              </div>
            </div>

            <div className="calc-active-effects">
              {selectedEffects.length ? (
                selectedEffects.map(({ entryId, effect, valueIndex }) => {
                  const valueCount = getCombatModifierValueCount(effect);

                  return (
                    <div className="calc-active-effect-card" key={entryId}>
                      <button type="button" onClick={() => removeEffect(entryId)}>
                        {effect.name}
                        <span>삭제</span>
                      </button>
                      {valueCount > 1 ? (
                        <ResponsiveSelect
                          value={String(valueIndex)}
                          ariaLabel={`${effect.name} 수치 선택`}
                          sheetTitle="옵션 수치 선택"
                          options={Array.from({ length: valueCount }, (_, index) => ({
                            value: String(index),
                            label: getEffectImpactSummary(effect, index),
                          }))}
                          onChange={(nextValueIndex) => updateEffectValue(entryId, Number(nextValueIndex))}
                        />
                      ) : null}
                      <small>{getEffectImpactSummary(effect, valueIndex)}</small>
                    </div>
                  );
                })
              ) : (
                <p>선택된 옵션 없음</p>
              )}
            </div>

            <div className="calc-effect-results">
              {effectMatches.map((effect) => {
                const disabledReason = getDisabledReason(effect);

                return (
                  <button
                    key={effect.id}
                    type="button"
                    onClick={() => addEffect(effect)}
                    disabled={Boolean(disabledReason)}
                  >
                    <strong>{effect.name}</strong>
                    <span>{effect.desc ?? ''}</span>
                    <em>{disabledReason || getEffectImpactSummary(effect, 0)}</em>
                  </button>
                );
              })}
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
                        {damageKeys.map((key) => {
                          const finalValue = finalAttack.breakdown[key];
                          const baseValue = baseAttack.breakdown[key] ?? 0;
                          const damageDelta = (finalValue ?? 0) - baseValue;

                          return (
                            <td key={key}>
                              {finalValue ?? '-'}
                              {damageDelta ? (
                                <span className={damageDelta > 0 ? 'is-positive' : 'is-negative'}>
                                  {damageDelta > 0 ? `+${damageDelta}` : damageDelta}
                                </span>
                              ) : null}
                            </td>
                          );
                        })}
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
