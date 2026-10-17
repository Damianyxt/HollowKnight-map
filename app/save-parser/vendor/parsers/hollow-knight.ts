import type { GameParser, ParseResult, SaveBundleFile } from "./protocol/types";
import type { IdentityResult } from "./protocol/identity";
import { extractHollowKnightBossProgress } from "./hollow-knight-boss-progress";
import { extractHollowKnightColosseumProgress } from "./hollow-knight-colosseum-progress";
import { extractHollowKnightCollectionProgress } from "./hollow-knight-collectibles";
import { extractHollowKnightDreamerProgress } from "./hollow-knight-dreamer-progress";
import { extractHollowKnightExplorationProgress } from "./hollow-knight-exploration";
import { extractHollowKnightJournalProgress } from "./hollow-knight-journal-progress";
import { extractHollowKnightKeyItemProgress } from "./hollow-knight-key-item-progress";
import { extractHollowKnightStatus } from "./hollow-knight-status";
import { decodeTeamCherryDatText } from "./shared/team-cherry-dat";

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function parseSave(file: ArrayBuffer): ParseResult | null {
  const text = decodeTeamCherryDatText(file);
  if (!text) return null;
  try {
    const root = toRecord(JSON.parse(text) as unknown);
    const playerData = toRecord(root.playerData);
    const hasReadablePlayerData = [
      "profileID",
      "version",
      "playTime",
      "completionPercentage",
      "health",
      "maxHealth",
      "geo",
    ].some((key) => Object.prototype.hasOwnProperty.call(playerData, key));
    if (!hasReadablePlayerData) return null;

    const profileId = numberValue(playerData.profileID);
    const summary = {
      version: stringValue(playerData.version),
      profileId,
      playTime: numberValue(playerData.playTime),
      completionPercentage: numberValue(playerData.completionPercentage),
      permadeathMode: numberValue(playerData.permadeathMode),
      health: numberValue(playerData.health),
      maxHealth: numberValue(playerData.maxHealth),
      geo: numberValue(playerData.geo),
      respawnScene: stringValue(playerData.respawnScene),
      mapZone: stringValue(playerData.mapZone),
    };
    const bossProgress = extractHollowKnightBossProgress(playerData);
    const colosseumProgress = extractHollowKnightColosseumProgress(playerData);
    const dreamerProgress = extractHollowKnightDreamerProgress(playerData);
    const sceneData = toRecord(root.sceneData);
    const collectionProgress = extractHollowKnightCollectionProgress(playerData, sceneData);
    const explorationProgress = extractHollowKnightExplorationProgress(playerData);
    const journalProgress = extractHollowKnightJournalProgress(playerData);
    const keyItemProgress = extractHollowKnightKeyItemProgress(playerData, sceneData);
    const status = extractHollowKnightStatus(playerData);
    const slotLabel = profileId == null ? "空洞骑士存档" : `槽位 ${profileId}`;

    return {
      profileName: profileId == null ? "空洞骑士存档" : `空洞骑士 槽位 ${profileId}`,
      characters: [{ id: profileId == null ? "slot-0" : `slot-${profileId}`, label: slotLabel }],
      stats: [
        {
          name: "存档摘要",
          items: [
            {
              label: "游戏完成度",
              value: summary.completionPercentage == null ? "未知" : `${summary.completionPercentage}/112`,
            },
            { label: "Geo", value: summary.geo ?? "未知" },
            {
              label: "生命",
              value: summary.maxHealth == null ? "未知" : `${summary.health ?? "?"}/${summary.maxHealth}`,
            },
          ],
        },
      ],
      detail: {
        game: "HollowKnight",
        parserStatus: "encrypted-dat",
        summary,
        status,
        bossProgress,
        colosseumProgress,
        dreamerProgress,
        collectionProgress,
        explorationProgress,
        journalProgress,
        keyItemProgress,
      },
    };
  } catch {
    return null;
  }
}

function slotFileEntry(file: SaveBundleFile) {
  const pathParts = (file.path || file.name)
    .replace(/\\/gu, "/")
    .split("/")
    .filter(Boolean);
  const nameMatch = /^user([1-4])\.dat$/iu.exec(pathParts.at(-1) ?? file.name);
  if (!nameMatch) return null;

  const parentParts = pathParts.slice(0, -1);
  const parentName = parentParts.at(-1)?.toLocaleLowerCase();
  if (parentParts.length > 1 && parentName !== "hollow knight") return null;

  return {
    file,
    slotNumber: Number(nameMatch[1]),
    parentPath: parentParts.join("/").toLocaleLowerCase(),
  };
}

function hasHollowKnightIdentity(file: ArrayBuffer): boolean {
  const text = decodeTeamCherryDatText(file);
  if (!text) return false;
  try {
    const root = toRecord(JSON.parse(text) as unknown);
    const playerData = toRecord(root.playerData);
    const keys = ["hasDreamNail", "dreamOrbs", "nailDamage", "completionPercent", "vesselFragments"];
    return keys.filter((key) => Object.prototype.hasOwnProperty.call(playerData, key)).length >= 2;
  } catch {
    return false;
  }
}

