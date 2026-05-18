import { useMemo, useState } from 'react';
import {
  createBuilderRelic,
  getStorageErrorMessage,
  type StoredRelicDebuff,
  type StoredRelicOption,
} from '../api/storageApi';
import ResponsiveSelect from '../components/ResponsiveSelect';
import { relicRollAppData, type RelicRollEffect, type RelicRollMode } from '../data/relics';

type SlotSelection = [string, string, string];
type BuilderRelicColor = 'Red' | 'Blue' | 'Yellow' | 'Green';
type CandidateEvaluation = {
  effect: RelicRollEffect;
  reasons: string[];
};

const EMPTY_SELECTION: SlotSelection = ['', '', ''];
const SLOT_LABELS = ['A', 'B', 'C'];
const LOGIN_REQUIRED_MESSAGE = '로그인을 해주시길 바랍니다.';
const RELIC_COLOR_OPTIONS: Array<{ value: BuilderRelicColor; label: string }> = [
  { value: 'Red', label: '빨강' },
  { value: 'Blue', label: '파랑' },
  { value: 'Yellow', label: '노랑' },
  { value: 'Green', label: '초록' },
];

const BUILDER_RELIC_COLOR_LABELS: Record<BuilderRelicColor, string> = {
  Red: '빨강',
  Blue: '파랑',
  Yellow: '노랑',
  Green: '초록',
};

function getBuilderRelicName(color: BuilderRelicColor) {
  return `제작 유물(${BUILDER_RELIC_COLOR_LABELS[color]})`;
}

function getEffectName(effect: RelicRollEffect) {
  return effect.effect_kor || effect.effect;
}

function getEffectDetail(effect: RelicRollEffect) {
  return effect.effect_detail_kor || '';
}

function toStoredRelicEffect(effect: RelicRollEffect | null, slotIndex: number) {
  const effectId = Number(effect?.id);

  return {
    slot: slotIndex + 1,
    ...(Number.isFinite(effectId) ? { effectId } : {}),
    ...(effect?.key ? { effectKey: effect.key } : {}),
    name: effect ? getEffectName(effect) : '',
    detail: effect ? getEffectDetail(effect) : '',
  };
}

function getCategoryRank(effect: RelicRollEffect, categoryOrder: number[]) {
  const rank = categoryOrder.indexOf(effect.cat);
  return rank === -1 ? categoryOrder.length : rank;
}

function compareEffects(
  left: RelicRollEffect,
  right: RelicRollEffect,
  categoryOrder: number[],
) {
  const leftRank = getCategoryRank(left, categoryOrder);
  const rightRank = getCategoryRank(right, categoryOrder);

  if (leftRank !== rightRank) return leftRank - rightRank;
  if (left.loc !== right.loc) return left.loc - right.loc;

  return Number(left.id) - Number(right.id);
}

function hasEffectConflict(left: RelicRollEffect, right: RelicRollEffect) {
  return (
    left.key === right.key ||
    String(left.id) === String(right.id) ||
    String(left.group) === String(right.group)
  );
}

function getConflictReasons(
  candidate: RelicRollEffect,
  selectedEffect: RelicRollEffect,
  selectedIndex: number,
) {
  const slotLabel = SLOT_LABELS[selectedIndex];
  const reasons: string[] = [];

  if (candidate.key === selectedEffect.key) {
    reasons.push(`${slotLabel}와 같은 효과`);
  }

  if (String(candidate.id) === String(selectedEffect.id)) {
    reasons.push(`${slotLabel}와 같은 ID`);
  }

  if (String(candidate.group) === String(selectedEffect.group)) {
    reasons.push(`${slotLabel}와 같은 그룹`);
  }

  return reasons;
}

function getEffectByKey(mode: RelicRollMode) {
  return new Map(mode.effects.map((effect) => [effect.key, effect]));
}

function getSelectedEffects(mode: RelicRollMode, selectedKeys: SlotSelection) {
  const effectsByKey = getEffectByKey(mode);
  return selectedKeys.map((key) => (key ? effectsByKey.get(key) ?? null : null));
}

