import {
  HOLLOW_KNIGHT_COLLECTIBLES,
  HOLLOW_KNIGHT_COLLECTIBLE_RULES,
  type HollowKnightCollectibleCategory,
  type HollowKnightCollectibleDefinition,
  type HollowKnightCollectibleRule,
} from "./hollow-knight-collectibles-generated";

export type HollowKnightCollectibleStatus = "owned" | "missing" | "unknown";

export interface HollowKnightCollectibleProgressItem {
  id: string;
  status: HollowKnightCollectibleStatus;
  formId?: string;
  formNameZh?: string;
  formImagePath?: string;
  held?: boolean;
}

export interface HollowKnightCollectibleProgressGroup {
  status: "known" | "unknown";
  total: number;
  owned: number | null;
  items: HollowKnightCollectibleProgressItem[];
  diagnostic?: string;
}

export interface HollowKnightCollectionProgress {
  charms: HollowKnightCollectibleProgressGroup;
  grubs: HollowKnightCollectibleProgressGroup;
  maskShards: HollowKnightCollectibleProgressGroup;
  vesselFragments: HollowKnightCollectibleProgressGroup;
  paleOres: HollowKnightCollectibleProgressGroup;
  charmNotches: HollowKnightCollectibleProgressGroup;
  simpleKeys: HollowKnightCollectibleProgressGroup;
}

interface PersistentBoolItem {
  sceneName: string;
  id: string;
  activated: boolean;
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function persistentBoolItems(sceneData: Record<string, unknown>): PersistentBoolItem[] | null {
  if (!Array.isArray(sceneData.persistentBoolItems)) return null;
  return sceneData.persistentBoolItems.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    return typeof item.sceneName === "string" && typeof item.id === "string" && typeof item.activated === "boolean"
      ? [{ sceneName: item.sceneName, id: item.id, activated: item.activated }]
      : [];
  });
}

function playerRuleStatus(playerData: Record<string, unknown>, rule: HollowKnightCollectibleRule) {
  if (!rule.playerField || !(rule.playerField in playerData)) return "unknown" as const;
  return playerData[rule.playerField] === rule.expectedValue ? "owned" as const : "missing" as const;
}

function sceneRuleStatus(items: PersistentBoolItem[] | null, rule: HollowKnightCollectibleRule) {
  if (!items || !rule.sceneName || !rule.objectId) return "unknown" as const;
  return items.some((item) => item.sceneName === rule.sceneName && item.id === rule.objectId && item.activated)
    ? "owned" as const
    : "missing" as const;
}

function evaluateItem(
  definition: HollowKnightCollectibleDefinition,
  rules: HollowKnightCollectibleRule[],
  playerData: Record<string, unknown>,
  sceneItems: PersistentBoolItem[] | null,
): HollowKnightCollectibleProgressItem {
  let sawMissingEvidence = false;
  for (const rule of [...rules].sort((left, right) => right.priority - left.priority)) {
    const status = rule.ruleType === "scene_bool"
      ? sceneRuleStatus(sceneItems, rule)
      : playerRuleStatus(playerData, rule);
    if (status === "owned") {
      return {
        id: definition.id,
        status,
        ...(rule.formId ? { formId: rule.formId } : {}),
        ...(rule.formNameZh ? { formNameZh: rule.formNameZh } : {}),
        ...(rule.formImagePath ? { formImagePath: rule.formImagePath } : {}),
        ...(rule.heldState == null ? {} : { held: rule.heldState }),
      };
    }
    if (status === "missing") sawMissingEvidence = true;
  }
  return { id: definition.id, status: sawMissingEvidence ? "missing" : "unknown" };
}

function expectedAggregate(category: HollowKnightCollectibleCategory, playerData: Record<string, unknown>) {
  if (category === "charm") return finiteNumber(playerData.charmsOwned);
  if (category === "grub") return finiteNumber(playerData.grubsCollected);
  if (category === "mask_shard") {
    const maxHealthBase = finiteNumber(playerData.maxHealthBase);
    const heartPieces = finiteNumber(playerData.heartPieces);
    if (maxHealthBase == null || heartPieces == null) return undefined;
    return (maxHealthBase - 5) * 4 + heartPieces;
  }
  const reserve = finiteNumber(playerData.MPReserveMax);
  const fragments = finiteNumber(playerData.vesselFragments);
  if (reserve == null || fragments == null || reserve % 33 !== 0) return undefined;
  return (reserve / 33) * 3 + fragments;
}

