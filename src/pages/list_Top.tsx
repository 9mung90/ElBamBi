import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { RelicScanResult, CharacterSlot } from '../utils/nightreignSaveParser';
import { ashes } from '../data/ashes';
import AshesPage from './AshesPage';
import BossesPage from './BossesPage';
import BuildPage from './BuildPage';
import {
  bossFilterOptions,
  bossTypeLabels,
  createEmptyBossFilters,
  type BossFilters,
} from './bossFilters';
import CharactersPage from './CharactersPage';
import GesturesPage from './GesturesPage';
import ItemsPage from './ItemsPage';
import MapPage from './MapPage';
import OptionsPage, {
  createEmptyOptionFilters,
  optionCategoryLabels,
  optionFilterOptions,
  optionStackableLabels,
  optionTypeLabels,
  type OptionFilters,
} from './OptionsPage';
import PlaceholderPage from './PlaceholderPage';
import RelicBuilderPage from './RelicBuilderPage';
import RelicsPage from './RelicsPage';
import SaveParserPage from './SaveParserPage';
import SpellsPage, {
  createEmptySpellFilters,
  spellFilterOptions,
  type SpellFilters,
} from './SpellsPage';
import StatsCalculatorPage from './StatsCalculatorPage';
import TalismansPage from './TalismansPage';
import VesselsPage from './VesselsPage';
import WeaponsPage, {
  createEmptyWeaponFilters,
  weaponFilterOptions,
  type WeaponFilters,
} from './WeaponsPage';
import type { Category } from './pageTypes';
import ashTopIcon from '../assets/images/top_icon/ash.webp';
import bossTopIcon from '../assets/images/top_icon/boss.webp';
import buildTopIcon from '../assets/images/top_icon/imgi_6_152.webp';
import characterTopIcon from '../assets/images/top_icon/character.webp';
import dealTopIcon from '../assets/images/top_icon/deal.png';
import etcTopIcon from '../assets/images/top_icon/etc.webp';
import gestureTopIcon from '../assets/images/top_icon/gesture.webp';
import mapTopIcon from '../assets/images/top_icon/map.webp';
import optionMakeTopIcon from '../assets/images/top_icon/optin_make.webp';
import optionTopIcon from '../assets/images/top_icon/option.webp';
import relicTopIcon from '../assets/images/top_icon/relic.webp';
import saveTopIcon from '../assets/images/top_icon/save.webp';
import spellTopIcon from '../assets/images/top_icon/ee.webp';
import talismanTopIcon from '../assets/images/top_icon/talisman.webp';
import vesselTopIcon from '../assets/images/top_icon/vessel.webp';
import weaponTopIcon from '../assets/images/top_icon/weapone.webp';
import './list_Top.css';

const categories: Category[] = [
  {
    id: 'characters',
    label: '캐릭터',
    icon: 'C',
    description: '캐릭터 목록입니다.',
  },
  {
    id: 'weapons',
    label: '무기',
    icon: 'W',
    description: '무기 목록 페이지 임시 영역입니다.',
  },
  {
    id: 'options',
    label: '옵션',
    icon: 'O',
    description: '유물 옵션 목록입니다.',
  },
  {
    id: 'stats-calculator',
    label: '계산기',
    icon: 'A',
    description: '스탯과 공격력 계산기입니다.',
  },
  {
    id: 'ashes',
    label: '전회',
    icon: 'S',
    description: '전회 목록 페이지 임시 영역입니다.',
  },
  {
    id: 'bosses',
    label: '보스',
    icon: 'B',
    description: '보스 목록입니다.',
  },
  {
    id: 'spells',
    label: '마술,기도',
    icon: 'M',
    description: '마술과 기도 목록 페이지 임시 영역입니다.',
  },
  {
    id: 'talismans',
    label: '탈리스만',
    icon: 'T',
    description: '탈리스만 목록 페이지 임시 영역입니다.',
  },
  {
    id: 'relics',
    label: '유물',
    icon: 'R',
    description: '유물 목록입니다.',
  },
  {
    id: 'map',
    label: '맵',
    icon: 'M',
    description: '맵 보기입니다.',
  },
  {
    id: 'builds',
    label: '빌드',
    icon: 'D',
    description: '빌드 공유 커뮤니티입니다.',
  },
  {
    id: 'relic-builder',
    label: '유물 제작',
    icon: 'B',
    description: '유물 옵션 3개를 규칙에 맞춰 조합합니다.',
  },
  {
    id: 'save-parser',
    label: 'Save',
    icon: 'P',
    description: 'Nightreign save relic parser test page.',
  },
  {
    id: 'vessels',
    label: '현기',
    icon: 'V',
    description: '현기 목록입니다.',
  },
  {
    id: 'items',
    label: '기타',
    icon: 'E',
    description: '기타 아이템 목록 페이지 임시 영역입니다.',
  },
  {
    id: 'gestures',
    label: '제스처',
    icon: 'G',
    description: '제스처 목록 페이지 임시 영역입니다.',
  },
];

