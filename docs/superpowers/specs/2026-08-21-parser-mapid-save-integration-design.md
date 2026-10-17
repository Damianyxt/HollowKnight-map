# Parser-MapID 存档状态接入设计

## 目标

在 `20260821完整版` 地图分支中恢复本地 Hollow Knight 存档导入，并一次性接入 `空洞骑士Parser-地图ID映射表.xlsx` 中已经完成且 Parser ID 非空的全部映射。地图仅消费资料包 parser 的标准化输出，不直接读取 `playerData` 或根据剧情顺序推测状态。

## 范围

首轮接入以下已完成类别：幼虫、面具碎片、容器碎片、苍白矿石、护符槽、简单钥匙、护符、位移能力、梦之钉能力、其他能力、法术、骨钉技艺、店主钥匙、典雅钥匙、城市纹章、电车通行证、爱之钥、国王印记、Boss 攻略进度、地图、鹿角站和守梦者。

工作簿中 Parser ID 为空的条目不接入。例如 Godtuner 在获得稳定 Parser ID 前保持 `unknown`。国王之魂左右半片、完整国王之魂和虚空之心当前没有工作簿地图 ID，也不虚构地图映射。

## 架构

采用三层边界：

1. `app/save-parser/vendor/` 保存资料包 parser 的可移植浏览器快照，负责 `.dat` 解密并输出 normalized detail。
2. 显式映射数据保存工作簿中确认过的 `markerId -> parserIds` 关系。运行时不加载 Excel，也不按 marker 中文名称模糊匹配。
3. `entity-map` 按模块读取 normalized detail，将 Parser ID 转换为统一的 `collected | missing | unknown`，再聚合为地图点状态。

React 地图只负责选择目录、切换有效槽位和应用状态筛选，不接触解析器私有字段。

## 映射规则

- 工作簿中的非空 Parser ID 是唯一映射来源。无法稳定对应的条目不补猜测值。
- 一个 Parser ID 可以映射多个 marker，例如深邃巢穴的两个地图购买点；这些 marker 使用相同存档状态。
- 一个 marker 可以映射多个 Parser ID，例如商店、先知或虫爷爷的一组奖励。
- 一个 marker 的所有关联项均明确获得时，marker 为 `collected`。
- 任一关联项明确未获得时，marker 为 `missing`。这包括部分商品已购、部分未购的地点。
- 没有明确未获得项，但至少一项为未知时，marker 为 `unknown`。
- 没有映射的 marker 为 `unknown`。
- `unknown` 只在“全部”筛选中显示，不进入“已收集”或“未收集”。

领取资格不等于获得。苍白矿石、护符槽、简单钥匙等继续采用资料包中已经确认的实际领取、购买、拾取或奖励标记；不使用可消耗库存或剧情先后关系反推来源。

## 状态适配

状态转换按输出模块显式实现，不递归扫描整个 detail：

- `collectionProgress`：收藏品目录项的 `collected/missing/unknown`。
- `status.abilities`：能力项的 `owned: true/false/缺失`。
- `keyItemProgress.items`：关键物品的 `obtained/missing/unknown`；交付、消耗或转化后仍遵循 parser 的历史获得状态。
- `bossProgress`：世界与 Godhome Boss 的 `done/missing/unknown`。
- `explorationProgress`：地图和鹿角站的 `owned/missing/unknown`。
- `dreamerProgress`：守梦者的 `done/missing/unknown`。

不同模块出现相同 ID 时，以映射条目指定的模块为准，避免全局递归搜索产生碰撞。

## 本地存档流程

浏览器目录选择只读取根层级 `user1.dat` 到 `user4.dat`。每个槽位独立解析，损坏槽位不影响其他槽位；默认选择编号最小的有效槽位。原始文件和解析结果只保存在当前页面内存，不上传服务端，也不写入持久化存储。

存档状态筛选与现有分类、区域和搜索条件取交集。现有手动完成标记继续独立保存，不覆盖 parser 的确定状态。

## 错误与兼容

- 无有效存档时显示可操作的本地错误，保留重新选择目录入口。
- 单槽位失败时列出失败槽位，其他成功槽位仍可使用。
- parser 决定性字段缺失、类型无效或目录项无法唯一判断时保留 `unknown`。
- vendor parser 与资料包契约同步；新增或改变输出字段时同步更新资料包 `docs/parser-contract.md`。
- 映射快照必须能由工作簿重新生成或验证，避免手工维护两套互相漂移的数据。

## 测试与验收

采用测试先行，至少覆盖：

- 有效、稀疏、损坏和全损坏槽位。
- 每个输出模块至少一个已获得、未获得和未知状态。
- 单 marker 单 Parser ID。
- 单 marker 多 Parser ID 的全获得、部分未获得和部分未知聚合。
- 单 Parser ID 对应多个 marker。
- 空 Parser ID 和无映射 marker 保持未知。
- 工作簿所有有效映射均能解析到已知 parser 目录项和指定模块。
- Windows 下可直接运行测试、lint 和构建命令。

最终验证不使用或提交真实 `user*.dat`，只使用合成数据和最小脱敏 fixture。
