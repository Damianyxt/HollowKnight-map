import achievements from "../../data/hollow-knight/achievements/generated/achievements.json";

export type HollowKnightAchievementSpoilerLevel = "low" | "medium" | "high";

export interface HollowKnightAchievementCatalogItem {
  id: string;
  sourceRef: string;
  nameEn: string;
  nameZh: string;
  descriptionEn: string;
  descriptionZh: string;
  unlockConditionZh?: string;
  iconPath?: string;
  iconGrayPath?: string;
  relatedModule?: string;
  relatedAnchor?: string;
  relatedTargetIds: string[];
  spoilerLevel: HollowKnightAchievementSpoilerLevel;
}

export interface HollowKnightAchievementCategory {
  id: string;
  title: string;
  order: number;
  items: HollowKnightAchievementCatalogItem[];
}

type GeneratedAchievement = {
  id: string;
  source_ref: string;
  name_en: string;
  name_zh: string;
  description_en: string;
  description_zh: string;
  unlock_condition_zh?: string;
  icon_path?: string;
  icon_gray_path?: string;
  related_module?: string;
  related_anchor?: string;
  related_target_ids: string[];
  spoiler_level: HollowKnightAchievementSpoilerLevel;
};

type GeneratedArtifact = {
  categories: Array<{ id: string; title: string; order: number; itemIds: string[] }>;
  achievements: GeneratedAchievement[];
};

const artifact = achievements as GeneratedArtifact;

export const HOLLOW_KNIGHT_ACHIEVEMENTS: HollowKnightAchievementCatalogItem[] =
  artifact.achievements.map((item) => ({
    id: item.id,
    sourceRef: item.source_ref,
    nameEn: item.name_en,
    nameZh: item.name_zh,
    descriptionEn: item.description_en,
    descriptionZh: item.description_zh,
    unlockConditionZh: item.unlock_condition_zh,
    iconPath: item.icon_path,
    iconGrayPath: item.icon_gray_path,
    relatedModule: item.related_module,
    relatedAnchor: item.related_anchor,
    relatedTargetIds: item.related_target_ids,
    spoilerLevel: item.spoiler_level,
  }));

const achievementById = new Map(HOLLOW_KNIGHT_ACHIEVEMENTS.map((item) => [item.id, item]));

export const HOLLOW_KNIGHT_ACHIEVEMENT_CATEGORIES: HollowKnightAchievementCategory[] =
  artifact.categories.map((category) => ({
    id: category.id,
    title: category.title,
    order: category.order,
    items: category.itemIds
      .map((id) => achievementById.get(id))
      .filter((item): item is HollowKnightAchievementCatalogItem => Boolean(item)),
  }));


