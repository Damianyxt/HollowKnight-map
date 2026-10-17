import generated from "../../data/hollow-knight/key-items/generated/key-items.json";

export type HollowKnightKeyItemRulePurpose = "history" | "held" | "lifecycle" | "current_form" | "source";
export type HollowKnightKeyItemRuleType = "player_bool" | "player_number_in" | "scene_bool";

export interface HollowKnightKeyItemDefinition {
  id: string;
  sortOrder: number;
  nameEn: string;
  nameZh: string;
  areaEn: string;
  areaZh: string;
  locationZh: string;
  requirementZh: string;
  lifecycleType: "transferable" | "consumable" | "permanent" | "fragment" | "transformation";
}

export interface HollowKnightKeyItemRule {
  ruleId: string;
  keyItemId: string;
  purpose: HollowKnightKeyItemRulePurpose;
  groupId: string;
  priority: number;
  ruleType: HollowKnightKeyItemRuleType;
  playerField?: string;
  expectedValue?: boolean | number[];
  sceneName?: string;
  objectId?: string;
  result: string;
  missingSemantics: "unknown";
}

export const HOLLOW_KNIGHT_KEY_ITEMS = generated.keyItems as HollowKnightKeyItemDefinition[];
export const HOLLOW_KNIGHT_KEY_ITEM_RULES = generated.rules as HollowKnightKeyItemRule[];