const categoryIconAssets: Record<string, string> = {
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

function toggleFilterValue<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((currentValue) => currentValue !== value)
    : [...values, value];
}

type AuthView = 'login' | 'signup' | null;
const defaultApiBaseUrl = 'https://k9e297bszl.execute-api.ap-northeast-2.amazonaws.com';
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl).replace(/\/$/, '');
const accessTokenStorageKey = 'accessToken';
const authUserIdStorageKey = 'nightreign:auth-user-id';
const lastPageStorageKey = 'nightreign:last-page';
const authViewStorageKey = 'nightreign:auth-view';
const pullToRefreshThreshold = 90;

function getStoredPageId() {
  const storedId = getStoredValue(lastPageStorageKey);
  if (storedId && categories.some((category) => category.id === storedId)) {
    return storedId;
  }
  return categories[0].id;
}

function getStoredAuthView(): AuthView {
  const storedView = getStoredValue(authViewStorageKey);
  return storedView === 'login' || storedView === 'signup' ? storedView : null;
}

function getStoredAuthUserId() {
  return getUserIdFromAccessToken(getStoredValue(accessTokenStorageKey)) ?? getStoredValue(authUserIdStorageKey);
}

function getStoredValue(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStoredValue(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked in some browser modes. Refresh still works with the in-memory state.
  }
}

function removeStoredValue(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures for the same reason as setStoredValue.
  }
}

function getMessageFromPayload(payload: unknown) {
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

function getAccessTokenFromPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const token = (payload as { accessToken?: unknown }).accessToken;
  return typeof token === 'string' && token ? token : null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const [, encodedPayload] = token.split('.');
  if (!encodedPayload) return null;

  try {
    const normalizedPayload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '=',
    );
    const binaryPayload = atob(paddedPayload);
    const bytes = Uint8Array.from(binaryPayload, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch (error) {
    console.warn('[auth] Failed to decode access token payload', error);
    return null;
  }
}

function getUserIdFromAccessToken(token: string | null) {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  const userId = payload?.userId ?? payload?.sub;
  if (typeof userId === 'string' && userId) return userId;
  if (typeof userId === 'number' && Number.isFinite(userId)) return String(userId);
  return null;
}

function getGoogleLoginUrl() {
  return `${apiBaseUrl}/oauth2/authorization/google`;
}

async function postAuthForm(path: string, data: Record<string, string>): Promise<string> {
  const body = new URLSearchParams(data);
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body,
  });
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  const payload = contentType.includes('application/json') && text ? JSON.parse(text) : text;
  const message = getMessageFromPayload(payload);
  const accessToken = getAccessTokenFromPayload(payload);
  const userId = getUserIdFromAccessToken(accessToken);
  if (accessToken) {
    setStoredValue(accessTokenStorageKey, accessToken);
  }
  if (userId) {
    setStoredValue(authUserIdStorageKey, userId);
  }

  if (!response.ok) {
    throw new Error(message || '요청을 처리하지 못했습니다.');
  }

  return message || (typeof payload === 'string' ? payload : '');
}

