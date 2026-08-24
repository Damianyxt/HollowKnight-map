"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import popupImageGuides from "./popup-image-guides.json";
import { filterMarkersBySaveState, type SaveFilterMode } from "./save-parser/entity-map";
import { parseSaveDirectory } from "./save-parser";
import type { ParsedSaveSlot } from "./save-parser/types";

const MAP_WIDTH = 4498;
const MAP_HEIGHT = 2901;
const MIN_SCALE_FACTOR = 1;
const MAX_SCALE = 4;
const AUTO_FOCUS_MAX_SCALE_FACTOR = 2.5;
const FOCUS_TRANSITION_MS = 220;
const MAX_BATCH_BREATHING_GLOW_MARKERS = 64;
const MAP_EDGE_DRAG_ALLOWANCE = 250;
const MAP_DRAG_RIGHT_ALLOWANCE = 250;
const COMPLETION_STORAGE_KEY = "hk-map-client-completed-markers-v1";
const COMPLETABLE_PRIMARY_CATEGORIES = new Set(["装备", "收集物", "Boss"]);
const INFORMATION_ONLY_MARKER_IDS = new Set([
  "marker_custom_sly_crossroads_57466_35094",
]);
type PopupTextLinkTarget =
  | { name: string; type: "marker"; markerId: string }
  | { name: string; type: "region"; regionName: string }
  | {
      name: string;
      type: "popup-item";
      itemName: string;
      ownerMarkerId: string;
      ownerIconId: string;
    };

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MARKER_IMAGE_GUIDES = popupImageGuides as Record<
  string,
  { note: string | null; imageFile: string | null; imageAlt: string | null }
>;

const HIGHLIGHT_LEADING_ICONS: Record<
  string,
  { src: string; alt: string; displaySize?: "small" }
> = {
  "躁郁的毛里克(Brooding Mawlek)": {
    src: "/icons/收集物/面具碎片.png",
    alt: "面具碎片",
    displaySize: "small",
  },
  "收藏家(The Collector)": {
    src: "/icons/收集物/收藏家的地图.webp",
    alt: "收藏家的地图",
  },
  "布蕾塔(Bretta)": { src: "/icons/收集物/面具碎片.png", alt: "面具碎片" },
  "暴怒守卫(Enraged Guardian)": {
    src: "/icons/收集物/面具碎片.png",
    alt: "面具碎片",
  },
  "灰色哀悼者(Grey Mourner)": {
    src: "/icons/收集物/面具碎片.png",
    alt: "面具碎片",
  },
  "诺斯克(Nosk)": {
    src: "/icons/收集物/苍白矿石.png",
    alt: "苍白矿石",
  },
  "叛徒之女(The Traitors’ Child)": {
    src: "/icons/弹窗装饰/娇嫩的花.png",
    alt: "娇嫩的花",
    displaySize: "small",
  },
  "忏悔师吉吉(Confessor Jiji)": {
    src: "/icons/收集物/腐臭蛋.png",
    alt: "腐臭蛋",
  },
  "图克(Tuk)": {
    src: "/icons/收集物/腐臭蛋.png",
    alt: "腐臭蛋",
  },
};

const HIGHLIGHT_ITEM_NOTES: Record<
  string,
  { src: string; alt: string; paragraphs: string[] }
> = {
  "蜗牛萨满(Snail Shaman)": {
    src: "/icons/技能/复仇之魂（Vengeful Spirit）.png",
    alt: "复仇之魂",
    paragraphs: [
      "召唤一个向前飞行的魂灵，对路径上的敌人造成伤害。可以升级为暗影之魂。",
    ],
  },
  "假骑士(False Knight)": {
    src: "/icons/收集物/城市纹章.png",
    alt: "城市纹章",
    paragraphs: [
      "调查泪水之城大门前，五骑士之一海格默的雕像，会提示：“一个巨大的骑士雕像。它的胸前有个插槽。插入城市纹章？”插入纹章可以打开从真菌荒地前往泪水之城的大门，使用后无法回收。",
    ],
  },
  "明子(Nymm)": {
    src: "/icons/护符+护符槽图标/无忧旋律（Carefree Melody）.png",
    alt: "无忧旋律",
    paragraphs: [
      "无忧旋律会取代护符格林之子，出现在护符页面的对应位置。佩戴后有概率抵挡小骑士受到的伤害。",
      "这枚护符看上去与布鲁姆很相似。",
    ],
  },
  "乌恩(Unn)": {
    src: "/icons/护符+护符槽图标/乌恩之形（Shape of Unn）.png",
    alt: "乌恩之形",
    paragraphs: ["装备该护符可以让小骑士在凝聚灵魂时移动。"],
  },
  "吸虫之母(Flukemarm)": {
    src: "/icons/护符+护符槽图标/吸虫之巢（Flukenest）.png",
    alt: "吸虫之巢",
    paragraphs: ["将复仇之魂与暗影之魂变成一群能造成伤害的幼小吸虫。"],
  },
  "苍白潜伏者(Pale Lurker)": {
    src: "/icons/收集物/简单钥匙.png",
    alt: "简单钥匙",
    paragraphs: ["可以打开简单锁，但是由于做工粗糙、磨损严重，只能使用一次。"],
  },
  "骨钉大师奥罗(Nailmaster Oro)": {
    src: "/icons/剑技/冲刺劈砍.webp",
    alt: "冲刺劈砍",
    paragraphs: ["经过蓄力，可以在冲刺后释放攻击距离更长，伤害更高的一击。"],
  },
  "骨钉大师席奥(Nailmaster Sheo)": {
    src: "/icons/剑技/强力劈砍.webp",
    alt: "强力劈砍",
    paragraphs: ["经过蓄力，释放范围更广，伤害更高的一击。"],
  },
  "骨钉大师马托(Nailmaster Mato)": {
    src: "/icons/剑技/旋风劈砍.webp",
    alt: "旋风劈砍",
    paragraphs: ["经过蓄力，可以旋转释放连续多次伤害更高的攻击。"],
  },
  "白色夫人(White Lady)": {
    src: "/icons/收集物/国王之魂-左.png",
    alt: "国王之魂",
    paragraphs: [
      "两片国王之魂碎片可以合成护符国王之魂，它使小骑士每2秒获得4灵魂。",
      "国王之魂也能打开通往深渊之底的道路，在出生地，它可以转变为虚空之心。",
    ],
  },
  "苍白之王(The Pale King)": {
    src: "/icons/收集物/国王之魂-右.png",
    alt: "国王之魂",
    paragraphs: [
      "两片国王之魂碎片可以合成护符国王之魂，它使小骑士每2秒获得4灵魂。",
      "国王之魂也能打开通往深渊之底的道路，在出生地，它可以转变为虚空之心。",
    ],
  },
};

const DESCRIPTION_INLINE_ICONS: Record<
  string,
  { paragraphIncludes: string; src: string; alt: string }[]
> = {
  "marker_1785469750648_1qrjgg": [
    {
      paragraphIncludes: "成就“忽视”",
      src: "/icons/弹窗装饰/成就-忽视.png",
      alt: "忽视成就",
    },
  ],
  "custom_zote_colosseum_marker": [
    {
      paragraphIncludes: "成就“恩怨”",
      src: "/icons/弹窗装饰/成就-恩怨.png",
      alt: "恩怨成就",
    },
  ],
  "marker_1785484569953_pg55vz": [
    {
      paragraphIncludes: "成就“见证”",
      src: "/icons/弹窗装饰/成就-见证.png",
      alt: "见证成就",
    },
  ],
};

const CHARACTER_ENDINGS: Record<
  string,
  { title: string; iconFile: string; description: string }[]
> = {
  "钉子匠(Nailsmith)": [
    {
      title: "结局一：纯粹",
      iconFile: "/icons/弹窗装饰/成就-纯粹.png",
      description:
        "如果选择按它所说杀了它，它的尸体会落入下方的水中，并获得“纯粹”成就。最终，在完成两个万神殿并聆听寻神者后，可以在垃圾坑的岸边找到它漂浮在水面的尸体。",
    },
    {
      title: "结局二：幸福成双",
      iconFile: "/icons/弹窗装饰/成就-幸福成双.png",
      description:
        "如果拒绝它的请求，选择不杀它，离开区域，它起初感到恼怒，但思考后认同了小骑士的决定，踏上了探索世界，寻找新人生目标的旅途。之后，可以在苍绿之径席奥的小屋里找到它，聆听它之后能获得“幸福成双”成就，该成就的名称表明了它和席奥的恋爱关系。接下来，它一直会和席奥在一起搞艺术，给席奥做绘画模特或是一同制作小尺寸模型。每次进入房间刷新，它和席奥可能在做这两件事之一。它们彼此陪伴，幸福快乐。",
    },
  ],
  "剧团团长格林(Troupe Master Grimm)": [
    {
      title: "结局一：仪式",
      iconFile: "/icons/弹窗装饰/成就-仪式.png",
      description:
        "如果小骑士成功杀死了梦魇之王，剧团完成了仪式，在小骑士醒来之前就会离开圣巢。",
    },
    {
      title: "结局二：驱逐",
      iconFile: "/icons/弹窗装饰/成就-驱逐.png",
      description:
        "如果小骑士没有面对梦魇之王，而是帮助布鲁姆摧毁梦魇之灯，那么会放逐剧团，随后布鲁姆会与格林剧团一同消失。",
    },
  ],
};

const CHARACTER_ENDING_NOTES: Record<string, string> = {
  "剧团团长格林(Troupe Master Grimm)":
    "注：格林团长和梦魇之王格林的战斗都需要携带格林之子才能触发。",
};

const CHARACTER_DESCRIPTION_SECTIONS: Record<
  string,
  { title: string; paragraphs: string[] }[]
> = {
  "苍白之王(The Pale King)": [
    {
      title: "圣巢王国",
      paragraphs: [
        "沃姆转变成苍白之王之后，在圣巢扩张了部分虫子的思想，并赋予他们智慧。他想让虫子们臣服于他，向他奉献，而作为回报，他保证圣巢王国将会永恒延续。",
        "有关苍白之王的记载说他仪表堂堂、遍体生光，王冠上有凶猛的尖角。他容光焕发，神采奕奕，娇嫩的花的纯洁光环也无法和他的光辉媲美。",
        "尽管苍白之王是一个难以捉摸的存在，并且深居简出，很少看到他出现在宫殿外，臣民还是将他奉若神明。圣巢的虫子相信，这个世界的造物主就是他，并且用国王神像来崇拜他，连飞蛾部落也背叛了他们的造物主——辐光，转而崇拜苍白之王。苍白之王拥有预见能力，使得真菌荒地的蘑菇们欣然接受了他的统治。",
        "遍布在圣巢各地的建筑大多是他建立的，其中大部分都有圣巢印章的标记。鹿角虫道和电车也都是他下令建造的。",
        "在小骑士的记忆中也可以看到苍白之王的身影。在记忆中，苍白之王带着空洞骑士离开深渊，然后封印了深渊的大门。",
      ],
    },
    {
      title: "感染",
      paragraphs: [
        "辐光几乎完全被遗忘了。她想让虫子们重新记起她的存在，结果造成了感染。为了解决感染，苍白之王打算利用容器封印辐光。所谓容器，是指苍白之王和白色夫人结合所生出的后代，它们出生于深渊，内部充满了虚空。",
        "为了封印住容器，他请了三只虫子成为守梦者，共同组成黑卵圣殿的封印。赫拉是其中的一位，她要求苍白之王和她做一个交易，两者结合生出了一个孩子，也就是后来的大黄蜂。",
        "被选中的容器是空洞骑士。然而，苍白之王和白色夫人的判断出现了差错，容器出现了污点，因此它无法彻底地封印感染。空洞骑士之所以出现污点，可能是因为苍白之王在养育它时与它产生了羁绊。",
        "后来，感染重新出现，苍白之王和白色宫殿也消失了。",
      ],
    },
  ],
};

const SHARED_MARKER_DESCRIPTIONS: Record<string, string> = {
  "暗影之门(Shade Gate)":
    "暗影之门是圣巢各处由虚空制成的门。它们无法被破坏或解除。小骑士碰到它时，会被往后弹，但不会受到伤害。法术不会被暗影之门阻挡。\n大多数暗影之门是由两个带刺的装置中黑色的虚空部分相连而成的。但深渊出生地内的两个暗影之门并没有这样的装置。",
  "长椅":
    "在长椅上休息可以使小骑士：\n存档游戏。\n在退出游戏或死亡后在长椅上重生。（不包括神居的万神殿中的温泉长椅，它永远不会更新重生点。）\n回满全部血量。（包括护符给予的生命血，但会移除所有在生命血茧处获得的生命血量。）\n刷新非本房间的已破坏的生命血茧。\n刷新灵魂图腾。\n购买获得萨鲁巴的祝福后，能缓慢回复灵魂。\n若已购买获得地图和羽毛笔，则能将新探索的区域房间在地图上更新。\n刷新大部分不包括当前长椅房间内的敌人。当前长椅房间内的敌人不会立即刷新，但会在小骑士再次进入该房间时刷新。\n小骑士在长椅上休息时还可以装备或卸下物品栏菜单中的护符。\n在伊塞尔达处可以花费100[GEO]购买长椅图针。",
  "生命血茧(Lifeblood Cocoon)":
    "生命血茧是一个含有生命血的大囊，分布在圣巢各处。用骨钉破坏它会生成2至5个生命籽。一个生命籽能给予一格生命血，杀死生命籽，就能吸收生命血，获得额外的生命血面具血量。\n通向隐藏的茧的道路旁，会生长着蓝色蝴蝶状的植物，暗示生命血茧的存在。此外，茧本身也会不时发出声音。可以从伊塞尔达处以100[GEO]购买虫茧图针，能显示目前所有已发现的生命血茧的位置。",
  "温泉(Hot Spring)":
    "温泉是热气腾腾的水潭，分布在圣巢各处。站在其中，小骑士会每秒回复50灵魂，血量也会缓慢回复。\n可以从伊塞尔达处以100[GEO]购买温泉图针，购买对应区域地图后，就会在其上显示所有已发现的温泉。\n获得萨鲁巴的祝福后，长椅的灵魂回复效果与温泉等同，因此周围有长椅的时候也可以选择长椅。",
  "鹿角虫道(Old Stag)":
    "鹿角虫道是贯穿整个圣巢的互相联通的隧道系统，通过鹿角站将不同区域连接在一起。小骑士可以乘坐老鹿角虫，在他的帮助下使用鹿角虫道旅行。他还会在谈话时提供有关每个位置的一些信息。\n大多数站点需要向收费机缴一定数量的吉欧以激活。不是每个区域都有一个鹿角站。\n解锁一个鹿角虫车站后，用骨钉击打铃铛就能召唤老鹿角虫。每次小骑士在上次使用的鹿角站以外的鹿角站想唤来鹿角虫的话，也必须敲铃。\n可以在伊塞尔达的商店花费100[GEO]购买鹿角虫道图针，购买对应区域地图后，就会显示此地的鹿角站位置。",
  "电车(Tram)":
    "电车可以让小骑士在鹿角虫站无法到达的深层隧道中快速旅行。使用位于深邃巢穴的废弃电车轨道中的电车通行证即可自由乘车。如果小骑士在拿到电车通行证前检查电车，只会出现这样的描述：“一个带凹槽的装置，需要某种通行证。”获得通行证之后，则会额外出现选项：“插入电车通行证？”\n在第一次检查电车门后，小骑士可以在伊塞尔达的商店花费100[GEO]购买电车图针，购买相应区域地图后，就会标记出该区域内的电车位置。",
  "护符槽":
    "装备护符需要占用护符槽，每个护符占用的凹槽数量不尽相同。小骑士开始时拥有3个护符槽，在游戏中一共还能额外获得8个，最多拥有11个。",
  "面具碎片(Mask Shard)":
    "面具碎片是远古面具的碎片，每四片能拼成一个远古面具，增加血量。\n游戏中共有16个面具碎片，所以小骑士能增加4格面具血量。不算护符和生命血的话，小骑士最多能拥有9格血量。",
  "容器碎片(Vessel Fragment)":
    "容器碎片是灵魂容器的碎片。3片容器碎片能拼成一个完整的灵魂容器，增加小骑士的最大灵魂容量，每个可额外容纳33灵魂。主灵魂仪空时，容器中的灵魂会在短暂延迟后自动注入主灵魂仪。\n游戏中共有9个容器碎片，所以可以额外获得3个灵魂容器，使小骑士的最大灵魂容量加倍，从99增加至198灵魂。",
  "苍白矿石(Pale Ore)":
    "小骑士可以在圣巢各处收集到苍白矿石。将苍白矿石交给钉子匠，并支付一定数量的吉欧，他就可以升级小骑士的骨钉。第一次升级不需要苍白矿石，第二次需要一块，第三次需要两块，最后一次需要三块，总共需要六块。",
  "柯尼法(Cornifer)":
    "柯尼法一出生就立刻离开了他的兄弟姐妹与母亲，去探索世界。后来他得知了圣巢的存在，和他的妻子伊塞尔达一起搬到了德特茅斯。\n开始时，可以在遗忘十字路底部遇到柯尼法，向他购买地图。他建议小骑士光临他的妻子伊塞尔达在德特茅斯的店铺。这个店铺将在小骑士购买一次地图，或者进入通往祖先山丘的房间后开张。\n直到柯尼法介绍他自己之前，他的名字都不会在屏幕下方显示。只有在再次聆听，他自我介绍后，他的名字才会显现。\n在大多数区域都可以找到柯尼法。在接近他所在的房间时可以听见他正在哼歌，跟随地上四处散落的纸就可以找到他的方位。不过有一处例外，那就是在深邃巢穴，柯尼法不再哼歌，而是害怕地躲在石头后方。此时也无法阅读其梦语。在此区域，可以在两个不同的地方遇到柯尼法。这取决于小骑士从哪个入口进入深邃巢穴，在一处遇到他的话就无法在另一处遇到。如果小骑士是在这里与柯尼法第一次相识，将会有特别的对话。\n在古老盆地，如果在购买了地图之后继续和他对话，他会表示他不想继续让妻子担心了，自己会在稍微休息一下之后回到店铺。\n当所有的地图都已经被购买或者能够在德特茅斯的商店被买到后，柯尼法就会回到店铺，在一张阁楼床上呼呼大睡。",
  "蘑菇先生(Mister Mushroom)":
    "王国边缘右下角的密室中，有一块发光的石碑。通向它的入口也通向巨大吉欧堆。进入该区域后，使用荒芜俯冲或黑暗降临打开通路三次，它位于第三次的路径的右边。装备蘑菇孢子后，阅读石碑时会显示一首诗，提示了可以找到蘑菇先生的地点。\n1. 我们述说使者大人的道路，他会宣告一个时代的结束。\n2. 由自我产生，他们的思想联合在一起。（真菌荒地）\n3. 在酸液肆意的源头一旁停歇。（王国边缘，伊思玛的树林附近）\n4. 在最黑暗曲折的深邃中发光。（深邃巢穴，加利安附近）\n5. 狂风在化石险崖上呼啸。（呼啸悬崖）\n6. 空中的帝王蝶静止不动。（古老盆地，帝王之翼的地点附近）\n7. 通往“根”的领域，蜗牛曾高声嚎叫处。（雾之峡谷，长满植物的山丘附近）\n8. 沃姆的山道，新土地的入口。（国王山道）\n9. 旅程在此结束，王国的冒险完成。\n接近对应区域时，从远处就能听到他的念叨声，引导小骑士找到他。他起初总是背对着小骑士，攻击他一下后他会转过来，之后才能聆听。如果在他转过来后离开他足够远的距离，他会再转过身去。必须装备蘑菇孢子才能理解他的对话，否则小骑士难以理解他的蘑菇语言，他也不会前往下一地点。然而，即便不装备蘑菇孢子，也能明白他的梦语。对话完后，他会短暂停止自言自语，表示打扰了，然后缩进地里。\n蘑菇先生大部分时间没有理睬小骑士，而似乎在和别人说话或是自言自语。最后一次相遇时，他终于意识到小骑士在他旅行时一直跟随着他，并对小骑士说了话。之后，他飞向空中。",
};

