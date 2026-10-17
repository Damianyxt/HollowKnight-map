import {
  HOLLOW_KNIGHT_BOSSES,
  HOLLOW_KNIGHT_PANTHEONS,
} from "./hollow-knight-bosses-generated";

export type HollowKnightBossStatus = "done" | "missing" | "unknown";

export interface HollowKnightWorldBossProgress {
  id: string;
  status: HollowKnightBossStatus;
}

export interface HollowKnightGodhomeBossProgress {
  id: string;
  status: HollowKnightBossStatus;
  seen: boolean;
  unlocked: boolean;
  tiers: {
    attuned: boolean;
    ascended: boolean;
    radiant: boolean;
  };
}

export interface HollowKnightPantheonProgress {
  id: string;
  status: HollowKnightBossStatus;
  unlocked: boolean;
  completed: boolean;
  allBindings: boolean;
  bindings: {
    nail: boolean;
    shell: boolean;
    charms: boolean;
    soul: boolean;
  };
}

export interface HollowKnightBossProgress {
  world: HollowKnightWorldBossProgress[];
  godhome: HollowKnightGodhomeBossProgress[];
  pantheons: HollowKnightPantheonProgress[];
}

type WorldRule =
  | { kind: "exact-boolean"; field: string }
  | { kind: "numeric-two"; field: string }
  | {
      kind: "kill-evidence";
      killedField: string;
      killsField: string;
      supportingBooleanFields?: string[];
      completedEndingsMask?: number;
    }
  | { kind: "unknown" };

const WORLD_RULES: Record<string, WorldRule> = {
  "false-knight": { kind: "exact-boolean", field: "falseKnightDefeated" },
  "gruz-mother": { kind: "kill-evidence", killedField: "killedBigFly", killsField: "killsBigFly", supportingBooleanFields: ["giantFlyDefeated"] },
  "vengefly-king": { kind: "kill-evidence", killedField: "killedBigBuzzer", killsField: "killsBigBuzzer" },
  "brooding-mawlek": { kind: "kill-evidence", killedField: "killedMawlek", killsField: "killsMawlek", supportingBooleanFields: ["mawlekDefeated"] },
  "hornet-protector": { kind: "exact-boolean", field: "hornet1Defeated" },
  "massive-moss-charger": { kind: "exact-boolean", field: "megaMossChargerDefeated" },
  "mantis-lords": { kind: "exact-boolean", field: "defeatedMantisLords" },
  "soul-warrior": { kind: "kill-evidence", killedField: "killedMageKnight", killsField: "killsMageKnight" },
  "soul-master": { kind: "exact-boolean", field: "mageLordDefeated" },
  "dung-defender": { kind: "exact-boolean", field: "defeatedDungDefender" },
  flukemarm: { kind: "exact-boolean", field: "flukeMotherDefeated" },
  "crystal-guardian": { kind: "exact-boolean", field: "defeatedMegaBeamMiner" },
  "broken-vessel": { kind: "kill-evidence", killedField: "killedInfectedKnight", killsField: "killsInfectedKnight" },
  "the-collector": { kind: "exact-boolean", field: "collectorDefeated" },
  uumuu: { kind: "exact-boolean", field: "defeatedMegaJelly" },
  "watcher-knight": {
    kind: "kill-evidence",
    killedField: "killedBlackKnight",
    killsField: "killsBlackKnight",
    supportingBooleanFields: ["lurienDefeated"],
  },
  nosk: { kind: "kill-evidence", killedField: "killedMimicSpider", killsField: "killsMimicSpider" },
  "hive-knight": { kind: "kill-evidence", killedField: "killedHiveKnight", killsField: "killsHiveKnight" },
  "traitor-lord": { kind: "kill-evidence", killedField: "killedTraitorLord", killsField: "killsTraitorLord" },
  oblobbles: { kind: "kill-evidence", killedField: "killedOblobble", killsField: "killsOblobble" },
  "god-tamer": { kind: "kill-evidence", killedField: "killedLobsterLancer", killsField: "killsLobsterLancer" },
  "zote-the-mighty": { kind: "exact-boolean", field: "zoteDefeated" },
  "troupe-master-grimm": { kind: "kill-evidence", killedField: "killedGrimm", killsField: "killsGrimm" },
  "the-hollow-knight": {
    kind: "kill-evidence",
    killedField: "killedHollowKnightPrime",
    killsField: "killsHollowKnightPrime",
    supportingBooleanFields: ["killedHollowKnight", "killedFinalBoss"],
    completedEndingsMask: 0b111,
  },
  "the-radiance": { kind: "exact-boolean", field: "killedFinalBoss" },
  "elder-hu": { kind: "numeric-two", field: "elderHuDefeated" },
  galien: { kind: "numeric-two", field: "galienDefeated" },
  gorb: { kind: "numeric-two", field: "aladarSlugDefeated" },
  markoth: { kind: "numeric-two", field: "markothDefeated" },
  marmu: { kind: "numeric-two", field: "mumCaterpillarDefeated" },
  "no-eyes": { kind: "numeric-two", field: "noEyesDefeated" },
  xero: { kind: "numeric-two", field: "xeroDefeated" },
  "failed-champion": { kind: "exact-boolean", field: "falseKnightDreamDefeated" },
  "soul-tyrant": { kind: "exact-boolean", field: "mageLordDreamDefeated" },
  "lost-kin": { kind: "exact-boolean", field: "infectedKnightDreamDefeated" },
  "white-defender": { kind: "exact-boolean", field: "whiteDefenderDefeated" },
  "grey-prince-zote": { kind: "exact-boolean", field: "greyPrinceDefeated" },
  "enraged-guardian": {
    kind: "kill-evidence",
    killedField: "killedMegaBeamMiner",
    killsField: "killsMegaBeamMiner",
  },
  "nightmare-king-grimm": { kind: "exact-boolean", field: "defeatedNightmareGrimm" },
  "hornet-sentinel": { kind: "exact-boolean", field: "hornetOutskirtsDefeated" },
};

