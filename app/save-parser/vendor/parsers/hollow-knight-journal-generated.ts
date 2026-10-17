import generated from "../../data/hollow-knight/journal/generated/journal.json";

export type HollowKnightJournalEntryKind = "enemy" | "boss" | "warrior_dream" | "special";
export type HollowKnightJournalProgressKind = "defeat" | "record";
export type HollowKnightJournalCountRule = "required" | "bonus" | "display_only";
export type HollowKnightJournalStateKind = "primary" | "tier";

export interface HollowKnightJournalStateRule {
  ruleOrder: number;
  stateKind: HollowKnightJournalStateKind;
  stateLabelEn: string;
  stateLabelZh: string;
  seenField: string;
  killsRemainingField: string;
  killsRequired: number;
}

export interface HollowKnightJournalDefinition {
  id: string;
  sortOrder: number;
  nameEn: string;
  nameZh: string;
  entryKind: HollowKnightJournalEntryKind;
  progressKind: HollowKnightJournalProgressKind;
  journalCountRule: HollowKnightJournalCountRule;
  bossId?: string;
  stateRules: HollowKnightJournalStateRule[];
  regionIds: string[];
}

export interface HollowKnightJournalCatalogTotals {
  displayed: number;
  countable: number;
  required: number;
  bonus: number;
  displayOnly: number;
}

export const HOLLOW_KNIGHT_JOURNAL_ENTRIES = generated.entries as HollowKnightJournalDefinition[];
export const HOLLOW_KNIGHT_JOURNAL_TOTALS = generated.totals as HollowKnightJournalCatalogTotals;


