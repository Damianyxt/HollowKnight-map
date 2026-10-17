# Parser-MapID 存档状态接入实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** 在 `20260821完整版` 地图应用中恢复本地存档导入，并让工作簿中全部已确认 marker 精确响应 normalized parser 状态。

**架构：** 先扩充独立资料包的 `collectionProgress`，使 129 项收藏品全部进入标准输出；再从工作簿生成带模块信息的显式 marker/entity 映射；地图应用内保存 parser 与映射快照，通过模块专用适配器生成 `collected | missing | unknown`，React 组件只消费这一结果。

**技术栈：** TypeScript、React 19、Node test runner、Python/openpyxl、`aes-js`、vinext。

---

## 文件结构

资料包 `D:\hollow-Knight`：

- 修改：`parser/src/parsers/hollow-knight-collectibles.ts`，输出苍白矿石、护符槽和简单钥匙状态组。
- 创建：`source-scripts/verify-hollow-knight-collection-progress.ts`，用合成 PlayerData/SceneData 验证七类收藏品输出。
- 修改：`docs/parser-contract.md`、`integration/save-output-schema.json`、`checks/verify.ps1`，同步标准输出契约和验证入口。
- 创建：`integration/map-marker-entity-map.csv`，保存展开后的 marker、Parser ID、模块和工作簿组内序号。
- 创建：`scripts/export_parser_mapid_mapping.py`，从工作簿可重复生成并校验 CSV。

地图 worktree `D:\hollow-Knight\.hollow-knight-staging\worktree-20260821-parser`：

- 创建：`app/save-parser/`，浏览器 parser 快照、目录适配器、类型与映射消费层。
- 创建：`app/save-parser/parser-mapid-map.json`，从资料包 CSV 生成的运行时映射快照。
- 创建：`scripts/sync-hollow-knight-save-parser.ps1`，从明确传入的资料包根目录同步 parser、数据和映射快照。
- 创建：`tests/save-parser.test.ts`，验证目录解析、模块状态和复合 marker 聚合。
- 修改：`app/MapViewer.tsx`、`app/globals.css`，接入本地存档、槽位和状态筛选。
- 修改：`package.json`、`package-lock.json`，添加 AES 依赖和 Windows 可执行的验证命令。
- 修改：`tests/rendered-html.test.mjs`，移除失效 starter skeleton 假设并验证当前地图服务端输出。

### 任务 1：让全部收藏品进入 parser 标准输出

**文件：**
- 创建：`source-scripts/verify-hollow-knight-collection-progress.ts`
- 修改：`parser/src/parsers/hollow-knight-collectibles.ts`
- 修改：`docs/parser-contract.md`
- 修改：`integration/save-output-schema.json`
- 修改：`checks/verify.ps1`

- [ ] **步骤 1：编写失败的收藏品输出测试**

构造包含 `dreamReward3`、`salubraNotch1`、`gotLurkerKey` 及对应 scene item 的合成输入，调用 `extractHollowKnightCollectionProgress`，断言输出包含七个固定组：

```ts
assert(progress.paleOres.items.find((item) => item.id === "pale-ore-seer")?.status === "owned");
assert(progress.charmNotches.items.find((item) => item.id === "charm-notch-salubra-1")?.status === "owned");
assert(progress.simpleKeys.items.find((item) => item.id === "simple-key-pale-lurker")?.status === "owned");
```

- [ ] **步骤 2：运行测试并确认正确失败**

运行：

```powershell
npx tsx source-scripts/verify-hollow-knight-collection-progress.ts
```

预期：TypeScript 报告 `paleOres`、`charmNotches`、`simpleKeys` 不存在，而不是 fixture 或导入错误。

- [ ] **步骤 3：实现七类统一分组**

扩展 `HollowKnightCollectionProgress`，并复用现有 `group(category, ...)`：

```ts
export interface HollowKnightCollectionProgress {
  charms: HollowKnightCollectibleProgressGroup;
  grubs: HollowKnightCollectibleProgressGroup;
  maskShards: HollowKnightCollectibleProgressGroup;
  vesselFragments: HollowKnightCollectibleProgressGroup;
  paleOres: HollowKnightCollectibleProgressGroup;
  charmNotches: HollowKnightCollectibleProgressGroup;
  simpleKeys: HollowKnightCollectibleProgressGroup;
}
```

保持聚合不一致时整组降为 `unknown`，不得使用 `ore`、`charmSlots` 或 `simpleKeys` 库存反推来源。

- [ ] **步骤 4：同步契约和检查入口**

在 parser contract 与 schema 中记录七个组、单项状态和缺失语义；将新验证脚本加入 `checks/verify.ps1` 的 required artifacts 与执行清单。

