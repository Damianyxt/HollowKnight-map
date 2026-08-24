import {
  HOLLOW_KNIGHT_ABILITIES,
  HOLLOW_KNIGHT_ABILITY_RULES,
  type HollowKnightAbilityDefinition,
  type HollowKnightAbilityRule,
} from "./hollow-knight-abilities-generated";

export interface HollowKnightStatusItem {
  id: string;
  label: string;
  owned?: boolean;
}

export interface HollowKnightSpellStatus {
  id: string;
  label: string;
  level?: number;
  maxLevel: number;
}

export interface HollowKnightStatus {
  health: {
    current?: number;
    max?: number;
  };
  soul: {
    current?: number;
    reserve?: number;
    reserveMax?: number;
  };
  geo?: number;
  charmSlots: {
    total?: number;
    filled?: number;
    overcharmed?: boolean;
  };
  abilities: HollowKnightStatusItem[];
  spells: HollowKnightSpellStatus[];
  nail: {
    level?: number;
    damage?: number;
  };
  dreamNail: {
    acquired?: boolean;
    awakened?: boolean;
    essence?: number;
  };
  nailArts: HollowKnightStatusItem[];
  equippedCharmIds: number[];
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === 1) return true;
  if (value === 0) return false;
  return undefined;
}

function fieldNumber(playerData: Record<string, unknown>, key: string) {
  return numberValue(playerData[key]);
}

function fieldBoolean(playerData: Record<string, unknown>, key: string) {
  return booleanValue(playerData[key]);
}

function abilityOwned(
  playerData: Record<string, unknown>,
  rule: HollowKnightAbilityRule | undefined,
): boolean | undefined {
  if (!rule) return undefined;
  if (rule.ruleType === "boolean_true") return fieldBoolean(playerData, rule.playerDataField);
  const value = fieldNumber(playerData, rule.playerDataField);
  return value == null || rule.threshold == null ? undefined : value >= rule.threshold;
}

function abilityStatuses(playerData: Record<string, unknown>): HollowKnightStatusItem[] {
  const rulesById = new Map(HOLLOW_KNIGHT_ABILITY_RULES.map((rule) => [rule.abilityId, rule]));
  return HOLLOW_KNIGHT_ABILITIES.map((ability) => ({
    id: ability.id,
    label: ability.nameZh,
    owned: abilityOwned(playerData, rulesById.get(ability.id)),
  }));
}

function abilityCategoryStatuses(
  abilities: HollowKnightStatusItem[],
  category: HollowKnightAbilityDefinition["category"],
) {
  const ids = new Set(HOLLOW_KNIGHT_ABILITIES.filter((ability) => ability.category === category).map((ability) => ability.id));
  return abilities.filter((ability) => ids.has(ability.id));
}

function spellStatuses(playerData: Record<string, unknown>): HollowKnightSpellStatus[] {
  return [
    { id: "fireball", label: "复仇之魂", level: fieldNumber(playerData, "fireballLevel"), maxLevel: 2 },
    { id: "quake", label: "荒芜俯冲", level: fieldNumber(playerData, "quakeLevel"), maxLevel: 2 },
    { id: "scream", label: "嚎叫幽灵", level: fieldNumber(playerData, "screamLevel"), maxLevel: 2 },
  ];
}

function equippedCharmIds(playerData: Record<string, unknown>) {
  const indexedIds = Array.from({ length: 40 }, (_, index) => index + 1)
    .filter((index) => fieldBoolean(playerData, `equippedCharm_${index}`) === true);
  if (indexedIds.length > 0) return indexedIds;

  const values = playerData.equippedCharms;
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => numberValue(value))
    .filter((value): value is number => value != null && value > 0);
}

export function extractHollowKnightStatus(playerData: Record<string, unknown>): HollowKnightStatus {
  const abilities = abilityStatuses(playerData);
  return {
    health: {
      ...(fieldNumber(playerData, "health") == null ? {} : { current: fieldNumber(playerData, "health") }),
      ...(fieldNumber(playerData, "maxHealth") == null ? {} : { max: fieldNumber(playerData, "maxHealth") }),
    },
    soul: {
      ...(fieldNumber(playerData, "MPCharge") == null ? {} : { current: fieldNumber(playerData, "MPCharge") }),
      ...(fieldNumber(playerData, "MPReserve") == null ? {} : { reserve: fieldNumber(playerData, "MPReserve") }),
      ...(fieldNumber(playerData, "MPReserveMax") == null ? {} : { reserveMax: fieldNumber(playerData, "MPReserveMax") }),
    },
    geo: fieldNumber(playerData, "geo"),
    charmSlots: {
      ...(fieldNumber(playerData, "charmSlots") == null ? {} : { total: fieldNumber(playerData, "charmSlots") }),
      ...(fieldNumber(playerData, "charmSlotsFilled") == null ? {} : { filled: fieldNumber(playerData, "charmSlotsFilled") }),
      ...(fieldBoolean(playerData, "overcharmed") == null ? {} : { overcharmed: fieldBoolean(playerData, "overcharmed") }),
    },
    abilities,
    spells: spellStatuses(playerData),
    nail: {
      ...(fieldNumber(playerData, "nailSmithUpgrades") == null ? {} : { level: fieldNumber(playerData, "nailSmithUpgrades") }),
      ...(fieldNumber(playerData, "nailDamage") == null ? {} : { damage: fieldNumber(playerData, "nailDamage") }),
    },
    dreamNail: {
      ...(fieldBoolean(playerData, "hasDreamNail") == null ? {} : { acquired: fieldBoolean(playerData, "hasDreamNail") }),
      ...(fieldBoolean(playerData, "dreamNailUpgraded") == null ? {} : { awakened: fieldBoolean(playerData, "dreamNailUpgraded") }),
      ...(fieldNumber(playerData, "dreamOrbs") == null ? {} : { essence: fieldNumber(playerData, "dreamOrbs") }),
    },
    nailArts: abilityCategoryStatuses(abilities, "nail-art"),
    equippedCharmIds: equippedCharmIds(playerData),
  };
}

