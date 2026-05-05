export type CharacterName =
  | 'Wylder'
  | 'Guardian'
  | 'Ironeye'
  | 'Duchess'
  | 'Raider'
  | 'Revenant'
  | 'Recluse'
  | 'Executor'
  | 'Scholar'
  | 'Undertaker'
  | string;

export type CharacterStats = {
  character: CharacterName;
  level: number;
  STR: number;
  DEX: number;
  INT: number;
  FAI: number;
  ARC: number;
  VIG: number;
  MND: number;
  END: number;
  HP: number;
  FP: number;
  Stamina: number;
};
