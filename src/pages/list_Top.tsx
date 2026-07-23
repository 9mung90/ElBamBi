import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { RelicScanResult, CharacterSlot } from '../utils/nightreignSaveParser';
import { useCallback, type MouseEvent } from 'react';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { useRef, type TouchEvent as ReactTouchEvent } from 'react';
import { ashes } from '../data/ashes';
import AshesPage from './AshesPage';
import BossesPage from './BossesPage';
import BuildPage, { type SortKey as BuildSortKey } from './BuildPage';
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
import {
  accessTokenStorageKey,
  authNicknameStorageKey,
  authNicknameUserIdStorageKey,
  authUserIdStorageKey,
  clearAuthStorage,
  getUserIdFromAccessToken,
} from '../api/authToken';
import logoImage from '../assets/images/top_icon/logo.png';
import loginImage from '../assets/images/top_icon/login.webp';
import {
  LoginRequiredError,
  normalizeAuthRole,
  type AuthRole,
  type AuthView,
} from './listTop/authTypes';
import {
  getStoredAccessToken,
  getStoredAuthUserId,
  getStoredAuthView,
} from './listTop/authStorage';
import { apiBaseUrl } from './listTop/apiConfig';
import { categories } from './listTop/categoryConfig';
import { categoryIconAssets } from './listTop/categoryIcons';
import {
  authViewStorageKey,
  lastPageStorageKey,
  mainRoutePath,
  nicknameRoutePath,
  officialWebsiteUrl,
  playStoreUrl,
  pullToRefreshThreshold,
  verifyEmailRoutePath,
} from './listTop/constants';
import {
  requestMyPageApi,
  type MyPageMeResponse,
  type MyPageUpdateResponse,
} from './listTop/myPageApi';
import AuthPage from './listTop/AuthPage';
import MyPage from './listTop/MyPage';
import NicknamePage from './listTop/NicknamePage';
import VerifyEmailPage from './listTop/VerifyEmailPage';
import {
  getMessageFromPayload,
} from './listTop/payloadUtils';
import {
  getStoredValue,
  removeStoredValue,
  setStoredValue,
} from './listTop/storageUtils';
import './list_Top.css';

function toggleFilterValue<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((currentValue) => currentValue !== value)
    : [...values, value];
}

function getStoredPageId() {
  const storedId = getStoredValue(lastPageStorageKey);
  if (storedId && categories.some((category) => category.id === storedId)) {
    return storedId;
  }
  return categories[0].id;
}

function resetPageScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function getAccessTokenFromParams(params: URLSearchParams) {
  const accessToken = params.get('accessToken') ?? params.get('access_token') ?? params.get('token');
  return accessToken && accessToken.trim() ? accessToken : null;
}

function getAccessTokenFromLocationSearch() {
  if (window.location.pathname === verifyEmailRoutePath) return null;
  return getAccessTokenFromParams(new URLSearchParams(window.location.search));
}

function getNeedsNicknameFromParams(params: URLSearchParams) {
  return params.get('needsNickname') === 'true';
}

function getNeedsNicknameFromLocationSearch() {
  return getNeedsNicknameFromParams(new URLSearchParams(window.location.search));
}

function hasOAuthRedirectParamsInSearch(params: URLSearchParams) {
  return (
    params.has('oauthError') ||
    params.has('accessToken') ||
    params.has('access_token') ||
    params.has('token') ||
    params.has('needsNickname')
  );
}

function hasOAuthRedirectParams() {
  if (window.location.pathname === verifyEmailRoutePath) return false;
  return hasOAuthRedirectParamsInSearch(new URLSearchParams(window.location.search));
}

function getGoogleLoginUrl() {
  return `${apiBaseUrl}/oauth2/authorization/google`;
}

function getAndroidGoogleLoginUrl() {
  const url = new URL(getGoogleLoginUrl());
  url.searchParams.set('redirectTarget', 'android');
  return url.toString();
}

function getOAuthErrorMessage(errorCode: string | null) {
  if (errorCode === 'google_email_already_exists') {
    return '이미 사용하신 이메일 주소 입니다';
  }

  return '구글 로그인에 실패했습니다. 다시 시도해 주세요.';
}

