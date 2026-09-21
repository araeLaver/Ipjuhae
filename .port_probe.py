import socket, subprocess

# What does the OS hand out for listen(0) on this machine?
ports = []
socks = []
for _ in range(8):
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("0.0.0.0", 0))
    s.listen(1)
    ports.append(s.getsockname()[1])
    socks.append(s)
print("ephemeral listen(0) ports:", ports)

# Can a wildcard bind coexist with a loopback-specific bind on the same port?
loop = socket.socket()
loop.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
loop.bind(("127.0.0.1", 0))
loop.listen(1)
p = loop.getsockname()[1]
print("loopback-bound port:", p)

wild = socket.socket()
wild.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
try:
    wild.bind(("0.0.0.0", p))
    wild.listen(1)
    print("WILDCARD BIND ON SAME PORT SUCCEEDED -> silent collision is possible")
    # Which one receives a connection to 127.0.0.1:p ?
    c = socket.create_connection(("127.0.0.1", p), timeout=2)
    loop.settimeout(0.5)
    wild.settimeout(0.5)
    try:
        conn, _ = loop.accept()
        print("connection went to the LOOPBACK-specific listener")
    except Exception:
        try:
            conn, _ = wild.accept()
            print("connection went to the WILDCARD listener")
        except Exception as e:
            print("neither accepted:", e)
    c.close()
except OSError as e:
    print("wildcard bind failed (good):", e)

for s in socks + [loop, wild]:
    try:
        s.close()
    except Exception:
        pass
