import os, re

p = '/Volumes/WorkDrive/Develop/_runtime/paperclip-home/instances/default/logs/server.log'
size = os.path.getsize(p)
n = 900000
with open(p, 'rb') as f:
    f.seek(max(0, size - n))
    data = f.read().decode('utf-8', errors='replace')
lines = data.split('\n')[1:]

# locate boot markers
boots = [i for i, l in enumerate(lines) if 'Paperclip server' in l or 'listening on' in l or 'auto-generated runtime' in l]
print('boot marker idx:', boots)
if boots:
    b = boots[0]
    print('\n===== 40 lines BEFORE boot (= final moments of previous run) =====')
    for l in lines[max(0, b - 40):b]:
        print(l[:300])
    print('\n===== boot lines =====')
    for l in lines[b:b + 12]:
        print(l[:300])