function AuthPage({
  view,
  onChangeView,
  onLoginSuccess,
}: {
  view: Exclude<AuthView, null>;
  onChangeView: (view: Exclude<AuthView, null>) => void;
  onLoginSuccess: (loginId: string) => void;
}) {
  const isLogin = view === 'login';
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      if (isLogin) {
        const result = await postAuthForm('/api/login', { loginId, password });
        setMessage(result || '로그인되었습니다.');
        onLoginSuccess(getStoredAuthUserId() ?? loginId);
        return;
      }

      const result = await postAuthForm('/api/sign', {
        loginId,
        password,
        confirmPassword,
        email,
        nickname,
      });
      setMessage(result || '회원가입이 완료되었습니다. 로그인해 주세요.');
      setPassword('');
      setConfirmPassword('');
      onChangeView('login');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-page" aria-labelledby="auth-page-title">
      <div className="auth-panel">
        <p className="list-page-kicker">Account</p>
        <h2 id="auth-page-title">{isLogin ? '로그인' : '회원가입'}</h2>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            아이디
            <input
              type="text"
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          {!isLogin ? (
            <label>
              닉네임
              <input
                type="text"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                autoComplete="nickname"
                required
              />
            </label>
          ) : null}
          {!isLogin ? (
            <label>
              이메일
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
          ) : null}
          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
            />
          </label>
          {!isLogin ? (
            <label>
              비밀번호 확인
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
          ) : null}
          {!isLogin ? (
            <p className="auth-help-text">아이디는 영문 소문자/숫자/밑줄 4~20자, 비밀번호는 영문/숫자/특수문자 포함 8~20자입니다.</p>
          ) : null}
          {error ? <p className="auth-message is-error">{error}</p> : null}
          {message ? <p className="auth-message is-success">{message}</p> : null}
          <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
            {isLogin ? '로그인' : '회원가입'}
          </button>
        </form>

        {isLogin ? (
          <div className="auth-oauth-area">
            <div className="auth-divider">
              <span>또는</span>
            </div>
            <a className="auth-google-button" href={getGoogleLoginUrl()}>
              <span aria-hidden="true">G</span>
              Google로 로그인
            </a>
          </div>
        ) : null}

        <div className="auth-switch-row">
          <span>{isLogin ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}</span>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMessage(null);
              onChangeView(isLogin ? 'signup' : 'login');
            }}
          >
            {isLogin ? '회원가입' : '로그인'}
          </button>
        </div>
      </div>
    </section>
  );
}