function isCandidateAllowedForSlot(
  candidate: RelicRollEffect,
  slotIndex: number,
  selectedEffects: Array<RelicRollEffect | null>,
  categoryOrder: number[],
) {
  return selectedEffects.every((selectedEffect, selectedIndex) => {
    if (!selectedEffect || selectedIndex === slotIndex) return true;
    if (hasEffectConflict(candidate, selectedEffect)) return false;

    if (selectedIndex < slotIndex) {
      return compareEffects(selectedEffect, candidate, categoryOrder) <= 0;
    }

    return compareEffects(candidate, selectedEffect, categoryOrder) <= 0;
  });
}

function getCandidateReasonsForSlot(
  candidate: RelicRollEffect,
  slotIndex: number,
  selectedEffects: Array<RelicRollEffect | null>,
  categoryOrder: number[],
) {
  const reasons: string[] = [];

  selectedEffects.forEach((selectedEffect, selectedIndex) => {
    if (!selectedEffect || selectedIndex === slotIndex) return;

    reasons.push(...getConflictReasons(candidate, selectedEffect, selectedIndex));

    if (selectedIndex < slotIndex && compareEffects(selectedEffect, candidate, categoryOrder) > 0) {
      reasons.push(
        `${SLOT_LABELS[selectedIndex]}보다 앞선 순서라 ${SLOT_LABELS[slotIndex]}에 올 수 없음`,
      );
    }

    if (selectedIndex > slotIndex && compareEffects(candidate, selectedEffect, categoryOrder) > 0) {
      reasons.push(
        `${SLOT_LABELS[selectedIndex]}보다 뒤쪽 순서라 ${SLOT_LABELS[slotIndex]}에 올 수 없음`,
      );
    }
  });

  return [...new Set(reasons)];
}

function canCompleteSelection(
  mode: RelicRollMode,
  selectedKeys: SlotSelection,
  categoryOrder: number[],
): boolean {
  const emptyIndex = selectedKeys.findIndex((key) => !key);
  if (emptyIndex === -1) return true;

  const selectedEffects = getSelectedEffects(mode, selectedKeys);

  return mode.effects.some((effect) => {
    if (!isCandidateAllowedForSlot(effect, emptyIndex, selectedEffects, categoryOrder)) {
      return false;
    }

    const nextSelection = [...selectedKeys] as SlotSelection;
    nextSelection[emptyIndex] = effect.key;

    return canCompleteSelection(mode, nextSelection, categoryOrder);
  });
}

function getSlotEvaluations(
  mode: RelicRollMode,
  selectedKeys: SlotSelection,
  slotIndex: number,
  categoryOrder: number[],
): CandidateEvaluation[] {
  const selectedEffects = getSelectedEffects(mode, selectedKeys);

  return mode.effects.map((effect) => {
    const reasons = getCandidateReasonsForSlot(effect, slotIndex, selectedEffects, categoryOrder);

    if (reasons.length === 0) {
      const nextSelection = [...selectedKeys] as SlotSelection;
      nextSelection[slotIndex] = effect.key;

      if (!canCompleteSelection(mode, nextSelection, categoryOrder)) {
        reasons.push('남은 슬롯 조합 없음');
      }
    }

    return { effect, reasons };
  });
}

function matchesSearch(effect: RelicRollEffect, searchQuery: string) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    effect.effect_kor,
    effect.effect_detail_kor,
    effect.effect,
    effect.key,
    effect.id,
    effect.group,
    effect.cat,
    effect.loc,
  ].some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function getModeLabel(mode: RelicRollMode) {
  const labels: Record<string, string> = {
    base_game_v102: '일반',
    deep_night_v102: '심도',
    tfh_dlc_base: '버려진 공허',
    tfh_dlc_deep: '버려진 공허, 심도',
  };

  return labels[mode.id] ?? mode.label;
}

function getDebuffTableLabel(label: string) {
  const labels: Record<string, string> = {
    'Base / Deep of the Night debuffs': '심도 디버프',
    'The Forsaken Hollow DLC debuffs': '버려진 공허 디버프',
  };

  return labels[label] ?? label;
}

