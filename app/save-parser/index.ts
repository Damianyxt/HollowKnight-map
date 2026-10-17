import type {
  ParseSlot,
  ParsedSaveSlot,
  SaveDirectoryResult,
  SaveFileLike,
  SaveParseFailure,
} from "./types";
import { hollowKnightParser } from "./vendor/parsers/hollow-knight";

const SLOT_FILE_PATTERN = /^user([1-4])\.dat$/iu;

function slotNumberFor(file: SaveFileLike): number | null {
  const path = file.webkitRelativePath?.replace(/\\/gu, "/") ?? file.name;
  const parts = path.split("/").filter(Boolean);
  if (parts.length > 2) return null;
  const match = SLOT_FILE_PATTERN.exec(parts.at(-1) ?? file.name);
  return match ? Number(match[1]) : null;
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "无法解析存档";
}

export async function parseSaveDirectory(
  files: SaveFileLike[],
  parseSlot?: ParseSlot,
): Promise<SaveDirectoryResult> {
  const candidates = files
    .map((file) => ({ file, slotNumber: slotNumberFor(file) }))
    .filter(
      (entry): entry is { file: SaveFileLike; slotNumber: number } =>
        entry.slotNumber != null,
    )
    .sort((left, right) => left.slotNumber - right.slotNumber);

  if (candidates.length === 0) {
    return {
      slots: [],
      failures: [],
      error: "未找到可解析的空洞骑士存档",
    };
  }

  const slots: ParsedSaveSlot[] = [];
  const failures: SaveParseFailure[] = [];
  for (const { file, slotNumber } of candidates) {
    try {
      const data = await file.arrayBuffer();
      const parsed = parseSlot
        ? await parseSlot(data, slotNumber)
        : await hollowKnightParser.parse(data, {
            fileName: `user${slotNumber}.dat`,
          });
      slots.push({
        slotId:
          "slotId" in parsed && typeof parsed.slotId === "string"
            ? parsed.slotId
            : `slot-${slotNumber}`,
        slotNumber,
        detail: parsed.detail,
      });
    } catch (error) {
      failures.push({ slot: slotNumber, message: errorMessage(error) });
    }
  }

  return {
    slots,
    failures,
    ...(slots.length === 0
      ? { error: "未找到可解析的空洞骑士存档" }
      : {}),
  };
}

export type { ParseSlot, SaveDirectoryResult, SaveFileLike } from "./types";
