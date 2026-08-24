import assert from "node:assert/strict";
import test from "node:test";

import { parseSaveDirectory } from "../app/save-parser/index.ts";
import type { SaveFileLike } from "../app/save-parser/types.ts";
import {
  filterMarkersBySaveState,
  getCharmDisplayProgress,
  getMarkerSaveMatches,
  getMarkerSaveState,
  getSaveGroupProgress,
  getSaveMappingProgress,
} from "../app/save-parser/entity-map.ts";
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
  assert.deepEqual(
    filterMarkersBySaveState([marker, { id: "unmapped" }], oneMissing, "missing").map((item) => item.id),
    [marker.id],
  );
  assert.deepEqual(
    filterMarkersBySaveState([marker, { id: "unmapped" }], oneMissing, "collected").map((item) => item.id),
    [marker.id],
  );
  assert.deepEqual(
    getMarkerSaveMatches(marker, oneMissing, "collected").map(
      (mapping) => mapping.parserId,
    ),
    ["charm-023", "charm-025"],
  );
  assert.deepEqual(
    getMarkerSaveMatches(marker, oneMissing, "missing").map(
      (mapping) => mapping.parserId,
    ),
    ["charm-024"],
  );
});

test("returns the exact popup item matched by a save filter", () => {
  const detail = {
    collectionProgress: {
      simpleKeys: {
        items: [{ id: "simple-key-pale-lurker", status: "missing" }],
      },
    },
  };

  assert.deepEqual(
    getMarkerSaveMatches(
      { id: "marker_1785403197566_2kfjga" },
      detail,
      "missing",
    ),
    [
      {
        displayName: "简单钥匙 · 苍白潜伏者",
        groupName: "简单钥匙",
        parserId: "simple-key-pale-lurker",
        state: "missing",
      },
    ],
  );
});

test("summarizes collected and total mapped items by sidebar group", () => {
  const progress = getSaveGroupProgress({
    collectionProgress: {
      simpleKeys: {
        items: [{ id: "simple-key-pale-lurker", status: "owned" }],
      },
    },
  });

  assert.deepEqual(progress["简单钥匙"], { collected: 1, total: 4 });
});

test("normalizes the gathering swarm parser name to the map label", () => {
  const matches = getMarkerSaveMatches(
    { id: "marker_1785400049577_qkp7zb" },
    {
      collectionProgress: {
        charms: {
          items: [{ id: "charm-001", status: "owned" }],
        },
      },
    },
    "collected",
  );

  assert.equal(
    matches.find((mapping) => mapping.parserId === "charm-001")?.displayName,
    "蜂群集结",
  );
});

test("normalizes parser names to the map labels used by popups and markers", () => {
  const mappings = getSaveMappingProgress({});
  const expectedNames: Record<string, string> = {
    "charm-035": "蜕变挽歌",
    "kingsoul-left-half": "国王之魂(Kingsoul)-左",
    "kingsoul-right-half": "国王之魂(Kingsoul)-右",
    "troupe-master-grimm": "剧团团长格林",
    "nightmare-king-grimm": "梦魇之王格林",
    "zote-the-mighty": "伟大的左特",
    "hornet-protector": "守护者大黄蜂",
    "watcher-knight": "守望者骑士团",
    "hornet-sentinel": "岗哨大黄蜂",
    herrah: "野兽赫拉",
    monomon: "教师莫诺蒙",
    lurien: "守望者卢瑞恩",
    "stag-gardens-station": "鹿角虫道",
    "map-cliffs": "柯尼法",
  };

  for (const [parserId, displayName] of Object.entries(expectedNames)) {
    assert.equal(
      mappings.find((mapping) => mapping.parserId === parserId)?.displayName,
      displayName,
    );
  }
});

test("maps each Kingsoul fragment to its own reward marker", () => {
  const detail = {
    keyItemProgress: {
      items: [
        { id: "kingsoul-left-half", status: "obtained" },
        { id: "kingsoul-right-half", status: "missing" },
      ],
    },
  };

  assert.equal(
    getMarkerSaveState({ id: "marker_1785401752422_zn1pl2" }, detail),
    "collected",
  );
  assert.equal(
    getMarkerSaveState({ id: "marker_1785401965884_mivnhb" }, detail),
    "missing",
  );
});

test("preserves fragile charm forms for owner-specific popup completion", () => {
  const fragile = getSaveMappingProgress({
    collectionProgress: {
      charms: {
        items: [
          {
            id: "charm-023",
            status: "owned",
            formId: "fragile-heart",
            formNameZh: "易碎心脏",
          },
        ],
      },
    },
  }).filter((mapping) => mapping.parserId === "charm-023");
  const unbreakable = getSaveMappingProgress({
    collectionProgress: {
      charms: {
        items: [
          {
            id: "charm-023",
            status: "owned",
            formId: "unbreakable-heart",
            formNameZh: "坚固心脏",
          },
        ],
      },
    },
  }).filter((mapping) => mapping.parserId === "charm-023");

  assert.equal(fragile.length, 2);
  assert.ok(fragile.every((mapping) => mapping.formId === "fragile-heart"));
  assert.ok(
    unbreakable.every(
      (mapping) =>
        mapping.formId === "unbreakable-heart" &&
        mapping.formNameZh === "坚固心脏",
    ),
  );
});

test("counts the 45 map charm entries with mutually exclusive forms", () => {
  const charmIds = [
    ...new Set(
      parserMap
        .filter((mapping) => mapping.groupName === "护符")
        .map((mapping) => mapping.parserId),
    ),
  ];
  const baseItems = charmIds.map((id) => ({ id, status: "owned" }));
  const withAdvancedForms = baseItems.map((item) => {
    if (["charm-023", "charm-024", "charm-025"].includes(item.id)) {
      return { ...item, formId: `unbreakable-${item.id}` };
    }
    if (item.id === "charm-036") {
      return { ...item, formId: "void-heart" };
    }
    if (item.id === "charm-040") {
      return { ...item, formId: "carefree-melody" };
    }
    return item;
  });

  assert.equal(charmIds.length, 40);
  assert.deepEqual(
    getCharmDisplayProgress({
      collectionProgress: { charms: { items: baseItems } },
    }),
    { collected: 40, total: 45 },
  );
  assert.deepEqual(
    getCharmDisplayProgress({
      collectionProgress: { charms: { items: withAdvancedForms } },
    }),
    { collected: 44, total: 45 },
  );
});

test("ships the complete confirmed parser-mapid mapping", () => {
  assert.equal(parserMap.length, 222);
  assert.equal(new Set(parserMap.map((mapping) => mapping.markerId)).size, 181);
  assert.equal(
    parserMap.find((mapping) => mapping.parserId === "pale-ore-nosk")?.markerId,
    "marker_1785401511467_mp67hm",
  );
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
