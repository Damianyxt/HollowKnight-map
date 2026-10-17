export type HollowKnightDreamerStatus = "done" | "missing" | "unknown";

export interface HollowKnightDreamerProgressItem {
  id: "monomon" | "lurien" | "herrah";
  status: HollowKnightDreamerStatus;
}

export interface HollowKnightDreamerProgress {
  dreamers: HollowKnightDreamerProgressItem[];
}

const DREAMER_FIELDS = [
  ["monomon", "monomonDefeated"],
  ["lurien", "lurienDefeated"],
  ["herrah", "hegemolDefeated"],
] as const;

function status(value: unknown): HollowKnightDreamerStatus {
  if (value === true) return "done";
  if (value === false) return "missing";
  return "unknown";
}

export function extractHollowKnightDreamerProgress(
  playerData: Record<string, unknown>,
): HollowKnightDreamerProgress {
  return {
    dreamers: DREAMER_FIELDS.map(([id, field]) => ({ id, status: status(playerData[field]) })),
  };
}

