import ashTopIcon from '../../assets/images/top_icon/ash.webp';
import bossTopIcon from '../../assets/images/top_icon/boss.webp';
import buildTopIcon from '../../assets/images/top_icon/imgi_6_152.webp';
import characterTopIcon from '../../assets/images/top_icon/character.webp';
import dealTopIcon from '../../assets/images/top_icon/deal.webp';
import etcTopIcon from '../../assets/images/top_icon/etc.webp';
import gestureTopIcon from '../../assets/images/top_icon/gesture.webp';
import mapTopIcon from '../../assets/images/top_icon/map.webp';
import optionMakeTopIcon from '../../assets/images/top_icon/optin_make.webp';
import optionTopIcon from '../../assets/images/top_icon/option.webp';
import relicTopIcon from '../../assets/images/top_icon/relic.webp';
import saveTopIcon from '../../assets/images/top_icon/save.webp';
import spellTopIcon from '../../assets/images/top_icon/ee.webp';
import talismanTopIcon from '../../assets/images/top_icon/talisman.webp';
import vesselTopIcon from '../../assets/images/top_icon/vessel.webp';
import weaponTopIcon from '../../assets/images/top_icon/weapone.webp';

import type { Category } from '../pageTypes';

export const categories: Category[] = [
  { id: 'characters', label: '캐릭터', icon: 'C', description: '캐릭터 목록입니다.' },
  { id: 'weapons', label: '무기', icon: 'W', description: '무기 목록 페이지입니다.' },
  { id: 'options', label: '옵션', icon: 'O', description: '유물 옵션 목록입니다.' },
  { id: 'stats-calculator', label: '계산기', icon: 'A', description: '스탯과 공격력 계산기입니다.' },
  { id: 'ashes', label: '전회', icon: 'S', description: '전회 목록 페이지입니다.' },
  { id: 'bosses', label: '보스', icon: 'B', description: '보스 목록입니다.' },
  { id: 'spells', label: '마술,기도', icon: 'M', description: '마술과 기도 목록 페이지입니다.' },
  { id: 'talismans', label: '탈리스만', icon: 'T', description: '탈리스만 목록 페이지입니다.' },
  { id: 'relics', label: '유물', icon: 'R', description: '유물 목록입니다.' },
  { id: 'map', label: '맵', icon: 'M', description: '맵 보기입니다.' },
  { id: 'builds', label: '빌드', icon: 'D', description: '빌드 공유 커뮤니티입니다.' },
  { id: 'relic-builder', label: '유물 제작', icon: 'B', description: '유물 옵션 3개를 규칙에 맞춰 조합합니다.' },
  { id: 'save-parser', label: '세이브', icon: 'P', description: 'Nightreign save relic parser test page.' },
  { id: 'vessels', label: '현기', icon: 'V', description: '그릇 목록입니다.' },
  { id: 'items', label: '기타', icon: 'E', description: '기타 아이템 목록 페이지입니다.' },
  { id: 'gestures', label: '제스처', icon: 'G', description: '제스처 목록 페이지입니다.' },
];

export const categoryIconAssets: Record<string, string> = {
  ashes: ashTopIcon,
  bosses: bossTopIcon,
  builds: buildTopIcon,
  characters: characterTopIcon,
  gestures: gestureTopIcon,
  items: etcTopIcon,
  map: mapTopIcon,
  options: optionTopIcon,
  relics: relicTopIcon,
  'relic-builder': optionMakeTopIcon,
  'save-parser': saveTopIcon,
  spells: spellTopIcon,
  'stats-calculator': dealTopIcon,
  talismans: talismanTopIcon,
  vessels: vesselTopIcon,
  weapons: weaponTopIcon,
};
