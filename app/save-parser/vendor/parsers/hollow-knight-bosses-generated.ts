import artifact from "../../data/hollow-knight/bosses/generated/bosses.json";

export type HollowKnightBossCategory =
  | "story"
  | "optional"
  | "warrior_dream"
  | "dream_rematch"
  | "godhome";

export type HollowKnightBossEncounterVariant = "normal" | "dream" | "godhome";

export interface HollowKnightBossCatalogItem {
  id: string;
  sortOrder: number;
  nameEn: string;
  nameZh: string;
  areaEn: string;
  areaZh: string;
  category: HollowKnightBossCategory;
  required: boolean;
  optional: boolean;
  dreamVariant: boolean;
  godhomeOnly: boolean;
  completionPercent?: number;
  unlockRequirementZh: string;
  rewardZh: string;
  preparationZh: string;
  strategyZh: string;
  localizationKey?: string;
  status: string;
  confidence: string;
  source: string;
  sourceUrl: string;
  verification: string;
  notes?: string;
}

export interface HollowKnightBossEncounter {
  id: string;
  bossId: string;
  variant: HollowKnightBossEncounterVariant;
  godhomeTier?: "attuned" | "ascended" | "radiant";
  sceneName?: string;
  phaseCount?: number;
  health?: number;
  healthNotes?: string;
  arenaNotesZh?: string;
  specialRulesZh?: string;
  saveField?: string;
  saveRule?: string;
  status: string;
  confidence: string;
  source: string;
  sourceUrl: string;
  verification: string;
  notes?: string;
}

export interface HollowKnightPantheon {
  id: string;
  sortOrder: number;
  nameEn: string;
  nameZh: string;
  bossDoorField: string;
  finalBossId: string;
  sourceUrl: string;
}

export interface HollowKnightPantheonRosterItem {
  pantheonId: string;
  sortOrder: number;
  bossId: string;
  conditional: boolean;
  notes?: string;
}

type HollowKnightBossArtifact = {
  officialBossTotal: number;
  bosses: HollowKnightBossCatalogItem[];
  encounters: HollowKnightBossEncounter[];
  pantheons: HollowKnightPantheon[];
  pantheonRoster: HollowKnightPantheonRosterItem[];
};

const generated = artifact as HollowKnightBossArtifact;

export const HOLLOW_KNIGHT_BOSSES = generated.bosses;
export const HOLLOW_KNIGHT_BOSS_ENCOUNTERS = generated.encounters;
export const HOLLOW_KNIGHT_PANTHEONS = generated.pantheons;
export const HOLLOW_KNIGHT_PANTHEON_ROSTER = generated.pantheonRoster;


