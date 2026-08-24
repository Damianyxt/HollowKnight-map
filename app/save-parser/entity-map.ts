import parserMap from "./parser-mapid-map.json";
import abilitiesData from "./data/hollow-knight/abilities/generated/abilities.json";
import bossesData from "./data/hollow-knight/bosses/generated/bosses.json";
import collectiblesData from "./data/hollow-knight/collectibles/generated/collectibles.json";
import keyItemsData from "./data/hollow-knight/key-items/generated/key-items.json";

export type SaveMarkerState = "collected" | "missing" | "unknown";
export type SaveFilterMode = "all" | "collected" | "missing";

type MarkerLike = { id: string };
type Mapping = {
  groupName: string;
  markerId: string;
  parserId: string;
  module: string;
};

const MAPPINGS = parserMap as Mapping[];
const PARSER_ITEM_NAME_OVERRIDES: Record<string, string> = {
  "charm-001": "蜂群集结",
  "charm-035": "蜕变挽歌",
  "kingsoul-left-half": "国王之魂(Kingsoul)-左",
  "kingsoul-right-half": "国王之魂(Kingsoul)-右",
  "troupe-master-grimm": "剧团团长格林",
  "nightmare-king-grimm": "梦魇之王格林",
  "zote-the-mighty": "伟大的左特",
  "hornet-protector": "守护者大黄蜂",
  "watcher-knight": "守望者骑士团",
  "hornet-sentinel": "岗哨大黄蜂",
  herrah: "野兽赫拉",
  monomon: "教师莫诺蒙",
  lurien: "守望者卢瑞恩",
};
const PARSER_ITEM_NAMES = new Map(
  [
    ...abilitiesData.abilities,
    ...bossesData.bosses,
    ...collectiblesData.collectibles,
    ...keyItemsData.keyItems,
  ].map(
    (item) =>
      [item.id, PARSER_ITEM_NAME_OVERRIDES[item.id] ?? item.nameZh] as const,
  ),
);

function parserItemDisplayName(mapping: Mapping) {
  if (mapping.parserId.startsWith("stag-")) return "鹿角虫道";
  if (mapping.parserId.startsWith("map-")) return "柯尼法";
  return (
    PARSER_ITEM_NAME_OVERRIDES[mapping.parserId] ??
    PARSER_ITEM_NAMES.get(mapping.parserId) ??
    mapping.groupName
  );
}

function itemStatus(value: unknown): SaveMarkerState {
  if (value === "owned" || value === "done" || value === "obtained" || value === true) {
    return "collected";
  }
  if (value === "missing" || value === false) return "missing";
  return "unknown";
}

function moduleItems(detail: Record<string, unknown>, module: string): unknown[] {
  if (module === "abilities") {
    const status = detail.status;
    return status && typeof status === "object" && !Array.isArray(status)
      ? (((status as Record<string, unknown>).abilities as unknown[]) ?? [])
      : [];
  }
  if (module === "collectionProgress") {
    const collection = detail.collectionProgress;
    if (!collection || typeof collection !== "object" || Array.isArray(collection)) return [];
    return Object.values(collection as Record<string, unknown>).flatMap((group) => {
      if (!group || typeof group !== "object" || Array.isArray(group)) return [];
      return Array.isArray((group as Record<string, unknown>).items)
        ? ((group as Record<string, unknown>).items as unknown[])
        : [];
    });
  }
  const value = detail[module];
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  if (module === "keyItemProgress") {
    return Array.isArray((value as Record<string, unknown>).items)
      ? ((value as Record<string, unknown>).items as unknown[])
      : [];
  }
  if (module === "bossProgress") {
    const record = value as Record<string, unknown>;
    return ["world", "godhome", "pantheons"].flatMap((key) =>
      Array.isArray(record[key]) ? (record[key] as unknown[]) : [],
    );
  }
  if (module === "explorationProgress") {
    const record = value as Record<string, unknown>;
    return ["maps", "stagStations"].flatMap((key) => {
      const group = record[key];
      return group && typeof group === "object" && !Array.isArray(group) && Array.isArray((group as Record<string, unknown>).items)
        ? ((group as Record<string, unknown>).items as unknown[])
        : [];
    });
  }
  if (module === "dreamerProgress") {
    return Array.isArray((value as Record<string, unknown>).dreamers)
      ? ((value as Record<string, unknown>).dreamers as unknown[])
      : [];
  }
  return [];
}