function ListTop() {
  const [selectedId, setSelectedId] = useState(getStoredPageId);
  const [authView, setAuthView] = useState<AuthView>(getStoredAuthView);
  const [authUserId, setAuthUserId] = useState<string | null>(getStoredAuthUserId);
  const [relicStorageRefreshKey, setRelicStorageRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [weaponFilters, setWeaponFilters] = useState<WeaponFilters>(() => createEmptyWeaponFilters());
  const [optionFilters, setOptionFilters] = useState<OptionFilters>(() => createEmptyOptionFilters());
  const [bossFilters, setBossFilters] = useState<BossFilters>(() => createEmptyBossFilters());
  const [spellFilters, setSpellFilters] = useState<SpellFilters>(() => createEmptySpellFilters());
  const [selectedWeaponGroupId, setSelectedWeaponGroupId] = useState<number | null>(null);
  const [focusedWeaponGroupId, setFocusedWeaponGroupId] = useState<number | null>(null);
  const [ashProperty, setAshProperty] = useState<string | null>(null);

  // SaveParserPage state
  const [characterSlot, setCharacterSlot] = useState<CharacterSlot>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saveParserResult, setSaveParserResult] = useState<RelicScanResult | null>(null);
  const [saveParserLogs, setSaveParserLogs] = useState<string[]>([]);
  const [saveParserError, setSaveParserError] = useState<string | null>(null);
  const [isSaveParserParsing, setIsSaveParserParsing] = useState(false);

  const CACHE_KEY = 'nightreign_save_parser_result';

  useEffect(() => {
    setStoredValue(lastPageStorageKey, selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (authView) {
      setStoredValue(authViewStorageKey, authView);
      return;
    }
    removeStoredValue(authViewStorageKey);
  }, [authView]);

  useEffect(() => {
    const tokenUserId = getUserIdFromAccessToken(getStoredValue(accessTokenStorageKey));
    if (tokenUserId && tokenUserId !== authUserId) {
      setAuthUserId(tokenUserId);
    }
  }, [authUserId]);

  useEffect(() => {
    if (authUserId) {
      setStoredValue(authUserIdStorageKey, authUserId);
      return;
    }
    removeStoredValue(authUserIdStorageKey);
  }, [authUserId]);

  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints <= 0) {
      return undefined;
    }

    let startY: number | null = null;
    let shouldRefresh = false;

    const isFormTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (window.scrollY > 0 || isFormTarget(event.target)) {
        startY = null;
        shouldRefresh = false;
        return;
      }
      startY = event.touches[0]?.clientY ?? null;
      shouldRefresh = false;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (startY === null || window.scrollY > 0) {
        return;
      }
      const currentY = event.touches[0]?.clientY;
      if (currentY === undefined) {
        return;
      }
      shouldRefresh = currentY - startY >= pullToRefreshThreshold;
    };

    const handleTouchEnd = () => {
      if (shouldRefresh) {
        window.location.reload();
      }
      startY = null;
      shouldRefresh = false;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, []);

  // localStorage에 결과 저장
  const setSaveParserResultWithCache = (newResult: RelicScanResult | null) => {
    setSaveParserResult(newResult);
    if (newResult) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(newResult));
      } catch (e) {
        console.warn('Failed to save to localStorage:', e);
      }
    }
  };

  // 마운트 시 localStorage에서 이전 결과 로드
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as RelicScanResult;
        setSaveParserResult(parsed);
      }
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
    }
  }, []);

  const clearSaveParserCache = () => {
    setSaveParserResult(null);
    setSelectedFile(null);
    setSaveParserLogs([]);
    setSaveParserError(null);
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (e) {
      console.warn('Failed to clear localStorage:', e);
    }
  };

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedId) ?? categories[0],
    [selectedId],
  );
  const hasActiveWeaponFilters =
    weaponFilters.levels.length > 0 ||
    weaponFilters.types.length > 0 ||
    weaponFilters.genres.length > 0;
  const hasActiveOptionFilters =
    optionFilters.categories.length > 0 ||
    optionFilters.types.length > 0 ||
    optionFilters.stackable.length > 0;
  const hasActiveBossFilters = bossFilters.types.length > 0;
  const hasActiveAshFilters = ashProperty !== null;
  const hasActiveSpellFilters = spellFilters.spell !== null || spellFilters.type !== null;
  const canUseFilters =
    selectedId === 'weapons' ||
    selectedId === 'options' ||
    selectedId === 'ashes' ||
    selectedId === 'bosses' ||
    selectedId === 'spells';

  const updateWeaponLevelFilter = (level: number) => {
    setWeaponFilters((currentFilters) => ({
      ...currentFilters,
      levels: toggleFilterValue(currentFilters.levels, level),
    }));
  };

  const updateWeaponTextFilter = (key: 'types' | 'genres', value: string) => {
    setWeaponFilters((currentFilters) => ({
      ...currentFilters,
      [key]: toggleFilterValue(currentFilters[key], value),
    }));
  };

  const updateOptionTextFilter = (key: 'categories' | 'types', value: string) => {
    setOptionFilters((currentFilters) => ({
      ...currentFilters,
      [key]: toggleFilterValue(currentFilters[key], value),
    }));
  };

  const updateOptionStackableFilter = (value: boolean) => {
    setOptionFilters((currentFilters) => ({
      ...currentFilters,
      stackable: toggleFilterValue(currentFilters.stackable, value),
    }));
  };

  const updateBossTypeFilter = (value: string) => {
    setBossFilters((currentFilters) => ({
      ...currentFilters,
      types: toggleFilterValue(currentFilters.types, value),
    }));
  };

  const updateSpellFilter = (value: string) => {
    setSpellFilters((currentFilters) => ({
      spell: currentFilters.spell === value ? null : value,
      type: null,
    }));
  };

  const updateSpellTypeFilter = (value: string) => {
    setSpellFilters((currentFilters) => ({
      ...currentFilters,
      type: currentFilters.type === value ? null : value,
    }));
  };

  return (
    <main className="list-top-shell">
      <header className="list-top-header">
        <div className="game-title-row">
          <div className="game-title-icon" aria-hidden="true">
            N
          </div>
          <h1>Nightreign Data App</h1>
          <button
            type="button"
            className={`account-icon-button${authView ? ' is-active' : ''}`}
            aria-label={authUserId ? `${authUserId} 계정` : '로그인 페이지로 이동'}
            title={authUserId ? `${authUserId} 로그인됨` : '로그인'}
            onClick={() => {
              setAuthView('login');
              setSearchQuery('');
              setIsFilterPanelOpen(false);
            }}
          >
            &#128100;
          </button>
        </div>

        <div className="search-row">
          <span className="search-icon" aria-hidden="true">
            &#128269;
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="아이템 이름으로 검색..."
            aria-label="아이템 이름으로 검색"
          />
          <button
            type="button"
            className={`icon-button${canUseFilters && isFilterPanelOpen ? ' is-active' : ''}`}
            aria-label={`${selectedCategory.label} 필터`}
            aria-pressed={canUseFilters && isFilterPanelOpen}
            onClick={() => {
              if (!canUseFilters) return;
              setIsFilterPanelOpen((isOpen) => !isOpen);
            }}
          >
            &#9881;
          </button>
          <button type="button" className="icon-button" aria-label="카테고리 필터">
            &#9776;
          </button>
        </div>

        {selectedId === 'weapons' && isFilterPanelOpen ? (
          <section className="filter-panel" aria-label="Weapon filters">
            <div className="filter-panel-heading">
              <strong>Weapon Filters</strong>
              <button
                type="button"
                className="filter-reset-button"
                disabled={!hasActiveWeaponFilters}
                onClick={() => setWeaponFilters(createEmptyWeaponFilters())}
              >
                Reset
              </button>
            </div>

            <div className="filter-group">
              <span>Level</span>
              <div className="filter-chip-row">
                {weaponFilterOptions.levels.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`filter-chip${weaponFilters.levels.includes(level) ? ' is-selected' : ''}`}
                    onClick={() => updateWeaponLevelFilter(level)}
                  >
                    Lv. {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span>Type</span>
              <div className="filter-chip-row">
                {weaponFilterOptions.types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`filter-chip${weaponFilters.types.includes(type) ? ' is-selected' : ''}`}
                    onClick={() => updateWeaponTextFilter('types', type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span>Genre</span>
              <div className="filter-chip-row">
                {weaponFilterOptions.genres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    className={`filter-chip${weaponFilters.genres.includes(genre) ? ' is-selected' : ''}`}
                    onClick={() => updateWeaponTextFilter('genres', genre)}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {selectedId === 'ashes' && isFilterPanelOpen ? (
          <section className="filter-panel" aria-label="Ash filters">
            <div className="filter-panel-heading">
              <strong>전회 필터</strong>
              <button
                type="button"
                className="filter-reset-button"
                disabled={!hasActiveAshFilters}
                onClick={() => setAshProperty(null)}
              >
                초기화
              </button>
            </div>

            <div className="filter-group">
              <span>속성</span>
              <div className="filter-chip-row">
                {Array.from(new Set(ashes.map((ash) => ash.property)))
                  .sort()
                  .map((prop) => (
                    <button
                      key={prop}
                      type="button"
                      className={`filter-chip${ashProperty === prop ? ' is-selected' : ''}`}
                      onClick={() => setAshProperty(ashProperty === prop ? null : prop)}
                    >
                      {prop}
                    </button>
                  ))}
              </div>
            </div>
          </section>
        ) : null}

        {selectedId === 'spells' && isFilterPanelOpen ? (
          <section className="filter-panel" aria-label="Spell filters">
            <div className="filter-panel-heading">
              <strong>마술/기도 필터</strong>
              <button
                type="button"
                className="filter-reset-button"
                disabled={!hasActiveSpellFilters}
                onClick={() => setSpellFilters(createEmptySpellFilters())}
              >
                초기화
              </button>
            </div>

            <div className="filter-group">
              <span>분류</span>
              <div className="filter-chip-row">
                {spellFilterOptions.spells.map((spell) => (
                  <button
                    key={spell}
                    type="button"
                    className={`filter-chip${spellFilters.spell === spell ? ' is-selected' : ''}`}
                    onClick={() => updateSpellFilter(spell)}
                  >
                    {spell}
                  </button>
                ))}
              </div>
            </div>

            {spellFilters.spell ? (
              <div className="filter-group">
                <span>세부 분류</span>
                <div className="filter-chip-row">
                  {(spellFilterOptions.typesBySpell[spellFilters.spell] ?? []).map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`filter-chip${spellFilters.type === type ? ' is-selected' : ''}`}
                      onClick={() => updateSpellTypeFilter(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {selectedId === 'options' && isFilterPanelOpen ? (
          <section className="filter-panel" aria-label="Option filters">
            <div className="filter-panel-heading">
              <strong>옵션 필터</strong>
              <button
                type="button"
                className="filter-reset-button"
                disabled={!hasActiveOptionFilters}
                onClick={() => setOptionFilters(createEmptyOptionFilters())}
              >
                초기화
              </button>
            </div>

            <div className="filter-group">
              <span>분류</span>
              <div className="filter-chip-row">
                {optionFilterOptions.categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`filter-chip${optionFilters.categories.includes(category) ? ' is-selected' : ''}`}
                    onClick={() => updateOptionTextFilter('categories', category)}
                  >
                    {optionCategoryLabels[category] ?? category}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span>옵션 종류</span>
              <div className="filter-chip-row">
                {optionFilterOptions.types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`filter-chip${optionFilters.types.includes(type) ? ' is-selected' : ''}`}
                    onClick={() => updateOptionTextFilter('types', type)}
                  >
                    {optionTypeLabels[type] ?? type}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span>중첩 여부</span>
              <div className="filter-chip-row">
                {optionFilterOptions.stackable.map((stackable) => (
                  <button
                    key={String(stackable)}
                    type="button"
                    className={`filter-chip${optionFilters.stackable.includes(stackable) ? ' is-selected' : ''}`}
                    onClick={() => updateOptionStackableFilter(stackable)}
                  >
                    {optionStackableLabels[String(stackable)]}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {selectedId === 'bosses' && isFilterPanelOpen ? (
          <section className="filter-panel" aria-label="Boss filters">
            <div className="filter-panel-heading">
              <strong>보스 필터</strong>
              <button
                type="button"
                className="filter-reset-button"
                disabled={!hasActiveBossFilters}
                onClick={() => setBossFilters(createEmptyBossFilters())}
              >
                초기화
              </button>
            </div>

            <div className="filter-group">
              <span>보스 종류</span>
              <div className="filter-chip-row">
                {bossFilterOptions.types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`filter-chip${bossFilters.types.includes(type) ? ' is-selected' : ''}`}
                    onClick={() => updateBossTypeFilter(type)}
                  >
                    {bossTypeLabels[type] ?? type}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <nav className="category-tabs" aria-label="아이템 카테고리">
          {categories.map((category) => {
            const isSelected = category.id === selectedId;
            const iconAsset = categoryIconAssets[category.id];

            return (
              <button
                key={category.id}
                type="button"
                className={`category-tab${isSelected ? ' is-selected' : ''}`}
                onClick={() => {
                  setAuthView(null);
                  setSelectedId(category.id);
                  setSearchQuery('');
                  setIsFilterPanelOpen(false);
                  setSelectedWeaponGroupId(null);
                  setFocusedWeaponGroupId(null);
                }}
                aria-pressed={isSelected}
              >
                {iconAsset ? (
                  <img className="category-icon category-icon-image" src={iconAsset} alt="" aria-hidden="true" />
                ) : (
                  <span className="category-icon" aria-hidden="true">
                    {category.icon}
                  </span>
                )}
                <span>{category.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {authView ? (
        <AuthPage
          view={authView}
          onChangeView={setAuthView}
          onLoginSuccess={(loginId) => {
            setAuthUserId(loginId);
            setAuthView(null);
          }}
        />
      ) : selectedId === 'characters' ? (
        <CharactersPage
          searchQuery={searchQuery}
          onSelectWeapon={(weaponGroupId) => {
            setSelectedId('weapons');
            setSelectedWeaponGroupId(null);
            setFocusedWeaponGroupId(weaponGroupId);
            setSearchQuery('');
          }}
        />
      ) : selectedId === 'weapons' ? (
        <WeaponsPage
          searchQuery={searchQuery}
          filters={weaponFilters}
          selectedGroupId={selectedWeaponGroupId}
          focusedGroupId={focusedWeaponGroupId}
          onSelectGroup={(groupId) => {
            setSelectedWeaponGroupId(groupId);
            setFocusedWeaponGroupId(null);
            setSearchQuery('');
          }}
          onBack={() => {
            setSelectedWeaponGroupId(null);
            setFocusedWeaponGroupId(null);
          }}
        />
      ) : selectedId === 'options' ? (
        <OptionsPage searchQuery={searchQuery} filters={optionFilters} />
      ) : selectedId === 'stats-calculator' ? (
        <StatsCalculatorPage searchQuery={searchQuery} />
      ) : selectedId === 'ashes' ? (
        <AshesPage searchQuery={searchQuery} ashProperty={ashProperty} />
      ) : selectedId === 'bosses' ? (
        <BossesPage searchQuery={searchQuery} filters={bossFilters} />
      ) : selectedId === 'spells' ? (
        <SpellsPage searchQuery={searchQuery} filters={spellFilters} />
      ) : selectedId === 'talismans' ? (
        <TalismansPage searchQuery={searchQuery} />
      ) : selectedId === 'relics' ? (
        <RelicsPage
          searchQuery={searchQuery}
          authUserId={authUserId}
          storageRefreshKey={relicStorageRefreshKey}
          onRelicsChanged={() => setRelicStorageRefreshKey((currentKey) => currentKey + 1)}
        />
      ) : selectedId === 'map' ? (
        <MapPage />
      ) : selectedId === 'builds' ? (
        <BuildPage searchQuery={searchQuery} />
      ) : selectedId === 'relic-builder' ? (
        <RelicBuilderPage
          searchQuery={searchQuery}
          authUserId={authUserId}
          onRelicsChanged={() => setRelicStorageRefreshKey((currentKey) => currentKey + 1)}
        />
      ) : selectedId === 'save-parser' ? (
        <SaveParserPage
          authUserId={authUserId}
          storageRefreshKey={relicStorageRefreshKey}
          onRelicsChanged={() => setRelicStorageRefreshKey((currentKey) => currentKey + 1)}
          characterSlot={characterSlot}
          setCharacterSlot={setCharacterSlot}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          result={saveParserResult}
          setResult={setSaveParserResultWithCache}
          logs={saveParserLogs}
          setLogs={setSaveParserLogs}
          error={saveParserError}
          setError={setSaveParserError}
          isParsing={isSaveParserParsing}
          setIsParsing={setIsSaveParserParsing}
          clearCache={clearSaveParserCache}
        />
      ) : selectedId === 'vessels' ? (
        <VesselsPage searchQuery={searchQuery} />
      ) : selectedId === 'items' ? (
        <ItemsPage searchQuery={searchQuery} />
      ) : selectedId === 'gestures' ? (
        <GesturesPage searchQuery={searchQuery} />
      ) : (
        <PlaceholderPage category={selectedCategory} searchQuery={searchQuery} />
      )}
    </main>
  );
}

export default ListTop;