function recognizedSlotFiles(files: SaveBundleFile[]) {
  const groups = new Map<string, Array<{ file: SaveBundleFile; slotNumber: number }>>();
  files.forEach((file) => {
    const entry = slotFileEntry(file);
    if (!entry) return;
    groups.set(entry.parentPath, [...(groups.get(entry.parentPath) ?? []), {
      file: entry.file,
      slotNumber: entry.slotNumber,
    }]);
  });

  const selectedGroup = [...groups.entries()]
    .sort((left, right) => {
      const slotCount = (entries: Array<{ slotNumber: number }>) =>
        new Set(entries.map((entry) => entry.slotNumber)).size;
      return slotCount(right[1]) - slotCount(left[1]) || left[0].localeCompare(right[0]);
    })[0]?.[1] ?? [];

  const bySlot = new Map<number, { file: SaveBundleFile; slotNumber: number }>();
  selectedGroup.forEach((entry) => {
    if (!bySlot.has(entry.slotNumber)) bySlot.set(entry.slotNumber, entry);
  });
  return [...bySlot.values()].sort((left, right) => left.slotNumber - right.slotNumber);
}

async function parseSaveFolder(files: SaveBundleFile[]): Promise<ParseResult> {
  const slotFiles = recognizedSlotFiles(files);
  if (slotFiles.length === 0) throw new Error("未找到空洞骑士正式存档");

  const parsedSlots = slotFiles.map(({ file, slotNumber }) => {
    const result = parseSave(file.data);
    if (!result) throw new Error(`无法解析空洞骑士槽位 ${slotNumber}`);
    const slotId = `slot-${slotNumber}`;
    const label = `槽位 ${slotNumber}`;
    return {
      slotId,
      label,
      summary: toRecord(result.detail.summary),
      bossProgress: result.detail.bossProgress,
      colosseumProgress: result.detail.colosseumProgress,
      dreamerProgress: result.detail.dreamerProgress,
      collectionProgress: result.detail.collectionProgress,
      explorationProgress: result.detail.explorationProgress,
      journalProgress: result.detail.journalProgress,
      keyItemProgress: result.detail.keyItemProgress,
      status: result.detail.status,
    };
  });
  const firstSlot = parsedSlots[0];

  return {
    profileName: `空洞骑士 ${firstSlot.label}`,
    characters: parsedSlots.map((slot) => ({ id: slot.slotId, label: slot.label })),
    stats: [],
    detail: {
      game: "HollowKnight",
      parserStatus: "encrypted-dat-folder",
      allCharacters: parsedSlots.map((slot) => ({ id: slot.slotId, name: slot.label })),
      slots: Object.fromEntries(
        parsedSlots.map((slot) => [slot.slotId, {
          summary: slot.summary,
          bossProgress: slot.bossProgress,
          colosseumProgress: slot.colosseumProgress,
          dreamerProgress: slot.dreamerProgress,
          collectionProgress: slot.collectionProgress,
          explorationProgress: slot.explorationProgress,
          journalProgress: slot.journalProgress,
          keyItemProgress: slot.keyItemProgress,
          status: slot.status,
        }]),
      ),
    },
  };
}

export const hollowKnightParser: GameParser = {
  meta: {
    gameId: "HollowKnight",
    gameName: "空洞骑士",
    icon: "",
    accepts: [".dat"],
    bgImage: "/assets/game-bg/hollow-knight.jpg",
    themeColor: "#315965",
    saveLocations: [
      {
        platformLabel: "Windows · Steam",
        directory: "%USERPROFILE%\\AppData\\LocalLow\\Team Cherry\\Hollow Knight",
        uploadKind: "folder",
        uploadLabel: "选择整个 Hollow Knight 文件夹",
        notes: ["只读取文件夹根层级的 user1.dat 到 user4.dat，忽略备份和其他文件。"],
      },
    ],
    saveLocation: "C:\\Users\\{用户名}\\AppData\\LocalLow\\Team Cherry\\Hollow Knight\\",
  },
  identify(file): IdentityResult {
    return hasHollowKnightIdentity(file) && parseSave(file)
      ? { status: "match", evidence: ["Team Cherry DAT decode", "Hollow Knight playerData fields"] }
      : { status: "no-match", evidence: ["no Hollow Knight playerData fields"] };
  },
  validate(_file, fileName) {
    return /^user[1-4]\.dat$/iu.test(fileName);
  },
  parse(file) {
    const result = parseSave(file);
    if (!result) throw new Error("无法解析空洞骑士存档");
    return result;
  },
  validateBundle(files) {
    return recognizedSlotFiles(files).length > 0;
  },
  identifyBundle(files): IdentityResult {
    const matched = recognizedSlotFiles(files).some(({ file }) => hasHollowKnightIdentity(file.data) && Boolean(parseSave(file.data)));
    return matched
      ? { status: "match", evidence: ["Hollow Knight DAT slot content"] }
      : { status: "no-match", evidence: ["no Hollow Knight DAT slot content"] };
  },
  parseBundle(files) {
    return parseSaveFolder(files);
  },
};

