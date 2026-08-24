export type HollowKnightExplorationItemStatus = "owned" | "missing" | "unknown";

export interface HollowKnightExplorationItem {
  id: string;
  name: string;
  status: HollowKnightExplorationItemStatus;
}

export interface HollowKnightExplorationGroup {
  status: "known" | "unknown";
  owned: number | null;
  total: number;
  ratio: { current: number; total: number } | null;
  items: HollowKnightExplorationItem[];
}

export interface HollowKnightExplorationProgress {
  status: "known" | "unknown";
  maps: HollowKnightExplorationGroup;
  stagStations: HollowKnightExplorationGroup;
}

const MAPS = [
  ["map-dirtmouth", "德特茅斯", "mapDirtmouth"],
  ["map-crossroads", "遗忘十字路", "mapCrossroads"],
  ["map-greenpath", "苍绿之径", "mapGreenpath"],
  ["map-fungal-wastes", "真菌荒地", "mapFungalWastes"],
  ["map-city", "泪水之城", "mapCity"],
  ["map-waterways", "皇家水道", "mapWaterways"],
  ["map-mines", "水晶山峰", "mapMines"],
  ["map-resting-grounds", "安息之地", "mapRestingGrounds"],
  ["map-deepnest", "深巢", "mapDeepnest"],
  ["map-royal-gardens", "王后花园", "mapRoyalGardens"],
  ["map-fog-canyon", "雾之峡谷", "mapFogCanyon"],
  ["map-abyss", "深渊", "mapAbyss"],
  ["map-cliffs", "呼啸悬崖", "mapCliffs"],
  ["map-outskirts", "王国边缘", "mapOutskirts"],
] as const;

const STAG_STATIONS = [
  ["stag-dirtmouth", "德特茅斯", "openedTown"],
  ["stag-crossroads", "遗忘十字路", "openedCrossroads"],
  ["stag-greenpath", "苍绿之径", "openedGreenpath"],
  ["stag-queens-station", "王后车站", "openedFungalWastes"],
  ["stag-city-storerooms", "城市仓库", "openedRuins1"],
  ["stag-kings-station", "国王驿站", "openedRuins2"],
  ["stag-resting-grounds", "安息之地", "openedRestingGrounds"],
  ["stag-distant-village", "遥远村庄", "openedDeepnest"],
  ["stag-hidden-station", "隐藏车站", "openedHiddenStation"],
  ["stag-gardens-station", "王后花园车站", "openedGardensStagStation"],
  ["stag-nest", "鹿角虫巢", "openedStagNest"],
] as const;

function booleanState(value: unknown): HollowKnightExplorationItemStatus {
  return typeof value === "boolean" ? (value ? "owned" : "missing") : "unknown";
}

function knownGroup(items: HollowKnightExplorationItem[], owned: number | null, total: number): HollowKnightExplorationGroup {
  const known = owned != null;
  return {
    status: known ? "known" : "unknown",
    owned,
    total,
    ratio: known ? { current: owned, total } : null,
    items,
  };
}

export function extractHollowKnightExplorationProgress(playerData: Record<string, unknown>): HollowKnightExplorationProgress {
  const mapItems = MAPS.map(([id, name, key]) => ({ id, name, status: booleanState(playerData[key]) }));
  const mapOwned = mapItems.every((item) => item.status !== "unknown")
    ? mapItems.filter((item) => item.status === "owned").length
    : null;
  const stationItems = STAG_STATIONS.map(([id, name, key]) => ({ id, name, status: booleanState(playerData[key]) }));
  const stationOwned = stationItems.every((item) => item.status !== "unknown")
    ? stationItems.filter((item) => item.status === "owned").length
    : null;
  return {
    status: mapOwned != null && stationOwned != null ? "known" : "unknown",
    maps: knownGroup(mapItems, mapOwned, MAPS.length),
    stagStations: knownGroup(stationItems, stationOwned, STAG_STATIONS.length),
  };
}

