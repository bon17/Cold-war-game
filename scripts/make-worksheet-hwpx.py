"""종이 활동지(한글 .hwpx)를 교사의 포트폴리오 수행평가 양식으로 만든다(docs/drafts/worksheet.md 7장).

교사 양식 파일은 학교 양식·로고가 들어 있어 공개 저장소에 올리지 않는다. 쓰는 법:
    python3 -I scripts/make-worksheet-hwpx.py <교사양식.hwpx> docs/worksheet/qr-game.png <결과.hwpx>

양식에서 그대로 빌려 쓰는 조각(모양을 바꾸지 않으려고):
- 머리 표(NO., 학습 주제, 성취기준, 학번·이름): 글만 바꾼다.
- 질문 문단: 아이콘 그림 + 굵은 글(양식의 첫 질문 문단).
- 밑줄 칸: 1열 표의 행 하나가 밑줄 한 줄(양식의 첫 밑줄 표, 행 높이 그대로).
- 상자: 1행 1열 테두리 표(양식의 '1) 2) 3)' 상자). QR 상자는 이 표를 2열로 늘려 왼쪽에 QR 그림을 넣는다.
글이 바뀐 문단은 줄 배치 정보(linesegarray)를 지워 한글이 열 때 다시 배치하게 한다.
"""
import random
import re
import sys
import zipfile
from xml.sax.saxutils import escape

TEMPLATE, QR_PNG, OUT = sys.argv[1:4]

HEADER = {
    'NO': '8',
    'TOPIC': '8. 냉전(바늘과 실 : 자정의 분석실)',
    'STANDARD': '[9역07-01] 냉전의 전개와 제3 세계 등장의 상관관계를 이해하고, 냉전 이후 국제 질서의 변화를 분석한다.',
}

# QR 옆 칸(약 158mm)에 한 줄씩 들어가게 짧게
QR_LINES = [
    '게임을 다시 하려면 QR을 찍으세요. 주소: bon17.github.io/Cold-war-game',
    "장 바로 가기 코드(시작 화면의 '막 시작 코드' 칸에 넣어요)",
    '프롤로그 분할점령 · 1장 냉전시작 · 2장 쿠바위기 · 3장 핑퐁외교',
    '4장 미중수교 · 5장 장벽붕괴 · 에필로그 바늘과실',
    '집에서는 기록이 없어 처음부터 시작해요. 코드를 넣으면 그 장부터 할 수 있어요.',
]