const APPEND_SHARED_DESCRIPTION_MARKERS = new Set([
  "护符槽",
  "面具碎片(Mask Shard)",
  "容器碎片(Vessel Fragment)",
  "苍白矿石(Pale Ore)",
]);

const SHARED_MARKER_HIGHLIGHTS: Record<
  string,
  { text: string; iconFiles: string[] }
> = {
  "暗影之门(Shade Gate)": {
    text: "获得暗影披风后进行暗影冲刺，才能穿过暗影之门。",
    iconFiles: [],
  },
  "柯尼法(Cornifer)": {
    text: "柯尼法是一名制图师，致力于绘制整个圣巢的地图。",
    iconFiles: [],
  },
  "巴德尔之壳(Baldur Shell)": {
    text: "佩戴后，小骑士凝聚时会在周围生成一个最多抵挡4次攻击的保护壳，在长椅上休息时次数重置。",
    iconFiles: [],
  },
  "编织者之歌(Weaversong)": {
    text: "佩戴后能召唤三只编织者幼体攻击敌人，每次攻击造成3伤害。",
    iconFiles: [],
  },
  "冲刺大师(Dashmaster)": {
    text: "佩戴后减少蛾翼披风的冷却时间，并允许小骑士向下冲刺。",
    iconFiles: [],
  },
  "发光子宫(Glowing Womb)": {
    text: "佩戴后能消耗灵魂产生幼体；幼体平常跟随小骑士，发现敌人后会飞向敌人并造成碰撞伤害。",
    iconFiles: [],
  },
  "法术扭曲者(Spell Twister)": {
    text: "佩戴后能使伤害性法术的灵魂消耗从33降至24。",
    iconFiles: [],
  },
  "防御者纹章(Defender's Crest)": {
    text: "佩戴后会在小骑士身边持续产生臭气云，每0.3秒造成1伤害。",
    iconFiles: [],
  },
  "锋利之影(Sharp Shadow)": {
    text: "佩戴后将暗影披风的冲刺速度由20提升至28，冲刺时长不变，并伤害冲刺时穿过的敌人。",
    iconFiles: [],
  },
  "蜂巢之血(Hiveblood)": {
    text: "佩戴后无需凝聚就能恢复失去的最后一格面具血量，也能使蜂巢中的敌人不再对小骑士有敌意。",
    iconFiles: [],
  },
  "骄傲印记(Mark of Pride)": {
    text: "佩戴后能增加骨钉25%的攻击范围。",
    iconFiles: [],
  },
  "苦痛荆棘(Thorns of Agony)": {
    text: "佩戴后使小骑士在受到伤害时伸出荆棘藤蔓，伤害周围的敌人。",
    iconFiles: [],
  },
  "快速劈砍(Quick Slash)": {
    text: "佩戴后能让小骑士的攻击频率变快，在相同时间内造成更高输出。",
    iconFiles: [],
  },
  "灵魂捕手(Soul Catcher)": {
    text: "佩戴后增加用骨钉攻击敌人时获得的灵魂。",
    iconFiles: [],
  },
  "梦之盾(Dreamshield)": {
    text: "佩戴后生成一面围绕小骑士旋转的盾牌，能够阻挡特定投射物并对敌人造成伤害。",
    iconFiles: [],
  },
  "蘑菇孢子(Spore Shroom)": {
    text: "佩戴后进行凝聚，会在小骑士周围释放一片能造成伤害的孢子云。",
    iconFiles: [],
  },
  "乔尼的祝福(Joni's Blessing)": {
    text: "佩戴后使血量增长40%，向上取整，并使所有血量变成生命血。",
    iconFiles: [],
  },
  "深度聚集(Deep Focus)": {
    text: "佩戴后将凝聚回复的面具血量翻倍为两格，但使凝聚时间延长约0.55秒。",
    iconFiles: [],
  },
  "生命血核心(Lifeblood Core)": {
    text: "佩戴后，在长椅上休息时给予小骑士4格生命血血量。",
    iconFiles: [],
  },
  "噬魂者(Soul Eater)": {
    text: "佩戴后能极大增加使用骨钉攻击敌人时获得的灵魂。",
    iconFiles: [],
  },
  "亡者之怒(Fury of the Fallen)": {
    text: "佩戴后，在小骑士只有一格面具血量时，将所有骨钉伤害提升至175%。",
    iconFiles: [],
  },
  "虚空之心(Void Heart)": {
    text: "获得后无法卸下且不占用护符槽，并能使同胞与暗影不再攻击小骑士，使虚空卷须不再出现。",
    iconFiles: [],
  },
};