- [ ] **步骤 5：验证资料包**

运行：

```powershell
npx tsx source-scripts/verify-hollow-knight-collection-progress.ts
powershell -ExecutionPolicy Bypass -File checks/verify.ps1
```

预期：七组验证和资料包检查通过。

### 任务 2：生成可审计的精确 marker/entity 映射

**文件：**
- 创建：`scripts/export_parser_mapid_mapping.py`
- 创建：`integration/map-marker-entity-map.csv`
- 修改：`integration/entity-id-rules.md`

- [ ] **步骤 1：编写生成器的失败校验路径**

生成器接受 `--workbook`、`--output` 和 `--check`。先执行 `--check`，断言目标 CSV 不存在或与工作簿不一致时退出非零。

```powershell
python scripts/export_parser_mapid_mapping.py --workbook "空洞骑士Parser-地图ID映射表.xlsx" --output integration/map-marker-entity-map.csv --check
```

预期：FAIL，提示映射产物缺失。

- [ ] **步骤 2：实现结构化导出**

使用 openpyxl 读取前三列；跳过空行、标题行和 Parser ID 为空的行；将复合 Parser ID 拆为独立记录。每条记录写入：

```csv
group_name,map_sequence,marker_id,parser_id,module
幼虫,1,marker_1785395264091_1hwpgy,grub-028,collectionProgress
```

模块只允许 `collectionProgress`、`abilities`、`keyItemProgress`、`bossProgress`、`explorationProgress`、`dreamerProgress`。无法归类的非空 ID 必须报错，不能默认为某模块。

- [ ] **步骤 3：生成并核对映射**

运行生成和 `--check`，再断言：46 个幼虫映射齐全、Godtuner 不在产物中、两个 Deepnest marker 均关联 `map-deepnest`、工作簿所有非空 ID 均被展开。

- [ ] **步骤 4：记录连接规则**

更新 `integration/entity-id-rules.md`，声明 CSV 是地图连接入口、复合 marker 聚合规则和 `unknown` 语义。

### 任务 3：建立浏览器 parser 快照和目录适配器

**文件：**
- 创建：`tests/save-parser.test.ts`
- 创建：`app/save-parser/index.ts`
- 创建：`app/save-parser/types.ts`
- 创建：`app/save-parser/vendor/parsers/**`
- 创建：`app/save-parser/data/hollow-knight/**/generated/*.json`
- 创建：`app/save-parser/aes-js.d.ts`
- 创建：`scripts/sync-hollow-knight-save-parser.ps1`
- 修改：`package.json`
- 修改：`package-lock.json`

- [ ] **步骤 1：编写失败的目录解析测试**

测试根层级 `user1.dat`、损坏 `user2.dat`、有效 `user3.dat`、备份目录和无关文件，预期只返回槽位 1/3 且失败列表只包含 2；全无有效槽位时返回中文错误。

- [ ] **步骤 2：运行并确认入口缺失**

运行：

```powershell
npx tsx --test tests/save-parser.test.ts
```

预期：FAIL，模块 `app/save-parser/index` 不存在。

- [ ] **步骤 3：同步最新版 parser 快照**

同步脚本必须接收显式 `-PackageRoot`，复制 parser 所需 TS、generated JSON 和 `integration/map-marker-entity-map.csv` 的 JSON 快照；禁止硬编码用户目录。快照头部记录资料包 manifest/日期，不在运行时访问父目录。

- [ ] **步骤 4：实现目录适配器**

实现：

```ts
parseSaveDirectory(files, parseSlot?) => Promise<{ slots; failures; error? }>
```

只接受根目录或单一 Hollow Knight 父目录下的 `user1.dat` 到 `user4.dat`，按槽位排序并逐槽捕获错误。原始文件不得写入 localStorage、日志或网络。

- [ ] **步骤 5：添加 `aes-js` 并验证绿灯**

运行目录解析测试，预期全部通过；再运行 `npx tsc --noEmit`，确认浏览器快照类型可编译。

- [ ] **步骤 6：提交 parser 适配器**

```powershell
git add app/save-parser scripts/sync-hollow-knight-save-parser.ps1 tests/save-parser.test.ts package.json package-lock.json
git commit -m "feat: add current Hollow Knight browser parser"
```

### 任务 4：按模块映射并聚合 marker 状态

**文件：**
- 创建：`app/save-parser/entity-map.ts`
- 创建：`app/save-parser/parser-mapid-map.json`
- 修改：`tests/save-parser.test.ts`

- [ ] **步骤 1：编写失败的模块状态测试**