BLANK = '(            )'
# (질문, 상자 안 줄들, 밑줄 수). 2026-11-04 교사 의견(질문이 어렵다, 뭘 쓰라는 건지 모르겠다)으로 쉬운 판
QUESTIONS = [
    ('냉전 하면 떠오르는 낱말은 무엇인가요? 낱말 하나를 고르고, 그 낱말을 고른 이유를 게임에서 본 일 하나를 들어 '
     '써 보세요. (3줄 이상)',
     ['보기 낱말: 줄다리기 · 얼음 · 두려움 · 경쟁 · 갈림길 · 시소 (다른 낱말도 좋아요)',
      "이렇게 써 보세요: 냉전은 '______'이다. 왜냐하면 게임에서 ______을/를 보았기 때문이다."], 4),
    ("냉전은 '차가운 전쟁'이라는 뜻입니다. 미국과 소련이 서로 직접 총을 쏘며 싸우지는 않았기 때문입니다. 그런데 "
     "한반도에서는 6·25 전쟁이라는 진짜 전쟁이 일어났습니다. 한반도에서 보면, 냉전은 정말 '차가운' 전쟁이었을까요? "
     '내 생각과 이유를 써 보세요. (3줄 이상)',
     ["이렇게 써 보세요: 나는 냉전이 '차가운' 전쟁이 (맞다고 / 아니라고) 생각한다. 왜냐하면 ______ 때문이다."], 4),
    ("냉전 때 인도, 이집트처럼 막 독립한 나라들 가운데에는 미국 편에도 소련 편에도 서지 않은 나라가 많았습니다. "
     "이런 나라들을 '제3 세계'라고 합니다. 내가 이런 나라의 지도자라면 어떻게 하겠습니까? 아래에서 하나를 고르고 "
     '이유를 써 보세요. (3줄 이상)',
     ['① 미국 편에 선다      ② 소련 편에 선다      ③ 어느 편에도 서지 않는다'], 4),
    ('운명의 날 시계는 자정에 가까울수록 세계가 핵전쟁 같은 큰 위험에 가깝다는 뜻입니다. 냉전이 끝난 1991년에는 '
     '자정 17분 전이었지만, 지금(2026년)은 자정 85초 전으로 훨씬 가까워졌습니다. 냉전이 끝났는데 왜 다시 '
     '가까워졌을까요? 에필로그(코드 바늘과실)에서 읽은 문서를 떠올려 이유를 하나 써 보세요. (2줄 이상)', [], 3),
    ('게임에서 남한과 북한을 잇는 실은 여러 번 바뀌었습니다. 빈칸에 알맞은 실의 이름을 쓰세요.',
     ['실의 이름: 대립 · 전쟁 · 대화 (같은 이름을 여러 번 써도 돼요)',
      f'1948 대립 → 1950 {BLANK} → 1953 {BLANK} → 1972 {BLANK}', f'→ 1973 {BLANK} → 1991 {BLANK} → 지금은?'], 0),
    ('세계의 냉전은 1991년에 끝났지만, 한반도는 아직 남과 북으로 나뉘어 있습니다. 한반도의 분단은 왜 아직 끝나지 '
     '않았을까요? 게임에서 1945년의 당직자가 편지를 남겼듯이, 다음 당직자에게 내 생각을 메모로 남겨 보세요. (4줄 이상)',
     ['이렇게 써 보세요: 세계의 냉전은 1991년에 끝났지만 한반도의 분단은 아직 남아 있다. 그 까닭은 ______ 때문이라고 '
      '생각한다. 다음 당직자는 ______을/를 지켜보면 좋겠다.',
      '낱말 상자: 38도선 · 6·25 전쟁 · 정전 · 휴전선 · 7·4 남북 공동 성명 · 남북 기본 합의서 · 냉전 · 이산가족 · 핵무기'], 5),
]

zin = zipfile.ZipFile(TEMPLATE)
sec = zin.read('Contents/section0.xml').decode('utf-8')
hpf = zin.read('Contents/content.hpf').decode('utf-8')


def top_paras(s):
    """hs:sec 바로 아래 문단들의 (시작, 끝) 위치"""
    out, depth, start = [], 0, None
    for m in re.finditer(r'<(/?)hp:p(?=[ >])[^>]*?(/?)>', s):
        closing, selfclose = m.group(1), m.group(2)
        if not closing and not selfclose:
            if depth == 0:
                start = m.start()
            depth += 1
        elif closing:
            depth -= 1
            if depth == 0:
                out.append((start, m.end()))
    return out


P = top_paras(sec)
para = [sec[a:b] for a, b in P]
assert len(para) == 25, len(para)
assert 'hp:secPr' in para[0] and 'rowCnt="4" colCnt="9"' in para[0], '머리 표가 첫 문단에 없음'

rng = random.Random(20261104)
z_order = [max(int(z) for z in re.findall(r'zOrder="(\d+)"', sec))]


def fresh_ids(x):
    """복제한 표·그림에 새 id, instid, zOrder"""
    x = re.sub(r'(<hp:(?:tbl|pic) id=")\d+(")', lambda m: f'{m.group(1)}{rng.randrange(10**9, 2**31)}{m.group(2)}', x)
    x = re.sub(r'( instid=")\d+(")', lambda m: f'{m.group(1)}{rng.randrange(10**8, 2**31)}{m.group(2)}', x)

    def z(m):
        z_order[0] += 1
        return f'{m.group(1)}{z_order[0]}{m.group(2)}'
    return re.sub(r'(zOrder=")\d+(")', z, x)


