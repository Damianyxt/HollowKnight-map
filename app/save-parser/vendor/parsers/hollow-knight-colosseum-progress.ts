export type HollowKnightColosseumStatus = "done" | "missing" | "unknown";

export interface HollowKnightColosseumProgressItem {
  id: "warrior" | "conqueror" | "fool";
  status: HollowKnightColosseumStatus;
}

export interface HollowKnightColosseumProgress {
  trials: HollowKnightColosseumProgressItem[];
}

const TRIAL_FIELDS = [
  ["warrior", "colosseumBronzeCompleted"],
  ["conqueror", "colosseumSilverCompleted"],
  ["fool", "colosseumGoldCompleted"],
] as const;

function status(value: unknown): HollowKnightColosseumStatus {
  if (value === true) return "done";
  if (value === false) return "missing";
  return "unknown";
}

export function extractHollowKnightColosseumProgress(
  playerData: Record<string, unknown>,
): HollowKnightColosseumProgress {
  return {
    trials: TRIAL_FIELDS.map(([id, field]) => ({ id, status: status(playerData[field]) })),
  };
}