function itemForMapping(detail: Record<string, unknown>, mapping: Mapping) {
  const item = moduleItems(detail, mapping.module).find((candidate) =>
    candidate && typeof candidate === "object" && !Array.isArray(candidate) &&
    (candidate as Record<string, unknown>).id === mapping.parserId,
  );
  return item && typeof item === "object" && !Array.isArray(item)
    ? (item as Record<string, unknown>)
    : undefined;
}

function statusForMapping(detail: Record<string, unknown>, mapping: Mapping): SaveMarkerState {
  const record = itemForMapping(detail, mapping);
  if (!record) return "unknown";
  return itemStatus("owned" in record ? record.owned : record.status);
}

export function getMarkerSaveState(
  marker: MarkerLike,
  detail: Record<string, unknown>,
): SaveMarkerState {
  const mappings = MAPPINGS.filter((mapping) => mapping.markerId === marker.id);
  if (mappings.length === 0) return "unknown";
  const statuses = mappings.map((mapping) => statusForMapping(detail, mapping));
  if (statuses.includes("missing")) return "missing";
  if (statuses.every((status) => status === "collected")) return "collected";
  return "unknown";
}

export function getMarkerSaveMatches(
  marker: MarkerLike,
  detail: Record<string, unknown>,
  mode: Exclude<SaveFilterMode, "all">,
) {
  return MAPPINGS.filter((mapping) => mapping.markerId === marker.id)
    .map((mapping) => ({
      displayName: parserItemDisplayName(mapping),
      groupName: mapping.groupName,
      parserId: mapping.parserId,
      state: statusForMapping(detail, mapping),
    }))
    .filter((mapping) => mapping.state === mode);
}

export function filterMarkersBySaveState<T extends MarkerLike>(
  markers: T[],
  detail: Record<string, unknown> | null,
  mode: SaveFilterMode,
) {
  if (!detail || mode === "all") return markers;
  return markers.filter(
    (marker) => getMarkerSaveMatches(marker, detail, mode).length > 0,
  );
}

export function getSaveGroupProgress(detail: Record<string, unknown> | null) {
  const progress: Record<string, { collected: number; total: number }> = {};

  for (const mapping of MAPPINGS) {
    const group = progress[mapping.groupName] ?? { collected: 0, total: 0 };
    group.total += 1;
    if (detail && statusForMapping(detail, mapping) === "collected") {
      group.collected += 1;
    }
    progress[mapping.groupName] = group;
  }

  return progress;
}

export function getSaveMappingProgress(detail: Record<string, unknown>) {
  return MAPPINGS.map((mapping) => {
    const item = itemForMapping(detail, mapping);
    return {
      markerId: mapping.markerId,
      parserId: mapping.parserId,
      groupName: mapping.groupName,
      displayName: parserItemDisplayName(mapping),
      state: statusForMapping(detail, mapping),
      formId: typeof item?.formId === "string" ? item.formId : undefined,
      formNameZh:
        typeof item?.formNameZh === "string" ? item.formNameZh : undefined,
    };
  });
}

export function getCharmDisplayProgress(detail: Record<string, unknown>) {
  const uniqueCharms = new Map<
    string,
    { state: SaveMarkerState; formId?: string }
  >();

  for (const mapping of MAPPINGS) {
    if (mapping.groupName !== "护符" || uniqueCharms.has(mapping.parserId)) {
      continue;
    }
    const item = itemForMapping(detail, mapping);
    uniqueCharms.set(mapping.parserId, {
      state: statusForMapping(detail, mapping),
      formId: typeof item?.formId === "string" ? item.formId : undefined,
    });
  }

  let collected = [...uniqueCharms.values()].filter(
    (charm) => charm.state === "collected",
  ).length;

  for (const parserId of ["charm-023", "charm-024", "charm-025"]) {
    const charm = uniqueCharms.get(parserId);
    if (
      charm?.state === "collected" &&
      charm.formId?.startsWith("unbreakable-")
    ) {
      collected += 1;
    }
  }

  const kingsoul = uniqueCharms.get("charm-036");
  if (kingsoul?.state === "collected" && kingsoul.formId === "void-heart") {
    collected += 1;
  }

  return { collected, total: 45 };
}

export function getMappedMarkerCount() {
  return new Set(MAPPINGS.map((mapping) => mapping.markerId)).size;
}
