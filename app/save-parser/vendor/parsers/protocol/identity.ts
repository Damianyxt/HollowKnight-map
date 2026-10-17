export const IDENTITY_ERROR_CODES = {
  mismatch: "GAME_IDENTITY_MISMATCH",
  unknown: "GAME_IDENTITY_UNKNOWN",
  ambiguous: "GAME_IDENTITY_AMBIGUOUS",
  checkFailed: "GAME_IDENTITY_CHECK_FAILED",
  corruptOrUnsupported: "SAVE_CORRUPT_OR_UNSUPPORTED",
} as const;

export type IdentityStatus = "match" | "no-match" | "unknown";

export type IdentityResult =
  | { status: "match"; evidence: string[] }
  | { status: "no-match"; evidence: string[] }
  | { status: "unknown"; reason: string };

const MAX_EVIDENCE_ITEMS = 8;
const MAX_EVIDENCE_LENGTH = 200;

export function normalizeIdentityEvidence(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const evidence: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const text = item.trim().slice(0, MAX_EVIDENCE_LENGTH);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    evidence.push(text);
    if (evidence.length >= MAX_EVIDENCE_ITEMS) break;
  }
  return evidence;
}

export function normalizeIdentityResult(value: IdentityResult): IdentityResult {
  if (value.status === "unknown") {
    return {
      status: "unknown",
      reason: value.reason.trim().slice(0, MAX_EVIDENCE_LENGTH) || "无法读取存档身份",
    };
  }
  return {
    status: value.status,
    evidence: normalizeIdentityEvidence(value.evidence),
  };
}

