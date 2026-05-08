/**
 * Elden Ring: Nightreign save relic parser
 *
 * 역할:
 * 1) .sl2 / .co2 파일이면 BND4 컨테이너를 풀고 AES-CBC로 USERDATA 엔트리를 복호화합니다.
 * 2) .dat 파일이면 그대로 바이너리를 읽습니다.
 * 3) 복호화된 데이터 안에서 유물 슬롯 패턴을 찾아 itemId/effectId를 추출합니다.
 *
 * 사용 위치 예시:
 *   src/utils/nightreignSaveParser.ts
 *
 * 주의:
 * - 이 코드는 읽기/분석 전용입니다. 세이브 파일을 수정하거나 다시 저장하지 않습니다.
 * - 실제 세이브 파일에는 개인 식별값이 들어 있을 수 있으므로 외부 서버로 업로드하지 마세요.
 */

export type CharacterSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface Bnd4Entry {
  index: number;
  name: string;
  size: number;
  dataOffset: number;
  footerLength: number;
  iv: Uint8Array;
  encryptedData: Uint8Array;
  encryptedPayload: Uint8Array;
  decryptedData: Uint8Array;
  decrypted: boolean;
}

export interface Bnd4UnpackResult {
  entries: Bnd4Entry[];
  successCount: number;
  totalCount: number;
  indexMapping: Record<number, string>;
}

export interface CharacterInfo {
  name: string;
  murks: number;
  sigs: number;
  steamId: Uint8Array;
}

export interface RawRelicSlot {
  index: number;
  slotIndex: number;
  idx: number;
  flag: number;
  offset: number;
  size: number;
  rawData: Uint8Array;
  itemId: number;
  effect1Id: number;
  effect2Id: number;
  effect3Id: number;
  effect4Id: number;
  effect5Id: number;
  effect6Id: number;
  uncertain: boolean;
}

export interface ParsedRelic {
  id: string;
  itemId: number;
  slotIndex: number;
  color: string;
  dn?: boolean;
  effects: number[];
  raw: RawRelicSlot;
}

export interface RelicScanResult {
  slots: RawRelicSlot[];
  relics: ParsedRelic[];
  characterInfo: CharacterInfo;
  successCount: number;
  totalSlots: number;
  uncertainSlots: number;
  uncertainResult: boolean;
  endRelicsOffset: number;
  logs: string[];
}

export type ItemLookup = (itemId: number) => { color?: string; dn?: boolean } | undefined;

const DS2_KEY = new Uint8Array([
  0x18, 0xf6, 0x32, 0x66,
  0x05, 0xbd, 0x17, 0x8a,
  0x55, 0x24, 0x52, 0x3a,
  0xc0, 0xa0, 0xc6, 0x09,
]);

const BND4_MAGIC = "BND4";
const BND4_ENTRY_MAGIC = new Uint8Array([0x40, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff]);

const IV_SIZE = 16;
const BND4_HEADER_LEN = 64;
const BND4_ENTRY_HEADER_LEN = 32;

const EMPTY_U32 = 0xffffffff;
const UNCERTAIN_THRESHOLD = 0.2;

// 캐릭터명 기준으로 Murk / Sigil / Steam ID를 찾기 위한 보정값
const MURKS_OFFSET_FROM_NAME = 52;
const SIGS_OFFSET_FROM_NAME = -64;
const STEAM_ID_OFFSET_FROM_PATTERN = -126;
const STEAM_ID_ANCHOR_PATTERN = "82 7F 30 31";

const MEMORY_DAT_SECTIONS: Record<CharacterSlot, { start: number; end: number }> = {
  1: { start: 128, end: 1048703 },
  2: { start: 1048704, end: 2097279 },
  3: { start: 2097280, end: 3145855 },
  4: { start: 3145856, end: 4194431 },
  5: { start: 4194432, end: 5243007 },
  6: { start: 5243008, end: 6291583 },
  7: { start: 6291584, end: 7340159 },
  8: { start: 7340160, end: 8388735 },
  9: { start: 8388736, end: 9437311 },
  10: { start: 9437312, end: 10485887 },
};

