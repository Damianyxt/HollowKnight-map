import generated from "../../data/hollow-knight/npcs/generated/npcs.json";

export type HollowKnightNpcQuestGroup = "travel" | "collection" | "service" | "dlc";

export interface HollowKnightNpcDefinition {
  id: string;
  nameEn: string;
  nameZh: string;
  areaEn: string;
  areaZh: string;
  localizationSheet: string;
  localizationKey: string;
}

export interface HollowKnightNpcQuestMember {
  npcId: string;
  order: number;
  roleZh: string;
}

export interface HollowKnightNpcQuestStep {
  id: string;
  primaryNpcId: string;
  order: number;
  titleEn: string;
  titleZh: string;
  areaEn: string;
  areaZh: string;
  locationZh: string;
  summaryZh: string;
  conditionType?: string;
  conditionZh?: string;
  rewardType?: string;
  rewardZh?: string;
  missable: boolean;
  tags: string[];
}

export interface HollowKnightNpcQuestline {
  id: string;
  titleEn: string;
  titleZh: string;
  groupId: HollowKnightNpcQuestGroup;
  sortOrder: number;
  summaryZh: string;
  contentPack: string;
  members: HollowKnightNpcQuestMember[];
  steps: HollowKnightNpcQuestStep[];
}

export const HOLLOW_KNIGHT_NPCS = generated.npcs as HollowKnightNpcDefinition[];
export const HOLLOW_KNIGHT_NPC_QUESTLINES = generated.questlines as HollowKnightNpcQuestline[];


