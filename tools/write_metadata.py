"""在所有课表解析完成后写入学期元数据"""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from data_contract import load_contract


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path('public/data'))
    parser.add_argument('--contract', type=Path, default=Path('data-contract.json'))
    args = parser.parse_args()
    contract = load_contract(args.contract)
    metadata = {'schemaVersion': 1, 'term': contract['term'], 'generatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')}
    path = args.output / contract['term'] / 'meta.json'
    path.write_text(json.dumps(metadata, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'已生成课表元数据：{path}')


if __name__ == '__main__': main()
