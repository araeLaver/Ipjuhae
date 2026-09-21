import sys, os, re, collections

p = '/Volumes/WorkDrive/Develop/_runtime/paperclip-home/instances/default/logs/server.log'
size = os.path.getsize(p)
# read last N bytes
n = int(sys.argv[1]) if len(sys.argv) > 1 else 400000
with open(p, 'rb') as f:
    f.seek(max(0, size - n))
    data = f.read().decode('utf-8', errors='replace')
lines = data.split('\n')[1:]
print('total size', size, 'lines in window', len(lines))

# find the boundary: the last server start
starts = [i for i, l in enumerate(lines) if 'listening' in l.lower() or 'server started' in l.lower() or 'paperclip server' in l.lower()]
print('start markers at idx:', starts[-5:])

mode = sys.argv[2] if len(sys.argv) > 2 else 'tail'
if mode == 'tail':
    for l in lines[-60:]:
        print(l[:220])
elif mode == 'freq':
    # normalize and count message shapes
    c = collections.Counter()
    for l in lines:
        s = re.sub(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '<uuid>', l)
        s = re.sub(r'\d+', '<n>', s)
        c[s[:150]] += 1
    for msg, cnt in c.most_common(30):
        print(cnt, '|', msg)
