import generated from "../../data/hollow-knight/collectibles/generated/collectibles.json";

export type HollowKnightCollectibleCategory =
  | "charm"
  | "grub"
  | "mask_shard"
  | "vessel_fragment"
  | "pale_ore"
  | "charm_notch"
  | "simple_key";
export type HollowKnightCollectibleRuleType =
  | "player_bool"
  | "player_number"
  | "scene_bool"
  | "charm_form";

export interface HollowKnightCollectibleDefinition {
  id: string;
  category: HollowKnightCollectibleCategory;
  sortOrder: number;
  nameEn: string;
  nameZh: string;
  areaEn: string;
  areaZh: string;
  locationZh: string;
  requirementZh: string;
  acquisitionZh: string;
  defaultForm?: string;
  defaultImagePath?: string;
}

export interface HollowKnightCollectibleRule {
  collectibleId: string;
  priority: number;
  ruleType: HollowKnightCollectibleRuleType;
  playerField?: string;
  expectedValue?: boolean | number | string;
  sceneName?: string;
  objectId?: string;
  formId?: string;
  formNameZh?: string;
  formImagePath?: string;
  heldState?: boolean;
}

export const HOLLOW_KNIGHT_COLLECTIBLES = generated.collectibles as HollowKnightCollectibleDefinition[];
export const HOLLOW_KNIGHT_COLLECTIBLE_RULES = generated.rules as HollowKnightCollectibleRule[];