def no_lineseg(x):
    return re.sub(r'<hp:linesegarray>.*?</hp:linesegarray>', '', x, flags=re.S)


# ── 머리 표: 글만 바꾼다(바뀐 칸은 줄 배치를 다시 하게)
def set_header(p0):
    def sub_once(p, old, new):
        assert p.count(old) == 1, old
        return p.replace(old, new)
    p0 = sub_once(p0, '<hp:t>7</hp:t>', f'<hp:t>{escape(HEADER["NO"])}</hp:t>')
    p0 = sub_once(p0, '<hp:t>7. 2차 세계대전과 악의 평범성</hp:t>', f'<hp:t>{escape(HEADER["TOPIC"])}</hp:t>')
    old_std = re.search(r'<hp:t>\[9역06-01\][^<]*</hp:t>', p0).group(0)
    p0 = sub_once(p0, old_std, f'<hp:t>{escape(HEADER["STANDARD"])}</hp:t>')
    # 바뀐 글이 든 셀 문단의 줄 배치 정보만 지운다
    for t in (HEADER['NO'], HEADER['TOPIC'], HEADER['STANDARD']):
        i = p0.index(f'<hp:t>{escape(t)}</hp:t>')
        a = p0.rfind('<hp:p ', 0, i)
        b = p0.index('</hp:p>', i) + len('</hp:p>')
        p0 = p0[:a] + no_lineseg(p0[a:b]) + p0[b:]
    return p0


# ── 조각 틀
Q_TPL = para[1]       # 아이콘 + 굵은 질문
EMPTY_TPL = para[2]   # 빈 문단(간격)
LINES_TPL = para[3]   # 밑줄 표 3행
BOX_TPL = para[9]     # 상자 1×1


def question(text):
    q = re.sub(r'<hp:t>[^<]*</hp:t>', f'<hp:t>{escape(text)}</hp:t>', Q_TPL, count=1)
    return fresh_ids(no_lineseg(q))


def empty():
    return no_lineseg(EMPTY_TPL)


def lines(n):
    rows = re.findall(r'<hp:tr>.*?</hp:tr>', LINES_TPL, flags=re.S)
    row = rows[0]
    row_h = int(re.search(r'<hp:cellSz width="\d+" height="(\d+)"', row).group(1))
    new_rows = ''.join(row.replace('rowAddr="0"', f'rowAddr="{i}"') for i in range(n))
    x = LINES_TPL[:LINES_TPL.index(rows[0])] + new_rows + LINES_TPL[LINES_TPL.index(rows[-1]) + len(rows[-1]):]
    x = x.replace('rowCnt="3"', f'rowCnt="{n}"', 1)
    x = re.sub(r'(<hp:tbl [^>]*>\s*<hp:sz width="\d+" widthRelTo="ABSOLUTE" height=")\d+(")', lambda m: f'{m.group(1)}{row_h * n}{m.group(2)}', x, count=1)
    return fresh_ids(no_lineseg(x))


def cell_paras(texts, cell_p):
    """상자 셀 안 문단들(양식 상자의 셀 문단 모양 그대로)"""
    return ''.join(re.sub(r'<hp:t>[^<]*</hp:t>', f'<hp:t>{escape(t)}</hp:t>', cell_p, count=1) for t in texts)


BOX_CELL_P = no_lineseg(re.findall(r'<hp:p id="\d+" paraPrIDRef="0"[^>]*><hp:run charPrIDRef="9"><hp:t>.*?</hp:p>', BOX_TPL, flags=re.S)[0])
LINE_H = 1600   # 상자 글 한 줄 높이(10pt, 줄 간격 160%)


def box(texts):
    sub = re.search(r'(<hp:subList [^>]*>)(.*?)(</hp:subList>)', BOX_TPL, flags=re.S)
    x = BOX_TPL[:sub.start(2)] + cell_paras(texts, BOX_CELL_P) + BOX_TPL[sub.end(2):]
    h = LINE_H * len(texts) + 282
    x = re.sub(r'(<hp:sz width="\d+" widthRelTo="ABSOLUTE" height=")\d+(")', lambda m: f'{m.group(1)}{h}{m.group(2)}', x, count=1)
    return fresh_ids(no_lineseg(x))


