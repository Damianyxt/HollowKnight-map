import generated from "../../data/hollow-knight/abilities/generated/abilities.json";

export type HollowKnightAbilityRuleType = "boolean_true" | "number_min";

export interface HollowKnightAbilityDefinition {
  id: string;
  sortOrder: number;
  category: "movement" | "spell" | "dream-nail" | "nail-art" | "nail-upgrade" | "passive";
  nameEn: string;
  nameZh: string;
}

export interface HollowKnightAbilityRule {
  abilityId: string;
  ruleType: HollowKnightAbilityRuleType;
  playerDataField: string;
  threshold?: number;
}

export const HOLLOW_KNIGHT_ABILITIES = generated.abilities as HollowKnightAbilityDefinition[];
export const HOLLOW_KNIGHT_ABILITY_RULES = generated.rules as HollowKnightAbilityRule[];