const normalizeItemName = (name: string) =>
  name.replace(/[（(].*$/, "").trim();

const MARKER_VISIT_NUMBERS: Record<string, number> = {
  custom_cloth_visit_1: 1,
  custom_cloth_visit_2: 2,
  custom_cloth_visit_3: 3,
  marker_1785470611423_mo38d9: 4,
  marker_1785469750648_1qrjgg: 1,
  marker_1785485109491_mzw6s3: 2,
  custom_zote_colosseum_marker: 3,
  custom_zote_dirtmouth_marker: 4,
  custom_quirrel_visit_1: 1,
  custom_quirrel_visit_2: 2,
  custom_quirrel_visit_3: 3,
  custom_quirrel_visit_4: 4,
  custom_quirrel_visit_5: 5,
  custom_quirrel_visit_6: 6,
  custom_quirrel_visit_7: 7,
  custom_quirrel_visit_8: 8,
  marker_1785484569953_pg55vz: 9,
};

const getMarkerVisitNumber = (marker: Marker) => {
  const configuredVisitNumber = MARKER_VISIT_NUMBERS[marker.id];
  if (configuredVisitNumber) return configuredVisitNumber;
  if (marker.name !== "蘑菇先生(Mister Mushroom)") return null;
  const description = marker.description?.trim() ?? "";
  if (description.includes("初次见面")) return 1;
  if (description.includes("第二次见面")) return 2;
  if (description.includes("第三次见面")) return 3;
  if (description.includes("第四次见面")) return 4;
  if (description.includes("第五次见面")) return 5;
  if (description.includes("第六次见面")) return 6;
  if (description.includes("最后一次见面")) return 7;
  return null;
};

function getPopupEmbeddedItemIcons(markerName: string) {
  const icons: { src: string; alt: string }[] = [];
  const leadingIcon = HIGHLIGHT_LEADING_ICONS[markerName];
  if (leadingIcon) icons.push(leadingIcon);
  const itemNote = HIGHLIGHT_ITEM_NOTES[markerName];
  if (itemNote) icons.push(itemNote);
  return icons;
}

const MAP_REGION_LABELS = [
  { name: "安息之地", x: 86.66536591142382, y: 26.28359439785804, width: 247.6860497137325 },
  { name: "苍绿之径", x: 15.442728928441607, y: 29.999799651132363, width: 157.2709899208236 },
  { name: "德特茅斯", x: 45.86295753786005, y: 15.908776357191984, width: 158.39636654279715 },
  { name: "蜂巢", x: 89.34002094557405, y: 71.09607673624343, width: 60.917022117874055 },
  { name: "古老盆地", x: 55.86707220139323, y: 76.60296542521503, width: 97.69645765128404 },
  { name: "呼啸悬崖", x: 22.751733160325944, y: 12.10722981616994, width: 100.14645157282047 },
  { name: "皇家水道", x: 52.89712764142594, y: 69.83233971688021, width: 217.33382777905348 },
  { name: "泪水之城", x: 71.25786517349891, y: 42.259359842494376, width: 177.98783007084415 },
  { name: "深邃巢穴", x: 20.407970695365368, y: 72.92179718721492, width: 141.8238910919086 },
  { name: "深渊", x: 63.876684486883576, y: 91.69862967588894, width: 95.70426998388045 },
  { name: "水晶山峰", x: 68.43885457493207, y: 11.16350650630222, width: 123.72186940153742 },
  { name: "王国边缘", x: 92.11757378460435, y: 52.104302444856145, width: 120.48014411096324 },
  { name: "王后花园", x: 22.675562289718666, y: 54.39136519352509, width: 213.97067892899906 },
  { name: "雾之峡谷", x: 36.86417418397123, y: 46.09668784721114, width: 158.4420779380419 },
  { name: "遗忘十字路", x: 53.41074811445003, y: 36.9669280354921, width: 151.15727882005683 },
  { name: "真菌荒地", x: 47.57314590450625, y: 52.47152762578902, width: 160.49061167533208 },
] as const;

type RegionTextLabel = {
  name: string;
  x: number;
  y: number;
  size: number;
  edgeGlow: string;
  fogGlow: string;
};

const MAP_REGION_CHINESE_LABELS: RegionTextLabel[] = [
  {
    name: "安息之地",
    x: 85.3521074513571,
    y: 24.918570700106073,
    size: 34,
    edgeGlow: "#D6BD91",
    fogGlow: "#8B765B",
  },
  {
    name: "苍绿之径",
    x: 14.657857433838586,
    y: 28.700882799683423,
    size: 34,
    edgeGlow: "#66B681",
    fogGlow: "#276B58",
  },
  {
    name: "德特茅斯",
    x: 44.764874101008175,
    y: 14.641692149478349,
    size: 34,
    edgeGlow: "#7898B8",
    fogGlow: "#334A63",
  },
  {
    name: "蜂巢",
    x: 88.92130311225681,
    y: 69.96475246672968,
    size: 34,
    edgeGlow: "#E4A33C",
    fogGlow: "#8A561C",
  },
  {
    name: "古老盆地",
    x: 54.501434055540166,
    y: 75.27703560711458,
    size: 34,
    edgeGlow: "#75859A",
    fogGlow: "#3F4B5D",
  },
  {
    name: "呼啸悬崖",
    x: 21.86620939002313,
    y: 10.685347940510908,
    size: 34,
    edgeGlow: "#7895AD",
    fogGlow: "#40586C",
  },
  {
    name: "皇家水道",
    x: 51.924619445932215,
    y: 68.63790306347927,
    size: 34,
    edgeGlow: "#55A6AD",
    fogGlow: "#27666B",
  },
  {
    name: "泪水之城",
    x: 70.41739922113157,
    y: 41.028155438152716,
    size: 34,
    edgeGlow: "#68AEE8",
    fogGlow: "#245B9D",
  },
  {
    name: "深邃巢穴",
    x: 19.699381709768293,
    y: 71.67632630023877,
    size: 34,
    edgeGlow: "#665584",
    fogGlow: "#30283F",
  },
  {
    name: "深渊",
    x: 63.41528231112999,
    y: 90.27449595758127,
    size: 34,
    edgeGlow: "#858D9A",
    fogGlow: "#252A32",
  },
  {
    name: "水晶山峰",
    x: 67.46435587217904,
    y: 9.836156194766428,
    size: 34,
    edgeGlow: "#B67AD2",
    fogGlow: "#713F91",
  },
  {
    name: "王国边缘",
    x: 91.18699259512933,
    y: 50.60566328770141,
    size: 34,
    edgeGlow: "#AE8553",
    fogGlow: "#5D4632",
  },
  {
    name: "王后花园",
    x: 21.816950057743252,
    y: 53.075262730100256,
    size: 34,
    edgeGlow: "#69AE8A",
    fogGlow: "#326E58",
  },
  {
    name: "雾之峡谷",
    x: 36.33625772817655,
    y: 44.87088415244825,
    size: 34,
    edgeGlow: "#E49AD8",
    fogGlow: "#9B4F91",
  },
  {
    name: "遗忘十字路",
    x: 52.33168507928329,
    y: 35.58736031600548,
    size: 34,
    edgeGlow: "#8295A8",
    fogGlow: "#46596B",
  },
  {
    name: "真菌荒地",
    x: 46.70067940403373,
    y: 51.28202778920774,
    size: 34,
    edgeGlow: "#C8A65A",
    fogGlow: "#75652E",
  },
  {
    name: "遥远的村庄",
    x: 7.463493485256741,
    y: 60.3063819957649,
    size: 18.5035,
    edgeGlow: "#665584",
    fogGlow: "#30283F",
  },
  {
    name: "圣巢之冠",
    x: 67.41855274566814,
    y: 2.898217223854959,
    size: 18.5035,
    edgeGlow: "#B67AD2",
    fogGlow: "#713F91",
  },
  {
    name: "愚人斗兽场",
    x: 84.51850821683638,
    y: 43.73724977919316,
    size: 18.5035,
    edgeGlow: "#AE8553",
    fogGlow: "#5D4632",
  },
];

const BASE_REGION_LABEL_NAMES = new Set(
  MAP_REGION_CHINESE_LABELS.map((region) => region.name),
);

const getRgbChannels = (hexColor: string) => {
  const value = Number.parseInt(hexColor.slice(1), 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
};

type RegionLabelLayout = { x: number; y: number; size: number };
type RegionLabelLayouts = Record<string, RegionLabelLayout>;

const INITIAL_REGION_LABEL_LAYOUTS: RegionLabelLayouts = Object.fromEntries([
  ...MAP_REGION_LABELS.map((region) => [
    `image:${region.name}`,
    { x: region.x, y: region.y, size: region.width },
  ]),
  ...MAP_REGION_CHINESE_LABELS.map((region) => [
    `text:${region.name}`,
    { x: region.x, y: region.y, size: region.size },
  ]),
]);

const MATCHED_NEW_REGION_LABELS = new Set([
  "遥远的村庄",
  "圣巢之冠",
  "愚人斗兽场",
]);

const FILTER_CATEGORY_ICON_OVERRIDES: Record<
  string,
  { iconFile?: string; iconScale?: number }
> = {
  "NPC\u0000任务型NPC": { iconFile: "/filter-icons/npc-quest.webp" },
  "NPC\u0000商人": { iconFile: "/filter-icons/npc-merchant.png" },
  "NPC\u0000奖励型NPC": { iconFile: "/filter-icons/npc-reward.webp" },
  "NPC\u0000多结局NPC": {
    iconFile: "/icons/地标+npc/骨钉匠（Nailsmith）.webp",
  },
  "地点\u0000地图": {
    iconFile: "/filter-icons/location-map-cornifer.webp",
  },
  "地点\u0000格林剧团内容": {
    iconFile: "/icons/自定义/大虫尸体.webp",
    iconScale: 0.82,
  },
  "技能\u0000护符": {
    iconFile: "/icons/护符+护符槽图标/快速聚集（Quick Focus）.png",
  },
  "技能\u0000位移能力": {
    iconFile: "/icons/技能/帝王之翼（Monarch Wings）.png",
  },
  "技能\u0000骨钉技艺": {
    iconFile: "/icons/剑技/强力劈砍.webp",
  },
  "收集物\u0000国王之魂碎片": {
    iconFile: "/icons/收集物/国王之魂-左.png",
  },
  "技能\u0000梦之钉能力": {
    iconFile: "/icons/商店商品/梦之门.webp",
  },
  "收集物\u0000低语之根": { iconFile: "/filter-icons/collectible-whispering-root.png" },
  "收集物\u0000道具": { iconFile: "/icons/收集物/光蝇灯笼.webp" },
  "Boss\u0000非主线Boss": { iconFile: "/filter-icons/boss-optional.png" },
  "Boss\u0000主线Boss": { iconFile: "/filter-icons/boss-main.webp" },
  "Boss\u0000战士之梦Boss": { iconFile: "/filter-icons/boss-warrior-dream.png" },
};

type ViewTransform = {
  x: number;
  y: number;
  scale: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type Marker = {
  id: string;
  name: string;
  iconId: string;
  iconFile: string;
  category: string;
  description?: string;
  x: number;
  y: number;
  size: number;
  region?: string;
  highlight?: {
    text: string;
    iconFiles: string[];
  };
};

type ProjectData = {
  markers: Marker[];
};

type RegionInfo = {
  name: string;
  englishName: string;
  parent: string | null;
  x: number | null;
  y: number | null;
  highlight: string;
  description: string;
};

type RegionInfoData = {
  regions: RegionInfo[];
};

const getMarkerDescription = (marker: Marker) => {
  const sharedDescription = SHARED_MARKER_DESCRIPTIONS[marker.name];
  const markerDescription = marker.description?.trim() ?? "";
  if (sharedDescription && APPEND_SHARED_DESCRIPTION_MARKERS.has(marker.name)) {
    return markerDescription && markerDescription !== "暂无描述"
      ? `${sharedDescription}\n${markerDescription}`
      : sharedDescription;
  }
  return sharedDescription ?? markerDescription;
};

const getMarkerHighlight = (marker: Marker) => {
  if (marker.name === "蘑菇先生(Mister Mushroom)") {
    const visitNumber = getMarkerVisitNumber(marker);
    const visitOrdinal = visitNumber
      ? ["", "一", "二", "三", "四", "五", "六", "七"][visitNumber]
      : "X";
    return {
      text: `蘑菇先生是一个会说话的蘑菇。杀死三位守梦者后，他会出现在圣巢各处。他也被称作使者或者使者大人，并以某种方式联系到蘑菇部落。\n在全部七个地区找到他并对话，游戏进入结局时，正常结局后会播放一段额外的短动画，并获得“时代的终结”成就，这预示他将在《空洞骑士：丝之歌》中回归。\n此处为第${visitOrdinal}次与它对话。`,
      iconFiles: [],
    };
  }
  return SHARED_MARKER_HIGHLIGHTS[marker.name] ?? marker.highlight;
};

type IconClassification = {
  iconId: string;
  name: string;
  location: string;
  primary: string;
  secondary: string;
};

type PopupRelation = {
  itemName: string;
  ownerIconId: string;
};

type ClassificationData = {
  entries: IconClassification[];
  relations: PopupRelation[];
};

type CategoryFilter = {
  secondaries?: string[];
};

type MerchantOffer = {
  name: string;
  price?: number;
  geoReward?: string;
  rewardIconFile?: string;
  rewardIconLabel?: string;
  requiredItem?: {
    iconFile: string;
    label: string;
  };
  materialCost?: {
    amount: number;
    iconFile: string;
    label: string;
  };
  requirement?: number;
  iconFile?: string;
  secondaryIconFile?: string;
  iconScale?: number;
  iconRotation?: number;
  detail?: string;
};

type MerchantOfferSection = {
  title: string;
  layout?: "price-table";
  description?: string;
  iconFile?: string;
  unlockPrice?: number;
  hideHeader?: boolean;
  hideCount?: boolean;
  requirementIconFile?: string;
  requirementUnitLabel?: string;
  offers: MerchantOffer[];
};

const SLY_ICON_ID =
  "5Zyw5qCHK25wYy_mlq_ojrHvvIhTbHnvvIkud2VicA";
const ISELDA_ICON_ID =
  "5Zyw5qCHK25wYy_kvIrloZ7lsJTovr7vvIhJc2VsZGHvvIkud2VicA";
const GRUBFATHER_ICON_ID =
  "5Zyw5qCHK25wYy_omavniLfniLfvvIhHcnViZmF0aGVy77yJLndlYnA";
const SEER_ICON_ID =
  "5Zyw5qCHK25wYy_lhYjnn6XvvIhTZWVy77yJLndlYnA";
const SALUBRA_ICON_ID =
  "5Zyw5qCHK25wYy_miqTnrKbniLHlpb3ogIXokKjpsoHlt7TvvIhDaGFybSBMb3ZlciBTYWx1YnJh77yJLnBuZw";
const DIVINE_ICON_ID =
  "5Zyw5qCHK25wYy_ov6rkuIfvvIhEaXZpbmXvvIkud2VicA";
const LEG_EATER_ICON_ID =
  "5Zyw5qCHK25wYy_po5_ohb_ogIXvvIhMZWcgRWF0ZXLvvIkud2VicA";
const NAILSMITH_ICON_ID =
  "5Zyw5qCHK25wYy_pqqjpkonljKDvvIhOYWlsc21pdGjvvIkud2VicA";
const TROUPE_MASTER_GRIMM_ICON_ID =
  "Qk9TUy_liaflm6Llm6Lplb_moLzmnpfvvIhUcm91cGUgTWFzdGVyIEdyaW1t77yJLnBuZw";
const LITTLE_FOOL_ICON_ID =
  "5Zyw5qCHK25wYy_lsI_mhJrkurrvvIhMaXR0bGUgRm9vbO-8iS53ZWJw";
const CORNIFER_ICON_ID =
  "5Zyw5qCHK25wYy_mn6_lsLzms5XvvIhDb3JuaWZlcu-8iS53ZWJw";
const RELIC_SEEKER_LEMM_ICON_ID =
  "5Zyw5qCHK25wYy_mlofnianmkJzlr7vogIXph4zlp4bvvIhSZWxpYyBTZWVrZXIgTGVtbe-8iS53ZWJw";
const GRUB_ICON_FILE = "/icons/收集物/Grub.webp";
const ESSENCE_ICON_FILE = "/icons/商店商品/梦之精华.png";
const OFFER_TAB_LABELS: Record<string, string> = {
  [GRUBFATHER_ICON_ID]: "收集幼虫奖励",
  [SEER_ICON_ID]: "收集精华奖励",
  [NAILSMITH_ICON_ID]: "骨钉升级",
  [TROUPE_MASTER_GRIMM_ICON_ID]: "集火奖励",
  [LITTLE_FOOL_ICON_ID]: "试炼信息",
  [CORNIFER_ICON_ID]: "出售地图",
  [RELIC_SEEKER_LEMM_ICON_ID]: "文物收购",
};

const MERCHANT_OFFERS: Record<string, MerchantOfferSection[]> = {
  [RELIC_SEEKER_LEMM_ICON_ID]: [
    {
      title: "文物收购",
      hideHeader: true,
      offers: [
        {
          name: "漫游者日记",
          price: 200,
          iconFile: "/icons/收集物/漫游者日记.png",
          detail:
            "“这些日志给我们展现了以前的虫子身心的有趣一面。\n这些很常见，所以我不会出太高的价格。”",
        },
        {
          name: "圣巢印章",
          price: 450,
          iconFile: "/icons/收集物/圣巢印章.png",
          detail:
            "“这些华丽的印章是国王和他的骑士的官方标志，那些携带的虫子很珍惜它们。\n国王和他的骑士已经逝去，但印章作为古董仍然很有价值。我会为它们支付适中的价格。”",
        },
        {
          name: "国王神像",
          price: 800,
          iconFile: "/icons/收集物/国王神像.png",
          detail:
            "“圣巢的国王神像，他被尊为神和统治者。这些圣像由一种神秘的白色材料制成，十分罕见，非常有价值。\n如果你把它卖给我，我会出一个好价钱。”",
        },
        {
          name: "神秘蛋",
          price: 1200,
          iconFile: "/icons/收集物/神秘蛋.webp",
          detail:
            "“啊！它看起来像一个普通的蛋，但实际上是个圣巢诞生前的珍贵遗物！\n请把它卖给我！我会给你一大笔钱的。”",
        },
      ],
    },
  ],
  [CORNIFER_ICON_ID]: [
    {
      title: "出售地图",
      layout: "price-table",
      hideHeader: true,
      offers: [
        { name: "遗忘十字路", price: 30 },
        { name: "皇家水道", price: 75 },
        { name: "苍绿之径", price: 60 },
        { name: "雾之峡谷", price: 150 },
        { name: "真菌荒地", price: 75 },
        { name: "王后花园", price: 150 },
        { name: "水晶山峰", price: 112 },
        { name: "古老盆地", price: 112 },
        { name: "泪水之城", price: 90 },
        { name: "王国边缘", price: 112 },
        { name: "深邃巢穴", price: 38 },
        { name: "呼啸悬崖", price: 75 },
      ],
    },
  ],
  [TROUPE_MASTER_GRIMM_ICON_ID]: [
    {
      title: "格林之子",
      hideHeader: true,
      offers: [
        {
          name: "第一阶段",
          detail: "初始。",
          iconFile: "/icons/护符+护符槽图标/格林之子（Grimmchild）1.png",
          secondaryIconFile: "/icons/护符+护符槽图标/格林之子形态1.webp",
        },
        {
          name: "第二阶段",
          detail: "收集三团格林亲族新手守卫的火焰，返回格林处。",
          iconFile: "/icons/护符+护符槽图标/格林之子（Grimmchild）2.png",
          secondaryIconFile: "/icons/护符+护符槽图标/格林之子形态2.webp",
        },
        {
          name: "第三阶段",
          detail: "收集三团格林亲族大师守卫的火焰，击败格林团长。",
          iconFile: "/icons/护符+护符槽图标/格林之子（Grimmchild）3.png",
          secondaryIconFile: "/icons/护符+护符槽图标/格林之子形态3.webp",
        },
        {
          name: "护符槽",
          detail: "第二次集齐火焰，击败剧团团长格林后获得。",
          iconFile: "/icons/收集物/护符槽图标.png",
        },
        {
          name: "第四阶段",
          detail: "收集三团格林亲族梦魇守卫的火焰，击败梦魇之王格林。",
          iconFile: "/icons/护符+护符槽图标/格林之子（Grimmchild）4.png",
          secondaryIconFile: "/icons/护符+护符槽图标/格林之子形态4.webp",
        },
      ],
    },
  ],
  [LITTLE_FOOL_ICON_ID]: [
    {
      title: "勇士的试炼",
      description: "第一个试炼，节奏相对缓慢，敌人较容易应对。",
      iconFile: "/icons/商店商品/勇士的试炼.png",
      unlockPrice: 100,
      hideCount: true,
      offers: [
        {
          name: "首次完成",
          geoReward: "1000–1024",
          rewardIconFile: "/icons/收集物/护符槽图标.png",
          rewardIconLabel: "护符槽",
        },
        {
          name: "再次完成",
          geoReward: "1000–1024",
        },
      ],
    },
    {
      title: "征服者的试炼",
      description: "第二个试炼，包含无法治疗的持续爬墙空中战斗。",
      iconFile: "/icons/商店商品/征服者的试炼.png",
      unlockPrice: 450,
      hideCount: true,
      offers: [
        {
          name: "首次完成",
          geoReward: "2000–2020",
          rewardIconFile: "/icons/收集物/苍白矿石.png",
          rewardIconLabel: "苍白矿石",
        },
        {
          name: "再次完成",
          geoReward: "2000–2020",
        },
      ],
    },
    {
      title: "愚人的试炼",
      description: "最后一个试炼，敌人更强，进攻节奏也更快。",
      iconFile: "/icons/商店商品/愚人的试炼.png",
      unlockPrice: 800,
      hideCount: true,
      offers: [
        {
          name: "首次完成",
          geoReward: "3000–3020",
        },
        {
          name: "再次完成",
          geoReward: "3000–3020",
        },
      ],
    },
  ],
  [SLY_ICON_ID]: [
    {
      title: "初始出售",
      offers: [
        {
          name: "面具碎片",
          detail: "第一块",
          price: 150,
          iconFile: "/icons/收集物/面具碎片.png",
        },
        {
          name: "面具碎片",
          detail: "第二块",
          price: 500,
          iconFile: "/icons/收集物/面具碎片.png",
        },
        {
          name: "容器碎片",
          price: 550,
          iconFile: "/icons/收集物/灵魂碎片.png",
        },
        {
          name: "蜂群集结",
          price: 300,
          iconFile: "/icons/护符+护符槽图标/蜂群集结（Gathering Swarm）.png",
          detail: "吉欧掉落后，产生小飞虫收集吉欧，飞向小骑士。",
        },
        {
          name: "坚硬外壳",
          price: 200,
          iconFile: "/icons/护符+护符槽图标/坚硬外壳（Stalwart Shell）.png",
        },
        {
          name: "光蝇灯笼",
          price: 1800,
          iconFile: "/icons/收集物/光蝇灯笼.webp",
          detail: "照亮漆黑区域；解锁与梦境Boss无眼的战斗。",
        },
        {
          name: "腐臭蛋",
          price: 60,
          iconFile: "/icons/收集物/腐臭蛋.png",
        },
        {
          name: "简单钥匙",
          price: 950,
          iconFile: "/icons/收集物/简单钥匙.png",
          detail: "可以打开简单锁，但是由于做工粗糙、磨损严重，只能使用一次。",
        },
      ],
    },
    {
      title: "交还店主的钥匙后出售",
      offers: [
        {
          name: "面具碎片",
          detail: "第三块",
          price: 800,
          iconFile: "/icons/收集物/面具碎片.png",
        },
        {
          name: "面具碎片",
          detail: "第四块",
          price: 1500,
          iconFile: "/icons/收集物/面具碎片.png",
        },
        {
          name: "容器碎片",
          price: 900,
          iconFile: "/icons/收集物/灵魂碎片.png",
        },
        {
          name: "典雅的钥匙",
          price: 800,
          iconFile: "/icons/收集物/典雅的钥匙.webp",
          detail: "用于打开位于泪水之城灵魂圣所内的一扇上锁的门。",
        },
        {
          name: "沉重之击",
          price: 350,
          iconFile: "/icons/护符+护符槽图标/沉重之击（Heavy Blow）.png",
          detail: "增加骨钉攻击和剑技的击退效果，还能使Boss硬直所需的受击次数减少1。",
        },
        {
          name: "飞毛腿",
          price: 400,
          iconFile: "/icons/护符+护符槽图标/飞毛腿（Sprintmaster）.png",
          detail: "使小骑士平时在地上的移动速度增加约20%。",
        },
      ],
    },
    {
      title: "学会全部骨钉技艺后赠送",
      offers: [
        {
          name: "骨钉大师的荣耀",
          iconFile: "/icons/护符+护符槽图标/骨钉大师的荣耀（Nailmaster's Glory）.png",
          detail: "使骨钉技艺的蓄力时间减少约44%，由1.35秒降至0.75秒。",
        },
      ],
    },
  ],
  [ISELDA_ICON_ID]: [
    {
      title: "出售商品",
      hideHeader: true,
      offers: [
        {
          name: "任性的指南针",
          price: 220,
          iconFile: "/icons/护符+护符槽图标/任性的指南针（Wayward Compass）.png",
          iconScale: 0.86,
          detail: "在地图上显示小骑士的当前位置。",
        },
        {
          name: "羽毛笔",
          price: 120,
          iconFile: "/icons/商店商品/羽毛笔.webp",
        },
        {
          name: "长椅图标",
          price: 100,
          iconFile: "/icons/地标+npc/长椅图标.png",
        },
        {
          name: "生命血茧图标",
          price: 100,
          iconFile: "/icons/地标+npc/生命血茧图标.png",
        },
        {
          name: "商人图标",
          price: 100,
          iconFile: "/icons/商店商品/商贩图针.png",
        },
        {
          name: "温泉图标",
          price: 100,
          iconFile: "/icons/地标+npc/温泉图标.png",
        },
        {
          name: "低语之根图标",
          price: 150,
          iconFile: "/icons/收集物/梦之树图标.png",
        },
        {
          name: "战士陵墓图标",
          price: 180,
          iconFile: "/icons/商店商品/战士之墓图针.png",
        },
        {
          name: "鹿角虫道图标",
          price: 100,
          iconFile: "/icons/地标+npc/鹿角虫车站图标.png",
        },
        {
          name: "电车图标",
          price: 100,
          iconFile: "/icons/地标+npc/电车图标.png",
        },
        {
          name: "圣甲虫标记",
          price: 100,
          iconFile: "/icons/商店商品/圣甲虫标记.webp",
        },
        {
          name: "贝壳标记",
          price: 100,
          iconFile: "/icons/商店商品/贝壳标记.webp",
        },
        {
          name: "闪亮标记",
          price: 210,
          iconFile: "/icons/商店商品/SHINING标记.webp",
        },
        {
          name: "铜币标记",
          price: 100,
          iconFile: "/icons/商店商品/TOKEN标记.webp",
        },
      ],
    },
  ],
  [GRUBFATHER_ICON_ID]: [
    {
      title: "收集幼虫奖励",
      hideHeader: true,
      requirementIconFile: GRUB_ICON_FILE,
      requirementUnitLabel: "幼虫",
      offers: [
        {
          name: "面具碎片",
          requirement: 5,
          iconFile: "/icons/收集物/面具碎片.png",
        },
        {
          name: "幼虫之歌",
          requirement: 10,
          iconFile: "/icons/护符+护符槽图标/幼虫之歌（Grubsong）.png",
          detail: "使小骑士每次受伤能获得15灵魂。",
        },
        {
          name: "腐臭蛋",
          requirement: 16,
          iconFile: "/icons/收集物/腐臭蛋.png",
        },
        {
          name: "圣巢印章",
          requirement: 23,
          iconFile: "/icons/收集物/圣巢印章.png",
        },
        {
          name: "苍白矿石",
          requirement: 31,
          iconFile: "/icons/收集物/苍白矿石.png",
        },
        {
          name: "国王神像",
          requirement: 38,
          iconFile: "/icons/收集物/国王神像.png",
        },
        {
          name: "蜕变挽歌",
          requirement: 46,
          iconFile: "/icons/护符+护符槽图标/蜕变挽歌（Grubberfly's Elegy）.png",
          detail: "面具血量为满格时，使用骨钉普通攻击会发射剑气，伤害为骨钉每击伤害的一半。",
        },
      ],
    },
  ],
  [SEER_ICON_ID]: [
    {
      title: "收集精华奖励",
      hideHeader: true,
      requirementIconFile: ESSENCE_ICON_FILE,
      requirementUnitLabel: "精华",
      offers: [
        {
          name: "圣巢印章",
          requirement: 100,
          iconFile: "/icons/收集物/圣巢印章.png",
        },
        {
          name: "解锁灵魂沼地",
          requirement: 200,
          iconFile: "/icons/商店商品/灵魂沼地.png",
        },
        {
          name: "苍白矿石",
          requirement: 300,
          iconFile: "/icons/收集物/苍白矿石.png",
        },
        {
          name: "舞梦者",
          requirement: 500,
          iconFile: "/icons/护符+护符槽图标/舞梦者（Dream Wielder）.png",
          detail:
            "使梦之钉击中敌人时获得的灵魂从33增长至66，还能使梦之钉攻击速度加快，所用时间从2.4秒降至0.9秒。此外，还能增加杀死敌人时随机获得精华的可能性。",
        },
        {
          name: "容器碎片",
          requirement: 700,
          iconFile: "/icons/收集物/灵魂碎片.png",
        },
        {
          name: "梦之门",
          requirement: 900,
          iconFile: "/icons/商店商品/梦之门.webp",
          detail:
            "小骑士可以长按梦之钉+下键建立梦之门，之后在几乎任何地方都能长按梦之钉+上键使用1梦境精华传送至梦之门所在的位置。同一时间只能存在一个梦之门，放置新的梦之门会使之前的消失。",
        },
        {
          name: "神秘蛋",
          requirement: 1200,
          iconFile: "/icons/收集物/神秘蛋.webp",
        },
        {
          name: "面具碎片",
          requirement: 1500,
          iconFile: "/icons/收集物/面具碎片.png",
        },
        {
          name: "觉醒的梦之钉",
          requirement: 1800,
          iconFile: "/icons/商店商品/觉醒的梦之钉.png",
          detail:
            "对宫殿广场的国王傀儡尸体使用，可以进入白色宫殿。\n可以查看深渊中手捧使小骑士获得暗影披风的虚空盆的暗影野兽的梦语。获得虚空之心后，它的梦语会产生变化。",
        },
        {
          name: "成就：升天",
          requirement: 2400,
          iconFile: "/icons/商店商品/成就-升天.png",
        },
      ],
    },
  ],
  [SALUBRA_ICON_ID]: [
    {
      title: "出售商品",
      hideHeader: true,
      offers: [
        {
          name: "生命血之心",
          price: 250,
          iconFile: "/icons/护符+护符槽图标/生命血之心（Lifeblood Heart）.png",
        },
        {
          name: "修长之钉",
          price: 300,
          iconFile: "/icons/护符+护符槽图标/修长之钉（Longnail）.png",
        },
        {
          name: "稳定之体",
          price: 120,
          iconFile: "/icons/护符+护符槽图标/稳定之体（Steady Body）.png",
          detail: "使小骑士一般攻击时不会因反作用力后退。",
        },
        {
          name: "萨满之石",
          price: 220,
          iconFile: "/icons/护符+护符槽图标/萨满之石（Shaman Stone）.png",
        },
        {
          name: "快速聚集",
          price: 800,
          iconFile: "/icons/护符+护符槽图标/快速聚集（Quick Focus）.png",
        },
        {
          name: "护符槽",
          detail: "拥有5个护符",
          price: 120,
          iconFile: "/icons/收集物/护符槽图标.png",
        },
        {
          name: "护符槽",
          detail: "拥有10个护符",
          price: 500,
          iconFile: "/icons/收集物/护符槽图标.png",
        },
        {
          name: "护符槽",
          detail: "拥有18个护符",
          price: 900,
          iconFile: "/icons/收集物/护符槽图标.png",
        },
        {
          name: "护符槽",
          detail: "拥有25个护符",
          price: 1400,
          iconFile: "/icons/收集物/护符槽图标.png",
        },
        {
          name: "萨鲁巴的祝福",
          detail:
            "获得全部护符。\n坐在长椅上休息时，两秒后上方会出现一个舞动的萨鲁巴的幻影，使小骑士每秒回复50点灵魂，直到小骑士回复至满魂状态。",
          price: 800,
          iconFile: "/icons/商店商品/萨鲁巴的祝福.webp",
        },
      ],
    },
  ],
  [DIVINE_ICON_ID]: [
    {
      title: "出售商品",
      hideHeader: true,
      offers: [
        {
          name: "坚固力量",
          detail: "将骨钉伤害乘以150%。",
          price: 15000,
          requiredItem: {
            iconFile: "/icons/护符+护符槽图标/易碎力量（Fragile Strength）.png",
            label: "易碎力量",
          },
          iconFile: "/icons/护符+护符槽图标/坚固力量（Unbreakable Strength）.png",
        },
        {
          name: "坚固心脏",
          detail: "增加小骑士两格面具的血量。",
          price: 12000,
          requiredItem: {
            iconFile: "/icons/护符+护符槽图标/易碎心脏（Fragile Heart）.png",
            label: "易碎心脏",
          },
          iconFile: "/icons/护符+护符槽图标/坚固心脏（Unbreakable Heart）.png",
        },
        {
          name: "坚固贪婪",
          detail: "提升敌人掉落的吉欧数量。",
          price: 9000,
          requiredItem: {
            iconFile: "/icons/护符+护符槽图标/易碎贪婪（Fragile Greed）.png",
            label: "易碎贪婪",
          },
          iconFile: "/icons/护符+护符槽图标/坚固贪婪（Unbreakable Greed）.png",
        },
      ],
    },
  ],
  [LEG_EATER_ICON_ID]: [
    {
      title: "出售商品",
      hideHeader: true,
      offers: [
        {
          name: "易碎力量",
          detail: "将骨钉伤害乘以150%，死亡后损坏。",
          price: 600,
          iconFile: "/icons/护符+护符槽图标/易碎力量（Fragile Strength）.png",
        },
        {
          name: "易碎心脏",
          detail: "增加小骑士两格面具的血量，死亡后损坏。",
          price: 350,
          iconFile: "/icons/护符+护符槽图标/易碎心脏（Fragile Heart）.png",
        },
        {
          name: "易碎贪婪",
          detail: "提升敌人掉落的吉欧数量，死亡后损坏。",
          price: 250,
          iconFile: "/icons/护符+护符槽图标/易碎贪婪（Fragile Greed）.png",
        },
      ],
    },
  ],
  [NAILSMITH_ICON_ID]: [
    {
      title: "骨钉升级",
      hideHeader: true,
      offers: [
        {
          name: "锋利的骨钉",
          price: 250,
          iconFile: "/icons/商店商品/锋利的骨钉.webp",
          iconScale: 1.18,
          iconRotation: 90,
        },
        {
          name: "开槽的骨钉",
          price: 800,
          materialCost: {
            amount: 1,
            iconFile: "/icons/收集物/苍白矿石.png",
            label: "苍白矿石",
          },
          iconFile: "/icons/商店商品/开槽的骨钉.webp",
          iconScale: 1.18,
          iconRotation: 90,
        },
        {
          name: "带螺纹的骨钉",
          price: 2000,
          materialCost: {
            amount: 2,
            iconFile: "/icons/收集物/苍白矿石.png",
            label: "苍白矿石",
          },
          iconFile: "/icons/商店商品/带螺纹的骨钉.webp",
          iconScale: 1.18,
          iconRotation: 90,
        },
        {
          name: "纯粹骨钉",
          price: 4000,
          materialCost: {
            amount: 3,
            iconFile: "/icons/收集物/苍白矿石.png",
            label: "苍白矿石",
          },
          iconFile: "/icons/商店商品/纯粹骨钉.webp",
          iconScale: 1.18,
          iconRotation: 90,
        },
      ],
    },
  ],
};

function getMarkerGlow(marker: Marker, primaryCategory?: string) {
  if (marker.iconId === "custom_shade_gate") {
    return "drop-shadow(0 0 2px rgba(255, 255, 255, 0.96)) drop-shadow(0 0 6px rgba(214, 230, 255, 0.74))";
  }
  if (
    marker.iconId === "custom_nightmare_lantern" ||
    marker.iconId === "custom_large_bug_corpse"
  ) {
    return "drop-shadow(0 0 2px rgba(255, 255, 255, 0.96)) drop-shadow(0 0 6px rgba(214, 230, 255, 0.74))";
  }
  if (primaryCategory === "地点") {
    return "drop-shadow(0 0 2px rgba(184, 200, 214, 0.9)) drop-shadow(0 0 6px rgba(102, 127, 150, 0.66))";
  }
  if (primaryCategory === "收集物") {
    return "drop-shadow(0 0 2px rgba(184, 200, 214, 0.9)) drop-shadow(0 0 6px rgba(102, 127, 150, 0.66))";
  }
  if (
    marker.iconId === "5Zyw5qCHK25wYy_plb_mpIXlm77moIcucG5n" ||
    marker.iconId === "5pS26ZuG54mpL-aipuS5i-agkeWbvuaghy5wbmc" ||
    marker.iconId === "5Zyw5qCHK25wYy9waW5fdHJhbV9sb2NhdGlvbiAjNjM4Mi5wbmc"
  ) {
    return undefined;
  }

  if (
    marker.iconId === "5pS26ZuG54mpL-mdouWFt-eijueJhy5wbmc" ||
    marker.iconId === "5pS26ZuG54mpL-eBtemtgueijueJhy5wbmc" ||
    marker.iconId === "5pS26ZuG54mpL-iLjeeZveefv-efsy5wbmc" ||
    marker.iconId === "5pS26ZuG54mpL-WbveeOi-S5i-mtgi3lt6YucG5n" ||
    marker.iconId === "5pS26ZuG54mpL-WbveeOi-S5i-mtgi3lj7MucG5n"
  ) {
    return "drop-shadow(0 0 2px rgba(255, 255, 255, 0.96)) drop-shadow(0 0 6px rgba(214, 230, 255, 0.74))";
  }

  if (
    marker.iconId === "asset_6Ieq5a6a5LmJL-elnuenmOibiy53ZWJw"
  ) {
    return "drop-shadow(0 0 2px rgba(0, 0, 0, 1)) drop-shadow(0 0 6px rgba(8, 4, 14, 0.88))";
  }

  if (
    marker.iconId ===
    "asset_6Ieq5a6a5LmJL-iZmuepuuS5i-W_g--8iFZvaWQgSGVhcnTvvIkucG5n"
  ) {
    return "drop-shadow(0 0 2px rgba(72, 200, 255, 0.92)) drop-shadow(0 0 6px rgba(28, 105, 235, 0.7))";
  }

  if (
    marker.iconId === "asset_6Ieq5a6a5LmJL-S5jOaBqe-8iFVubu-8iS53ZWJw" ||
    marker.iconId === "icon_1785996896672_ezsbsi"
  ) {
    return "drop-shadow(0 0 2px rgba(255, 224, 72, 0.92)) drop-shadow(0 0 6px rgba(236, 166, 18, 0.7))";
  }

  if (marker.category === "BOSS" || primaryCategory === "Boss") {
    return "drop-shadow(0 0 2px rgba(255, 42, 52, 0.9)) drop-shadow(0 0 6px rgba(230, 8, 28, 0.65))";
  }

  if (marker.category === "技能" || marker.category === "剑技") {
    return "drop-shadow(0 0 2px rgba(192, 92, 255, 0.92)) drop-shadow(0 0 6px rgba(125, 42, 230, 0.7))";
  }

  if (marker.category === "地标+npc" || primaryCategory === "NPC") {
    return "drop-shadow(0 0 2px rgba(255, 224, 72, 0.92)) drop-shadow(0 0 6px rgba(236, 166, 18, 0.7))";
  }

  if (marker.category === "护符+护符槽图标") {
    return "drop-shadow(0 0 2px rgba(72, 200, 255, 0.92)) drop-shadow(0 0 6px rgba(28, 105, 235, 0.7))";
  }

  return undefined;
}

function getMarkerGlowColors(marker: Marker, primaryCategory?: string) {
  const glow = getMarkerGlow(marker, primaryCategory);
  if (!glow) return null;
  const colors = [...glow.matchAll(/rgba\((\d+),\s*(\d+),\s*(\d+),/g)].map(
    (match) => `${match[1]}, ${match[2]}, ${match[3]}`,
  );
  return colors.length
    ? { core: colors[0], haze: colors[1] ?? colors[0] }
    : null;
}

function markerHasPopupContent(marker: Marker) {
  const description = getMarkerDescription(marker).trim();
  const highlight = getMarkerHighlight(marker);
  return Boolean(
    (description && description !== "暂无描述") ||
      highlight?.text?.trim() ||
      HIGHLIGHT_ITEM_NOTES[marker.name] ||
      (!INFORMATION_ONLY_MARKER_IDS.has(marker.id) &&
        (MERCHANT_OFFERS[marker.iconId]?.length ?? 0) > 0),
  );
}

export default function MapViewer() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const markerAspectRatiosRef = useRef(new Map<string, number>());
  const transformRef = useRef<ViewTransform>({ x: 0, y: 0, scale: 1 });
  const minimumScaleRef = useRef(1);
  const dragRef = useRef<DragState | null>(null);
  const focusNavigationTimerRef = useRef<number | null>(null);
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const previewCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const [transform, setTransform] = useState<ViewTransform>(transformRef.current);
  const [, setMarkerMetricsVersion] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [smoothFocusMoving, setSmoothFocusMoving] = useState(false);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [classification, setClassification] = useState<ClassificationData>({
    entries: [],
    relations: [],
  });
  const [regionInfos, setRegionInfos] = useState<RegionInfo[]>([]);
  const [filterCollapsed, setFilterCollapsed] = useState(true);
  const [isResettingFilters, setIsResettingFilters] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter | null>(null);
  const [maskFragmentCursor, setMaskFragmentCursor] = useState(0);
  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);
  const [glowFocusMarkerId, setGlowFocusMarkerId] = useState<string | null>(null);
  const [glowFocusRegionName, setGlowFocusRegionName] = useState<string | null>(
    null,
  );
  const [hoveredRegionLabelName, setHoveredRegionLabelName] = useState<
    string | null
  >(null);
  const [popupLinkSource, setPopupLinkSource] = useState<Marker | null>(null);
  const [popupLinkFocus, setPopupLinkFocus] = useState<{
    itemName: string;
    ownerMarkerId: string;
  } | null>(null);
  const [popupTextLinks, setPopupTextLinks] = useState<PopupTextLinkTarget[]>([]);
  const [popupTab, setPopupTab] = useState<"description" | "offers">("description");
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const [completedMarkerIds, setCompletedMarkerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const saveInputRef = useRef<HTMLInputElement>(null);
  const [saveSlots, setSaveSlots] = useState<ParsedSaveSlot[]>([]);
  const [selectedSaveSlot, setSelectedSaveSlot] = useState<string | null>(null);
  const [saveFilterMode, setSaveFilterMode] = useState<SaveFilterMode>("all");
  const [saveFailures, setSaveFailures] = useState<{ slot: number; message: string }[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    saveInputRef.current?.setAttribute("webkitdirectory", "");
  }, []);

  const closePreviewImage = useCallback(() => {
    setPreviewImage(null);
    window.requestAnimationFrame(() => {
      previewTriggerRef.current?.focus();
      previewTriggerRef.current = null;
    });
  }, []);

  useEffect(() => {
    if (!previewImage) return;

    const focusFrame = window.requestAnimationFrame(() => {
      previewCloseButtonRef.current?.focus();
    });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePreviewImage();
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [previewImage, closePreviewImage]);
  const [regionLabelLayouts, setRegionLabelLayouts] =
    useState<RegionLabelLayouts>(INITIAL_REGION_LABEL_LAYOUTS);

  const constrainTransform = useCallback((next: ViewTransform) => {
    const viewport = viewportRef.current;
    if (!viewport) return next;

    const scaledWidth = MAP_WIDTH * next.scale;
    const scaledHeight = MAP_HEIGHT * next.scale;
    const horizontalRestingX =
      scaledWidth <= viewport.clientWidth
        ? (viewport.clientWidth - scaledWidth) / 2
        : 0;
    const horizontalMinX =
      scaledWidth <= viewport.clientWidth
        ? horizontalRestingX - MAP_EDGE_DRAG_ALLOWANCE
        : viewport.clientWidth - scaledWidth - MAP_EDGE_DRAG_ALLOWANCE;
    const horizontalMaxX = horizontalRestingX + MAP_DRAG_RIGHT_ALLOWANCE;
    const x = Math.min(horizontalMaxX, Math.max(horizontalMinX, next.x));
    const verticalRestingY =
      scaledHeight <= viewport.clientHeight
        ? (viewport.clientHeight - scaledHeight) / 2
        : 0;
    const verticalMinY =
      scaledHeight <= viewport.clientHeight
        ? verticalRestingY - MAP_EDGE_DRAG_ALLOWANCE
        : viewport.clientHeight - scaledHeight - MAP_EDGE_DRAG_ALLOWANCE;
    const verticalMaxY = verticalRestingY + MAP_EDGE_DRAG_ALLOWANCE;
    const y = Math.min(verticalMaxY, Math.max(verticalMinY, next.y));

    return { ...next, x, y };
  }, []);

  const selectedSaveDetail = useMemo(
    () => saveSlots.find((slot) => slot.slotId === selectedSaveSlot)?.detail ?? null,
    [saveSlots, selectedSaveSlot],
  );

  const handleSaveDirectory = async (files: File[]) => {
    const result = await parseSaveDirectory(files);
    setSaveSlots(result.slots);
    setSaveFailures(result.failures);
    setSaveError(result.error ?? null);
    setSelectedSaveSlot(result.slots[0]?.slotId ?? null);
    setSaveFilterMode("all");
  };

  const handleSaveInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    await handleSaveDirectory(files);
    event.target.value = "";
  };

  const updateTransform = useCallback(
    (next: ViewTransform) => {
      const constrained = constrainTransform(next);
      transformRef.current = constrained;
      setTransform(constrained);
    },
    [constrainTransform],
  );

  const fitMap = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const scale = Math.min(
      viewport.clientWidth / MAP_WIDTH,
      viewport.clientHeight / MAP_HEIGHT,
    );
    minimumScaleRef.current = scale * MIN_SCALE_FACTOR;
    updateTransform({
      x: (viewport.clientWidth - MAP_WIDTH * scale) / 2,
      y: (viewport.clientHeight - MAP_HEIGHT * scale) / 2,
      scale,
    });
  }, [updateTransform]);

  useEffect(() => {
    fitMap();
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(fitMap);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fitMap]);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch("/project.json", { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error("无法读取地图点位数据");
        return response.json() as Promise<ProjectData>;
      }),
      fetch("/icon-classification.json", { signal: controller.signal }).then(
        (response) => {
          if (!response.ok) throw new Error("无法读取图标分类数据");
          return response.json() as Promise<ClassificationData>;
        },
      ),
      fetch("/region-info.json", { signal: controller.signal }).then(
        (response) => {
          if (!response.ok) throw new Error("无法读取区域名称数据");
          return response.json() as Promise<RegionInfoData>;
        },
      ),
    ])
      .then(([project, classificationData, regionInfoData]) => {
        setMarkers(project.markers ?? []);
        setClassification({
          entries: classificationData.entries ?? [],
          relations: classificationData.relations ?? [],
        });
        setRegionInfos(regionInfoData.regions ?? []);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error(error);
      });

    // 弹窗文字跳转索引独立加载，失败不影响主数据（仅跳转功能降级）
    fetch("/popup-text-links.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("无法读取弹窗跳转索引");
        return response.json() as Promise<{ links: PopupTextLinkTarget[] }>;
      })
      .then((linkData) => setPopupTextLinks(linkData.links ?? []))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error(error);
      });

    return () => controller.abort();
  }, []);

  const regionInfoByName = useMemo(
    () => new Map(regionInfos.map((region) => [region.name, region])),
    [regionInfos],
  );

  const popupTextLinkByName = useMemo(
    () => new Map(popupTextLinks.map((link) => [link.name, link])),
    [popupTextLinks],
  );

  const allRegionChineseLabels = useMemo<RegionTextLabel[]>(() => {
    const additions = regionInfos
      .filter(
        (region) =>
          Boolean(region.parent) &&
          region.x !== null &&
          region.y !== null &&
          !BASE_REGION_LABEL_NAMES.has(region.name),
      )
      .map((region) => {
        const parentStyle = MAP_REGION_CHINESE_LABELS.find(
          (candidate) => candidate.name === region.parent,
        );
        return {
          name: region.name,
          x: region.x as number,
          y: region.y as number,
          size: 18.5035,
          edgeGlow: parentStyle?.edgeGlow ?? "#8295A8",
          fogGlow: parentStyle?.fogGlow ?? "#46596B",
        };
      });
    return [...MAP_REGION_CHINESE_LABELS, ...additions];
  }, [regionInfos]);

  useEffect(() => {
    setRegionLabelLayouts((current) => {
      let next = current;
      for (const region of allRegionChineseLabels) {
        const labelId = `text:${region.name}`;
        if (next[labelId]) continue;
        if (next === current) next = { ...current };
        next[labelId] = { x: region.x, y: region.y, size: region.size };
      }
      return next;
    });
  }, [allRegionChineseLabels]);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(COMPLETION_STORAGE_KEY) ?? "[]",
      );
      if (Array.isArray(saved)) {
        setCompletedMarkerIds(
          new Set(saved.filter((id): id is string => typeof id === "string")),
        );
      }
    } catch (error) {
      console.error("无法读取已完成点位", error);
    }
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    const current = transformRef.current;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: current.x,
      originY: current.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    updateTransform({
      ...transformRef.current,
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    });
  };

  const closeSelectedMarker = () => {
    setSelectedMarker(null);
    setGlowFocusMarkerId(null);
    setGlowFocusRegionName(null);
    setPopupLinkSource(null);
    setPopupLinkFocus(null);
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const movedDistance = Math.hypot(
      event.clientX - drag.startX,
      event.clientY - drag.startY,
    );
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (movedDistance < 5 && selectedMarker) {
      closeSelectedMarker();
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;

    const bounds = viewport.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    const current = transformRef.current;
    const zoomFactor = Math.exp(-event.deltaY * 0.0015);
    const nextScale = Math.min(
      MAX_SCALE,
      Math.max(minimumScaleRef.current, current.scale * zoomFactor),
    );
    const mapX = (pointerX - current.x) / current.scale;
    const mapY = (pointerY - current.y) / current.scale;

    updateTransform({
      scale: nextScale,
      x: pointerX - mapX * nextScale,
      y: pointerY - mapY * nextScale,
    });
  };

  const getPopupPosition = (marker: Marker) => {
    const viewportWidth = viewportRef.current?.clientWidth ?? 0;
    const markerX =
      transform.x + (marker.x / 100) * MAP_WIDTH * transform.scale;
    const markerY =
      transform.y + (marker.y / 100) * MAP_HEIGHT * transform.scale;
    const markerAspectRatio = markerAspectRatiosRef.current.get(marker.id) ?? 1;
    const renderedMarkerHeight = marker.size * transform.scale * markerAspectRatio;
    const markerTop = markerY - renderedMarkerHeight / 2;
    const markerBottom = markerY + renderedMarkerHeight / 2;
    const popupHalfWidth = Math.min(190, Math.max(0, (viewportWidth - 24) / 2));
    const left = Math.min(
      Math.max(markerX, popupHalfWidth + 12),
      Math.max(popupHalfWidth + 12, viewportWidth - popupHalfWidth - 12),
    );
    const showBelow = markerY < 157;
    const arrowOffset = Math.min(
      popupHalfWidth - 18,
      Math.max(18 - popupHalfWidth, markerX - left),
    );

    return {
      left,
      top: showBelow ? markerBottom + 14 : markerTop - 14,
      showBelow,
      arrowOffset,
    };
  };

  const popupPosition = selectedMarker ? getPopupPosition(selectedMarker) : null;
  const activeCategoryKeys = useMemo(
    () => categoryFilter?.secondaries ?? [],
    [categoryFilter],
  );
  const activeRegionNames = useMemo(
    () =>
      new Set(
        activeCategoryKeys
          .filter((key) => key.startsWith("区域\u0000"))
          .map((key) => key.split("\u0000")[1]),
      ),
    [activeCategoryKeys],
  );
  const activeMarkerCategoryKeys = activeCategoryKeys.filter(
    (key) => !key.startsWith("区域\u0000"),
  );
  const activeCategoryEntries = classification.entries.filter((entry) =>
    activeMarkerCategoryKeys.includes(`${entry.primary}\u0000${entry.secondary}`),
  );
  const normalizedFocusSearch = searchQuery.trim().toLocaleLowerCase("zh-CN");
  const activeSearchEntries = normalizedFocusSearch
    ? classification.entries.filter((entry) =>
        [entry.name, entry.primary, entry.secondary].some((value) =>
          normalizeItemName(value ?? "")
            .toLocaleLowerCase("zh-CN")
            .includes(normalizedFocusSearch),
        ),
      )
    : [];
  const activeSearchPopupItemNames = normalizedFocusSearch
    ? [
        ...markers.flatMap((marker) =>
          getPopupEmbeddedItemIcons(marker.name).map((icon) => icon.alt),
        ),
        ...Object.values(MERCHANT_OFFERS).flatMap((sections) =>
          sections.flatMap((section) =>
            section.offers.flatMap((offer) =>
              [
                offer.name,
                offer.rewardIconLabel,
                offer.requiredItem?.label,
                offer.materialCost?.label,
              ].filter((name): name is string => Boolean(name)),
            ),
          ),
        ),
        ...classification.relations.map((relation) => relation.itemName),
      ].filter((name) =>
        normalizeItemName(name)
          .toLocaleLowerCase("zh-CN")
          .includes(normalizedFocusSearch),
      )
    : [];
  const isPopupLinkFocus =
    Boolean(popupLinkFocus) &&
    selectedMarker?.id === popupLinkFocus?.ownerMarkerId;
  const activeCategoryItemNames = new Set(
    [
      ...activeCategoryEntries.map((entry) => entry.name),
      ...activeSearchEntries.map((entry) => entry.name),
      ...activeSearchPopupItemNames,
      ...(isPopupLinkFocus && popupLinkFocus ? [popupLinkFocus.itemName] : []),
    ].map((name) => normalizeItemName(name)),
  );
  const isMaskFragmentFocus =
    activeRegionNames.size > 0 ||
    activeMarkerCategoryKeys.length > 0 ||
    Boolean(normalizedFocusSearch);
  const isSingleCategoryFocus =
    activeMarkerCategoryKeys.length > 0 || Boolean(normalizedFocusSearch);
  const selectedMarkerDirectlyMatchesFilter = selectedMarker
    ? [...activeCategoryEntries, ...activeSearchEntries].some(
        (entry) =>
          entry.iconId === selectedMarker.iconId &&
          entry.name === selectedMarker.name,
      )
    : false;
  const selectedMarkerContainsFilteredPopupItem = selectedMarker
    ? getPopupEmbeddedItemIcons(selectedMarker.name).some((icon) =>
        activeCategoryItemNames.has(normalizeItemName(icon.alt)),
      ) ||
      (!INFORMATION_ONLY_MARKER_IDS.has(selectedMarker.id) &&
        (MERCHANT_OFFERS[selectedMarker.iconId] ?? []).some((section) =>
          section.offers.some(
            (offer) =>
              activeCategoryItemNames.has(normalizeItemName(offer.name)) ||
              activeCategoryItemNames.has(
                normalizeItemName(offer.rewardIconLabel ?? ""),
              ),
          ),
      )) ||
      classification.relations.some(
        (relation) =>
          relation.ownerIconId === selectedMarker.iconId &&
          activeCategoryItemNames.has(normalizeItemName(relation.itemName)),
      )
    : false;
  const shouldFilterPopupContents =
    isPopupLinkFocus ||
    (!popupLinkSource &&
      isMaskFragmentFocus &&
      ((activeMarkerCategoryKeys.length > 0 &&
        !selectedMarkerDirectlyMatchesFilter) ||
        (Boolean(normalizedFocusSearch) &&
          selectedMarkerContainsFilteredPopupItem)));
  const selectedMerchantSectionsBase = selectedMarker
    ? INFORMATION_ONLY_MARKER_IDS.has(selectedMarker.id)
      ? []
      : (MERCHANT_OFFERS[selectedMarker.iconId] ?? [])
    : [];
  const selectedMerchantSections = shouldFilterPopupContents
    ? selectedMerchantSectionsBase
        .map((section) => ({
          ...section,
          hideHeader:
            selectedMerchantSectionsBase.length === 1
              ? true
              : section.hideHeader,
          hideCount: true,
          offers: section.offers.filter(
            (offer) =>
              activeCategoryItemNames.has(normalizeItemName(offer.name)) ||
              activeCategoryItemNames.has(
                normalizeItemName(offer.rewardIconLabel ?? ""),
              ),
          ),
        }))
        .filter((section) => section.offers.length > 0)
    : selectedMerchantSectionsBase;
  const hideUnmatchedDescription = shouldFilterPopupContents;
  const selectedMarkerDescription = selectedMarker
    ? getMarkerDescription(selectedMarker)
    : "";
  const selectedDescriptionParagraphs = selectedMarkerDescription.trim()
    ? selectedMarkerDescription
        .split(/\r?\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
    : [];
  const selectedPopupHighlight = selectedMarker
    ? getMarkerHighlight(selectedMarker)
    : undefined;
  const selectedImageGuide = selectedMarker
    ? MARKER_IMAGE_GUIDES[selectedMarker.id]
    : undefined;
  const selectedHighlightLeadingIcon = selectedMarker
    ? HIGHLIGHT_LEADING_ICONS[selectedMarker.name]
    : undefined;
  const selectedClassifications = selectedMarker
    ? classification.entries.filter(
        (entry) =>
          entry.iconId === selectedMarker.iconId &&
          entry.name === selectedMarker.name &&
          entry.primary,
      )
    : [];
  const selectedClassification =
    selectedClassifications.find((entry) => entry.primary === "Boss") ??
    selectedClassifications[0] ??
    (selectedMarker
      ? classification.entries.find(
          (entry) => entry.iconId === selectedMarker.iconId && entry.primary,
        )
      : undefined);
  const getPopupItemGlowClass = (itemName = "", iconFile = "") => {
    const decodedIconFile = decodeURIComponent(iconFile);
    const iconBaseName =
      decodedIconFile.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "";
    const normalizedCandidates = new Set([
      normalizeItemName(itemName),
      normalizeItemName(iconBaseName),
    ]);
    const matchedEntry = classification.entries.find((entry) =>
      normalizedCandidates.has(normalizeItemName(entry.name)),
    );
    const isCharm = classification.entries.some(
      (entry) =>
        entry.primary === "技能" &&
        entry.secondary === "护符" &&
        normalizedCandidates.has(normalizeItemName(entry.name)),
    );
    const isCharmIconFile =
      decodedIconFile.includes("/护符+护符槽图标/") &&
      !iconBaseName.includes("护符槽");
    const isNailArt = classification.entries.some(
      (entry) =>
        entry.primary === "技能" &&
        entry.secondary === "骨钉技艺" &&
        normalizedCandidates.has(normalizeItemName(entry.name)),
    );
    let glowClass = "";
    if (isCharm || isCharmIconFile) {
      glowClass = "is-blue-glow";
    } else if (
      matchedEntry?.primary === "技能" ||
      isNailArt ||
      decodedIconFile.includes("/剑技/")
    ) {
      glowClass = "is-purple-glow";
    } else if (
      matchedEntry?.primary === "收集物" ||
      decodedIconFile.includes("/收集物/")
    ) {
      glowClass = "is-green-glow";
    } else if (matchedEntry?.primary === "地点") {
      glowClass = "is-silver-blue-glow";
    } else if (matchedEntry?.primary === "NPC") {
      glowClass = "is-yellow-glow";
    } else if (matchedEntry?.primary === "Boss") {
      glowClass = "is-red-glow";
    }
    const isFilteredItem =
      isMaskFragmentFocus &&
      [...normalizedCandidates].some((name) =>
        activeCategoryItemNames.has(name),
      );
    const sizeClass =
      normalizedCandidates.has("苍白矿石") &&
      selectedMarker?.iconId !== NAILSMITH_ICON_ID
      ? " is-pale-ore-popup-icon"
      : "";
    return `${glowClass ? ` ${glowClass}${isFilteredItem ? " is-popup-glow-breathing" : ""}` : ""}${sizeClass}`;
  };
  const selectedCategoryLabels = selectedMarker
    ? [...selectedClassifications]
        .sort((left, right) => {
          const priority = (primary: string) =>
            primary === "Boss" ? 0 : primary === "NPC" ? 1 : 2;
          return priority(left.primary) - priority(right.primary);
        })
        .map((entry) =>
          entry.primary === "Boss" && entry.secondary
            ? entry.secondary
            : entry.primary,
        )
        .filter(
          (label, index, labels) => Boolean(label) && labels.indexOf(label) === index,
        )
    : [];
  if (selectedMarker && selectedCategoryLabels.length === 0) {
    selectedCategoryLabels.push(selectedMarker.category);
  }
  const selectedMarkerSupportsCompletion = Boolean(
    selectedClassification?.primary &&
      COMPLETABLE_PRIMARY_CATEGORIES.has(selectedClassification.primary),
  );
  const selectedSecondaryCompletionGroup =
    selectedClassification?.primary && selectedClassification.secondary
      ? markers.filter((marker) => {
          const markerClassification =
            classification.entries.find(
              (entry) =>
                entry.iconId === marker.iconId &&
                entry.name === marker.name &&
                entry.primary,
            ) ??
            classification.entries.find(
              (entry) => entry.iconId === marker.iconId && entry.primary,
            );

          return (
            markerClassification?.primary === selectedClassification.primary &&
            markerClassification.secondary === selectedClassification.secondary
          );
        })
      : [];
  const selectedSecondaryCompletedCount =
    selectedSecondaryCompletionGroup.filter((marker) =>
      completedMarkerIds.has(marker.id),
    ).length;

  const categoryGroups = useMemo(() => {
    const groups = new Map<
      string,
      Map<
        string,
        { name: string; count: number; iconFile?: string; iconScale?: number }
      >
    >();
    const popupOccurrenceCounts = new Map<string, number>();
    let countedKingsoulFragments = false;
    const countedMultiEndingCharacters = new Set<string>();
    const countedTaskNpcCharacters = new Set<string>();
    for (const sections of Object.values(MERCHANT_OFFERS)) {
      for (const section of sections) {
        for (const offer of section.offers) {
          const offerName = normalizeItemName(offer.name);
          popupOccurrenceCounts.set(
            offerName,
            (popupOccurrenceCounts.get(offerName) ?? 0) + 1,
          );
          if (offer.rewardIconLabel && offer.rewardIconLabel !== offer.name) {
            const rewardName = normalizeItemName(offer.rewardIconLabel);
            popupOccurrenceCounts.set(
              rewardName,
              (popupOccurrenceCounts.get(rewardName) ?? 0) + 1,
            );
          }
        }
      }
    }
    for (const marker of markers) {
      for (const icon of getPopupEmbeddedItemIcons(marker.name)) {
        const itemName = normalizeItemName(icon.alt);
        popupOccurrenceCounts.set(
          itemName,
          (popupOccurrenceCounts.get(itemName) ?? 0) + 1,
        );
      }
    }
    for (const entry of classification.entries) {
      if (!entry.primary) continue;
      if (!groups.has(entry.primary)) groups.set(entry.primary, new Map());
      if (!entry.secondary) continue;
      const secondary = groups.get(entry.primary)!;
      const current = secondary.get(entry.secondary);
      const matchingMarkers = markers.filter(
        (item) => item.iconId === entry.iconId && item.name === entry.name,
      );
      const marker = matchingMarkers[0];
      const popupIconFile = entry.iconId.startsWith("popup:")
        ? `/${entry.iconId.slice("popup:".length)}`
        : undefined;
      const popupCount = popupOccurrenceCounts.get(normalizeItemName(entry.name)) ?? 0;
      const countedOccurrences =
        (entry.location.includes("地图") ? matchingMarkers.length : 0) +
        (entry.location.includes("弹窗") ? popupCount : 0);
      let entryCount = countedOccurrences > 0 ? countedOccurrences : 1;
      if (
        entry.primary === "收集物" &&
        entry.secondary === "国王之魂碎片"
      ) {
        entryCount = countedKingsoulFragments ? 0 : 2;
        countedKingsoulFragments = true;
      }
      if (
        entry.primary === "NPC" &&
        entry.secondary === "对话型NPC" &&
        (entry.name === "阿布(Cloth)" || entry.name === "奎若(Quirrel)")
      ) {
        entryCount = 1;
      }
      if (entry.primary === "NPC" && entry.secondary === "多结局NPC") {
        const characterKey = entry.name.includes("左特")
          ? "左特"
          : normalizeItemName(entry.name);
        entryCount = countedMultiEndingCharacters.has(characterKey) ? 0 : 1;
        countedMultiEndingCharacters.add(characterKey);
      }
      if (
        entry.primary === "NPC" &&
        entry.secondary === "任务型NPC" &&
        entry.name.includes("左特")
      ) {
        const characterKey = "左特";
        entryCount = countedTaskNpcCharacters.has(characterKey) ? 0 : 1;
        countedTaskNpcCharacters.add(characterKey);
      }
      const iconOverride =
        FILTER_CATEGORY_ICON_OVERRIDES[`${entry.primary}\u0000${entry.secondary}`];
      secondary.set(entry.secondary, {
        name: entry.secondary,
        count: (current?.count ?? 0) + entryCount,
        iconFile:
          iconOverride?.iconFile ??
          current?.iconFile ??
          (marker
            ? decodeURIComponent(marker.iconFile).replace(/^\.\//, "/")
            : popupIconFile),
        iconScale: iconOverride?.iconScale ?? current?.iconScale,
      });
    }
    groups.set(
      "区域",
      new Map(
        regionInfos
          .filter((region) => !region.parent)
          .map((region) => [
            region.name,
            {
              name: region.name,
              count:
                markers.filter((marker) => marker.region === region.name).length +
                1 +
                regionInfos.filter((candidate) => candidate.parent === region.name)
                  .length,
              iconFile: "/filter-icons/region-map-quill.png",
              iconScale: 0.82,
            },
          ]),
      ),
    );
    return [...groups.entries()].map(([primary, secondaryMap]) => ({
      primary,
      secondary: [...secondaryMap.values()].sort(
        (left, right) => right.count - left.count,
      ),
    }));
  }, [classification.entries, markers, regionInfos]);

  const normalizedSearch = normalizedFocusSearch;
  const categoryVisibleMarkers = useMemo(() => {
    const selectedCategoryKeys = (categoryFilter?.secondaries ?? []).filter(
      (key) => !key.startsWith("区域\u0000"),
    );
    const selectedRegionNames = new Set(
      (categoryFilter?.secondaries ?? [])
        .filter((key) => key.startsWith("区域\u0000"))
        .map((key) => key.split("\u0000")[1]),
    );
    const hasMarkerCategoryFilter = selectedCategoryKeys.length > 0;
    const hasRegionFilter = selectedRegionNames.size > 0;
    if (!hasMarkerCategoryFilter && !hasRegionFilter && !normalizedSearch) return markers;

    const isCorniferMerchantFilter =
      selectedCategoryKeys.includes("NPC\u0000商人") &&
      !selectedCategoryKeys.includes("地点\u0000地图");
    const categoryMatchedEntries = classification.entries.filter((entry) => {
      return !hasMarkerCategoryFilter ||
        selectedCategoryKeys.includes(`${entry.primary}\u0000${entry.secondary}`);
    });
    const categoryMatchedKeys = new Set(
      categoryMatchedEntries.map((entry) => `${entry.iconId}\u0000${entry.name}`),
    );
    const categoryMatchedNames = new Set(
      categoryMatchedEntries.map((entry) => normalizeItemName(entry.name)),
    );
    const isKingsoulFragmentCategorySelected = selectedCategoryKeys.includes(
      "收集物\u0000国王之魂碎片",
    );
    const categoryMatchesPopupItem = (itemName: string) => {
      const normalizedItemName = normalizeItemName(itemName);
      if (normalizedItemName === "国王之魂") {
        return isKingsoulFragmentCategorySelected;
      }
      return categoryMatchedNames.has(normalizedItemName);
    };
    const categoryRelatedOwnerIds = new Set(
      classification.relations
        .filter((relation) => categoryMatchesPopupItem(relation.itemName))
        .map((relation) => relation.ownerIconId),
    );
    const searchMatchedEntries = normalizedSearch
      ? classification.entries.filter((entry) =>
          [entry.name, entry.primary, entry.secondary].some((value) =>
            normalizeItemName(value ?? "")
              .toLocaleLowerCase("zh-CN")
              .includes(normalizedSearch),
          ),
        )
      : [];
    const searchMatchedKeys = new Set(
      searchMatchedEntries.map((entry) => `${entry.iconId}\u0000${entry.name}`),
    );
    const searchMatchedNames = new Set(
      searchMatchedEntries.map((entry) => normalizeItemName(entry.name)),
    );
    const isKingsoulFragmentSearchMatch =
      "国王之魂".includes(normalizedSearch) ||
      searchMatchedEntries.some(
        (entry) =>
          entry.primary === "收集物" &&
          entry.secondary === "国王之魂碎片",
      );
    const searchMatchesPopupItem = (itemName: string) => {
      const normalizedItemName = normalizeItemName(itemName);
      if (normalizedItemName === "国王之魂") {
        return isKingsoulFragmentSearchMatch;
      }
      return searchMatchedNames.has(normalizedItemName);
    };
    const searchRelatedOwnerIds = new Set(
      classification.relations
        .filter((relation) => searchMatchesPopupItem(relation.itemName))
        .map((relation) => relation.ownerIconId),
    );

    const matchedMarkers = markers.filter((marker) => {
      if (hasRegionFilter && (!marker.region || !selectedRegionNames.has(marker.region))) {
        return false;
      }
      const categoryMatches = !hasMarkerCategoryFilter ||
        categoryMatchedKeys.has(`${marker.iconId}\u0000${marker.name}`) ||
        (!INFORMATION_ONLY_MARKER_IDS.has(marker.id) &&
          categoryRelatedOwnerIds.has(marker.iconId)) ||
        getPopupEmbeddedItemIcons(marker.name).some((icon) =>
          categoryMatchesPopupItem(icon.alt),
        );
      if (!categoryMatches) return false;
      if (
        isCorniferMerchantFilter &&
        marker.iconId === CORNIFER_ICON_ID &&
        (marker.x !== 44.282 || marker.y !== 30.153)
      ) {
        return false;
      }
      if (!normalizedSearch) return true;

      if (
        searchMatchedKeys.has(`${marker.iconId}\u0000${marker.name}`) ||
        (!INFORMATION_ONLY_MARKER_IDS.has(marker.id) &&
          searchRelatedOwnerIds.has(marker.iconId)) ||
        getPopupEmbeddedItemIcons(marker.name).some((icon) =>
          searchMatchesPopupItem(icon.alt),
        )
      ) {
        return true;
      }

      if (marker.name.toLocaleLowerCase("zh-CN").includes(normalizedSearch)) {
        return true;
      }

      if (
        getPopupEmbeddedItemIcons(marker.name).some((icon) =>
          icon.alt.toLocaleLowerCase("zh-CN").includes(normalizedSearch),
        )
      ) {
        return true;
      }

      const popupMatches = !INFORMATION_ONLY_MARKER_IDS.has(marker.id) &&
        (MERCHANT_OFFERS[marker.iconId] ?? []).some(
          (section) =>
            section.offers.some((offer) =>
              [
                offer.name,
                offer.rewardIconLabel,
                offer.requiredItem?.label,
                offer.materialCost?.label,
              ]
                .filter(Boolean)
                .some((text) =>
                  text!.toLocaleLowerCase("zh-CN").includes(normalizedSearch),
                ),
            ),
      );
      if (popupMatches) return true;

      return !INFORMATION_ONLY_MARKER_IDS.has(marker.id) &&
        classification.relations.some(
          (relation) =>
            relation.ownerIconId === marker.iconId &&
            relation.itemName
              .toLocaleLowerCase("zh-CN")
              .includes(normalizedSearch),
        );
    });

    const markerVisitNumbers = matchedMarkers.map(getMarkerVisitNumber);
    const numberedMarkerCount = markerVisitNumbers.filter(
      (visitNumber) => visitNumber !== null,
    ).length;
    const hasOneSharedMarkerName =
      new Set(matchedMarkers.map((marker) => marker.name)).size === 1;
    if (
      matchedMarkers.length > 1 &&
      numberedMarkerCount > 1 &&
      hasOneSharedMarkerName
    ) {
      return [...matchedMarkers].sort(
        (left, right) =>
          (getMarkerVisitNumber(left) ?? Number.MAX_SAFE_INTEGER) -
          (getMarkerVisitNumber(right) ?? Number.MAX_SAFE_INTEGER),
      );
    }

    return matchedMarkers;
  }, [categoryFilter, classification, markers, normalizedSearch]);

  const visibleMarkers = useMemo(
    () => filterMarkersBySaveState(categoryVisibleMarkers, selectedSaveDetail, saveFilterMode),
    [categoryVisibleMarkers, saveFilterMode, selectedSaveDetail],
  );

  const renderedMarkers = useMemo(() => {
    if (
      !glowFocusMarkerId ||
      visibleMarkers.some((marker) => marker.id === glowFocusMarkerId)
    ) {
      return visibleMarkers;
    }
    const focusedMarker = markers.find(
      (marker) => marker.id === glowFocusMarkerId,
    );
    return focusedMarker ? [...visibleMarkers, focusedMarker] : visibleMarkers;
  }, [glowFocusMarkerId, markers, visibleMarkers]);

  const visibleRegionFocusMarkers = useMemo<Marker[]>(() => {
    if (activeRegionNames.size === 0) return [];
    return allRegionChineseLabels.flatMap((label) => {
      const region = regionInfoByName.get(label.name);
      const layout = regionLabelLayouts[`text:${label.name}`];
      if (
        !region ||
        !layout ||
        (!activeRegionNames.has(region.name) &&
          (!region.parent || !activeRegionNames.has(region.parent)))
      ) {
        return [];
      }
      return [{
        id: `region:${region.name}`,
        name: `${region.name}(${region.englishName})`,
        iconId: `region:${region.name}`,
        iconFile: "",
        category: region.parent ?? "区域",
        description: region.parent
          ? [region.highlight, region.description].filter(Boolean).join("\n")
          : region.description,
        x: layout.x,
        y: layout.y,
        size: Math.max(layout.size, 18),
        highlight: !region.parent && region.highlight
          ? { text: region.highlight, iconFiles: [] }
          : undefined,
      }];
    });
  }, [activeRegionNames, allRegionChineseLabels, regionInfoByName, regionLabelLayouts]);

  const focusNavigationItems = useMemo(
    () => [...visibleMarkers, ...visibleRegionFocusMarkers],
    [visibleMarkers, visibleRegionFocusMarkers],
  );

  const fitMarkersInView = useCallback(
    (targetMarkers: Marker[]) => {
      const viewport = viewportRef.current;
      if (!viewport || targetMarkers.length === 0) return;

      const padding = 110;
      const minX = Math.min(...targetMarkers.map((marker) => (marker.x / 100) * MAP_WIDTH));
      const maxX = Math.max(...targetMarkers.map((marker) => (marker.x / 100) * MAP_WIDTH));
      const minY = Math.min(...targetMarkers.map((marker) => (marker.y / 100) * MAP_HEIGHT));
      const maxY = Math.max(...targetMarkers.map((marker) => (marker.y / 100) * MAP_HEIGHT));
      const contentWidth = Math.max(1, maxX - minX);
      const contentHeight = Math.max(1, maxY - minY);
      const nextScale = Math.min(
        MAX_SCALE,
        minimumScaleRef.current * AUTO_FOCUS_MAX_SCALE_FACTOR,
        Math.max(
          minimumScaleRef.current,
          Math.min(
            (viewport.clientWidth - padding * 2) / contentWidth,
            (viewport.clientHeight - padding * 2) / contentHeight,
          ),
        ),
      );
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      if (focusNavigationTimerRef.current !== null) {
        window.clearTimeout(focusNavigationTimerRef.current);
      }
      setSmoothFocusMoving(true);
      updateTransform({
        scale: nextScale,
        x: viewport.clientWidth / 2 - centerX * nextScale,
        y: viewport.clientHeight / 2 - centerY * nextScale,
      });
      focusNavigationTimerRef.current = window.setTimeout(() => {
        setSmoothFocusMoving(false);
        focusNavigationTimerRef.current = null;
      }, FOCUS_TRANSITION_MS);
    },
    [updateTransform],
  );

  const focusMaskFragment = useCallback(
    (nextIndex: number, forcePopup = false) => {
      const viewport = viewportRef.current;
      if (!viewport || focusNavigationItems.length === 0) return;
      const normalizedIndex =
        (nextIndex + focusNavigationItems.length) % focusNavigationItems.length;
      const marker = focusNavigationItems[normalizedIndex];
      const nextScale = Math.min(
        MAX_SCALE,
        minimumScaleRef.current * AUTO_FOCUS_MAX_SCALE_FACTOR,
      );
      if (focusNavigationTimerRef.current !== null) {
        window.clearTimeout(focusNavigationTimerRef.current);
      }
      setSelectedMarker(null);
      setSmoothFocusMoving(true);
      updateTransform({
        scale: nextScale,
        x: viewport.clientWidth / 2 - (marker.x / 100) * MAP_WIDTH * nextScale,
        y: viewport.clientHeight / 2 - (marker.y / 100) * MAP_HEIGHT * nextScale,
      });
      setMaskFragmentCursor(normalizedIndex);
      focusNavigationTimerRef.current = window.setTimeout(() => {
        setSmoothFocusMoving(false);
        if (forcePopup) {
          setSelectedMarker(marker);
          setPopupTab(
            !INFORMATION_ONLY_MARKER_IDS.has(marker.id) &&
              MERCHANT_OFFERS[marker.iconId]?.length
              ? "offers"
              : "description",
          );
        } else if (markerHasPopupContent(marker)) {
          openMarker(marker);
        }
        focusNavigationTimerRef.current = null;
      }, FOCUS_TRANSITION_MS);
    },
    [focusNavigationItems, updateTransform],
  );

  useEffect(
    () => () => {
      if (focusNavigationTimerRef.current !== null) {
        window.clearTimeout(focusNavigationTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isMaskFragmentFocus || focusNavigationItems.length === 0) return;
    setMaskFragmentCursor(0);
    setSelectedMarker(null);
    if (visibleMarkers.length === 1 || focusNavigationItems.length === 1) {
      focusMaskFragment(0, true);
      return;
    }
    fitMarkersInView(focusNavigationItems);
  }, [
    isMaskFragmentFocus,
    normalizedFocusSearch,
    visibleMarkers.length,
    focusNavigationItems,
    fitMarkersInView,
    focusMaskFragment,
  ]);

  useEffect(() => {
    if (
      selectedMarker &&
      !selectedMarker.id.startsWith("region:") &&
      !renderedMarkers.some((marker) => marker.id === selectedMarker.id)
    ) {
      setSelectedMarker(null);
    }
  }, [renderedMarkers, selectedMarker]);

  const toggleSecondaryCategory = (primary: string, secondary: string) => {
    const selectionKey = `${primary}\u0000${secondary}`;
    setCategoryFilter((current) => {
      const selected = new Set(current?.secondaries ?? []);
      if (selected.has(selectionKey)) {
        selected.delete(selectionKey);
      } else {
        selected.add(selectionKey);
      }
      return selected.size > 0
        ? { secondaries: [...selected] }
        : null;
    });
  };

  const resetFilters = () => {
    setIsResettingFilters(true);
    setCategoryFilter(null);
    setSearchInput("");
    setSearchQuery("");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsResettingFilters(false));
    });
  };

  const openMarker = (marker: Marker) => {
    setSelectedMarker(marker);
    setPopupTab(
      !INFORMATION_ONLY_MARKER_IDS.has(marker.id) &&
        MERCHANT_OFFERS[marker.iconId]?.length
        ? "offers"
        : "description",
    );
  };

  const openRegionLabel = (region: RegionInfo, layout: RegionLabelLayout) => {
    setSelectedMarker({
      id: `region:${region.name}`,
      name: `${region.name}(${region.englishName})`,
      iconId: `region:${region.name}`,
      iconFile: "",
      category: region.parent ?? "区域",
      description: region.parent
        ? [region.highlight, region.description].filter(Boolean).join("\n")
        : region.description,
      x: layout.x,
      y: layout.y,
      size: Math.max(layout.size, 18),
      highlight: !region.parent && region.highlight
        ? { text: region.highlight, iconFiles: [] }
        : undefined,
    });
    setPopupTab("description");
  };

  const getPopupAwareTransform = (
    percentX: number,
    percentY: number,
    nextScale: number,
  ) => {
    const viewport = viewportRef.current;
    if (!viewport) return { x: 0, y: 0 };
    const margin = 12;
    const popupHeight = Math.min(400, viewport.clientHeight - 32);
    const markerScreenHalf = 24 * nextScale;

    // 水平：目标点尽量居中，但保证图标本体留在视口内
    const targetScreenX = Math.min(
      Math.max(viewport.clientWidth / 2, margin + markerScreenHalf),
      viewport.clientWidth - margin - markerScreenHalf,
    );

    // 垂直：优先让弹窗（默认显示在图标上方）完整可见
    const minYForPopupAbove = margin + markerScreenHalf + 14 + popupHeight;
    const maxMarkerY = viewport.clientHeight - margin - markerScreenHalf;
    let targetScreenY = Math.min(
      maxMarkerY,
      Math.max(viewport.clientHeight * 0.6, minYForPopupAbove),
    );
    if (minYForPopupAbove > maxMarkerY) {
      // 视口太矮，上方放不下，把图标放到顶部触发弹窗向下显示
      targetScreenY = margin + markerScreenHalf;
    }

    return {
      x: targetScreenX - (percentX / 100) * MAP_WIDTH * nextScale,
      y: targetScreenY - (percentY / 100) * MAP_HEIGHT * nextScale,
    };
  };

  const focusAndOpenMarker = (marker: Marker) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextScale = Math.min(
      MAX_SCALE,
      minimumScaleRef.current * AUTO_FOCUS_MAX_SCALE_FACTOR,
    );
    if (focusNavigationTimerRef.current !== null) {
      window.clearTimeout(focusNavigationTimerRef.current);
    }
    setSelectedMarker(null);
    setSmoothFocusMoving(true);
    const focused = getPopupAwareTransform(marker.x, marker.y, nextScale);
    updateTransform({ scale: nextScale, ...focused });
    focusNavigationTimerRef.current = window.setTimeout(() => {
      setSmoothFocusMoving(false);
      openMarker(marker);
      focusNavigationTimerRef.current = null;
    }, FOCUS_TRANSITION_MS);
  };

  const focusAndOpenRegion = (regionName: string) => {
    const viewport = viewportRef.current;
    const region = regionInfoByName.get(regionName);
    const layout = regionLabelLayouts[`text:${regionName}`];
    if (!viewport || !region || !layout) return;
    const nextScale = Math.min(
      MAX_SCALE,
      minimumScaleRef.current * AUTO_FOCUS_MAX_SCALE_FACTOR,
    );
    if (focusNavigationTimerRef.current !== null) {
      window.clearTimeout(focusNavigationTimerRef.current);
    }
    setSelectedMarker(null);
    setSmoothFocusMoving(true);
    const focused = getPopupAwareTransform(layout.x, layout.y, nextScale);
    updateTransform({ scale: nextScale, ...focused });
    focusNavigationTimerRef.current = window.setTimeout(() => {
      setSmoothFocusMoving(false);
      openRegionLabel(region, layout);
      focusNavigationTimerRef.current = null;
    }, FOCUS_TRANSITION_MS);
  };

  const handlePopupTextLink = (target: PopupTextLinkTarget) => {
    const sourceMarker = selectedMarker;
    if (target.type === "marker") {
      const marker = markers.find((candidate) => candidate.id === target.markerId);
      if (marker) {
        setPopupLinkSource(sourceMarker);
        setPopupLinkFocus(null);
        setGlowFocusMarkerId(marker.id);
        setGlowFocusRegionName(null);
        focusAndOpenMarker(marker);
      }
      return;
    }
    if (target.type === "region") {
      setPopupLinkSource(sourceMarker);
      setPopupLinkFocus(null);
      setGlowFocusMarkerId(null);
      setGlowFocusRegionName(target.regionName);
      focusAndOpenRegion(target.regionName);
      return;
    }
    const owner = markers.find(
      (candidate) => candidate.id === target.ownerMarkerId,
    );
    if (!owner) return;
    setPopupLinkSource(sourceMarker);
    setPopupLinkFocus({
      itemName: target.itemName,
      ownerMarkerId: owner.id,
    });
    setGlowFocusMarkerId(owner.id);
    setGlowFocusRegionName(null);
    focusAndOpenMarker(owner);
  };

  const handleReturnFromPopupLink = () => {
    if (!popupLinkSource) return;
    const source = popupLinkSource;
    setGlowFocusMarkerId(null);
    setGlowFocusRegionName(null);
    setPopupLinkSource(null);
    setPopupLinkFocus(null);
    focusAndOpenMarker(source);
  };

  const renderPopupLinkedText = (text: string) => {
    if (popupTextLinks.length === 0) return text;
    const currentMarkerName = selectedMarker
      ? normalizeItemName(selectedMarker.name)
      : "";
    const names = popupTextLinks
      .filter((link) => link.name !== currentMarkerName)
      .map((link) => link.name);
    if (names.length === 0) return text;
    const pattern = names.map(escapeRegExp).join("|");
    const parts = text.split(new RegExp(`(${pattern})`, "g"));
    return parts.map((part, index) => {
      const target = popupTextLinkByName.get(part);
      return target ? (
        <button
          type="button"
          className="marker-description-internal-link"
          onClick={() => handlePopupTextLink(target)}
          key={`${part}-${index}`}
        >
          {part}
        </button>
      ) : (
        <span key={`${part.slice(0, 12)}-${index}`}>{part}</span>
      );
    });
  };

  return (
    <main
      ref={viewportRef}
      className={`map-viewport${dragging ? " is-dragging" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onWheel={handleWheel}
      aria-label="空洞骑士地图"
    >
      <input
        ref={saveInputRef}
        className="save-directory-input"
        type="file"
        multiple
        aria-label="选择空洞骑士存档目录"
        onChange={handleSaveInputChange}
      />
      <button
        type="button"
        className={`map-filter-toggle${filterCollapsed ? " is-collapsed" : ""}`}
        aria-label={filterCollapsed ? "展开筛选栏" : "收起筛选栏"}
        aria-expanded={!filterCollapsed}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => setFilterCollapsed((current) => !current)}
      >
        <span aria-hidden="true">{filterCollapsed ? "›" : "‹"}</span>
      </button>
      <aside
        className={`map-filter-panel${filterCollapsed ? " is-collapsed" : ""}${isResettingFilters ? " is-resetting-filters" : ""}`}
        aria-label="地图图标筛选"
        onPointerDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        <div className="map-filter-logo" aria-hidden="true">
          <img src="/assets/hollow-knight-logo.png" alt="" />
        </div>
        <header className="map-filter-header">
          <div>
            <h1>图标筛选</h1>
          </div>
          <div className="map-filter-header-actions">
            <p>当前显示 {visibleMarkers.length}/{markers.length}</p>
          </div>
        </header>
        <div className="map-filter-search">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setSearchQuery(searchInput);
              }
            }}
            placeholder="搜索图标、物品或分类名称"
            aria-label="搜索图标、物品或分类名称"
          />
          <button
            type="button"
            className="map-filter-search-submit map-filter-text-action"
            aria-label="确认搜索"
            onClick={() => setSearchQuery(searchInput)}
          >
            搜索
          </button>
        </div>
        <div className="map-filter-save-panel">
          <div className="map-filter-save-heading">
            <div>
              <strong>存档进度</strong>
              <span>{saveSlots.length > 0 ? "选择槽位后筛选地图" : "导入本地存档以同步收集状态"}</span>
            </div>
            <button
              type="button"
              className="map-filter-save-upload"
              onClick={() => saveInputRef.current?.click()}
            >
              {saveSlots.length > 0 ? "重新导入" : "导入存档"}
            </button>
          </div>
          {saveSlots.length > 0 && (
            <div className="map-filter-save-slots" role="group" aria-label="选择存档槽位">
              {saveSlots.map((slot) => (
                <button
                  type="button"
                  key={slot.slotId}
                  className={selectedSaveSlot === slot.slotId ? "is-active" : ""}
                  aria-pressed={selectedSaveSlot === slot.slotId}
                  onClick={() => setSelectedSaveSlot(slot.slotId)}
                >
                  槽位 {slot.slotNumber}
                </button>
              ))}
            </div>
          )}
          {saveError && <p className="map-filter-save-error">{saveError}</p>}
          {saveFailures.length > 0 && (
            <p className="map-filter-save-error">
              {saveFailures.map((failure) => `槽位 ${failure.slot} 无法解析`).join("；")}
            </p>
          )}
        </div>
        <div className="map-filter-completion-tabs" aria-label="完成状态筛选">
          {(["all", "collected", "missing"] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                className={saveFilterMode === mode ? "is-active" : ""}
                aria-pressed={saveFilterMode === mode}
                disabled={mode !== "all" && saveSlots.length === 0}
                title={mode !== "all" && saveSlots.length === 0 ? "请先导入存档" : undefined}
                onClick={() => {
                  if (mode === "all") resetFilters();
                  setSaveFilterMode(mode);
                }}
              >
                {mode === "all" ? "全部" : mode === "collected" ? "已收集" : "未收集"}
              </button>
          ))}
        </div>
        {normalizedSearch && visibleMarkers.length === 0 && (
          <p className="map-filter-search-empty">没有找到搜索内容</p>
        )}
        {isMaskFragmentFocus && focusNavigationItems.length > 0 && (
          <div className="map-filter-focus-nav" aria-label="筛选结果定位">
            <span>
              {normalizedFocusSearch
                ? activeCategoryKeys.length > 0
                  ? `筛选 + “${searchQuery.trim()}”`
                  : `搜索：“${searchQuery.trim()}”`
                : activeCategoryKeys.length === 1
                  ? activeCategoryKeys[0].split("\u0000")[1]
                  : `${activeCategoryKeys.length}类图标`}
            </span>
            <div>
              <button
                type="button"
                className="map-filter-focus-arrow"
                aria-label="上一个筛选结果"
                onClick={() => focusMaskFragment(maskFragmentCursor - 1)}
              >
                ‹
              </button>
              <strong>{maskFragmentCursor + 1}/{focusNavigationItems.length}</strong>
              <button
                type="button"
                className="map-filter-focus-arrow"
                aria-label="下一个筛选结果"
                onClick={() => focusMaskFragment(maskFragmentCursor + 1)}
              >
                ›
              </button>
              <button
                type="button"
                className="map-filter-focus-locate map-filter-text-action"
                onClick={() => focusMaskFragment(maskFragmentCursor)}
              >
                定位
              </button>
            </div>
          </div>
        )}
        <div className="map-filter-categories">
          {categoryGroups.map((group) => (
            <section className="map-filter-category-page" key={group.primary}>
              <header>
                <h2>{group.primary}</h2>
              </header>
              <div className="map-filter-secondary-grid">
                {group.secondary.map((secondary) => (
                  <button
                    type="button"
                    key={secondary.name}
                    className={
                      categoryFilter?.secondaries?.includes(
                        `${group.primary}\u0000${secondary.name}`,
                      )
                        ? "is-active"
                        : ""
                    }
                    aria-pressed={Boolean(
                      categoryFilter?.secondaries?.includes(
                        `${group.primary}\u0000${secondary.name}`,
                      ),
                    )}
                    onClick={() =>
                      toggleSecondaryCategory(group.primary, secondary.name)
                    }
                  >
                    <span className="map-filter-secondary-icon">
                      {secondary.iconFile ? (
                        <img
                          src={secondary.iconFile}
                          alt=""
                          draggable={false}
                          style={
                            secondary.iconScale
                              ? { transform: `scale(${secondary.iconScale})` }
                              : undefined
                          }
                        />
                      ) : (
                        <span aria-hidden="true">◇</span>
                      )}
                    </span>
                    <span className="map-filter-secondary-copy">
                      <strong>{secondary.name}</strong>
                      <small>{secondary.count}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        {categoryFilter && !normalizedSearch && visibleMarkers.length === 0 && (
          <p className="map-filter-empty">没有找到符合条件的图标</p>
        )}
      </aside>
      <div
        className={`map-canvas${smoothFocusMoving ? " is-smooth-focus-moving" : ""}`}
        style={
          {
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
            "--region-handle-size": `${10 / transform.scale}px`,
            "--region-handle-border": `${1 / transform.scale}px`,
            "--region-handle-glow": `${5 / transform.scale}px`,
          } as React.CSSProperties
        }
      >
        <img
          className="hallownest-map"
          src="/assets/hallownest-map.png"
          alt="空洞骑士圣巢地图"
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          draggable={false}
        />
        <div className="map-region-label-layer" aria-label="区域名称层">
          {MAP_REGION_LABELS.map((region) => {
            const labelId = `image:${region.name}`;
            const layout = regionLabelLayouts[labelId];
            if (!layout || (activeRegionNames.size > 0 && !activeRegionNames.has(region.name))) return null;
            return (
              <div
                key={labelId}
                className={`map-region-label-editor map-region-label-visual is-image has-hover-highlight${activeRegionNames.has(region.name) ? " is-region-filter-focus" : ""}${hoveredRegionLabelName === region.name ? " is-hover-highlighted" : ""}`}
                style={
                  {
                    left: `${layout.x}%`,
                    top: `${layout.y}%`,
                    width: `${layout.size}px`,
                  } as React.CSSProperties
                }
              >
                <img
                  className="map-region-label-image"
                  src={`/assets/region-labels/${region.name}.png`}
                  alt={region.name}
                  draggable={false}
                />
              </div>
            );
          })}
          {allRegionChineseLabels.map((region) => {
            const labelId = `text:${region.name}`;
            const layout = regionLabelLayouts[labelId];
            const regionInfo = regionInfoByName.get(region.name);
            const hasMatchedGlow =
              MATCHED_NEW_REGION_LABELS.has(region.name) ||
              !BASE_REGION_LABEL_NAMES.has(region.name);
            const regionParent = regionInfo?.parent;
            const belongsToSelectedRegion =
              activeRegionNames.size === 0 ||
              activeRegionNames.has(region.name) ||
              Boolean(regionParent && activeRegionNames.has(regionParent));
            const isRegionFilterFocus =
              activeRegionNames.size > 0 && belongsToSelectedRegion;
            const isGlowFocusRegion = region.name === glowFocusRegionName;
            if (!layout || (!belongsToSelectedRegion && !isGlowFocusRegion)) return null;
            return (
              <div
                key={labelId}
                className={`map-region-label-editor map-region-label-visual is-text has-hover-highlight${hasMatchedGlow ? " has-matched-region-glow" : ""}${isRegionFilterFocus || isGlowFocusRegion ? " is-region-filter-focus" : ""}${hoveredRegionLabelName === region.name ? " is-hover-highlighted" : ""}`}
                style={
                  {
                    left: `${layout.x}%`,
                    top: `${layout.y}%`,
                    fontSize: `${layout.size}px`,
                    "--region-edge-rgb": getRgbChannels(region.edgeGlow),
                    "--region-fog-rgb": getRgbChannels(region.fogGlow),
                    "--region-stroke-width": "1.5px",
                  } as React.CSSProperties
                }
              >
                {hasMatchedGlow && (
                  <span className="map-region-label-text-haze" aria-hidden="true">
                    {region.name}
                  </span>
                )}
                <span className={hasMatchedGlow ? "map-region-label-text-main" : undefined}>
                  {region.name}
                </span>
              </div>
            );
          })}
          {allRegionChineseLabels.map((region) => {
            const textLayout = regionLabelLayouts[`text:${region.name}`];
            const imageLayout = regionLabelLayouts[`image:${region.name}`];
            const regionInfo = regionInfoByName.get(region.name);
            const regionParent = regionInfo?.parent;
            const belongsToSelectedRegion =
              activeRegionNames.size === 0 ||
              activeRegionNames.has(region.name) ||
              Boolean(regionParent && activeRegionNames.has(regionParent));
            const isGlowFocusRegion = region.name === glowFocusRegionName;
            if (
              !textLayout ||
              !regionInfo ||
              (!belongsToSelectedRegion && !isGlowFocusRegion)
            ) return null;

            const isMajorRegion = !regionInfo.parent && Boolean(imageLayout);
            const centerX = isMajorRegion
              ? (textLayout.x + imageLayout!.x) / 2
              : textLayout.x;
            const centerY = isMajorRegion
              ? (textLayout.y + imageLayout!.y) / 2
              : textLayout.y;
            const positionGapX = isMajorRegion
              ? (Math.abs(textLayout.x - imageLayout!.x) / 100) * MAP_WIDTH
              : 0;
            const positionGapY = isMajorRegion
              ? (Math.abs(textLayout.y - imageLayout!.y) / 100) * MAP_HEIGHT
              : 0;
            const hitWidth = isMajorRegion
              ? Math.max(
                  imageLayout!.size,
                  textLayout.size * region.name.length * 1.25,
                ) + positionGapX
              : textLayout.size * region.name.length * 1.35;
            const hitHeight = isMajorRegion
              ? Math.max(76, textLayout.size * 1.35 + positionGapY)
              : textLayout.size * 1.7;

            return (
              <button
                type="button"
                key={`interaction:${region.name}`}
                className="map-region-label-interaction"
                aria-label={`查看${region.name}区域介绍`}
                onPointerDown={(event) => event.stopPropagation()}
                onPointerEnter={() => setHoveredRegionLabelName(region.name)}
                onPointerLeave={() =>
                  setHoveredRegionLabelName((current) =>
                    current === region.name ? null : current,
                  )
                }
                onFocus={() => setHoveredRegionLabelName(region.name)}
                onBlur={() =>
                  setHoveredRegionLabelName((current) =>
                    current === region.name ? null : current,
                  )
                }
                onClick={() => {
                  setGlowFocusMarkerId(null);
                  setGlowFocusRegionName(null);
                  setPopupLinkSource(null);
                  setPopupLinkFocus(null);
                  openRegionLabel(regionInfo, textLayout);
                }}
                style={{
                  left: `${centerX}%`,
                  top: `${centerY}%`,
                  width: `${hitWidth}px`,
                  height: `${hitHeight}px`,
                }}
              />
            );
          })}
        </div>
        <div className="marker-layer">
          {renderedMarkers.map((marker) => {
            const markerClassifications = classification.entries.filter(
              (entry) =>
                entry.iconId === marker.iconId && entry.name === marker.name,
            );
            const markerPrimaryCategory =
              markerClassifications.find((entry) => entry.primary === "Boss")
                ?.primary ??
              markerClassifications[0]?.primary ??
              classification.entries.find(
                (entry) => entry.iconId === marker.iconId,
              )?.primary;
            const glowColors = getMarkerGlowColors(marker, markerPrimaryCategory);
            const isGlowFocus = marker.id === glowFocusMarkerId;
            const effectiveGlowColors =
              glowColors ??
              (activeRegionNames.size > 0 || isGlowFocus
                ? { core: "235, 244, 255", haze: "154, 190, 225" }
                : null);
            const isCurrentFilterFocus =
              isMaskFragmentFocus &&
              marker.id === visibleMarkers[maskFragmentCursor]?.id;
            const showBreathingGlow =
              (isGlowFocus ||
                (isMaskFragmentFocus &&
                  (visibleMarkers.length <= MAX_BATCH_BREATHING_GLOW_MARKERS ||
                    isCurrentFilterFocus))) &&
              Boolean(effectiveGlowColors);
            const markerVisitNumber = getMarkerVisitNumber(marker);
            return (
              <button
              key={marker.id}
              type="button"
              className={`map-marker-button${isSingleCategoryFocus ? " is-filter-focus" : ""}${showBreathingGlow ? " has-breathing-glow" : ""}${isCurrentFilterFocus ? " is-current-focus" : ""}`}
              aria-label={`查看${marker.name}的描述`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                setGlowFocusMarkerId(null);
                setGlowFocusRegionName(null);
                setPopupLinkSource(null);
                setPopupLinkFocus(null);
                openMarker(marker);
              }}
              style={
                {
                  left: `${marker.x}%`,
                  top: `${marker.y}%`,
                  width: `${marker.size}px`,
                  ...(effectiveGlowColors
                    ? {
                        "--marker-glow-core": effectiveGlowColors.core,
                        "--marker-glow-haze": effectiveGlowColors.haze,
                      }
                    : {}),
                } as React.CSSProperties
              }
            >
              <img
                className={`map-marker${marker.category === "BOSS" ? " is-boss" : ""}${marker.category === "技能" || marker.category === "剑技" ? " is-ability" : ""}${marker.category === "地标+npc" ? " is-landmark" : ""}${marker.category === "护符+护符槽图标" ? " is-charm" : ""}`}
                src={decodeURIComponent(marker.iconFile).replace(/^\.\//, "/")}
                alt=""
                draggable={false}
                onLoad={(event) => {
                  const image = event.currentTarget;
                  if (!image.naturalWidth || !image.naturalHeight) return;
                  const nextRatio = image.naturalHeight / image.naturalWidth;
                  if (markerAspectRatiosRef.current.get(marker.id) === nextRatio) return;
                  markerAspectRatiosRef.current.set(marker.id, nextRatio);
                  if (selectedMarker?.id === marker.id) {
                    setMarkerMetricsVersion((version) => version + 1);
                  }
                }}
                style={{ filter: getMarkerGlow(marker, markerPrimaryCategory) }}
              />
              {showBreathingGlow && (
                <img
                  className="map-marker map-marker-glow-overlay"
                  src={decodeURIComponent(marker.iconFile).replace(/^\.\//, "/")}
                  alt=""
                  draggable={false}
                  aria-hidden="true"
                />
              )}
              {markerVisitNumber !== null && (
                <span className="mister-mushroom-visit-number" aria-hidden="true">
                  {markerVisitNumber}
                </span>
              )}
              </button>
            );
          })}
        </div>
      </div>
      {selectedMarker && popupPosition && (
        <section
          className={`marker-popup${popupPosition.showBelow ? " is-below" : ""}`}
          style={
            {
              left: `${popupPosition.left}px`,
              top: `${popupPosition.top}px`,
              "--popup-arrow-offset": `${popupPosition.arrowOffset}px`,
            } as React.CSSProperties
          }
          aria-live="polite"
          onPointerDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <span className="marker-popup-pointer" aria-hidden="true" />
          <header className="marker-popup-header">
            {selectedClassification?.primary === "Boss" &&
              completedMarkerIds.has(selectedMarker.id) && (
                <span
                  className="marker-popup-boss-completed-stamp-clip"
                  aria-hidden="true"
                >
                  <img
                    className="marker-popup-boss-completed-stamp"
                    src="/assets/completed-stamp.png"
                    alt=""
                    draggable={false}
                  />
                </span>
              )}
            <div className="marker-popup-heading">
              <div className="marker-popup-title-line">
                <div className="marker-popup-title-and-tags">
                  <h2>{selectedMarker.name}</h2>
                  <span className="marker-popup-title-tag-gap"> </span>
                  {selectedCategoryLabels.length > 0 && (
                    <span className="marker-popup-category-tags">
                      {selectedCategoryLabels.map((label) => (
                        <span className="marker-popup-category-tag" key={label}>
                          {label}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
                {selectedMarkerSupportsCompletion &&
                  selectedClassification?.primary !== "Boss" &&
                  selectedSecondaryCompletionGroup.length > 1 && (
                    <span className="marker-popup-header-progress">
                      完成进度 {selectedSecondaryCompletedCount}/
                      {selectedSecondaryCompletionGroup.length}
                    </span>
                  )}
              </div>
            </div>
            <button
              type="button"
              className="marker-popup-close"
              aria-label="关闭描述"
              onClick={closeSelectedMarker}
            >
              ×
            </button>
          </header>
          {popupLinkSource &&
            selectedMarker &&
            selectedMarker.id !== popupLinkSource.id && (
              <button
                type="button"
                className="marker-popup-back-breadcrumb"
                onClick={handleReturnFromPopupLink}
              >
                <span className="marker-popup-back-arrow" aria-hidden="true">
                  ←
                </span>
                <span>返回：{popupLinkSource.name}</span>
              </button>
            )}
          {selectedMerchantSections.length > 0 && !shouldFilterPopupContents && (
            <nav className="marker-popup-tabs" aria-label="弹窗内容">
              <button
                type="button"
                className={popupTab === "offers" ? "is-active" : ""}
                aria-pressed={popupTab === "offers"}
                onClick={() => setPopupTab("offers")}
              >
                {OFFER_TAB_LABELS[selectedMarker.iconId] ?? "出售商品"}
              </button>
              <button
                type="button"
                className={popupTab === "description" ? "is-active" : ""}
                aria-pressed={popupTab === "description"}
                onClick={() => setPopupTab("description")}
              >
                人物介绍
              </button>
            </nav>
          )}
          <div className="marker-popup-content">
            {(selectedMerchantSections.length === 0 || popupTab === "description") &&
              (!hideUnmatchedDescription || Boolean(selectedPopupHighlight)) && (
              <div
                className={`marker-description${selectedDescriptionParagraphs.length || selectedPopupHighlight || selectedImageGuide ? "" : " is-empty"}`}
              >
                {selectedPopupHighlight && (
                  <aside
                    className={`marker-description-highlight${selectedHighlightLeadingIcon ? " has-leading-icon" : ""}${selectedHighlightLeadingIcon?.displaySize === "small" ? " has-small-leading-icon" : ""}${selectedHighlightLeadingIcon?.alt === "面具碎片" ? " has-compact-leading-icon" : ""}${shouldFilterPopupContents ? " without-divider" : ""}`}
                    aria-label="重要描述"
                  >
                    {selectedHighlightLeadingIcon && (
                      <img
                        className={`marker-description-highlight-icon${getPopupItemGlowClass(selectedHighlightLeadingIcon.alt, selectedHighlightLeadingIcon.src)}`}
                        src={selectedHighlightLeadingIcon.src}
                        alt={selectedHighlightLeadingIcon.alt}
                      />
                    )}
                    <p>
                      {selectedPopupHighlight.text
                        .split("[GEO]")
                        .map((part, partIndex, parts) => (
                          <span key={`${partIndex}-${part.slice(0, 8)}`}>
                            {renderPopupLinkedText(part)}
                            {partIndex < parts.length - 1 && (
                              <img
                                className="marker-description-geo-icon"
                                src="/assets/geo.png"
                                alt="吉欧"
                              />
                            )}
                          </span>
                        ))}
                    </p>
                    {HIGHLIGHT_ITEM_NOTES[selectedMarker.name] && (
                      <div className="marker-highlight-item-note">
                        <img
                          className={`${getPopupItemGlowClass(
                            HIGHLIGHT_ITEM_NOTES[selectedMarker.name].alt,
                            HIGHLIGHT_ITEM_NOTES[selectedMarker.name].src,
                          ).trim()}${HIGHLIGHT_ITEM_NOTES[selectedMarker.name].src.startsWith("/icons/剑技/") ? " is-nail-art" : ""}`}
                          src={HIGHLIGHT_ITEM_NOTES[selectedMarker.name].src}
                          alt={HIGHLIGHT_ITEM_NOTES[selectedMarker.name].alt}
                        />
                        <div>
                          {HIGHLIGHT_ITEM_NOTES[selectedMarker.name].paragraphs.map(
                            (paragraph) => (
                              <p key={paragraph}>
                                {renderPopupLinkedText(paragraph)}
                              </p>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </aside>
                )}
                {!hideUnmatchedDescription && selectedImageGuide && (
                  <section className="marker-image-guide" aria-label="位置图片说明">
                    {selectedImageGuide.note && (
                      <p className="marker-image-guide-note">
                        {renderPopupLinkedText(selectedImageGuide.note)}
                      </p>
                    )}
                    {selectedImageGuide.imageFile && (
                      <button
                        type="button"
                        className="marker-image-guide-preview-button"
                        aria-label="放大查看位置说明图片"
                        onClick={(event) => {
                          previewTriggerRef.current = event.currentTarget;
                          setPreviewImage({
                            src: selectedImageGuide.imageFile!,
                            alt: selectedImageGuide.imageAlt ?? "位置说明",
                          });
                        }}
                      >
                        <img
                          className="marker-image-guide-image"
                          src={selectedImageGuide.imageFile}
                          alt={selectedImageGuide.imageAlt ?? "位置说明"}
                          draggable={false}
                        />
                      </button>
                    )}
                    {selectedDescriptionParagraphs.length > 0 && (
                      <div className="marker-image-guide-divider" aria-hidden="true" />
                    )}
                  </section>
                )}
                {!hideUnmatchedDescription && selectedDescriptionParagraphs.length ? (
                  <>
                    {selectedDescriptionParagraphs.map((paragraph, index) =>
                      paragraph.startsWith("小标题：") ? (
                        <header
                          className="merchant-section-header marker-description-subheading"
                          key={`${index}-${paragraph.slice(0, 12)}`}
                        >
                          <span className="merchant-section-title">
                            {paragraph.slice("小标题：".length).trim()}
                          </span>
                        </header>
                      ) : (
                      <p key={`${index}-${paragraph.slice(0, 12)}`}>
                        {paragraph.split("[GEO]").map((part, partIndex, parts) => (
                          <span key={`${partIndex}-${part.slice(0, 8)}`}>
                            {renderPopupLinkedText(part)}
                            {partIndex < parts.length - 1 && (
                              <img
                                className="marker-description-geo-icon"
                                src="/assets/geo.png"
                                alt="吉欧"
                              />
                            )}
                          </span>
                        ))}
                        {(DESCRIPTION_INLINE_ICONS[selectedMarker.id] ??
                          DESCRIPTION_INLINE_ICONS[selectedMarker.name])
                          ?.filter((icon) =>
                            paragraph.includes(icon.paragraphIncludes),
                          )
                          .map((icon) => (
                            <img
                              className="marker-description-inline-icon"
                              src={icon.src}
                              alt={icon.alt}
                              draggable={false}
                              key={icon.src}
                            />
                          ))}
                      </p>
                      ),
                    )}
                    {CHARACTER_DESCRIPTION_SECTIONS[selectedMarker.name] && (
                      <section
                        className="character-description-sections"
                        aria-label="人物介绍章节"
                      >
                        {CHARACTER_DESCRIPTION_SECTIONS[selectedMarker.name].map(
                          (section) => (
                            <section
                              className="character-description-section"
                              key={section.title}
                            >
                              <header className="merchant-section-header">
                                <span className="merchant-section-title">
                                  {section.title}
                                </span>
                              </header>
                              {section.paragraphs.map((paragraph) => (
                                <p key={paragraph}>
                                  {renderPopupLinkedText(paragraph)}
                                </p>
                              ))}
                            </section>
                          ),
                        )}
                      </section>
                    )}
                    {CHARACTER_ENDINGS[selectedMarker.name] && (
                      <section className="character-endings" aria-label="人物结局">
                        {CHARACTER_ENDINGS[selectedMarker.name].map((ending) => (
                          <article className="character-ending" key={ending.title}>
                            <header className="character-ending-heading merchant-section-header">
                              <span className="merchant-section-title">
                                {ending.title}
                              </span>
                              <img src={ending.iconFile} alt="" draggable={false} />
                            </header>
                            <p>{renderPopupLinkedText(ending.description)}</p>
                          </article>
                        ))}
                        {CHARACTER_ENDING_NOTES[selectedMarker.name] && (
                          <p className="character-ending-note">
                            {renderPopupLinkedText(
                              CHARACTER_ENDING_NOTES[selectedMarker.name],
                            )}
                          </p>
                        )}
                      </section>
                    )}
                  </>
                ) : !hideUnmatchedDescription ? (
                  <p>暂无描述</p>
                ) : null}
              </div>
            )}
            {selectedMerchantSections.length > 0 &&
              (popupTab === "offers" || shouldFilterPopupContents) && (
              <section className="merchant-offers" aria-label="出售物品与奖励">
                {selectedMerchantSections.map((section) => (
                    <section className="merchant-offer-section" key={section.title}>
                      {!section.hideHeader && (
                        <>
                          <header className="merchant-section-header">
                            <span className="merchant-section-title">
                              {section.iconFile && (
                                <img src={section.iconFile} alt="" draggable={false} />
                              )}
                              {section.title}
                            </span>
                            {typeof section.unlockPrice === "number" ? (
                              <span
                                className="merchant-section-unlock"
                                aria-label={`解锁需要 ${section.unlockPrice} 吉欧`}
                              >
                                解锁：<strong>{section.unlockPrice}</strong>
                                <img src="/assets/geo.png" alt="吉欧" draggable={false} />
                              </span>
                            ) : (
                              !section.hideCount && <small>{section.offers.length}件</small>
                            )}
                          </header>
                          {section.description && (
                            <p className="merchant-section-description">
                              {renderPopupLinkedText(section.description)}
                            </p>
                          )}
                        </>
                      )}
                      <div
                        className={`merchant-offer-list${section.layout === "price-table" ? " is-price-table" : ""}`}
                      >
                          {section.offers.map((offer) => (
                            <article
                              className={`merchant-offer${offer.geoReward ? " is-reward-row" : ""}`}
                              key={`${section.title}-${offer.name}-${offer.detail ?? offer.price ?? "reward"}`}
                            >
                              {!offer.geoReward && section.layout !== "price-table" && <span className="merchant-offer-icons">
                                {offer.iconFile ? (
                                  <img
                                    className={`merchant-offer-icon${getPopupItemGlowClass(offer.name, offer.iconFile)}`}
                                    src={offer.iconFile}
                                    alt=""
                                    draggable={false}
                                    style={
                                      offer.iconScale || offer.iconRotation
                                        ? {
                                            transform: `${offer.iconRotation ? `rotate(${offer.iconRotation}deg)` : ""} ${offer.iconScale ? `scale(${offer.iconScale})` : ""}`.trim(),
                                          }
                                        : undefined
                                    }
                                  />
                                ) : (
                                  <span
                                    className="merchant-offer-icon-fallback"
                                    aria-hidden="true"
                                  >
                                    灯
                                  </span>
                                )}
                                {offer.secondaryIconFile && (
                                  <img
                                    className={`merchant-offer-icon${getPopupItemGlowClass(offer.name, offer.secondaryIconFile)}`}
                                    src={offer.secondaryIconFile}
                                    alt=""
                                    draggable={false}
                                  />
                                )}
                              </span>}
                              <span className="merchant-offer-name">
                                <strong>{offer.name}</strong>
                                {offer.detail && (
                                  <small>{renderPopupLinkedText(offer.detail)}</small>
                                )}
                              </span>
                              {typeof offer.price === "number" ? (
                                <span
                                  className="merchant-offer-price"
                                  aria-label={
                                    offer.requiredItem
                                      ? `${offer.requiredItem.label}，加 ${offer.price} 吉欧`
                                      : offer.materialCost
                                      ? `${offer.price} 吉欧，加 ${offer.materialCost.amount} 个${offer.materialCost.label}`
                                      : `${offer.price} 吉欧`
                                  }
                                >
                                  {offer.requiredItem && (
                                    <>
                                      <img
                                        className={`merchant-offer-required-item${getPopupItemGlowClass(offer.requiredItem.label, offer.requiredItem.iconFile)}`}
                                        src={offer.requiredItem.iconFile}
                                        alt={offer.requiredItem.label}
                                        draggable={false}
                                      />
                                      <span aria-hidden="true">+</span>
                                    </>
                                  )}
                                  <strong>{offer.price}</strong>
                                  <img src="/assets/geo.png" alt="吉欧" draggable={false} />
                                  {offer.materialCost && (
                                    <>
                                      <span aria-hidden="true">+</span>
                                      <strong>{offer.materialCost.amount}</strong>
                                      <img
                                        className={getPopupItemGlowClass(
                                          offer.materialCost.label,
                                          offer.materialCost.iconFile,
                                        ).trim()}
                                        src={offer.materialCost.iconFile}
                                        alt={offer.materialCost.label}
                                        draggable={false}
                                      />
                                    </>
                                  )}
                                </span>
                              ) : offer.geoReward ? (
                                <span
                                  className="merchant-offer-price merchant-offer-reward"
                                  aria-label={`奖励${offer.rewardIconLabel ? ` ${offer.rewardIconLabel}，加` : ""} ${offer.geoReward} 吉欧`}
                                >
                                  <span>奖励：</span>
                                  {offer.rewardIconFile && (
                                    <>
                                      <img
                                        className={`merchant-offer-reward-item${getPopupItemGlowClass(offer.rewardIconLabel ?? offer.name, offer.rewardIconFile)}`}
                                        src={offer.rewardIconFile}
                                        alt={offer.rewardIconLabel ?? "奖励物品"}
                                        draggable={false}
                                      />
                                      <span aria-hidden="true">+</span>
                                    </>
                                  )}
                                  <strong>{offer.geoReward}</strong>
                                  <img src="/assets/geo.png" alt="吉欧" draggable={false} />
                                </span>
                              ) : typeof offer.requirement === "number" &&
                                section.requirementIconFile ? (
                                <span
                                  className="merchant-offer-price merchant-offer-requirement"
                                  aria-label={`需要收集 ${offer.requirement} ${section.requirementUnitLabel ?? "收集物"}`}
                                >
                                  <strong>{offer.requirement}</strong>
                                  <img
                                    className={getPopupItemGlowClass(
                                      section.requirementUnitLabel ?? "",
                                      section.requirementIconFile,
                                    ).trim()}
                                    src={section.requirementIconFile}
                                    alt=""
                                    draggable={false}
                                  />
                                </span>
                              ) : null}
                            </article>
                          ))}
                      </div>
                    </section>
                ))}
              </section>
            )}
          </div>
        </section>
      )}
      {previewImage && (
        <div
          className="marker-image-preview-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="位置说明图片预览"
          onClick={closePreviewImage}
          onPointerDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              event.preventDefault();
              previewCloseButtonRef.current?.focus();
            }
          }}
        >
          <div
            className="marker-image-preview-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              ref={previewCloseButtonRef}
              className="marker-image-preview-close"
              aria-label="关闭图片预览"
              onClick={closePreviewImage}
            />
            <img
              className="marker-image-preview-image"
              src={previewImage.src}
              alt={previewImage.alt}
              draggable={false}
            />
          </div>
        </div>
      )}
    </main>
  );
}