# ── QR 상자: 1×1 상자를 2열로. 왼쪽 칸에 QR 그림(25mm), 오른쪽 칸에 안내 글
QR_MM = 25
QR_SIZE = round(QR_MM / 25.4 * 7200)          # HWPUNIT(1/7200인치)
QR_PX = 900                                   # docs/worksheet/qr-game.png 크기
QR_DIM = round(QR_PX * 7200 / 96)


def qr_pic():
    pic = re.search(r'<hp:pic .*?</hp:pic>', Q_TPL, flags=re.S).group(0)
    pic = pic.replace('binaryItemIDRef="image2"', 'binaryItemIDRef="image3"')
    pic = re.sub(r'<hp:offset x="\d+" y="\d+"/>', '<hp:offset x="0" y="0"/>', pic)
    pic = re.sub(r'<hp:orgSz width="\d+" height="\d+"/>', f'<hp:orgSz width="{QR_SIZE}" height="{QR_SIZE}"/>', pic)
    pic = re.sub(r'<hp:curSz width="\d+" height="\d+"/>', f'<hp:curSz width="{QR_SIZE}" height="{QR_SIZE}"/>', pic)
    pic = re.sub(r'centerX="\d+" centerY="\d+"', f'centerX="{QR_SIZE // 2}" centerY="{QR_SIZE // 2}"', pic)
    pic = re.sub(r'<hc:transMatrix [^>]*/>', '<hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>', pic)
    pic = re.sub(r'<hc:scaMatrix [^>]*/>', '<hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>', pic)
    pic = re.sub(r'<hp:imgRect>.*?</hp:imgRect>',
                 f'<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="{QR_SIZE}" y="0"/><hc:pt2 x="{QR_SIZE}" y="{QR_SIZE}"/><hc:pt3 x="0" y="{QR_SIZE}"/></hp:imgRect>', pic, flags=re.S)
    pic = re.sub(r'<hp:imgClip [^>]*/>', f'<hp:imgClip left="0" right="{QR_DIM}" top="0" bottom="{QR_DIM}"/>', pic)
    pic = re.sub(r'<hp:imgDim [^>]*/>', f'<hp:imgDim dimwidth="{QR_DIM}" dimheight="{QR_DIM}"/>', pic)
    pic = re.sub(r'<hp:sz width="\d+" widthRelTo="ABSOLUTE" height="\d+"', f'<hp:sz width="{QR_SIZE}" widthRelTo="ABSOLUTE" height="{QR_SIZE}"', pic)
    pic = re.sub(r'<hp:shapeComment>.*?</hp:shapeComment>', '<hp:shapeComment>게임 다시 하기 QR: https://bon17.github.io/Cold-war-game/</hp:shapeComment>', pic, flags=re.S)
    return pic


def qr_box():
    x = BOX_TPL
    total_w = int(re.search(r'<hp:sz width="(\d+)"', x).group(1))
    left_w = QR_SIZE + 510 * 2 + 400
    right_w = total_w - left_w
    tc = re.search(r'<hp:tc .*?</hp:tc>', x, flags=re.S).group(0)
    sub = re.search(r'(<hp:subList [^>]*>)(.*?)(</hp:subList>)', tc, flags=re.S)
    # 왼쪽 칸: 가운데 정렬 문단 하나에 QR 그림
    centered = BOX_CELL_P.replace('paraPrIDRef="0"', 'paraPrIDRef="36"', 1)
    left_p = re.sub(r'<hp:run charPrIDRef="9"><hp:t>[^<]*</hp:t></hp:run>', f'<hp:run charPrIDRef="9">{qr_pic()}<hp:t/></hp:run>', centered, count=1)
    left = tc[:sub.start(2)] + left_p + tc[sub.end(2):]
    right = tc[:sub.start(2)] + cell_paras(QR_LINES, BOX_CELL_P) + tc[sub.end(2):]
    h = max(QR_SIZE + 282 * 2, LINE_H * len(QR_LINES) + 282)
    left = re.sub(r'<hp:cellSz width="\d+" height="\d+"/>', f'<hp:cellSz width="{left_w}" height="{h}"/>', left)
    right = re.sub(r'<hp:cellSz width="\d+" height="\d+"/>', f'<hp:cellSz width="{right_w}" height="{h}"/>', right)
    right = right.replace('<hp:cellAddr colAddr="0" rowAddr="0"/>', '<hp:cellAddr colAddr="1" rowAddr="0"/>')
    x = x.replace(tc, left + right)
    x = x.replace('rowCnt="1" colCnt="1"', 'rowCnt="1" colCnt="2"', 1)
    x = re.sub(r'(<hp:sz width="\d+" widthRelTo="ABSOLUTE" height=")\d+(")', lambda m: f'{m.group(1)}{h}{m.group(2)}', x, count=1)
    return fresh_ids(no_lineseg(x))