const MEMORY_DAT_NAME_OFFSETS = [
  10492382,
  10493014,
  10493648,
  10494282,
  10494916,
  10495550,
  10496184,
  10496818,
  10497452,
  10498086,
];

const VALID_SLOT_FLAG_1 = new Set([128, 131, 129, 130, 132, 133]);
const VALID_SLOT_FLAG_2 = new Set([128, 144, 192]);

function readU32LE(data: Uint8Array, offset: number): number {
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  ) >>> 0;
}

function readU24LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16);
}

function readNumber(data: Uint8Array, offset: number, byteLength = 4): number | null {
  if (offset < 0 || offset + byteLength > data.length) return null;
  if (byteLength === 3) return readU24LE(data, offset);
  if (byteLength === 4) return readU32LE(data, offset);
  return null;
}

function toArrayBufferBytes(data: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(data);
}

function bytesToAsciiLikeName(data: Uint8Array, offset: number, byteLength = 32): string {
  if (offset < 0 || offset + byteLength > data.length) return "N/A";

  const chunk = data.slice(offset, offset + byteLength);
  const chars: string[] = [];

  // 원본 코드와 동일하게 UTF-16LE처럼 2바이트씩 건너뛰며 낮은 바이트를 읽습니다.
  for (let i = 0; i < chunk.length; i += 2) {
    const value = chunk[i];
    if (value === 0) break;
    chars.push(value >= 32 && value <= 126 ? String.fromCharCode(value) : ".");
  }

  return chars.join("");
}

function readUtf16NameAsUtf8Bytes(data: Uint8Array, offset: number, byteLength: number): Uint8Array {
  if (offset < 0 || offset + byteLength > data.length) return new Uint8Array(0);

  try {
    const raw = data.slice(offset, offset + byteLength);
    const decoded = new TextDecoder("utf-16le").decode(raw);
    const end = decoded.indexOf("\0");
    const name = end !== -1 ? decoded.substring(0, end) : decoded;
    return new TextEncoder().encode(name);
  } catch {
    return data.slice(offset, offset + byteLength);
  }
}

