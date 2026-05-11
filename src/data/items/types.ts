export type EtcItem = {
  id: number;
  game: string;
  title: string;
  type: string;
  description: string;
  ability?: string;
  img: string;
};

export type ConsumableItem = {
  id: number;
  name: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary' | 'unique' | string;
  maxStack?: number;
  bagcraftMaxStack?: number;
  bagcraftExperience?: number;
  bagcraftCategory?: number;
  name_kor: string;
  type_kor: string;
  description_kor: string;
  ability_kor: string;
  image?: string;
};