const GODHOME_STATUE_FIELDS: Record<string, string> = {
  "vengefly-king": "statueStateVengefly",
  "gruz-mother": "statueStateGruzMother",
  "false-knight": "statueStateFalseKnight",
  "massive-moss-charger": "statueStateMegaMossCharger",
  "hornet-protector": "statueStateHornet1",
  gorb: "statueStateGorb",
  "dung-defender": "statueStateDungDefender",
  "soul-warrior": "statueStateMageKnight",
  "brooding-mawlek": "statueStateBroodingMawlek",
  "brothers-oro-mato": "statueStateNailmasters",
  xero: "statueStateXero",
  "crystal-guardian": "statueStateCrystalGuardian1",
  "soul-master": "statueStateSoulMaster",
  oblobbles: "statueStateOblobbles",
  "mantis-lords": "statueStateMantisLords",
  marmu: "statueStateMarmu",
  nosk: "statueStateNosk",
  flukemarm: "statueStateFlukemarm",
  "broken-vessel": "statueStateBrokenVessel",
  "paintmaster-sheo": "statueStatePaintmaster",
  "hive-knight": "statueStateHiveKnight",
  "elder-hu": "statueStateElderHu",
  "the-collector": "statueStateCollector",
  "god-tamer": "statueStateGodTamer",
  "troupe-master-grimm": "statueStateGrimm",
  galien: "statueStateGalien",
  "grey-prince-zote": "statueStateGreyPrince",
  uumuu: "statueStateUumuu",
  "hornet-sentinel": "statueStateHornet2",
  "great-nailsage-sly": "statueStateSly",
  "enraged-guardian": "statueStateCrystalGuardian2",
  "lost-kin": "statueStateLostKin",
  "no-eyes": "statueStateNoEyes",
  "traitor-lord": "statueStateTraitorLord",
  "white-defender": "statueStateWhiteDefender",
  "failed-champion": "statueStateFailedChampion",
  markoth: "statueStateMarkoth",
  "watcher-knight": "statueStateWatcherKnights",
  "soul-tyrant": "statueStateSoulTyrant",
  "pure-vessel": "statueStateHollowKnight",
  "sisters-of-battle": "statueStateMantisLordsExtra",
  "winged-nosk": "statueStateNoskHornet",
  "nightmare-king-grimm": "statueStateNightmareGrimm",
  "absolute-radiance": "statueStateRadiance",
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function worldStatus(playerData: Record<string, unknown>, rule: WorldRule): HollowKnightBossStatus {
  if (rule.kind === "unknown") return "unknown";
  if (rule.kind === "kill-evidence") {
    const killed = playerData[rule.killedField];
    const kills = playerData[rule.killsField];
    const supportingCompletion = rule.supportingBooleanFields?.some((field) => playerData[field] === true) === true;
    const completedEndings = playerData.CompletedEndings;
    if (
      killed === true
      || (typeof kills === "number" && Number.isFinite(kills) && kills === 0)
      || supportingCompletion
      || (
        rule.completedEndingsMask != null
        && typeof completedEndings === "number"
        && Number.isInteger(completedEndings)
        && (completedEndings & rule.completedEndingsMask) !== 0
      )
    ) {
      return "done";
    }
    if (killed === false || (typeof kills === "number" && Number.isFinite(kills) && kills > 0)) {
      return "missing";
    }
    return "unknown";
  }
  const value = playerData[rule.field];
  if (rule.kind === "exact-boolean") {
    return typeof value === "boolean" ? (value ? "done" : "missing") : "unknown";
  }
  if (typeof value !== "number") return "unknown";
  if (value >= 2) return "done";
  if (value === 0) return "missing";
  return "unknown";
}

export function extractHollowKnightBossProgress(
  playerData: Record<string, unknown>,
): HollowKnightBossProgress {
  const world = HOLLOW_KNIGHT_BOSSES
    .filter((boss) => !boss.godhomeOnly)
    .map((boss) => ({
      id: boss.id,
      status: worldStatus(playerData, WORLD_RULES[boss.id] ?? { kind: "unknown" }),
    }));

  const godhome = Object.entries(GODHOME_STATUE_FIELDS).map(([id, field]) => {
    const state = objectValue(playerData[field]);
    const tiers = {
      attuned: state.completedTier1 === true,
      ascended: state.completedTier2 === true,
      radiant: state.completedTier3 === true,
    };
    const seen = state.hasBeenSeen === true;
    const unlocked = state.isUnlocked === true;
    return {
      id,
      status: tiers.attuned || tiers.ascended || tiers.radiant
        ? "done" as const
        : unlocked
          ? "unknown" as const
          : "missing" as const,
      seen,
      unlocked,
      tiers,
    };
  });

  const pantheons = HOLLOW_KNIGHT_PANTHEONS.map((pantheon) => {
    const state = objectValue(playerData[pantheon.bossDoorField]);
    const unlocked = state.unlocked === true;
    const completed = state.completed === true;
    return {
      id: pantheon.id,
      status: completed ? "done" as const : unlocked ? "unknown" as const : "missing" as const,
      unlocked,
      completed,
      allBindings: state.allBindings === true,
      bindings: {
        nail: state.boundNail === true,
        shell: state.boundShell === true,
        charms: state.boundCharms === true,
        soul: state.boundSoul === true,
      },
    };
  });

  return { world, godhome, pantheons };
}