function findHexPattern(data: Uint8Array, hexPattern: string): number | null {
  const pattern = new Uint8Array(hexPattern.split(" ").map((part) => parseInt(part, 16)));

  for (let i = 0; i <= data.length - pattern.length; i++) {
    let matched = true;
    for (let j = 0; j < pattern.length; j++) {
      if (data[i + j] !== pattern[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return i;
  }

  return null;
}

function findBytes(data: Uint8Array, pattern: Uint8Array): number | null {
  if (pattern.length === 0) return null;

  for (let i = 0; i <= data.length - pattern.length; i++) {
    let matched = true;
    for (let j = 0; j < pattern.length; j++) {
      if (data[i + j] !== pattern[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return i;
  }

  return null;
}

function getSlotSize(flag2: number): number | null {
  switch (flag2) {
    case 192:
      return 72; // 사이트 코드 기준 유물 슬롯
    case 144:
      return 16;
    case 128:
      return 80;
    default:
      return null;
  }
}

function isValidSlotHeader(data: Uint8Array, offset: number): [boolean, number | null] {
  if (offset + 4 > data.length) return [false, null];

  const flag1 = data[offset + 2];
  const flag2 = data[offset + 3];

  if (!VALID_SLOT_FLAG_1.has(flag1) || !VALID_SLOT_FLAG_2.has(flag2)) {
    return [false, null];
  }

  const size = getSlotSize(flag2);
  if (size !== null && offset + size <= data.length) {
    return [true, size];
  }

  return [false, null];
}

function applySpecialRelicEffectOverrides(itemId: number, slot: RawRelicSlot): void {
  // 사이트 원본 코드에 들어 있던 예외 보정입니다.
  // 특정 유물은 세이브에 저장된 효과와 실제 표시 효과가 달라서 수동으로 덮어씁니다.
  switch (itemId) {
    case 10002:
      slot.effect1Id = 7035900;
      slot.effect2Id = 7040400;
      slot.effect3Id = 7000000;
      slot.effect4Id = EMPTY_U32;
      break;
    case 12002:
      slot.effect1Id = 7012000;
      slot.effect2Id = 7033400;
      slot.effect3Id = 7000002;
      slot.effect4Id = EMPTY_U32;
      break;
    case 16002:
      slot.effect1Id = 7011200;
      slot.effect2Id = 7010900;
      slot.effect3Id = 7090000;
      slot.effect4Id = EMPTY_U32;
      break;
    case 17002:
      slot.effect1Id = 7034100;
      slot.effect2Id = 7032900;
      slot.effect3Id = 7000502;
      slot.effect4Id = EMPTY_U32;
      break;
    case 11001:
      slot.effect1Id = 7010500;
      slot.effect2Id = 7033200;
      slot.effect3Id = 7100100;
      slot.effect4Id = EMPTY_U32;
      break;
    case 11002:
      slot.effect1Id = 7032400;
      slot.effect2Id = 7000902;
      slot.effect3Id = 7000702;
      slot.effect4Id = EMPTY_U32;
      break;
  }
}

function isEmptyFfBlock(data: Uint8Array, offset: number): boolean {
  return (
    offset + 8 <= data.length &&
    data[offset] === 0 &&
    data[offset + 1] === 0 &&
    data[offset + 2] === 0 &&
    data[offset + 3] === 0 &&
    data[offset + 4] === 255 &&
    data[offset + 5] === 255 &&
    data[offset + 6] === 255 &&
    data[offset + 7] === 255
  );
}

function isEmptyZeroBlock(data: Uint8Array, offset: number): boolean {
  return (
    offset + 8 <= data.length &&
    data[offset] === 0 &&
    data[offset + 1] === 0 &&
    data[offset + 2] === 0 &&
    data[offset + 3] === 0 &&
    data[offset + 4] === 0 &&
    data[offset + 5] === 0 &&
    data[offset + 6] === 0 &&
    data[offset + 7] === 0
  );
}

function isLikelyRelicTerminator(data: Uint8Array, offset: number): boolean {
  return (
    offset >= 30000 &&
    offset + 8 <= data.length &&
    data[offset] === 1 &&
    data[offset + 1] === 0 &&
    data[offset + 2] === 0 &&
    data[offset + 3] === 0 &&
    data[offset + 4] === 0 &&
    data[offset + 5] === 0 &&
    data[offset + 6] === 0 &&
    data[offset + 7] === 0
  );
}

function scanRawRelicSlots(data: Uint8Array, baseOffset = 0): [RawRelicSlot[], number] {
  const relics: RawRelicSlot[] = [];
  let alignedStart: number | null = null;

  // 유효 슬롯 헤더가 연속되거나 뒤에 빈 슬롯이 오는 첫 위치를 정렬 시작점으로 봅니다.
  for (let i = 0; i < data.length - 8; i++) {
    const [valid, size] = isValidSlotHeader(data, i);
    if (!valid || size === null) continue;

    const nextOffset = i + size;
    const [nextValid] = isValidSlotHeader(data, nextOffset);
    const nextEmpty =
      nextOffset + 8 <= data.length &&
      data[nextOffset] === 0 &&
      data[nextOffset + 1] === 0 &&
      data[nextOffset + 2] === 0 &&
      data[nextOffset + 3] === 0 &&
      (data[nextOffset + 4] === 255 || data[nextOffset + 4] === 0) &&
      (data[nextOffset + 5] === 255 || data[nextOffset + 5] === 0) &&
      (data[nextOffset + 6] === 255 || data[nextOffset + 6] === 0) &&
      (data[nextOffset + 7] === 255 || data[nextOffset + 7] === 0);

    if (nextValid || nextEmpty) {
      alignedStart = i;
      break;
    }
  }

  if (alignedStart === null) {
    console.error("No valid slot alignment found");
    return [relics, -1];
  }

  let offset = alignedStart;
  let index = 0;

  while (offset < data.length - 4) {
    const flag1 = data[offset + 2];
    const flag2 = data[offset + 3];

    if (VALID_SLOT_FLAG_1.has(flag1) && VALID_SLOT_FLAG_2.has(flag2)) {
      const size = getSlotSize(flag2);

      if (size !== null && offset + size <= data.length) {
        // flag2 === 192인 72바이트 슬롯을 유물 슬롯으로 처리합니다.
        if (flag2 === 192) {
          const raw = data.slice(offset, offset + size);
          const slotIndex = raw[1] << 8 | raw[0];
          const itemId = readU24LE(raw, 4);

          const slot: RawRelicSlot = {
            index,
            slotIndex,
            idx: readU32LE(raw, 0),
            flag: raw[2],
            offset: baseOffset + offset,
            size,
            rawData: raw,
            itemId,
            effect1Id: readU32LE(raw, 16),
            effect2Id: readU32LE(raw, 20),
            effect3Id: readU32LE(raw, 24),
            effect4Id: readU32LE(raw, 56),
            effect5Id: readU32LE(raw, 60),
            effect6Id: readU32LE(raw, 64),
            uncertain: false,
          };

          applySpecialRelicEffectOverrides(itemId, slot);

          const effectIds = [
            slot.effect1Id,
            slot.effect2Id,
            slot.effect3Id,
            slot.effect4Id,
            slot.effect5Id,
            slot.effect6Id,
          ];

          const isValidRelic =
            itemId > 10 &&
            itemId < 2020000 &&
            effectIds.every((id) => id === EMPTY_U32 || id === -1 || (id > 0 && id < 10000000));

          if (isValidRelic) {
            relics.push(slot);
          }

          index++;
        }

        offset += size;
        continue;
      }
    }

    if (isEmptyFfBlock(data, offset) || isEmptyZeroBlock(data, offset)) {
      offset += 8;
      continue;
    }

    if (isLikelyRelicTerminator(data, offset)) {
      return [relics, offset + 8];
    }

    offset += 1;
  }

  return [relics, -1];
}

function assignSlotIndexFromEntryTable(slots: RawRelicSlot[], data: Uint8Array, endRelicsOffset: number): RawRelicSlot[] {
  if (endRelicsOffset < 0) return slots;

  const maps = [0, 4, 8].map((shift) => {
    let pos = endRelicsOffset + 1572 + shift;
    const map = new Map<number, number>();

    while (pos < data.length - 14) {
      const idx = readU32LE(data, pos);
      const maybeAmount = readU32LE(data, pos + 4);
      const slotIndex = readU24LE(data, pos + 8);

      // 원본 코드의 의도를 살려, 엔트리 테이블을 어느 정도 지난 뒤 이상한 0 엔트리가 나오면 중단합니다.
      if (pos - (endRelicsOffset + 1572 + shift) >= 10000 && idx === 0 && (maybeAmount !== 0 || slotIndex !== 0)) {
        break;
      }

      if (VALID_SLOT_FLAG_1.has(data[pos + 2]) && VALID_SLOT_FLAG_2.has(data[pos + 3])) {
        map.set(idx, slotIndex);
      }

      pos += 14;
    }

    return map;
  });

  maps.sort((a, b) => b.size - a.size);
  const bestMap = maps[0];

  for (const slot of slots) {
    if (bestMap.has(slot.idx)) {
      slot.slotIndex = bestMap.get(slot.idx) || 0;
    } else {
      slot.uncertain = true;
    }
  }

  return slots;
}

function findFallbackCharacterNameOffset(data: Uint8Array): number | null {
  for (let offset = 0; offset < data.length - 64; offset++) {
    let hasAscii = false;
    let hasNullTerminator = false;

    for (let i = 0; i < 32 && offset + i + 1 < data.length; i += 2) {
      const low = data[offset + i];
      const high = data[offset + i + 1];

      if (low === 0 && high === 0) {
        hasNullTerminator = true;
        break;
      }

      if (low >= 32 && low <= 126) {
        hasAscii = true;
      }
    }

    if (hasAscii && hasNullTerminator) return offset;
  }

  return null;
}

function readCharacterInfo(data: Uint8Array, nameOffset: number): CharacterInfo {
  const info: CharacterInfo = {
    name: "N/A",
    murks: 0,
    sigs: 0,
    steamId: new Uint8Array(8),
  };

  if (nameOffset !== 65535) {
    info.name = bytesToAsciiLikeName(data, nameOffset);
    info.murks = readNumber(data, nameOffset + MURKS_OFFSET_FROM_NAME) || 0;
    info.sigs = readNumber(data, nameOffset + SIGS_OFFSET_FROM_NAME) || 0;
  }

  const steamAnchor = findHexPattern(data, STEAM_ID_ANCHOR_PATTERN);
  if (steamAnchor !== null) {
    const steamOffset = steamAnchor + STEAM_ID_OFFSET_FROM_PATTERN;
    if (steamOffset >= 0 && steamOffset + 8 <= data.length) {
      info.steamId = data.slice(steamOffset, steamOffset + 8);
    }
  }

  return info;
}

export async function decryptAesCbc(payload: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", toArrayBufferBytes(key), { name: "AES-CBC" }, false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-CBC", iv: toArrayBufferBytes(iv) }, cryptoKey, toArrayBufferBytes(payload));
  return new Uint8Array(decrypted);
}

export async function unpackBnd4SaveFile(fileOrBytes: File | Uint8Array): Promise<Bnd4UnpackResult> {
  const bytes = fileOrBytes instanceof Uint8Array
    ? fileOrBytes
    : new Uint8Array(await fileOrBytes.arrayBuffer());

  const magic = String.fromCharCode(...bytes.slice(0, 4));
  if (magic !== BND4_MAGIC) {
    return {
      entries: [],
      successCount: 0,
      totalCount: 0,
      indexMapping: {},
    };
  }

  const totalCount = readU32LE(bytes, 12);
  const entries: Bnd4Entry[] = [];
  let successCount = 0;

  for (let index = 0; index < totalCount; index++) {
    const headerOffset = BND4_HEADER_LEN + BND4_ENTRY_HEADER_LEN * index;
    if (headerOffset + BND4_ENTRY_HEADER_LEN > bytes.length) break;

    const header = bytes.slice(headerOffset, headerOffset + BND4_ENTRY_HEADER_LEN);
    const magicOk = BND4_ENTRY_MAGIC.every((value, i) => header[i] === value);
    if (!magicOk) continue;

    const size = readU32LE(header, 8);
    const dataOffset = readU32LE(header, 16);
    const nameOffset = readU32LE(header, 20);
    const footerLength = readU32LE(header, 24);

    if (size <= 0 || size > 1_000_000_000) continue;
    if (dataOffset <= 0 || dataOffset + size > bytes.length) continue;
    if (nameOffset <= 0 || nameOffset >= bytes.length) continue;

    const encryptedData = bytes.slice(dataOffset, dataOffset + size);
    const iv = encryptedData.slice(0, IV_SIZE);
    const encryptedPayload = encryptedData.slice(IV_SIZE);

    const entry: Bnd4Entry = {
      index,
      name: `USERDATA_${String(index).padStart(2, "0")}`,
      size,
      dataOffset,
      footerLength,
      iv,
      encryptedData,
      encryptedPayload,
      decryptedData: new Uint8Array(0),
      decrypted: false,
    };

    try {
      entry.decryptedData = await decryptAesCbc(encryptedPayload, DS2_KEY, iv);
      entry.decrypted = true;
      successCount++;
      entries.push(entry);
    } catch (error) {
      console.error(`Failed to decrypt BND4 entry ${index}`, error);
    }
  }

  const indexMapping: Record<number, string> = {};
  for (const entry of entries) {
    if (entry.decrypted) indexMapping[entry.index] = entry.name;
  }

  return {
    entries,
    successCount,
    totalCount,
    indexMapping,
  };
}

export async function scanRelicsFromDecryptedData(
  data: Uint8Array,
  characterSlot: CharacterSlot,
  itemLookup?: ItemLookup,
  onLog?: (message: string) => void,
): Promise<RelicScanResult> {
  const logs: string[] = [];
  const log = (message: string) => {
    logs.push(message);
    onLog?.(message);
  };

  log(`Processing decrypted data for character slot ${characterSlot} (${data.length} bytes)`);

  const section = MEMORY_DAT_SECTIONS[characterSlot];
  if (!section) throw new Error(`Invalid character slot: ${characterSlot}`);

  const expectedNameOffset = MEMORY_DAT_NAME_OFFSETS[characterSlot - 1];
  if (expectedNameOffset === undefined) {
    throw new Error(`No name offset defined for character slot: ${characterSlot}`);
  }

  let nameOffset = expectedNameOffset - section.start;

  if (nameOffset < 0 || nameOffset >= data.length) {
    log("Adjusted name offset out of bounds. Trying fallback name search.");
    const fallback = findFallbackCharacterNameOffset(data);
    if (fallback !== null) {
      nameOffset = fallback;
    } else {
      throw new Error("Could not locate character name in decrypted data");
    }
  } else {
    let pattern = readUtf16NameAsUtf8Bytes(data, nameOffset, 32);
    let found = findBytes(data, pattern);

    if (found === null) {
      pattern = readUtf16NameAsUtf8Bytes(data, nameOffset, 15);
      found = findBytes(data, pattern);
    }
    if (found === null) {
      pattern = readUtf16NameAsUtf8Bytes(data, nameOffset, 6);
      found = findBytes(data, pattern);
    }

    if (found === null) {
      log("Character name pattern not found. Using fallback offset.");
      nameOffset = 65535;
    } else {
      nameOffset = found;
    }
  }

  const characterInfo = readCharacterInfo(data, nameOffset);
  const [slots, endRelicsOffset] = scanRawRelicSlots(data, 0);

  if (endRelicsOffset !== -1) {
    assignSlotIndexFromEntryTable(slots, data, endRelicsOffset);
  }

  const uncertainSlots = slots.filter((slot) => slot.uncertain).length;
  const uncertainResult = slots.length > 0 && uncertainSlots > UNCERTAIN_THRESHOLD * slots.length;

  const finalSlots = uncertainResult
    ? slots
    : slots.filter((slot) => !slot.uncertain);

  const relics: ParsedRelic[] = finalSlots.map((slot, index) => {
    const itemData = itemLookup?.(slot.itemId);
    const effects = [
      slot.effect1Id,
      slot.effect2Id,
      slot.effect3Id,
      slot.effect4Id,
      slot.effect5Id,
      slot.effect6Id,
    ].filter((id) => id !== EMPTY_U32 && id !== -1);

    return {
      id: `relic-${Date.now()}-${index}`,
      itemId: slot.itemId,
      slotIndex: slot.slotIndex,
      color: itemData?.color || "White",
      ...(itemData?.dn ? { dn: true } : {}),
      effects,
      raw: slot,
    };
  });

  log(`Found ${slots.length} raw relic slots`);
  log(`Usable relics after uncertainty filter: ${relics.length}`);

  return {
    slots: finalSlots,
    relics,
    characterInfo,
    successCount: finalSlots.length,
    totalSlots: slots.length,
    uncertainSlots,
    uncertainResult,
    endRelicsOffset,
    logs,
  };
}

export async function parseNightreignSaveFile(
  file: File,
  characterSlot: CharacterSlot,
  itemLookup?: ItemLookup,
  onLog?: (message: string) => void,
): Promise<RelicScanResult> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".sl2") || lowerName.endsWith(".co2")) {
    const unpacked = await unpackBnd4SaveFile(file);
    const entry = unpacked.entries.find((item) => item.index === characterSlot - 1 && item.decrypted);

    if (!entry) {
      throw new Error(`No decrypted data found for character slot ${characterSlot}`);
    }

    return scanRelicsFromDecryptedData(entry.decryptedData, characterSlot, itemLookup, onLog);
  }

  if (lowerName.endsWith(".dat")) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return scanRelicsFromDecryptedData(bytes, characterSlot, itemLookup, onLog);
  }

  throw new Error("Unsupported file type. Please use .sl2, .co2, or .dat");
}

export function exportRelicsToJson(relics: ParsedRelic[]): string {
  return JSON.stringify(relics, null, 2);
}
