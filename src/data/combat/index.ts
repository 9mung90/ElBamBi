import attackPowerSnippetsJson from './raw/attack-power-snippets.json';
import type { AttackPowerSnippet } from './types';

export const attackPowerSnippets =
  attackPowerSnippetsJson as unknown as AttackPowerSnippet[];

export type { AttackPowerSnippet } from './types';
