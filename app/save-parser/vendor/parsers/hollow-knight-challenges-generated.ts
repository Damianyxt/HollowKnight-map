import generated from "../../data/hollow-knight/challenges/generated/colosseum-trials.json";
import dreamerGenerated from "../../data/hollow-knight/challenges/generated/dreamers.json";

export interface HollowKnightColosseumDefinition {
  id: HollowKnightColosseumTrialId;
  sortOrder: number;
  nameEn: string;
  nameZh: string;
  waveCount: string;
  entryFeeGeo: number;
  rewardZh: string;
  bossesZh: string;
  notes?: string;
}

export type HollowKnightColosseumTrialId = "warrior" | "conqueror" | "fool";

export const HOLLOW_KNIGHT_COLOSSEUM_TRIALS = generated.trials as HollowKnightColosseumDefinition[];

export type HollowKnightDreamerId = "monomon" | "lurien" | "herrah";

export interface HollowKnightDreamerDefinition {
  id: HollowKnightDreamerId;
  sortOrder: number;
  nameEn: string;
  nameZh: string;
  locationEn: string;
  locationZh: string;
  regionEn: string;
  regionZh: string;
  notes?: string;
}

export const HOLLOW_KNIGHT_DREAMERS = dreamerGenerated.dreamers as HollowKnightDreamerDefinition[];