async function postNicknameForm(nickname: string, accessTokenOverride?: string | null): Promise<string> {
  const body = new URLSearchParams({ nickname });
  const headers = new Headers({
    'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
  });
  const accessToken =
    accessTokenOverride ?? getStoredAccessToken() ?? getAccessTokenFromLocationSearch();

  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${apiBaseUrl}/api/inputNick`, {
    method: 'POST',
    headers,
    body,
  });
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  const payload = contentType.includes('application/json') && text ? JSON.parse(text) : text;
  const message = getMessageFromPayload(payload) || (typeof payload === 'string' ? payload : '');

  if (!response.ok) {
    throw new Error(message || '닉네임 저장에 실패했습니다.');
  }

  return message || '닉네임이 저장되었습니다.';
}

function ListTop() {
  const [selectedId, setSelectedId] = useState(getStoredPageId);
  const [authView, setAuthView] = useState<AuthView>(getStoredAuthView);
  const [authUserId, setAuthUserId] = useState<string | null>(getStoredAuthUserId);
  const [authRole, setAuthRole] = useState<AuthRole>('USER');
  const [authInitialError, setAuthInitialError] = useState<string | null>(null);
  const [isMyPageOpen, setIsMyPageOpen] = useState(false);
  const [buildFocusPostId, setBuildFocusPostId] = useState<string | null>(null);
  const [isNicknameRoute, setIsNicknameRoute] = useState(
    () =>
      window.location.pathname === nicknameRoutePath ||
      Boolean(getAccessTokenFromLocationSearch() && getNeedsNicknameFromLocationSearch()),
  );
  const [isVerifyEmailRoute, setIsVerifyEmailRoute] = useState(
    () => window.location.pathname === verifyEmailRoutePath,
  );
  const [nicknameAccessToken, setNicknameAccessToken] = useState(() => getAccessTokenFromLocationSearch());
  const [relicStorageRefreshKey, setRelicStorageRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [weaponFilters, setWeaponFilters] = useState<WeaponFilters>(() => createEmptyWeaponFilters());
  const [optionFilters, setOptionFilters] = useState<OptionFilters>(() => createEmptyOptionFilters());
  const [bossFilters, setBossFilters] = useState<BossFilters>(() => createEmptyBossFilters());
  const [spellFilters, setSpellFilters] = useState<SpellFilters>(() => createEmptySpellFilters());
  const [buildSortKey, setBuildSortKey] = useState<BuildSortKey>('latest');
  const [selectedWeaponGroupId, setSelectedWeaponGroupId] = useState<number | null>(null);
  const [focusedWeaponGroupId, setFocusedWeaponGroupId] = useState<number | null>(null);
  const [ashProperty, setAshProperty] = useState<string | null>(null);
  const categoryTabsRef = useRef<HTMLElement | null>(null);
  const nativeBackButtonHandlerRef = useRef<(canGoBack: boolean) => void>(() => {});
  const buildInternalBackHandlerRef = useRef<(() => boolean) | null>(null);
  const pageSwipeStartRef = useRef<{
    x: number;
    y: number;
    index: number;
    width: number;
    time: number;
    axis: 'horizontal' | 'vertical' | null;
  } | null>(null);
  const suppressNextPageClickRef = useRef(false);
  const [visitedCategoryIds, setVisitedCategoryIds] = useState<Set<string>>(() => new Set([getStoredPageId()]));
  const [pageDrag, setPageDrag] = useState<{
    offset: number;
    isDragging: boolean;
    targetIndex: number | null;
  }>({
    offset: 0,
    isDragging: false,
    targetIndex: null,
  });

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
    resetPageScroll();
  }, [selectedId]);

  useEffect(() => {
    if (authView) {
      setStoredValue(authViewStorageKey, authView);
      return;
    }
    removeStoredValue(authViewStorageKey);
  }, [authView]);

  useEffect(() => {
    const tokenUserId = getUserIdFromAccessToken(getStoredAccessToken());
    if (tokenUserId && tokenUserId !== authUserId) {
      setAuthUserId(tokenUserId);
      return;
    }
    if (!tokenUserId && authUserId && !getStoredAccessToken()) {
      setAuthUserId(null);
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
    if (!getStoredAccessToken()) {
      setAuthRole('USER');
      return;
    }

    let isMounted = true;

    requestMyPageApi<MyPageMeResponse>('/api/me')
      .then((me) => {
        if (!isMounted) return;

        setAuthRole(normalizeAuthRole(me.role));
        if (me.userId) {
          setAuthUserId(me.userId);
          setStoredValue(authUserIdStorageKey, me.userId);
        }
        if (me.nickname) {
          setStoredValue(authNicknameStorageKey, me.nickname);
          if (me.userId) setStoredValue(authNicknameUserIdStorageKey, me.userId);
        }
      })
      .catch((error) => {
        if (!isMounted) return;
        setAuthRole('USER');
        if (error instanceof LoginRequiredError) {
          clearAuthStorage();
          setAuthUserId(null);
          return;
        }
        console.warn('[auth] Failed to load current user role', error);
      });

    return () => {
      isMounted = false;
    };
  }, [authUserId]);

  useEffect(() => {
    const handlePopState = () => {
      setIsNicknameRoute(window.location.pathname === nicknameRoutePath);
      setIsVerifyEmailRoute(window.location.pathname === verifyEmailRoutePath);
      setNicknameAccessToken(getAccessTokenFromLocationSearch());
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleOAuthRedirectParams = useCallback(
    (params: URLSearchParams, currentPath = mainRoutePath) => {
      if (!hasOAuthRedirectParamsInSearch(params)) {
        return { handled: false, success: false, route: currentPath || mainRoutePath };
      }

      const routeAfterError =
        currentPath === nicknameRoutePath ? mainRoutePath : currentPath || mainRoutePath;
      const oauthError = params.get('oauthError');
      const accessToken = getAccessTokenFromParams(params);
      const needsNickname = getNeedsNicknameFromParams(params);

      if (oauthError) {
        setAuthInitialError(getOAuthErrorMessage(oauthError));
        setAuthView('login');
        setIsMyPageOpen(false);
        return { handled: true, success: false, route: routeAfterError };
      }

      if (accessToken) {
        setStoredValue(accessTokenStorageKey, accessToken);
        setNicknameAccessToken(accessToken);

        const userId = getUserIdFromAccessToken(accessToken);
        if (userId) {
          setAuthUserId(userId);
          setStoredValue(authUserIdStorageKey, userId);
        }
      }

      if (needsNickname || currentPath === nicknameRoutePath) {
        setAuthView(null);
        setIsMyPageOpen(false);
        setSearchQuery('');
        setIsFilterPanelOpen(false);
        setIsVerifyEmailRoute(false);
        setIsNicknameRoute(true);
        return { handled: true, success: true, route: nicknameRoutePath };
      }

      setSelectedId('characters');
      setAuthView(null);
      setIsMyPageOpen(false);
      setSearchQuery('');
      setIsFilterPanelOpen(false);
      setIsVerifyEmailRoute(false);
      setIsNicknameRoute(false);
      setStoredValue(lastPageStorageKey, 'characters');
      return { handled: true, success: true, route: mainRoutePath };
    },
    [],
  );

  useEffect(() => {
    if (!hasOAuthRedirectParams()) return;

    const result = handleOAuthRedirectParams(
      new URLSearchParams(window.location.search),
      window.location.pathname,
    );
    if (result.handled) {
      window.history.replaceState(null, '', result.route);
    }
  }, [handleOAuthRedirectParams]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let removeListener: (() => Promise<void>) | null = null;
    let isMounted = true;

    const handleAppUrlOpen = (url: string) => {
      let params: URLSearchParams;
      try {
        params = new URL(url).searchParams;
      } catch {
        return;
      }

      const result = handleOAuthRedirectParams(params, window.location.pathname || mainRoutePath);
      if (result.success) {
        void Browser.close();
      }
      if (result.handled) {
        window.history.replaceState(null, '', result.route);
      }
    };

    void App.addListener('appUrlOpen', ({ url }) => {
      handleAppUrlOpen(url);
    }).then((listener) => {
      if (!isMounted) {
        void listener.remove();
        return;
      }
      removeListener = () => listener.remove();
    });

    void App.getLaunchUrl().then((launchUrl) => {
      if (isMounted && launchUrl?.url) {
        handleAppUrlOpen(launchUrl.url);
      }
    });

    return () => {
      isMounted = false;
      if (removeListener) void removeListener();
    };
  }, [handleOAuthRedirectParams]);

  const handleGoogleLoginClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

    event.preventDefault();
    void Browser.open({ url: getAndroidGoogleLoginUrl() });
  }, []);

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

  const selectedIndex = useMemo(() => {
    const index = categories.findIndex((category) => category.id === selectedId);
    return index >= 0 ? index : 0;
  }, [selectedId]);

  const selectedCategory = categories[selectedIndex] ?? categories[0];

  useEffect(() => {
    const selectedCategoryId = selectedCategory.id;
    setVisitedCategoryIds((currentIds) => {
      if (currentIds.has(selectedCategoryId)) return currentIds;
      const nextIds = new Set(currentIds);
      nextIds.add(selectedCategoryId);
      return nextIds;
    });
  }, [selectedCategory.id]);

  useEffect(() => {
    const currentTab = categoryTabsRef.current?.querySelector<HTMLElement>(
      `[data-category-id="${selectedId}"]`,
    );
    currentTab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedId]);
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
  const hasActiveBuildSort = buildSortKey !== 'latest';
  const canUseFilters =
    selectedId === 'weapons' ||
    selectedId === 'options' ||
    selectedId === 'ashes' ||
    selectedId === 'bosses' ||
    selectedId === 'spells' ||
    selectedId === 'builds';

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

  const closeOverlayPages = () => {
    setAuthView(null);
    setIsMyPageOpen(false);
  };

  const selectCategory = (categoryId: string) => {
    if (categoryId !== selectedId) {
      resetPageScroll();
    }
    closeOverlayPages();
    setVisitedCategoryIds((currentIds) => {
      if (currentIds.has(categoryId)) return currentIds;
      const nextIds = new Set(currentIds);
      nextIds.add(categoryId);
      return nextIds;
    });
    setSelectedId(categoryId);
    setSearchQuery('');
    setIsFilterPanelOpen(false);
    setBuildFocusPostId(null);
    setSelectedWeaponGroupId(null);
    setFocusedWeaponGroupId(null);
  };

  const selectCategoryByIndex = (index: number) => {
    const category = categories[Math.max(0, Math.min(categories.length - 1, index))];
    if (!category || category.id === selectedCategory.id) return;
    selectCategory(category.id);
  };

  const isPageSwipeTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const allowedInteractiveSwipeTarget = target.closest('[data-page-swipe-allowed]');
    const blockedSelectors = [
      'input',
      'textarea',
      'select',
      allowedInteractiveSwipeTarget ? null : 'button',
      allowedInteractiveSwipeTarget ? null : 'a',
      '[contenteditable="true"]',
      '[role="dialog"]',
      '[aria-modal="true"]',
      '[data-no-page-swipe]',
      '[data-interactive]',
      '.responsive-select-overlay',
    ].filter((selector): selector is string => Boolean(selector));

    if (
      target.closest(blockedSelectors.join(', '))
    ) {
      return false;
    }

    let element: HTMLElement | null = target;
    while (element) {
      const style = window.getComputedStyle(element);
      const canScrollHorizontally =
        (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
        element.scrollWidth > element.clientWidth;
      if (canScrollHorizontally) return false;
      element = element.parentElement;
    }

    return true;
  };

  const handlePageSwipeStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (
      event.touches.length !== 1 ||
      authView ||
      isMyPageOpen ||
      !isPageSwipeTarget(event.target)
    ) {
      pageSwipeStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    pageSwipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      index: selectedIndex,
      width: event.currentTarget.clientWidth,
      time: performance.now(),
      axis: null,
    };
    setPageDrag({ offset: 0, isDragging: true, targetIndex: null });
  };

  const handlePageSwipeMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = pageSwipeStartRef.current;
    if (!start || start.index !== selectedIndex || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!start.axis) {
      if (absX < 10 && absY < 10) return;
      start.axis = absX > absY * 1.18 ? 'horizontal' : 'vertical';
    }

    if (start.axis === 'vertical') return;

    if (absX > 12) {
      suppressNextPageClickRef.current = true;
    }

    const targetIndex = deltaX < 0 ? Math.min(categories.length - 1, start.index + 1) : Math.max(0, start.index - 1);
    const targetCategory = categories[targetIndex];
    if (!targetCategory || targetIndex === start.index) {
      setPageDrag({ offset: deltaX * 0.18, isDragging: true, targetIndex: null });
      return;
    }

    event.preventDefault();
    const limit = Math.max(1, start.width);
    const offset = Math.max(-limit, Math.min(limit, deltaX));
    setPageDrag({ offset, isDragging: true, targetIndex });
  };

  const handlePageSwipeEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = pageSwipeStartRef.current;
    pageSwipeStartRef.current = null;
    if (!start || start.index !== selectedIndex) {
      setPageDrag({ offset: 0, isDragging: false, targetIndex: null });
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) {
      setPageDrag({ offset: 0, isDragging: false, targetIndex: null });
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const elapsed = Math.max(1, performance.now() - start.time);
    const velocity = Math.abs(deltaX) / elapsed;
    const fallbackTargetIndex =
      deltaX < 0 ? Math.min(categories.length - 1, start.index + 1) : Math.max(0, start.index - 1);
    const targetIndex = pageDrag.targetIndex ?? (fallbackTargetIndex !== start.index ? fallbackTargetIndex : null);
    const shouldCommitSwipe =
      targetIndex !== null &&
      start.axis === 'horizontal' &&
      Math.abs(deltaY) <= Math.max(80, start.width * 0.35) &&
      (Math.abs(deltaX) >= Math.min(110, start.width * 0.24) || velocity >= 0.45);

    if (start.axis === 'horizontal' && Math.abs(deltaX) > 12) {
      suppressNextPageClickRef.current = true;
      window.setTimeout(() => {
        suppressNextPageClickRef.current = false;
      }, 350);
    }

    setPageDrag({ offset: 0, isDragging: false, targetIndex: null });
    if (shouldCommitSwipe && targetIndex !== null) {
      selectCategoryByIndex(targetIndex);
    }
  };

  const handlePageClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!suppressNextPageClickRef.current) return;

    suppressNextPageClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const clearAuthState = () => {
    clearAuthStorage();
    setAuthUserId(null);
    setAuthRole('USER');
  };

  const handleLogout = () => {
    clearAuthState();
    setIsMyPageOpen(false);
    setAuthView('login');
  };

  const handleAuthUpdated = (response: MyPageUpdateResponse) => {
    if (response.accessToken) {
      setStoredValue(accessTokenStorageKey, response.accessToken);
    }

    const nextUserId =
      response.userId ??
      getUserIdFromAccessToken(response.accessToken ?? getStoredAccessToken());

    if (nextUserId) {
      setAuthUserId(nextUserId);
      setStoredValue(authUserIdStorageKey, nextUserId);
    }

    if (response.nickname) {
      setStoredValue(authNicknameStorageKey, response.nickname);
      if (nextUserId) setStoredValue(authNicknameUserIdStorageKey, nextUserId);
    }

    if (response.role) {
      setAuthRole(normalizeAuthRole(response.role));
    }
  };

  const handleAccountDeleted = () => {
    clearAuthState();
    setIsMyPageOpen(false);
    setAuthView('login');
    setSelectedId('characters');
    setSearchQuery('');
    setIsFilterPanelOpen(false);
    setStoredValue(lastPageStorageKey, 'characters');
  };

  const handleLoginRequired = () => {
    clearAuthState();
    setIsMyPageOpen(false);
    setAuthView('login');
  };

  const openLoginPage = () => {
    setIsVerifyEmailRoute(false);
    setIsNicknameRoute(false);
    setIsMyPageOpen(false);
    setAuthView('login');
    setSearchQuery('');
    setIsFilterPanelOpen(false);
    window.history.replaceState(null, '', mainRoutePath);
  };

  const handleOpenMyPagePost = (postId: string) => {
    setBuildFocusPostId(postId);
    setSelectedId('builds');
    closeOverlayPages();
    setSearchQuery('');
    setIsFilterPanelOpen(false);
  };

  const handleBuildInternalBackChange = useCallback((handler: (() => boolean) | null) => {
    buildInternalBackHandlerRef.current = handler;
  }, []);

  nativeBackButtonHandlerRef.current = (canGoBack) => {
    if (isNicknameRoute || isVerifyEmailRoute) {
      setIsNicknameRoute(false);
      setIsVerifyEmailRoute(false);
      setNicknameAccessToken(null);
      setAuthView(null);
      setIsMyPageOpen(false);
      setSearchQuery('');
      setIsFilterPanelOpen(false);
      window.history.replaceState(null, '', mainRoutePath);
      return;
    }

    if (authView) {
      setAuthInitialError(null);
      setAuthView(null);
      return;
    }

    if (isMyPageOpen) {
      setIsMyPageOpen(false);
      return;
    }

    if (isFilterPanelOpen) {
      setIsFilterPanelOpen(false);
      return;
    }

    if (selectedWeaponGroupId !== null || focusedWeaponGroupId !== null) {
      setSelectedWeaponGroupId(null);
      setFocusedWeaponGroupId(null);
      return;
    }

    if (buildFocusPostId) {
      setBuildFocusPostId(null);
      return;
    }

    if (selectedId === 'builds' && buildInternalBackHandlerRef.current?.()) {
      return;
    }

    if (searchQuery) {
      setSearchQuery('');
      return;
    }

    if (selectedId !== categories[0].id) {
      selectCategory(categories[0].id);
      return;
    }

    if (canGoBack) {
      window.history.back();
      return;
    }

    void App.minimizeApp();
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return undefined;

    let removeListener: (() => Promise<void>) | null = null;
    let isMounted = true;

    void App.addListener('backButton', ({ canGoBack }) => {
      nativeBackButtonHandlerRef.current(canGoBack);
    }).then((listener) => {
      if (!isMounted) {
        void listener.remove();
        return;
      }
      removeListener = () => listener.remove();
    });

    return () => {
      isMounted = false;
      if (removeListener) void removeListener();
    };
  }, []);

  if (isVerifyEmailRoute) {
    return <VerifyEmailPage onGoToLogin={openLoginPage} />;
  }

  if (isNicknameRoute) {
    return (
      <NicknamePage
        accessToken={nicknameAccessToken}
        postNicknameForm={postNicknameForm}
        onComplete={() => {
          setSelectedId('characters');
          setAuthView(null);
          setSearchQuery('');
          setIsFilterPanelOpen(false);
          setIsNicknameRoute(false);
          window.history.replaceState(null, '', mainRoutePath);
          setStoredValue(lastPageStorageKey, 'characters');
        }}
      />
    );
  }

  const renderOverlayContent = (): ReactNode => {
    if (authView) {
      return (
        <AuthPage
          initialError={authInitialError}
          view={authView}
          onChangeView={(nextView) => {
            setAuthInitialError(null);
            setAuthView(nextView);
          }}
          onGoogleLoginClick={handleGoogleLoginClick}
          onLoginSuccess={(loginId) => {
            setAuthInitialError(null);
            setAuthUserId(loginId);
            setAuthView(null);
            setIsMyPageOpen(false);
          }}
          getGoogleLoginUrl={getGoogleLoginUrl}
        />
      );
    }

    if (isMyPageOpen) {
      return (
        <MyPage
          authUserId={authUserId}
          onAuthUpdated={handleAuthUpdated}
          onAccountDeleted={handleAccountDeleted}
          onLoginRequired={handleLoginRequired}
          onLogout={handleLogout}
          onOpenPost={handleOpenMyPagePost}
        />
      );
    }

    return null;
  };

  const renderPageContent = (categoryId: string): ReactNode => {
    if (categoryId === 'characters') {
      return (
        <CharactersPage
          searchQuery={searchQuery}
          onSelectWeapon={(weaponGroupId) => {
            setSelectedId('weapons');
            setSelectedWeaponGroupId(null);
            setFocusedWeaponGroupId(weaponGroupId);
            setSearchQuery('');
          }}
        />
      );
    }
    if (categoryId === 'weapons') {
      return (
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
      );
    }
    if (categoryId === 'options') return <OptionsPage searchQuery={searchQuery} filters={optionFilters} />;
    if (categoryId === 'stats-calculator') return <StatsCalculatorPage searchQuery={searchQuery} />;
    if (categoryId === 'ashes') return <AshesPage searchQuery={searchQuery} ashProperty={ashProperty} />;
    if (categoryId === 'bosses') return <BossesPage searchQuery={searchQuery} filters={bossFilters} />;
    if (categoryId === 'spells') return <SpellsPage searchQuery={searchQuery} filters={spellFilters} />;
    if (categoryId === 'talismans') return <TalismansPage searchQuery={searchQuery} />;
    if (categoryId === 'relics') {
      return (
        <RelicsPage
          searchQuery={searchQuery}
          authUserId={authUserId}
          storageRefreshKey={relicStorageRefreshKey}
          onRelicsChanged={() => setRelicStorageRefreshKey((currentKey) => currentKey + 1)}
        />
      );
    }
    if (categoryId === 'map') return <MapPage />;
    if (categoryId === 'builds') {
      return (
        <BuildPage
          searchQuery={searchQuery}
          authUserId={authUserId}
          authRole={authRole}
          focusPostId={buildFocusPostId}
          onInternalBackChange={handleBuildInternalBackChange}
          onLoginRequired={handleLoginRequired}
          sortKey={buildSortKey}
        />
      );
    }
    if (categoryId === 'relic-builder') {
      return (
        <RelicBuilderPage
          searchQuery={searchQuery}
          authUserId={authUserId}
          onRelicsChanged={() => setRelicStorageRefreshKey((currentKey) => currentKey + 1)}
        />
      );
    }
    if (categoryId === 'save-parser') {
      return (
        <SaveParserPage
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
      );
    }
    if (categoryId === 'vessels') return <VesselsPage searchQuery={searchQuery} />;
    if (categoryId === 'items') return <ItemsPage searchQuery={searchQuery} />;
    if (categoryId === 'gestures') return <GesturesPage searchQuery={searchQuery} />;

    return (
      <PlaceholderPage
        category={categories.find((category) => category.id === categoryId) ?? selectedCategory}
        searchQuery={searchQuery}
      />
    );
  };

  const overlayContent = renderOverlayContent();
  const isOverlayOpen = Boolean(overlayContent);
  const pageTrackTransform = `calc(${-selectedIndex * 100}% + ${pageDrag.offset}px)`;
  const isNativeApp = Capacitor.isNativePlatform();
  const externalProductUrl = isNativeApp ? officialWebsiteUrl : playStoreUrl;
  const externalProductLabel = isNativeApp ? '엘밤 비 웹사이트 열기' : 'Google Play에서 엘밤 비 앱 보기';

  const handleExternalProductClick = () => {
    if (isNativeApp) {
      void Browser.open({ url: externalProductUrl });
      return;
    }

    window.open(externalProductUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="list-top-shell">
      <header className="list-top-header">
        <div className="game-title-row">
          <div className="game-title-icon" aria-hidden="true">
            <img className="game-title-logo-image" src={logoImage} alt="" />
          </div>
          <h1>엘밤 비</h1>
          <button
            type="button"
            className="external-product-button"
            aria-label={externalProductLabel}
            title={externalProductLabel}
            onClick={handleExternalProductClick}
          >
            {isNativeApp ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.4 2.5 3.7 5.6 3.7 9s-1.3 6.5-3.7 9M12 3c-2.4 2.5-3.7 5.6-3.7 9s1.3 6.5 3.7 9" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
                <path className="external-product-play-mark" d="m10 8 5.5 4-5.5 4Z" />
                <path d="M10 18.5h4" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className={`account-icon-button${authView || isMyPageOpen ? ' is-active' : ''}`}
            aria-label={authUserId ? `${authUserId} 계정` : '로그인 페이지로 이동'}
            title={authUserId ? `${authUserId} 로그인됨` : '로그인'}
            onClick={() => {
              if (getStoredAccessToken()) {
                setAuthView(null);
                setIsMyPageOpen(true);
              } else {
                setIsMyPageOpen(false);
                setAuthView('login');
              }
              setSearchQuery('');
              setIsFilterPanelOpen(false);
            }}
          >
           <img className="account-icon-image" src={loginImage} alt="" aria-hidden="true" />
          </button>
        </div>

        <div className="search-row">
          <span className="search-icon" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="통합 검색 (아이템, 옵션, 무기 등)"
            aria-label="통합 검색"
          />
          <button
            type="button"
            className={`icon-button${canUseFilters && isFilterPanelOpen ? ' is-active' : ''}`}
            aria-label={selectedId === 'builds' ? '빌드 정렬' : `${selectedCategory.label} 필터`}
            aria-pressed={canUseFilters && isFilterPanelOpen}
            onClick={() => {
              if (!canUseFilters) return;
              setIsFilterPanelOpen((isOpen) => !isOpen);
            }}
          >
            &#9776;
          </button>
        </div>

        {selectedId === 'weapons' && isFilterPanelOpen ? (
          <section className="filter-panel" aria-label="무기 필터">
            <div className="filter-panel-heading">
              <strong>무기 필터</strong>
              <button
                type="button"
                className="filter-reset-button"
                disabled={!hasActiveWeaponFilters}
                onClick={() => setWeaponFilters(createEmptyWeaponFilters())}
              >
                초기화
              </button>
            </div>

            <div className="filter-group">
              <span>레벨</span>
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
              <span>종류</span>
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

            <div className="filter-group">
              <span>무기군</span>
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

        {selectedId === 'builds' && isFilterPanelOpen ? (
          <section className="filter-panel" aria-label="빌드 정렬">
            <div className="filter-panel-heading">
              <strong>빌드 정렬</strong>
              <button
                type="button"
                className="filter-reset-button"
                disabled={!hasActiveBuildSort}
                onClick={() => setBuildSortKey('latest')}
              >
                초기화
              </button>
            </div>

            <div className="filter-group">
              <span>정렬</span>
              <div className="filter-chip-row">
                {[
                  { value: 'latest', label: '최신순' },
                  { value: 'popular', label: '인기순' },
                  { value: 'views', label: '조회순' },
                ].map((sortOption) => (
                  <button
                    key={sortOption.value}
                    type="button"
                    className={`filter-chip${buildSortKey === sortOption.value ? ' is-selected' : ''}`}
                    onClick={() => setBuildSortKey(sortOption.value as BuildSortKey)}
                  >
                    {sortOption.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <nav ref={categoryTabsRef} className="category-tabs" aria-label="아이템 카테고리">
          {categories.map((category) => {
            const isSelected = category.id === selectedId;
            const iconAsset = categoryIconAssets[category.id];

            return (
              <button
                key={category.id}
                type="button"
                data-category-id={category.id}
                className={`category-tab${isSelected ? ' is-selected' : ''}`}
                onClick={() => selectCategory(category.id)}
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

      {isOverlayOpen ? (
        <div className="page-view-viewport">
          <div className="page-view-track">
            <section className="page-view-panel is-active">{overlayContent}</section>
          </div>
        </div>
      ) : (
        <div
          className={`page-view-viewport${pageDrag.isDragging ? ' is-dragging' : ''}`}
          onClickCapture={handlePageClickCapture}
          onTouchStart={handlePageSwipeStart}
          onTouchMove={handlePageSwipeMove}
          onTouchEnd={handlePageSwipeEnd}
          onTouchCancel={() => {
            pageSwipeStartRef.current = null;
            setPageDrag({ offset: 0, isDragging: false, targetIndex: null });
          }}
        >
          <div
            className={`page-view-track${pageDrag.isDragging ? ' is-dragging' : ''}`}
            style={{ transform: `translate3d(${pageTrackTransform}, 0, 0)` }}
          >
            {categories.map((category, index) => {
              const isActive = index === selectedIndex;
              const isSwipePreview = pageDrag.targetIndex === index;
              const shouldMount =
                isActive || visitedCategoryIds.has(category.id) || pageDrag.targetIndex === index;

              return (
                <section
                  key={category.id}
                  className={`page-view-panel${isActive ? ' is-active' : ' is-inactive'}${isSwipePreview ? ' is-preview' : ''}`}
                  aria-hidden={!isActive}
                >
                  {shouldMount ? renderPageContent(category.id) : null}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

export default ListTop;