# ── 본문 조립
body = [qr_box(), empty()]
for text, box_lines, n in QUESTIONS:
    body.append(question(text))
    if box_lines:
        body.append(box(box_lines))
    if n:
        body.append(empty())
        body.append(lines(n))
    body.append(empty())

new_sec = sec[:P[0][0]] + set_header(para[0]) + ''.join(body) + sec[P[-1][1]:]

# ── 검사: XML이 바르고, 표의 행·열 수가 실제와 같고, 그림이 가리키는 파일이 있다
import xml.etree.ElementTree as ET
root = ET.fromstring(new_sec)
NS = '{http://www.hancom.co.kr/hwpml/2011/paragraph}'
for tbl in root.iter(NS + 'tbl'):
    trs = tbl.findall(NS + 'tr')
    assert len(trs) == int(tbl.get('rowCnt')), ('rowCnt', tbl.get('rowCnt'), len(trs))
    merged = any(sp.get('colSpan') != '1' or sp.get('rowSpan') != '1' for sp in tbl.iter(NS + 'cellSpan'))
    for tr in trs:   # 합친 칸이 없는 표(새로 만든 표)만 칸 수를 센다
        assert merged or len(tr.findall(NS + 'tc')) == int(tbl.get('colCnt')), 'colCnt'
ids = [t.get('id') for t in root.iter(NS + 'tbl')] + [t.get('id') for t in root.iter(NS + 'pic')]
assert len(ids) == len(set(ids)), '표·그림 id가 겹침'

new_hpf = hpf.replace('<opf:item id="section0"',
                      '<opf:item id="image3" href="BinData/image3.png" media-type="image/png" isEmbeded="1"/><opf:item id="section0"', 1)
assert 'image3' in new_hpf

texts = [HEADER['TOPIC'], HEADER['STANDARD']] + QR_LINES + [t for q in QUESTIONS for t in [q[0], *q[1]]]
prv = '\r\n'.join(texts)

with zipfile.ZipFile(OUT, 'w') as zout:
    for info in zin.infolist():
        data = zin.read(info.filename)
        if info.filename == 'Contents/section0.xml':
            data = new_sec.encode('utf-8')
        elif info.filename == 'Contents/content.hpf':
            data = new_hpf.encode('utf-8')
        elif info.filename == 'Preview/PrvText.txt':
            data = prv.encode('utf-8')   # 양식의 미리 보기 글도 UTF-8
        compress = zipfile.ZIP_STORED if info.filename == 'mimetype' else zipfile.ZIP_DEFLATED
        zout.writestr(zipfile.ZipInfo(info.filename, date_time=info.date_time), data, compress_type=compress)
        if info.filename == 'BinData/image2.png':
            zout.writestr(zipfile.ZipInfo('BinData/image3.png', date_time=info.date_time), open(QR_PNG, 'rb').read(), compress_type=zipfile.ZIP_DEFLATED)

print('만듦:', OUT, '| 표', sum(1 for _ in root.iter(NS + 'tbl')), '| 그림', sum(1 for _ in root.iter(NS + 'pic')))
