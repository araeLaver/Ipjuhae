"""내부 서술 제거본에 보정 원고·도표 대체 경로를 적용해 재계량한다.

gvalley_fallback_sim.py 를 그대로 재사용하되 원본만 제거본으로 바꾼다.
대조군: 같은 스크립트로 제거 전 원본도 한 번 돌려 두 결과를 나란히 본다.

선행 조건: gvalley_internal_leak_audit.py 를 먼저 실행해
docs/tmp/gvalley_pkg_internal_removed.md 를 만들어 둔다. 없으면 이 스크립트가
직접 실행한다.

결과 해석은 docs/business-development/20260927_gvalley_form2_submission_leak_audit.md
를 따른다.
"""

import importlib.util
import os
import shutil
import subprocess
import sys

spec = importlib.util.spec_from_file_location(
    'sim', 'scripts/stats/gvalley_fallback_sim.py')
sim = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sim)

ORIG = sim.V5
REMOVED = 'docs/tmp/gvalley_v5_internal_removed.md'
SRC = 'docs/tmp/gvalley_pkg_internal_removed.md'

if not os.path.exists(SRC):
    print('제거본이 없어 감사 스크립트를 먼저 실행한다: %s' % SRC)
    subprocess.run([sys.executable, 'scripts/stats/gvalley_internal_leak_audit.py', ORIG],
                   check=False, capture_output=True)
shutil.copyfile(SRC, REMOVED)

print('#' * 64)
print('# 대조군 — 내부 서술 제거 전 (원본 v5)')
print('#' * 64)
sim.V5 = ORIG
sim.main('docs/tmp/gvalley_sim_before')

print()
print('#' * 64)
print('# 처리군 — 내부 서술 8건 제거 후')
print('#' * 64)
sim.V5 = REMOVED
sim.main('docs/tmp/gvalley_sim_after')
