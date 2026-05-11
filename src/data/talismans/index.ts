import talismansJson from './raw/talismans.json';
import talismansTextBasedJson from './raw/talismans_text_based.json';
import type { Talisman } from './types';

type TextBasedTalisman = {
  name: string;
  effects?: string[];
};

const markerPattern = /[◇☆●]/g;

function normalizeName(value: string) {
  return value
    .replace(markerPattern, '')
    .replace(/\s*\+\s*/g, ' + ')
    .replace(/\s+/g, ' ')
    .trim();
}

function displayName(value: string) {
  return value.replace(/\s*●/g, '').trim();
}

function getNightreignAbility(effects: string[] = []) {
  return effects
    .map((effect) => effect.trim())
    .filter((effect) => /\d/.test(effect))
    .filter((effect) => effect.length <= 45)
    .join(', ');
}

const rawTalismans = talismansJson as unknown as Talisman[];
const textBasedTalismans = talismansTextBasedJson as TextBasedTalisman[];

const talismanByName = new Map<string, Talisman>();

for (const talisman of rawTalismans) {
  const normalizedTitle = normalizeName(talisman.title);
  talismanByName.set(normalizedTitle, talisman);

  if (normalizedTitle === '은혜의 물방울의 탈리스만') {
    talismanByName.set('은총의 물방울의 탈리스만', talisman);
  }

  if (normalizedTitle === '포효의 탈리스만') {
    talismanByName.set('포효의 메달리온', talisman);
  }
}

export const talismans: Talisman[] = textBasedTalismans.flatMap((textBasedTalisman) => {
  const talisman = talismanByName.get(normalizeName(textBasedTalisman.name));
  if (!talisman) return [];

  const ability = getNightreignAbility(textBasedTalisman.effects);
  const { ability: _originalAbility, ...talismanWithoutAbility } = talisman;

  return [
    {
      ...talismanWithoutAbility,
      title: displayName(textBasedTalisman.name),
      ...(ability ? { ability } : {}),
    },
  ];
});

export type { Talisman };
