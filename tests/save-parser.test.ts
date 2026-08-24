import assert from "node:assert/strict";
import test from "node:test";

import { parseSaveDirectory } from "../app/save-parser/index.ts";
import type { SaveFileLike } from "../app/save-parser/types.ts";
import { filterMarkersBySaveState, getMarkerSaveState } from "../app/save-parser/entity-map.ts";
import parserMap from "../app/save-parser/parser-mapid-map.json" with { type: "json" };

function file(name: string, webkitRelativePath = name): SaveFileLike {
  return {
    name,
    webkitRelativePath,
    async arrayBuffer() {
      return new ArrayBuffer(0);
    },
  };
}

test("parses root save slots in order and isolates one damaged slot", async () => {
  const result = await parseSaveDirectory(
    [
      file("user3.dat", "Hollow Knight/user3.dat"),
      file("user2.dat", "Hollow Knight/user2.dat"),
      file("user1.dat", "Hollow Knight/user1.dat"),
      file("user1.dat", "Hollow Knight/backup/user1.dat"),
      file("readme.txt", "Hollow Knight/readme.txt"),
    ],
    async (_data, slotNumber) => {
      if (slotNumber === 2) throw new Error("damaged slot");
      return { slotId: `slot-${slotNumber}`, detail: { slotNumber } };
    },
  );

  assert.deepEqual(
    result.slots.map((slot) => slot.slotNumber),
    [1, 3],
  );
  assert.deepEqual(result.failures, [{ slot: 2, message: "damaged slot" }]);
  assert.equal(result.error, undefined);
});

test("reports a directory without root user1.dat to user4.dat files", async () => {
  const result = await parseSaveDirectory([
    file("user5.dat", "Hollow Knight/user5.dat"),
    file("user1.dat", "Hollow Knight/backup/user1.dat"),
    file("backup.dat", "Hollow Knight/backup.dat"),
  ]);

  assert.deepEqual(result.slots, []);
  assert.deepEqual(result.failures, []);
  assert.equal(result.error, "未找到可解析的空洞骑士存档");
});

test("reports an all-damaged directory while preserving per-slot failures", async () => {
  const result = await parseSaveDirectory(
    [file("user1.dat", "Hollow Knight/user1.dat")],
    async () => {
      throw new Error("invalid Team Cherry data");
    },
  );

  assert.deepEqual(result.slots, []);
  assert.deepEqual(result.failures, [
    { slot: 1, message: "invalid Team Cherry data" },
  ]);
  assert.equal(result.error, "未找到可解析的空洞骑士存档");
});

test("maps every normalized parser module without reading marker names", () => {
  const detail = {
    status: {
      abilities: [
        { id: "dash", owned: true },
        { id: "wall-jump", owned: false },
      ],
    },
    collectionProgress: {
      grubs: { items: [{ id: "grub-028", status: "owned" }] },
      charms: { items: [{ id: "charm-007", status: "owned" }] },
    },
    keyItemProgress: {
      items: [
        { id: "love-key", status: "obtained" },
        { id: "city-crest", status: "obtained" },
      ],
    },
    bossProgress: {
      world: [{ id: "false-knight", status: "done" }],
      godhome: [],
      pantheons: [],
    },
    explorationProgress: {
      maps: { items: [{ id: "map-cliffs", status: "owned" }] },
      stagStations: [{ id: "stag-gardens-station", status: "missing" }],
    },
    dreamerProgress: {
      dreamers: [{ id: "herrah", status: "done" }],
    },
  };

  assert.equal(
    getMarkerSaveState({ id: "marker_1785467018875_nfkxkz" }, detail),
    "collected",
  );
  assert.equal(
    getMarkerSaveState({ id: "marker_1785468288521_fq9ukr" }, detail),
    "missing",
  );
  assert.equal(
    getMarkerSaveState({ id: "marker_1785479706230_54y866" }, detail),
    "collected",
  );
  assert.equal(
    getMarkerSaveState({ id: "marker_1785470326386_etxoau" }, detail),
    "collected",
  );
  assert.equal(
    getMarkerSaveState({ id: "marker_1785404256813_hvx7x2" }, detail),
    "collected",
  );
  assert.equal(
    getMarkerSaveState({ id: "marker_1785394124911_bf0cw1" }, detail),
    "unknown",
  );
  assert.equal(
    getMarkerSaveState({ id: "marker_1785395564710_befq2l" }, detail),
    "collected",
  );
  assert.equal(
    getMarkerSaveState({ id: "unmapped" }, detail),
    "unknown",
  );
});

test("aggregates compound markers and preserves unknown evidence", () => {
  const marker = { id: "marker_1785402327761_huubjv" };
  const allOwned = {
    collectionProgress: {
      charms: {
        items: [
          { id: "charm-023", status: "owned" },
          { id: "charm-024", status: "owned" },
          { id: "charm-025", status: "owned" },
        ],
      },
      charmNotches: { items: [] },
    },
  };
  const oneMissing = {
    collectionProgress: {
      charms: {
        items: [
          { id: "charm-023", status: "owned" },
          { id: "charm-024", status: "missing" },
          { id: "charm-025", status: "owned" },
        ],
      },
    },
  };
  const oneUnknown = {
    collectionProgress: {
      charms: {
        items: [
          { id: "charm-023", status: "owned" },
          { id: "charm-024", status: "unknown" },
          { id: "charm-025", status: "owned" },
        ],
      },
    },
  };

  assert.equal(getMarkerSaveState(marker, allOwned), "collected");
  assert.equal(getMarkerSaveState(marker, oneMissing), "missing");
  assert.equal(getMarkerSaveState(marker, oneUnknown), "unknown");
  assert.deepEqual(
    filterMarkersBySaveState([marker, { id: "unmapped" }], allOwned, "collected").map((item) => item.id),
    [marker.id],
  );
});

test("ships the complete confirmed parser-mapid mapping", () => {
  assert.equal(parserMap.length, 218);
  assert.equal(new Set(parserMap.map((mapping) => mapping.markerId)).size, 178);
  assert.ok(parserMap.every((mapping) => mapping.parserId && mapping.markerId));
  assert.ok(
    parserMap.every((mapping) =>
      [
        "collectionProgress",
        "abilities",
        "keyItemProgress",
        "bossProgress",
        "explorationProgress",
        "dreamerProgress",
      ].includes(mapping.module),
    ),
  );
});
