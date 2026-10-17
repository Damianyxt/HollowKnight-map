import {
  HOLLOW_KNIGHT_KEY_ITEMS,
  HOLLOW_KNIGHT_KEY_ITEM_RULES,
  type HollowKnightKeyItemRule,
  type HollowKnightKeyItemRulePurpose,
} from "./hollow-knight-key-items-generated";

export type HollowKnightKeyItemStatus = "obtained" | "missing" | "unknown";
export type HollowKnightKeyItemLifecycleState = "held" | "delivered" | "consumed" | "transformed" | "permanent";
export type HollowKnightRoyalCharmForm = "none" | "left-half" | "right-half" | "kingsoul" | "void-heart" | "unknown";

export interface HollowKnightKeyItemProgressItem {
  id: string;
  status: HollowKnightKeyItemStatus;
  held?: boolean;
  lifecycleState?: HollowKnightKeyItemLifecycleState;
  diagnostic?: string;
}

export interface HollowKnightKeyItemProgress {
  status: "known" | "partial" | "unknown";
  total: number;
  obtained: number | null;
  currentRoyalCharmForm: HollowKnightRoyalCharmForm;
  items: HollowKnightKeyItemProgressItem[];
}

type ConditionStatus = "match" | "no-match" | "unknown";

interface RuleGroup {
  groupId: string;
  priority: number;
  result: string;
  rules: HollowKnightKeyItemRule[];
}

function finiteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function conditionStatus(playerData: Record<string, unknown>, rule: HollowKnightKeyItemRule): ConditionStatus {
  if (!rule.playerField || !(rule.playerField in playerData)) return "unknown";
  const actual = playerData[rule.playerField];
  if (rule.ruleType === "player_bool") {
    if (typeof actual !== "boolean" || typeof rule.expectedValue !== "boolean") return "unknown";
    return actual === rule.expectedValue ? "match" : "no-match";
  }
  if (rule.ruleType === "player_number_in") {
    const number = finiteNumber(actual);
    if (number == null || !Array.isArray(rule.expectedValue)) return "unknown";
    return rule.expectedValue.includes(number) ? "match" : "no-match";
  }
  return "unknown";
}

function groupedRules(keyItemId: string, purpose: HollowKnightKeyItemRulePurpose) {
  const groups = new Map<string, RuleGroup>();
  for (const rule of HOLLOW_KNIGHT_KEY_ITEM_RULES) {
    if (rule.keyItemId !== keyItemId || rule.purpose !== purpose) continue;
    const group = groups.get(rule.groupId) ?? {
      groupId: rule.groupId,
      priority: rule.priority,
      result: rule.result,
      rules: [],
    };
    group.rules.push(rule);
    groups.set(rule.groupId, group);
  }
  return [...groups.values()].sort((left, right) => right.priority - left.priority || left.groupId.localeCompare(right.groupId));
}

function groupStatus(playerData: Record<string, unknown>, group: RuleGroup): ConditionStatus {
  const conditions = group.rules.map((rule) => conditionStatus(playerData, rule));
  if (conditions.includes("no-match")) return "no-match";
  if (conditions.includes("unknown")) return "unknown";
  return "match";
}

function hasUsableRoyalCharmState(playerData: Record<string, unknown>) {
  const state = finiteNumber(playerData.royalCharmState);
  return state != null && Number.isInteger(state) && state >= 0 && state <= 4;
}

function historyStatus(keyItemId: string, playerData: Record<string, unknown>): HollowKnightKeyItemStatus {
  let groups = groupedRules(keyItemId, "history");
  if (keyItemId === "void-heart" && hasUsableRoyalCharmState(playerData)) {
    groups = groups.filter((group) => !group.rules.some((rule) => rule.playerField === "gotShadeCharm"));
  }
  const statuses = groups.map((group) => groupStatus(playerData, group));
  if (statuses.includes("match")) return "obtained";
  if (statuses.length > 0 && statuses.every((status) => status === "no-match")) return "missing";
  return "unknown";
}

function heldStatus(keyItemId: string, playerData: Record<string, unknown>) {
  const statuses = groupedRules(keyItemId, "held").map((group) => groupStatus(playerData, group));
  if (statuses.includes("match")) return true;
  if (statuses.length > 0 && statuses.every((status) => status === "no-match")) return false;
  return undefined;
}

function lifecycleState(keyItemId: string, playerData: Record<string, unknown>) {
  const match = groupedRules(keyItemId, "lifecycle")
    .find((group) => groupStatus(playerData, group) === "match");
  return match?.result as HollowKnightKeyItemLifecycleState | undefined;
}

function diagnostic(keyItemId: string, playerData: Record<string, unknown>) {
  const state = finiteNumber(playerData.royalCharmState);
  if (keyItemId === "kingsoul-left-half" && playerData.gotQueenFragment === false && [1, 3, 4].includes(state ?? -1)) {
    return "gotQueenFragment conflicts with royalCharmState";
  }
  if (keyItemId === "kingsoul-right-half" && playerData.gotKingFragment === false && [2, 3, 4].includes(state ?? -1)) {
    return "gotKingFragment conflicts with royalCharmState";
  }
  if (keyItemId === "shopkeepers-key" && playerData.hasSlykey === true && playerData.gaveSlykey === true) {
    return "hasSlykey conflicts with gaveSlykey";
  }
  if (keyItemId === "city-crest" && playerData.hasCityKey === true && playerData.openedCityGate === true) {
    return "hasCityKey conflicts with openedCityGate";
  }
  return undefined;
}

function currentRoyalCharmForm(playerData: Record<string, unknown>): HollowKnightRoyalCharmForm {
  const match = groupedRules("kingsoul", "current_form")
    .find((group) => groupStatus(playerData, group) === "match");
  return (match?.result as HollowKnightRoyalCharmForm | undefined) ?? "unknown";
}

export function extractHollowKnightKeyItemProgress(
  playerData: Record<string, unknown>,
  _sceneData: Record<string, unknown>,
): HollowKnightKeyItemProgress {
  const items = HOLLOW_KNIGHT_KEY_ITEMS.map((definition): HollowKnightKeyItemProgressItem => {
    const status = historyStatus(definition.id, playerData);
    const held = heldStatus(definition.id, playerData);
    const lifecycle = lifecycleState(definition.id, playerData);
    const conflict = diagnostic(definition.id, playerData);
    return {
      id: definition.id,
      status,
      ...(held == null ? {} : { held }),
      ...(lifecycle == null ? {} : { lifecycleState: lifecycle }),
      ...(conflict == null ? {} : { diagnostic: conflict }),
    };
  });
  const knownCount = items.filter((item) => item.status !== "unknown").length;
  const obtainedCount = items.filter((item) => item.status === "obtained").length;
  return {
    status: knownCount === 0 ? "unknown" : knownCount === items.length ? "known" : "partial",
    total: items.length,
    obtained: knownCount === items.length ? obtainedCount : null,
    currentRoyalCharmForm: currentRoyalCharmForm(playerData),
    items,
  };
}