function reconcileLegacyTowerOfLoveGrubs(
  playerData: Record<string, unknown>,
  sceneItems: PersistentBoolItem[] | null,
  items: HollowKnightCollectibleProgressItem[],
  expected: number | undefined,
) {
  if (playerData.version !== "1.5.78.11833" || !sceneItems || expected == null) return items;
  const hasCollapsedTowerRecord = sceneItems.some(
    (item) => item.sceneName === "Ruins2_11" && item.id === "Grub Bottle" && item.activated,
  ) && !sceneItems.some(
    (item) => item.sceneName === "Ruins2_11" && (item.id === "Grub Bottle 2" || item.id === "Grub Bottle 3"),
  );
  if (!hasCollapsedTowerRecord) return items;

  const ambiguousIds = new Set(["grub-045", "grub-046"]);
  const knownOwned = items.filter((item) => item.status === "owned" && !ambiguousIds.has(item.id)).length;
  const inferredStatus: HollowKnightCollectibleStatus = expected === knownOwned
    ? "missing"
    : expected === knownOwned + ambiguousIds.size
      ? "owned"
      : "unknown";
  return items.map((item) => ambiguousIds.has(item.id) ? { ...item, status: inferredStatus } : item);
}

function group(
  category: HollowKnightCollectibleCategory,
  playerData: Record<string, unknown>,
  sceneItems: PersistentBoolItem[] | null,
): HollowKnightCollectibleProgressGroup {
  const definitions = HOLLOW_KNIGHT_COLLECTIBLES.filter((item) => item.category === category);
  let items = definitions.map((definition) => evaluateItem(
    definition,
    HOLLOW_KNIGHT_COLLECTIBLE_RULES.filter((rule) => rule.collectibleId === definition.id),
    playerData,
    sceneItems,
  ));
  const expected = expectedAggregate(category, playerData);
  if (category === "grub") {
    items = reconcileLegacyTowerOfLoveGrubs(playerData, sceneItems, items, expected);
  }
  const owned = items.filter((item) => item.status === "owned").length;
  const hasUnknown = items.some((item) => item.status === "unknown");
  const requiresAggregate = ["charm", "grub", "mask_shard", "vessel_fragment"].includes(category);
  if (!requiresAggregate) {
    return {
      status: hasUnknown ? "unknown" : "known",
      total: definitions.length,
      owned: hasUnknown ? null : owned,
      items,
      ...(hasUnknown ? { diagnostic: "item evidence unavailable" } : {}),
    };
  }
  if (expected == null || hasUnknown || owned !== expected) {
    const reason = expected == null
      ? "aggregate unavailable"
      : hasUnknown
        ? "item evidence unavailable"
        : `aggregate mismatch: items=${owned}, aggregate=${expected}`;
    return {
      status: "unknown",
      total: definitions.length,
      owned: null,
      items: items.map((item) => ({ id: item.id, status: "unknown" })),
      diagnostic: reason,
    };
  }
  return { status: "known", total: definitions.length, owned, items };
}

export function extractHollowKnightCollectionProgress(
  playerData: Record<string, unknown>,
  sceneData: Record<string, unknown>,
): HollowKnightCollectionProgress {
  const sceneItems = persistentBoolItems(sceneData);
  return {
    charms: group("charm", playerData, sceneItems),
    grubs: group("grub", playerData, sceneItems),
    maskShards: group("mask_shard", playerData, sceneItems),
    vesselFragments: group("vessel_fragment", playerData, sceneItems),
    paleOres: group("pale_ore", playerData, sceneItems),
    charmNotches: group("charm_notch", playerData, sceneItems),
    simpleKeys: group("simple_key", playerData, sceneItems),
  };
}

