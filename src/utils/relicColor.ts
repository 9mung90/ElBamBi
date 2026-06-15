export type RelicColorToken = 'red' | 'blue' | 'yellow' | 'green' | 'white' | 'builder';

const relicColorAliases: Record<string, RelicColorToken> = {
  r: 'red',
  red: 'red',
  crimson: 'red',
  '\ube68\uac15': 'red',
  '\ube68\uac04\uc0c9': 'red',
  b: 'blue',
  blue: 'blue',
  azure: 'blue',
  '\ud30c\ub791': 'blue',
  '\ud30c\ub780\uc0c9': 'blue',
  '\uccad\uc0c9': 'blue',
  y: 'yellow',
  yellow: 'yellow',
  gold: 'yellow',
  golden: 'yellow',
  '\ub178\ub791': 'yellow',
  '\ub178\ub780\uc0c9': 'yellow',
  '\ud669\uc0c9': 'yellow',
  g: 'green',
  green: 'green',
  '\ucd08\ub85d': 'green',
  '\ucd08\ub85d\uc0c9': 'green',
  '\ub179\uc0c9': 'green',
  w: 'white',
  white: 'white',
  free: 'white',
  '\ud770\uc0c9': 'white',
  '\ubc31\uc0c9': 'white',
  '\uc790\uc720': 'white',
  builder: 'builder',
  crafted: 'builder',
  '\uc81c\uc791': 'builder',
};

const relicColorLabels: Record<RelicColorToken, string> = {
  red: '\ube68\uac15',
  blue: '\ud30c\ub791',
  yellow: '\ub178\ub791',
  green: '\ucd08\ub85d',
  white: '\uc790\uc720',
  builder: '\uc81c\uc791',
};

function normalizeColorText(color: string | number | undefined) {
  return String(color ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

export function normalizeRelicColor(color: string | number | undefined) {
  const normalizedColor = normalizeColorText(color);
  return relicColorAliases[normalizedColor] ?? '';
}

export function getRelicColorLabel(color: string | number | undefined) {
  const normalizedColor = normalizeRelicColor(color);
  return normalizedColor ? relicColorLabels[normalizedColor] : color ?? '-';
}

export function getRelicColorClass(color: string | number | undefined) {
  const normalizedColor = normalizeRelicColor(color);
  return normalizedColor ? `relic-color-${normalizedColor}` : '';
}

export function getRelicBorderClass(color: string | number | undefined) {
  const normalizedColor = normalizeRelicColor(color);
  return normalizedColor ? `relic-border-${normalizedColor}` : '';
}
