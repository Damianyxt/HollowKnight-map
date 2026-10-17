import {
  HOLLOW_KNIGHT_JOURNAL_ENTRIES,
  HOLLOW_KNIGHT_JOURNAL_TOTALS,
  type HollowKnightJournalCountRule,
  type HollowKnightJournalEntryKind,
  type HollowKnightJournalProgressKind,
  type HollowKnightJournalStateRule,
} from "./hollow-knight-journal-generated";

export type HollowKnightJournalStatus = "completed" | "in_progress" | "missing" | "unknown";

export interface HollowKnightJournalStateProgress {
  order: number;
  kind: "primary" | "tier";
  labelEn: string;
  labelZh: string;
  status: HollowKnightJournalStatus;
  completed: boolean | null;
  seen: boolean | null;
  defeated: number | null;
  required: number;
}

export interface HollowKnightJournalEntryProgress {
  id: string;
  sortOrder: number;
  nameEn: string;
  nameZh: string;
  entryKind: HollowKnightJournalEntryKind;
  progressKind: HollowKnightJournalProgressKind;
  journalCountRule: HollowKnightJournalCountRule;
  bossId?: string;
  regionIds: string[];
  status: HollowKnightJournalStatus;
  completed: boolean | null;
  seen: boolean | null;
  defeated: number | null;
  required: number | null;
  states: HollowKnightJournalStateProgress[];
}

export interface HollowKnightJournalProgress {
  totals: {
    displayed: number;
    countable: number;
    required: number;
    bonus: number;
    displayOnly: number;
    requiredCompleted: number;
  };
  entries: HollowKnightJournalEntryProgress[];
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function evaluateState(
  playerData: Record<string, unknown>,
  rule: HollowKnightJournalStateRule,
): HollowKnightJournalStateProgress {
  const seen = booleanValue(playerData[rule.seenField]);
  const remaining = finiteNumber(playerData[rule.killsRemainingField]);
  const defeated = remaining == null
    ? null
    : Math.max(0, Math.min(rule.killsRequired, rule.killsRequired - remaining));
  let completed: boolean | null;
  let status: HollowKnightJournalStatus;
  if (remaining == null) {
    completed = seen === false ? false : null;
    status = seen === false ? "missing" : "unknown";
  } else if (seen === true && remaining <= 0) {
    completed = true;
    status = "completed";
  } else if (seen === true || (defeated != null && defeated > 0)) {
    completed = false;
    status = "in_progress";
  } else {
    completed = false;
    status = "missing";
  }

  return {
    order: rule.ruleOrder,
    kind: rule.stateKind,
    labelEn: rule.stateLabelEn,
    labelZh: rule.stateLabelZh,
    status,
    completed,
    seen,
    defeated,
    required: rule.killsRequired,
  };
}

function aggregateRecordStates(states: HollowKnightJournalStateProgress[]) {
  if (states.some((state) => state.completed === true)) {
    return { status: "completed" as const, completed: true, seen: true };
  }
  if (states.some((state) => state.status === "in_progress")) {
    return { status: "in_progress" as const, completed: false, seen: true };
  }
  if (states.every((state) => state.status === "missing")) {
    return { status: "missing" as const, completed: false, seen: false };
  }
  return {
    status: "unknown" as const,
    completed: null,
    seen: states.some((state) => state.seen === true) ? true : null,
  };
}

export function extractHollowKnightJournalProgress(
  playerData: Record<string, unknown>,
): HollowKnightJournalProgress {
  const entries = HOLLOW_KNIGHT_JOURNAL_ENTRIES.map((definition): HollowKnightJournalEntryProgress => {
    const states = [...definition.stateRules]
      .sort((left, right) => left.ruleOrder - right.ruleOrder)
      .map((rule) => evaluateState(playerData, rule));
    const primary = states[0];
    const aggregate = definition.progressKind === "record"
      ? aggregateRecordStates(states)
      : {
          status: primary?.status ?? "unknown" as const,
          completed: primary?.completed ?? null,
          seen: primary?.seen ?? null,
        };

    return {
      id: definition.id,
      sortOrder: definition.sortOrder,
      nameEn: definition.nameEn,
      nameZh: definition.nameZh,
      entryKind: definition.entryKind,
      progressKind: definition.progressKind,
      journalCountRule: definition.journalCountRule,
      ...(definition.bossId ? { bossId: definition.bossId } : {}),
      regionIds: definition.regionIds,
      status: aggregate.status,
      completed: aggregate.completed,
      seen: aggregate.seen,
      defeated: definition.progressKind === "defeat" ? primary?.defeated ?? null : null,
      required: definition.progressKind === "defeat" ? primary?.required ?? null : null,
      states,
    };
  });

  return {
    totals: {
      ...HOLLOW_KNIGHT_JOURNAL_TOTALS,
      requiredCompleted: entries.filter(
        (entry) => entry.journalCountRule === "required" && entry.completed === true,
      ).length,
    },
    entries,
  };
}

