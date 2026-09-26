"""HWP 5.0(OLE) 파일에서 본문 텍스트를 뽑는다.

사용: python3 hwp_text.py <파일.hwp> [검색어 ...]
공고 첨부가 HWP로만 제공될 때 원문을 대조하기 위한 최소 도구다.
BodyText/Section* 스트림의 문단 레코드(HWPTAG_PARA_TEXT=67)만 읽는다.
"""
import struct
import sys
import zlib

import olefile


def sections(path):
    ole = olefile.OleFileIO(path)
    compressed = True
    if ole.exists('FileHeader'):
        header = ole.openstream('FileHeader').read()
        compressed = bool(header[36] & 0x01)
    names = sorted(
        ('/'.join(s) for s in ole.listdir() if s[0] == 'BodyText'),
        key=lambda n: int(n.rsplit('Section', 1)[-1]),
    )
    for name in names:
        data = ole.openstream(name).read()
        yield zlib.decompress(data, -15) if compressed else data


def paragraphs(data):
    pos = 0
    while pos + 4 <= len(data):
        header = struct.unpack('<I', data[pos:pos + 4])[0]
        tag = header & 0x3FF
        size = (header >> 20) & 0xFFF
        pos += 4
        if size == 0xFFF:
            size = struct.unpack('<I', data[pos:pos + 4])[0]
            pos += 4
        payload = data[pos:pos + size]
        pos += size
        if tag != 67:  # HWPTAG_PARA_TEXT
            continue
        out = []
        i = 0
        while i + 1 < len(payload):
            code = struct.unpack('<H', payload[i:i + 2])[0]
            if code in (0, 10, 13):
                out.append('\n')
                i += 2
            elif code < 32:  # 확장/인라인 제어문자는 16바이트를 차지한다
                i += 16 if code in (1, 2, 3, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23) else 2
            else:
                out.append(chr(code))
                i += 2
        text = ''.join(out).strip()
        if text:
            yield text


if __name__ == '__main__':
    path = sys.argv[1]
    terms = sys.argv[2:]
    lines = [p for sec in sections(path) for p in paragraphs(sec)]
    if not terms:
        print('\n'.join(lines))
    else:
        for i, line in enumerate(lines):
            if any(t in line for t in terms):
                print('[%d] %s' % (i, line))
