import parserMap from "./parser-mapid-map.json";

export type SaveMarkerState = "collected" | "missing" | "unknown";
export type SaveFilterMode = "all" | "collected" | "missing";

type MarkerLike = { id: string };
type Mapping = {
  markerId: string;
  parserId: string;
  module: string;
};

const MAPPINGS = parserMap as Mapping[];

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

function statusForMapping(detail: Record<string, unknown>, mapping: Mapping): SaveMarkerState {
  const item = moduleItems(detail, mapping.module).find((candidate) =>
    candidate && typeof candidate === "object" && !Array.isArray(candidate) &&
    (candidate as Record<string, unknown>).id === mapping.parserId,
  );
  if (!item || typeof item !== "object" || Array.isArray(item)) return "unknown";
  const record = item as Record<string, unknown>;
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

export function filterMarkersBySaveState<T extends MarkerLike>(
  markers: T[],
  detail: Record<string, unknown> | null,
  mode: SaveFilterMode,
) {
  if (!detail || mode === "all") return markers;
  return markers.filter((marker) => getMarkerSaveState(marker, detail) === mode);
}

export function getMappedMarkerCount() {
  return new Set(MAPPINGS.map((mapping) => mapping.markerId)).size;
}
