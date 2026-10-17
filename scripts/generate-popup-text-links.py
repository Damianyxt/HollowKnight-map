#!/usr/bin/env python3
"""从「空洞骑士地图攻略用_图标数据已更新.xlsx」的「跳转&配图」表生成弹窗文字跳转索引。

用法（在任意目录执行均可，脚本按自身位置定位文件）：
    python3 客户端编程文件/scripts/generate-popup-text-links.py

输出：
    客户端编程文件/public/popup-text-links.json
"""
import json
import os
import re
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter

MAIN = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, '..', '..'))
XLSX_PATH = os.path.join(PROJECT_ROOT, '空洞骑士地图攻略用_图标数据已更新.xlsx')
PUBLIC_DIR = os.path.join(PROJECT_ROOT, '客户端编程文件', 'public')
OUT_PATH = os.path.join(PUBLIC_DIR, 'popup-text-links.json')

POPUP_SOURCE_PREFIXES = (
    '弹窗商品/奖励图标', '弹窗首行图标', '弹窗正文图标',
    '弹窗分组图标', '弹窗奖励附属图标', '弹窗说明图标', '弹窗结局图标',
    '弹窗辅助图标', '弹窗所需物品图标', '弹窗材料图标',
)


def norm(name):
    return re.sub(r'[（(].*$', '', (name or '')).strip()


def col_of(ref):
    return ''.join(ch for ch in ref if ch.isalpha())


def read_sheet(z, sheet_path):
    ss = ET.fromstring(z.read('xl/sharedStrings.xml'))
    strings = []
    for si in ss.iter(MAIN + 'si'):
        strings.append(''.join(t.text or '' for t in si.iter(MAIN + 't')))

    root = ET.fromstring(z.read(sheet_path))
    rows = []
    for row in root.iter(MAIN + 'row'):
        cells = {}
        for c in row.iter(MAIN + 'c'):
            ref = c.get('r') or ''
            t = c.get('t')
            v = c.find(MAIN + 'v')
            val = v.text if v is not None else ''
            if t == 's':
                val = strings[int(val)] if val != '' else ''
            cells[col_of(ref)] = val
        rows.append(cells)
    return rows


def main():
    z = zipfile.ZipFile(XLSX_PATH)
    rows = read_sheet(z, 'xl/worksheets/sheet1.xml')[1:]

    # 特例：同名出现多次但属于“左右分片”时，只跳转到“左”半边（按图标文件含“-左”识别）
    SPLIT_LEFT_NAMES = {"国王之魂"}

    name_count = Counter()
    first_row = {}
    rows_by_name = {}
    for r in rows:
        n = norm(r.get('E', ''))
        if not n:
            continue
        name_count[n] += 1
        first_row.setdefault(n, r)
        rows_by_name.setdefault(n, []).append(r)

    links = []
    type_dist = Counter()
    for n, cnt in sorted(name_count.items()):
        if cnt != 1 and n not in SPLIT_LEFT_NAMES:
            continue
        r = first_row[n]
        if n in SPLIT_LEFT_NAMES:
            left = [x for x in rows_by_name[n] if '-左' in (x.get('N') or '')]
            if left:
                r = left[0]
        b = (r.get('B') or '').strip()
        o = (r.get('O') or '').strip()
        p = (r.get('P') or '').strip()
        if b == '地图图标':
            links.append({'name': n, 'type': 'marker', 'markerId': o})
            type_dist['marker'] += 1
        elif b == '地图名称图标':
            links.append({'name': n, 'type': 'region', 'regionName': n})
            type_dist['region'] += 1
        elif b in POPUP_SOURCE_PREFIXES:
            links.append({
                'name': n, 'type': 'popup-item', 'itemName': n,
                'ownerMarkerId': o, 'ownerIconId': p,
            })
            type_dist['popup-item'] += 1

    links.sort(key=lambda x: -len(x['name']))

    # 校验目标是否都能在运行时数据中解析
    markers = json.load(open(os.path.join(PUBLIC_DIR, 'project.json'), encoding='utf-8'))
    regions = json.load(open(os.path.join(PUBLIC_DIR, 'region-info.json'), encoding='utf-8'))
    marker_ids = {m['id'] for m in markers['markers']}
    region_names = {r['name'] for r in regions.get('regions', [])}
    missing_marker = []
    missing_region = []
    for l in links:
        if l['type'] in ('marker', 'popup-item'):
            if l.get('markerId', l.get('ownerMarkerId')) not in marker_ids:
                missing_marker.append(l['name'])
        elif l['type'] == 'region' and l['regionName'] not in region_names:
            missing_region.append(l['name'])

    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump({'links': links}, f, ensure_ascii=False, indent=2)

    print('链接总数:', len(links))
    print('类型分布:', dict(type_dist))
    print('缺失的 marker 目标:', missing_marker or '无')
    print('缺失的 region 目标:', missing_region or '无')
    print('已写入:', OUT_PATH)


if __name__ == '__main__':
    main()
