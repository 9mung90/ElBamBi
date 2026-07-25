// 게시판에서 글쓰기 및 수정 페이지
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { nightfarers } from '../../data/nightfarers';
import {
  getStorageErrorMessage,
  listRelicPresets,
  listRelics,
  type RelicPreset,
  type RelicPresetSlotInput,
  type StoredRelic,
} from '../../api/storageApi';
import ResponsiveSelect from '../../components/ResponsiveSelect';
import {
  BuildPostPresetBlock,
  BuildPresetCard,
  getBuildContentImageCount,
  getCategoryLabel,
  writeCategories,
  type BuildPostDraft,
  type BuildPostPreset,
  type WritableBuildPostCategory,
} from './buildShared';

// 이미지 제한, 장수/용량/형식
const maxBuildContentImageCount = 10;
const maxBuildContentImageSize = 20 * 1024 * 1024;
const allowedBuildImageTypes = new Set([
  'image/avif',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

// 저장된 유물을 찾아서 하나의 저장된 프리셋으로 묶음(유물 id를 6개를 줘서 프리셋 하나 만드는 형식임)
function createBuildPostPreset(preset: RelicPreset, relicsById: Map<string, StoredRelic>): BuildPostPreset {
  // 유물 id 찾기
  const storedRelicIds = preset.slots
    .filter((slot): slot is Extract<RelicPresetSlotInput, { relicRefType: 'stored' }> => slot.relicRefType === 'stored')
    .map((slot) => slot.relicId);

  return {
    preset,
    storedRelics: Array.from(new Set(storedRelicIds))
      .map((relicId) => relicsById.get(relicId))
      .filter((relic): relic is StoredRelic => Boolean(relic)),
  };
}

// 프리셋 넣기
function BuildPresetInsertSection({
  authUserId,
  onSelectPreset,
}: {
  authUserId: string | null;
  onSelectPreset: (preset: BuildPostPreset) => void;
}) {
  const [isOpen, setIsOpen] = useState(false); // 프리셋 열려있음?
  const [presets, setPresets] = useState<RelicPreset[]>([]); // 서버에서 받은 프리셋
  const [storedRelics, setStoredRelics] = useState<StoredRelic[]>([]); // 서버에서 받은 유물
  const [isLoadingPresets, setIsLoadingPresets] = useState(false); // 프리셋 불러오는 중
  const [presetNotice, setPresetNotice] = useState<string | null>(null); // 프리셋 불러오기 실패 메시지
  const relicsById = useMemo(
    () => new Map(storedRelics.map((relic) => [relic.relicId, relic])),
    [storedRelics],
  );

  useEffect(() => {
    if (!isOpen) return undefined;

    let isCurrentRequest = true;

    if (!authUserId) {
      setPresets([]);
      setStoredRelics([]);
      setPresetNotice('로그인 후 저장된 프리셋을 불러올 수 있습니다.');
      return () => {
        isCurrentRequest = false;
      };
    }

    setIsLoadingPresets(true);
    setPresetNotice(null);

    Promise.all([listRelicPresets(authUserId), listRelics(authUserId, 'all')])
      .then(([nextPresets, nextRelics]) => {
        if (!isCurrentRequest) return;

        setPresets(Array.isArray(nextPresets) ? nextPresets : []);
        setStoredRelics(Array.isArray(nextRelics) ? nextRelics : []);
      })
      .catch((error) => {
        if (!isCurrentRequest) return;

        setPresets([]);
        setStoredRelics([]);
        setPresetNotice(getStorageErrorMessage(error, '저장된 프리셋을 불러오지 못했습니다.'));
      })
      .finally(() => {
        if (isCurrentRequest) setIsLoadingPresets(false);
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [authUserId, isOpen]);

  return (
    <section className="build-preset-insert">
      <button
        type="button"
        className="build-secondary-button build-preset-insert-button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
      >
        {isOpen ? '프리셋 닫기' : '프리셋 넣기'}
      </button>

      {isOpen ? (
        <div className="build-preset-insert-panel">
          <div className="build-preset-insert-heading">
            <strong>저장된 프리셋 보기</strong>
            <span>{presets.length}개</span>
          </div>
          {presetNotice ? <p className="build-notice">{presetNotice}</p> : null}
          {isLoadingPresets ? <p className="build-preset-muted">저장된 프리셋을 불러오는 중...</p> : null}
          {!isLoadingPresets && !presetNotice && !presets.length ? (
            <p className="build-preset-muted">저장된 프리셋이 없습니다.</p>
          ) : null}
          {presets.length ? (
            <div className="saved-preset-grid build-preset-grid">
              {/* 프리셋 카드 출력*/}
              {presets.map((preset) => (
                <BuildPresetCard
                  key={preset.presetId}
                  hideRelicSource
                  onSelectPreset={(selectedPreset) => {
                    onSelectPreset(createBuildPostPreset(selectedPreset, relicsById));
                    setIsOpen(false);
                  }}
                  preset={preset}
                  relicsById={relicsById}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

    </section>
  );
}
{/* 게시글 본문 HTML로 작정 및 이미지 삽입 */}
function BuildRichContentEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastSelectionRef = useRef<Range | null>(null);
  const [imageNotice, setImageNotice] = useState<string | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor || editor.innerHTML === value) return;
    editor.innerHTML = value;
  }, [value]);

  // 커서 위치 저장
  function saveSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      lastSelectionRef.current = range.cloneRange();
    }
  }
  // 편집기 내용 전달
  function syncEditorContent() {
    const editor = editorRef.current;
    if (!editor) return;
    onChange(editor.innerHTML);
  }
  // 커서 복원
  function restoreSelection() {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();

    if (lastSelectionRef.current) {
      selection?.addRange(lastSelectionRef.current);
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection?.addRange(range);
  }
  // 이미지 삽입
  function insertImage(dataUrl: string, file: File) {
    const editor = editorRef.current;
    if (!editor) return;

    restoreSelection();

    const image = document.createElement('img');
    image.src = dataUrl;
    image.alt = file.name;
    image.className = 'build-content-image';

    const wrapper = document.createElement('figure');
    wrapper.className = 'build-content-image-block';
    wrapper.appendChild(image);

    // 이미지 뒤에 글 쓸 수 있게 해줌
    const spacer = document.createElement('div');
    spacer.appendChild(document.createElement('br'));

    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (range) {
      range.deleteContents();
      range.insertNode(spacer);
      range.insertNode(wrapper);
      range.setStartAfter(spacer);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } else {
      editor.append(wrapper, spacer);
    }

    saveSelection();
    syncEditorContent();
  }

  // 이미지 파일 읽음
  function readImageFile(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('파일을 읽지 못했습니다.'));
      };
      reader.onerror = () => reject(reader.error ?? new Error('파일을 읽지 못했습니다.'));
      reader.readAsDataURL(file);
    });
  }

  // 이미지 검증(파일 수나 형식 용량)
  async function handleImageFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;

    const currentImageCount = getBuildContentImageCount(editorRef.current?.innerHTML ?? value);
    const remainingImageCount = maxBuildContentImageCount - currentImageCount;
    const acceptedFiles: File[] = [];
    const rejectedMessages: string[] = [];

    if (remainingImageCount <= 0) {
      setImageNotice(`이미지는 최대 ${maxBuildContentImageCount}개까지 넣을 수 있습니다.`);
      return;
    }

    for (const file of files) {
      if (acceptedFiles.length >= remainingImageCount) {
        rejectedMessages.push(`최대 ${maxBuildContentImageCount}개까지만 추가됩니다.`);
        break;
      }

      if (!file.type.startsWith('image/') || !allowedBuildImageTypes.has(file.type)) {
        rejectedMessages.push(`${file.name}: 지원하지 않는 이미지 형식입니다.`);
        continue;
      }

      if (file.size > maxBuildContentImageSize) {
        rejectedMessages.push(`${file.name}: 20MB를 넘는 이미지는 넣을 수 없습니다.`);
        continue;
      }

      acceptedFiles.push(file);
    }

    // 허용되면 삽입
    try {
      for (const file of acceptedFiles) {
        const dataUrl = await readImageFile(file);
        insertImage(dataUrl, file);
      }
      setImageNotice(rejectedMessages[0] ?? null);
    } catch {
      setImageNotice('이미지를 본문에 넣지 못했습니다.');
    }
  }

  return (
    <div className="build-rich-editor">
      <div className="build-editor-toolbar">
        <button
          type="button"
          className="build-secondary-button"
          onMouseDown={saveSelection}
          onClick={() => fileInputRef.current?.click()}
        >
          이미지 넣기
        </button>
        <span>webp, gif, png, jpg 등 이미지/움짤 최대 20MB, 최대 10개</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/avif,image/bmp,image/gif,image/jpeg,image/png,image/webp"
          multiple
          onChange={handleImageFiles}
        />
      </div>
      {imageNotice ? <p className="build-preset-muted">{imageNotice}</p> : null}
      <div
        ref={editorRef}
        id="build-post-content"
        className="build-content-editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="내용"
        data-placeholder="장비, 유물 옵션, 운용법, 루트, 보스별 팁을 적어주세요."
        onBlur={saveSelection}
        onClick={saveSelection}
        onInput={syncEditorContent}
        onKeyUp={saveSelection}
      />
    </div>
  );
}

// 게시글 작성 및 수정 페이지
export default function BuildPostWritePage({
  authorLabel,
  authUserId,
  draft,
  isSubmitting,
  mode = 'create',
  onDraftChange,
  onSubmit,
  onCancel,
}: {
  authorLabel: string;
  authUserId: string | null;
  draft: BuildPostDraft;
  isSubmitting: boolean;
  mode?: 'create' | 'edit';
  onDraftChange: <K extends keyof BuildPostDraft>(key: K, value: BuildPostDraft[K]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const isEdit = mode === 'edit';

  return (
    <section className="build-page build-write-page" aria-labelledby="build-write-title">
      <div className="build-page-heading">
        <div>
          <p className="list-page-kicker">커뮤니티</p>
          <h2 id="build-write-title">{isEdit ? '글 수정' : '글쓰기'}</h2>
        </div>
        <button type="button" className="build-secondary-button" onClick={onCancel}>
          {isEdit ? '글로 돌아가기' : '게시판으로 돌아가기'}
        </button>
      </div>

      <form className="build-write-form" onSubmit={onSubmit}>
        <p className="build-session-note">작성자: {authorLabel}</p>
        <label>
          카테고리
          <ResponsiveSelect
            value={draft.category}
            ariaLabel="카테고리"
            sheetTitle="카테고리 선택"
            options={writeCategories.map((category) => ({
              value: category,
              label: getCategoryLabel(category),
            }))}
            onChange={(nextCategory) => onDraftChange('category', nextCategory as WritableBuildPostCategory)}
          />
        </label>
        <label>
          캐릭터
          {/* TODO: Currently UI only. Connect this form to the DB/API later. */}
          <ResponsiveSelect
            value={draft.nightfarerIndex == null ? '' : String(draft.nightfarerIndex)}
            ariaLabel="캐릭터"
            sheetTitle="캐릭터 선택"
            options={[
              { value: '', label: '선택 안 함' },
              ...nightfarers.map((nightfarer) => ({
                value: String(nightfarer.index),
                label: nightfarer.name,
              })),
            ]}
            onChange={(nextNightfarerIndex) =>
              onDraftChange('nightfarerIndex', nextNightfarerIndex === '' ? null : Number(nextNightfarerIndex))
            }
          />
        </label>
        <label>
          제목
          <input
            type="text"
            value={draft.title}
            onChange={(event) => onDraftChange('title', event.target.value)}
            placeholder="예: 레이더 출혈 빌드와 3일차 운영"
            maxLength={80}
            required
          />
        </label>
        <div className="build-write-field">
          <label htmlFor="build-post-content">내용</label>
          {draft.preset ? (
            <BuildPostPresetBlock
              embeddedPreset={draft.preset}
              onRemove={() => onDraftChange('preset', null)}
            />
          ) : null}
          <BuildRichContentEditor value={draft.content} onChange={(content) => onDraftChange('content', content)} />
        </div>
        <BuildPresetInsertSection authUserId={authUserId} onSelectPreset={(preset) => onDraftChange('preset', preset)} />

        <div className="build-write-actions">
          <button type="button" className="build-secondary-button" onClick={onCancel}>
            취소
          </button>
          <button type="submit" className="build-primary-button" disabled={isSubmitting}>
            {isSubmitting ? (isEdit ? '저장 중' : '등록 중') : isEdit ? '저장' : '등록'}
          </button>
        </div>
      </form>
    </section>
  );
}