为六个模块分别构造 `owned/done/obtained`、`missing`、缺失字段输入，断言统一转换结果。测试必须使用真实 normalized detail 结构，不使用中文 marker 名称。

- [ ] **步骤 2：编写失败的聚合测试**

覆盖：单项获得；复合 marker 全获得；复合 marker 任一缺失；复合 marker 存在未知但无缺失；同一 Parser ID 对应两个 marker；无映射 marker。

```ts
assert.equal(getMarkerSaveState({ id: slyMarker }, allOwned), "collected");
assert.equal(getMarkerSaveState({ id: slyMarker }, oneMissing), "missing");
assert.equal(getMarkerSaveState({ id: slyMarker }, oneUnknown), "unknown");
```

- [ ] **步骤 3：运行并确认映射功能缺失**

运行单文件测试，预期因 `entity-map` 不存在而失败。

- [ ] **步骤 4：实现显式模块索引**

为 normalized detail 建立六个模块索引；每个映射记录通过 `module + parserId` 查状态。禁止递归扫描整个 detail，禁止名称 alias。

- [ ] **步骤 5：实现 marker 聚合与筛选**

`getMarkerSaveState` 使用 `all collected -> collected`、`any missing -> missing`、其余 `unknown`；`filterMarkersBySaveState` 在 `all` 保留全部，在其他模式排除 unknown。

- [ ] **步骤 6：验证映射完整性并提交**

测试运行时映射中的每个 `module + parserId` 都存在于对应目录或固定 exploration/dreamer ID 列表。通过后提交：

```powershell
git add app/save-parser/entity-map.ts app/save-parser/parser-mapid-map.json tests/save-parser.test.ts
git commit -m "feat: map all confirmed save entities to markers"
```

### 任务 5：接入地图存档控件和筛选

**文件：**
- 修改：`app/MapViewer.tsx`
- 修改：`app/globals.css`
- 修改：`tests/save-parser.test.ts`

- [ ] **步骤 1：编写失败的 UI 静态契约测试**

断言组件包含目录输入、上传按钮、有效槽位选择、“全部/已收集/未收集”按钮、失败槽位提示，并把存档筛选应用到现有分类过滤结果之后。

- [ ] **步骤 2：运行并确认当前完整版无存档 UI**

预期测试因 `MapViewer` 没有目录输入和状态控件而失败。

- [ ] **步骤 3：迁移现有交互并适配最新版 MapViewer**

从旧提交 `81bd0e9` 只参考存档控件的状态与事件，不覆盖完整版之后的地图改动。目录重选替换内存状态，默认选最小有效槽位，现有手动完成标记保持独立。

- [ ] **步骤 4：实现样式与可访问状态**

复用完整版现有紧凑控件视觉，设置 `aria-pressed`、可见 focus、移动端约束；错误文案不得遮挡地图筛选栏或其他固定控件。

- [ ] **步骤 5：运行测试、类型检查和构建**

```powershell
npx tsx --test tests/save-parser.test.ts
npx tsc --noEmit
npx vinext build
```

- [ ] **步骤 6：提交 UI 接入**

```powershell
git add app/MapViewer.tsx app/globals.css tests/save-parser.test.ts
git commit -m "feat: filter map markers from local save progress"
```

### 任务 6：修复上游验证入口并完成回归检查

**文件：**
- 修改：`package.json`
- 修改：`package-lock.json`
- 修改：`tests/rendered-html.test.mjs`
- 修改：`README.md`（仅增加本地存档隐私和验证说明）

- [ ] **步骤 1：更新失效渲染断言**

将 starter skeleton 的 `codex-preview` meta 与 `_sites-preview/SkeletonPreview.tsx` 断言替换为当前地图真实输出：标题、地图主区域、筛选栏和本地存档入口。

- [ ] **步骤 2：让 npm scripts 跨平台**

使用 Node 包装脚本或 `cross-env` 设置 `WRANGLER_LOG_PATH`，确保 Windows PowerShell 直接执行 `npm test`，而不是依赖 POSIX 前缀赋值。

- [ ] **步骤 3：运行全部验证**

```powershell
npm test
npm run lint
npx tsc --noEmit
npx vinext build
git diff --check
```

预期：全部退出码为 0；无真实 `.dat`、node_modules、构建缓存或无关文件进入 Git 状态。

- [ ] **步骤 4：启动开发服务器并检查界面**

启动可用端口，验证桌面和移动视口下地图非空、控件不重叠、未导入和合成导入状态可操作。

- [ ] **步骤 5：最终提交**

```powershell
git add package.json package-lock.json tests/rendered-html.test.mjs README.md
git commit -m "test: verify save-aware map on Windows"
```