function RelicEffectOption({
  candidateCount,
  effect,
  reasons,
  searchQuery,
}: {
  candidateCount: number;
  effect: RelicRollEffect | null;
  reasons: string[];
  searchQuery: string;
}) {
  if (!effect) {
    return (
      <div className="relic-builder-empty">
        <strong>선택 필요</strong>
        <span>
          {searchQuery.trim()
            ? `${candidateCount}개 후보가 검색 조건에 맞습니다.`
            : `${candidateCount}개 후보가 표시됩니다.`}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relic-builder-selected-effect${reasons.length ? ' is-invalid' : ' is-valid'}`}
    >
      <strong>{getEffectName(effect)}</strong>
      {getEffectDetail(effect) ? <p>{getEffectDetail(effect)}</p> : null}
      {reasons.length ? (
        <ul className="relic-builder-reasons">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : (
        <em>현재 선택 기준으로 가능한 조합입니다.</em>
      )}
    </div>
  );
}

function RelicBuilderPage({
  searchQuery,
  authUserId,
  onRelicsChanged,
}: {
  searchQuery: string;
  authUserId: string | null;
  onRelicsChanged: () => void;
}) {
  const modes = useMemo(() => Object.values(relicRollAppData.modes), []);
  const [modeId, setModeId] = useState(modes[0]?.id ?? '');
  const [selectedKeys, setSelectedKeys] = useState<SlotSelection>(EMPTY_SELECTION);
  const [selectedColor, setSelectedColor] = useState<BuilderRelicColor>('Red');
  const [showInvalidOptions, setShowInvalidOptions] = useState(false);
  const [selectedDebuffKeys, setSelectedDebuffKeys] = useState<SlotSelection>(EMPTY_SELECTION);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [isSavingRelic, setIsSavingRelic] = useState(false);

  const mode = useMemo(
    () => modes.find((candidateMode) => candidateMode.id === modeId) ?? modes[0],
    [modeId, modes],
  );

  const categoryOrder = relicRollAppData.validationRulesInferred.recommendedCategorySortOrder;

  const selectedEffects = useMemo(
    () => getSelectedEffects(mode, selectedKeys),
    [mode, selectedKeys],
  );

  const allSlotEvaluations = useMemo(
    () =>
      selectedKeys.map((_, slotIndex) =>
        getSlotEvaluations(mode, selectedKeys, slotIndex, categoryOrder),
      ),
    [categoryOrder, mode, selectedKeys],
  );

  const selectedReasons = useMemo(
    () =>
      selectedEffects.map((effect, slotIndex) =>
        effect
          ? getCandidateReasonsForSlot(effect, slotIndex, selectedEffects, categoryOrder)
          : [],
      ),
    [categoryOrder, selectedEffects],
  );

  const isComplete = selectedKeys.every(Boolean);
  const resultReasons = selectedReasons.flat();
  const debuffTable = mode.debuffTable ? relicRollAppData.debuffTables[mode.debuffTable] : null;
  const canUseDebuffs = mode.isDeepMode && Boolean(debuffTable);
  const selectedDebuffs = selectedDebuffKeys.map(
    (key) => debuffTable?.effects.find((effect) => effect.key === key) ?? null,
  );
  const requiredDebuffIndexes = selectedEffects
    .map((effect, index) => (canUseDebuffs && effect?.cursed ? index : -1))
    .filter((index) => index !== -1);
  const missingDebuffIndexes = requiredDebuffIndexes.filter((index) => !selectedDebuffKeys[index]);
  const duplicateDebuffKeys = selectedDebuffKeys.filter(
    (key, index) => key && selectedDebuffKeys.indexOf(key) !== index,
  );
  const duplicateDebuffKeySet = new Set(duplicateDebuffKeys);
  const debuffReasons = [
    ...missingDebuffIndexes.map((index) => `${SLOT_LABELS[index]} 슬롯 옵션은 디버프가 필요합니다.`),
    ...[...duplicateDebuffKeySet].map(() => '같은 디버프를 두 번 선택할 수 없습니다.'),
  ];
  const invalidSlotReasonLines = selectedReasons
    .map((reasons, index) => {
      const slotReasons = [...reasons];

      if (missingDebuffIndexes.includes(index)) {
        slotReasons.push('디버프가 필요합니다.');
      }

      if (selectedDebuffKeys[index] && duplicateDebuffKeySet.has(selectedDebuffKeys[index])) {
        slotReasons.push('같은 디버프를 두 번 선택할 수 없습니다.');
      }

      return slotReasons.length
        ? `${SLOT_LABELS[index]} 슬롯: ${[...new Set(slotReasons)].join(' / ')}`
        : '';
    })
    .filter(Boolean);
  const isCompleteWithDebuff = isComplete && missingDebuffIndexes.length === 0;
  const isValidComplete = isCompleteWithDebuff && resultReasons.length === 0 && debuffReasons.length === 0;

  function updateSlot(slotIndex: number, effectKey: string) {
    setSelectedKeys((currentSelection) => {
      const nextSelection = [...currentSelection] as SlotSelection;
      nextSelection[slotIndex] = effectKey;
      return nextSelection;
    });
    setSelectedDebuffKeys((currentSelection) => {
      const nextSelection = [...currentSelection] as SlotSelection;
      nextSelection[slotIndex] = '';
      return nextSelection;
    });
  }

  function getBuilderRelicOptions(): StoredRelicOption[] {
    return selectedEffects.map((effect, index) => toStoredRelicEffect(effect, index));
  }

  function getBuilderRelicDebuffs(): StoredRelicDebuff[] {
    if (!canUseDebuffs) return [];

    return selectedDebuffs.flatMap((effect, index) =>
      selectedEffects[index]?.cursed && effect ? [toStoredRelicEffect(effect, index)] : [],
    );
  }

  async function handleSaveRelic() {
    setSaveNotice(null);

    if (!authUserId) {
      window.alert(LOGIN_REQUIRED_MESSAGE);
      return;
    }

    if (!isCompleteWithDebuff) {
      setSaveNotice('Select all 3 options and required debuffs before saving.');
      return;
    }

    const options = getBuilderRelicOptions();
    const debuffs = getBuilderRelicDebuffs();
    if (options.length !== 3 || options.some((option) => !option.name || (!option.effectId && !option.effectKey))) {
      setSaveNotice('Select all 3 options before saving.');
      return;
    }

    setIsSavingRelic(true);

    const payload = {
      userId: authUserId,
      slotIndex: 0,
      itemId: 0,
      itemName: getBuilderRelicName(selectedColor),
      color: selectedColor,
      modeId: mode.id,
      isValid: isValidComplete,
      options,
      debuffs,
    };

    console.info('[RelicBuilder] Saving relic payload', payload);

    try {
      const savedRelic = await createBuilderRelic(payload);
      console.info('[RelicBuilder] Relic saved response', savedRelic);
      setSaveNotice('Relic saved.');
      onRelicsChanged();
    } catch (error) {
      console.error('[RelicBuilder] Failed to save relic', {
        payload,
        error,
      });
      setSaveNotice(getStorageErrorMessage(error, 'Failed to save relic.'));
    } finally {
      setIsSavingRelic(false);
    }
  }

  return (
    <section className="options-page relic-builder-page" aria-labelledby="relic-builder-title">
      <div className="options-page-heading">
        <div>
          <h2 id="relic-builder-title">유물 옵션 제작</h2>
        </div>
        <span className="option-count">
          {mode.effects.length} effects / {mode.effectSlots} slots
        </span>
      </div>

      <div className="relic-builder-layout">
        <section className="calc-panel relic-builder-controls" aria-label="유물 옵션 규칙 설정">
          <div className="calc-control-grid relic-builder-mode-grid">
            <label>
              모드
              <ResponsiveSelect
                value={mode.id}
                ariaLabel="모드"
                sheetTitle="모드 선택"
                options={modes.map((candidateMode) => ({
                  value: candidateMode.id,
                  label: getModeLabel(candidateMode),
                }))}
                onChange={(nextModeId) => {
                  setModeId(nextModeId);
                  setSelectedKeys(EMPTY_SELECTION);
                  setSelectedDebuffKeys(EMPTY_SELECTION);
                }}
              />
            </label>

            <button
              type="button"
              className="relic-builder-reset"
              onClick={() => setSelectedKeys(EMPTY_SELECTION)}
            >
              초기화
            </button>
          </div>

          <label className="relic-builder-color-control">
            색상
            <ResponsiveSelect
              value={selectedColor}
              ariaLabel="색상"
              sheetTitle="색상 선택"
              options={RELIC_COLOR_OPTIONS.map((colorOption) => ({
                value: colorOption.value,
                label: colorOption.label,
              }))}
              onChange={(nextColor) => setSelectedColor(nextColor as BuilderRelicColor)}
            />
          </label>

          <label className="relic-builder-invalid-toggle">
            <input
              type="checkbox"
              checked={showInvalidOptions}
              onChange={(event) => setShowInvalidOptions(event.target.checked)}
            />
            <span>불가능한 조합도 표시</span>
          </label>

          {mode.isDeepMode && debuffTable ? (
            <div className="relic-builder-debuff-note">
              <strong>{getDebuffTableLabel(debuffTable.label)}</strong>
              <span>{debuffTable.count}개 디버프 테이블이 이 모드에 연결되어 있습니다.</span>
            </div>
          ) : null}
        </section>

        <div className="relic-builder-slots">
          {SLOT_LABELS.map((slotLabel, slotIndex) => {
            const selectedEffect = selectedEffects[slotIndex];
            const slotEvaluations = allSlotEvaluations[slotIndex];
            const allowedCount = slotEvaluations.filter(({ reasons }) => reasons.length === 0).length;
            const visibleEvaluations = slotEvaluations.filter(
              ({ effect, reasons }) =>
                effect.key === selectedKeys[slotIndex] ||
                ((showInvalidOptions || reasons.length === 0) && matchesSearch(effect, searchQuery)),
            );
            const selectedEvaluation = slotEvaluations.find(
              ({ effect }) => effect.key === selectedKeys[slotIndex],
            );
            const totalCount = showInvalidOptions ? slotEvaluations.length : allowedCount;
            const selectedDebuff = selectedDebuffs[slotIndex];
            const usedDebuffKeys = selectedDebuffKeys.filter((key, index) => key && index !== slotIndex);
            const visibleDebuffs =
              debuffTable?.effects.filter(
                (effect) =>
                  effect.key === selectedDebuffKeys[slotIndex] ||
                  (!usedDebuffKeys.includes(effect.key) && matchesSearch(effect, searchQuery)),
              ) ?? [];
            const needsDebuff = canUseDebuffs && Boolean(selectedEffect?.cursed);

            return (
              <section className="relic-builder-slot" key={slotLabel}>
                <div className="relic-builder-slot-heading">
                  <span>{slotLabel}</span>
                  <strong>옵션 {slotIndex + 1}</strong>
                  <em>{visibleEvaluations.length} / {totalCount}</em>
                </div>

                <ResponsiveSelect
                  value={selectedKeys[slotIndex]}
                  ariaLabel={`옵션 ${slotIndex + 1} 효과 선택`}
                  sheetTitle={`${slotLabel} 옵션 선택`}
                  options={[
                    { value: '', label: '효과 선택' },
                    ...visibleEvaluations.map(({ effect, reasons }) => ({
                      value: effect.key,
                      label: `${getEffectName(effect)}${reasons.length ? ' (불가)' : ''}`,
                    })),
                  ]}
                  onChange={(nextEffectKey) => updateSlot(slotIndex, nextEffectKey)}
                />

                <RelicEffectOption
                  candidateCount={visibleEvaluations.length}
                  effect={selectedEffect}
                  reasons={selectedEvaluation?.reasons ?? selectedReasons[slotIndex]}
                  searchQuery={searchQuery}
                />

                {needsDebuff ? (
                  <div className="relic-builder-slot-debuff">
                    <label>
                      디버프
                      <ResponsiveSelect
                        value={selectedDebuffKeys[slotIndex]}
                        ariaLabel={`${slotLabel} 슬롯 디버프 선택`}
                        sheetTitle={`${slotLabel} 디버프 선택`}
                        options={[
                          { value: '', label: '디버프 선택' },
                          ...visibleDebuffs.map((effect) => ({
                            value: effect.key,
                            label: getEffectName(effect),
                          })),
                        ]}
                        onChange={(effectKey) => {
                          setSelectedDebuffKeys((currentSelection) => {
                            const nextSelection = [...currentSelection] as SlotSelection;
                            nextSelection[slotIndex] = effectKey;
                            return nextSelection;
                          });
                        }}
                      />
                    </label>

                    <RelicEffectOption
                      candidateCount={visibleDebuffs.length}
                      effect={selectedDebuff}
                      reasons={[]}
                      searchQuery={searchQuery}
                    />
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>

        <section className="calc-panel relic-builder-result" aria-label="선택된 유물 옵션 결과">
          <div className="relic-builder-result-heading">
            <h3>결과</h3>
            <span
              className={`relic-builder-result-status ${
                isValidComplete ? 'is-valid' : isCompleteWithDebuff ? 'is-invalid' : 'is-pending'
              }`}
            >
              {isValidComplete ? '조합 가능' : isCompleteWithDebuff ? '조합 불가' : '선택 중'}
            </span>
          </div>

          <ol className="relic-builder-result-list">
            {selectedEffects.map((effect, index) => (
              <li key={SLOT_LABELS[index]}>
                <span>{SLOT_LABELS[index]}</span>
                {effect ? (
                  <div>
                    <strong>{getEffectName(effect)}</strong>
                    {getEffectDetail(effect) ? <p>{getEffectDetail(effect)}</p> : null}
                    {!selectedReasons[index].length ? <em>가능</em> : null}
                    {canUseDebuffs && effect.cursed ? (
                      selectedDebuffs[index] ? (
                        <div className="relic-builder-result-debuff">
                          <strong>디버프: {getEffectName(selectedDebuffs[index])}</strong>
                          {getEffectDetail(selectedDebuffs[index]) ? <p>{getEffectDetail(selectedDebuffs[index])}</p> : null}
                        </div>
                      ) : (
                        <em>이 옵션은 디버프 선택이 필요합니다.</em>
                      )
                    ) : null}
                  </div>
                ) : (
                  <div>
                    <strong>아직 선택되지 않음</strong>
                    <em>앞뒤 슬롯과 동시에 가능한 효과만 후보에 표시됩니다.</em>
                  </div>
                )}
              </li>
            ))}
          </ol>

          <div className="relic-builder-overall">
            <strong>종합 판정</strong>
            {isCompleteWithDebuff ? (
              invalidSlotReasonLines.length ? (
                <ul className="relic-builder-reasons">
                  {invalidSlotReasonLines.map((reasonLine) => (
                    <li key={reasonLine}>{reasonLine}</li>
                  ))}
                </ul>
              ) : (
                <span>
                  선택한 3개 옵션과 필요한 디버프는 현재 규칙 기준으로 조합 가능합니다.
                </span>
              )
            ) : (
              <span>
                3개 슬롯과 필요한 디버프를 모두 선택하면 최종 조합 가능 여부를 판정합니다.
              </span>
            )}
          </div>
        </section>
        <div className="relic-builder-save-actions">
          <button type="button" className="relic-builder-save-button" disabled={isSavingRelic} onClick={handleSaveRelic}>
            {isSavingRelic ? 'Saving...' : '유물 저장'}
          </button>
          {saveNotice ? <p className="relic-builder-save-notice">{saveNotice}</p> : null}
        </div>
      </div>
    </section>
  );
}

export default RelicBuilderPage;
