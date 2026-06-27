#!/usr/bin/env python3
# 极简 WebSocket 客户端(纯 stdlib,无第三方依赖):连接 -> 升级握手 -> 读取服务端文本帧并打印。
# 用法: _ws_recv.py <host> <port> <path-with-query> <seconds>
# 服务端 -> 客户端帧不掩码(WS 规范),仅需解析 opcode/len/payload。
import socket, base64, sys, time

host, port, path = sys.argv[1], int(sys.argv[2]), sys.argv[3]
duration = float(sys.argv[4]) if len(sys.argv) > 4 else 15.0

try:
    s = socket.create_connection((host, port), timeout=5)
except Exception as e:
    sys.stderr.write("connect-failed: %s\n" % e); sys.exit(2)

key = base64.b64encode(b"0123456789abcdef").decode()
req = ("GET %s HTTP/1.1\r\nHost: %s:%d\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
       "Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n" % (path, host, port, key))
s.sendall(req.encode())
s.settimeout(1.0)

buf = b""
while b"\r\n\r\n" not in buf:
    try:
        d = s.recv(4096)
    except socket.timeout:
        break
    if not d:
        break
    buf += d
hdr, _, rest = buf.partition(b"\r\n\r\n")
if hdr:
    sys.stderr.write("handshake: %s\n" % hdr.decode(errors="replace").splitlines()[0])
data = rest

def parse_frames(data):
    out, i = [], 0
    while i + 2 <= len(data):
        b0, b1 = data[i], data[i + 1]
        opcode = b0 & 0x0f
        masked = b1 & 0x80
        ln = b1 & 0x7f
        i += 2
        if ln == 126:
            if i + 2 > len(data): break
            ln = int.from_bytes(data[i:i + 2], "big"); i += 2
        elif ln == 127:
            if i + 8 > len(data): break
            ln = int.from_bytes(data[i:i + 8], "big"); i += 8
        if masked:
            if i + 4 > len(data): break
            mask = data[i:i + 4]; i += 4
        if i + ln > len(data): break
        payload = data[i:i + ln]; i += ln
        if masked:
            payload = bytes(payload[j] ^ mask[j % 4] for j in range(len(payload)))
        if opcode == 1:
            out.append(payload.decode(errors="replace"))
    return out, data[i:]

deadline = time.time() + duration
while time.time() < deadline:
    try:
        d = s.recv(4096)
    except socket.timeout:
        d = b""
    if d:
        data += d
        frames, data = parse_frames(data)
        for f in frames:
            print(f); sys.stdout.flush()
try:
    s.close()
except Exception:
    pass
