import json,re,io
base="../../../artifacts/knight-basins/src/"
src={}
for f,p in (("src/index.css",base+"index.css"),("src/components/ThemeToggle.tsx",base+"components/ThemeToggle.tsx")):
    src[f]=io.open(p,encoding="utf-8").read().replace("\r\n","\n").split("\n")
def norm(v): return re.sub(r"\s","",v.lower())
def where(sel,val):
    first=sel.split(",")[0].strip()
    v=norm(val); cands=[]
    for f,lines in src.items():
        for i,l in enumerate(lines,1):
            start=0
            while True:
                j=l.find(first,start)
                if j<0: break
                body=l[j:l.find("}",j)] if "}" in l[j:] else l[j:]
                if re.search(r"background(-color)?:"+re.escape(v),norm(body)) or v in norm(body): cands.append((f,i))
                start=j+1
    if cands: return f"{cands[-1][0]}:{cands[-1][1]}" if len(cands)==1 else ", ".join(f"{f}:{i}" for f,i in cands[:3])
    fb=[]
    for f,lines in src.items():
        for i,l in enumerate(lines,1):
            j=l.find(first)
            if j>=0 and "{" in l[j:] and re.search(r"background",l[j:l.find("}",j)] if "}" in l[j:] else l[j:]): fb.append(f"{f}:{i}")
    return ("≈ "+", ".join(fb[:2])) if fb else "n/a"
data={}
for th in ("dark","light"):
    for w in (1440,390):
        d=json.load(open(f"rules-{th}-{w}.json"))
        for r in d["rules"]:
            e=data.setdefault((r["selector"],r["value"]),{})
            m=e.setdefault(th,{"count":0,"measured":0,"worst":None})
            m["count"]=max(m["count"],r["count"]); m["measured"]=max(m["measured"],r.get("measured",0))
            if r["worst"] and (m["worst"] is None or r["worst"]["ratio"]<m["worst"]["ratio"]): m["worst"]=dict(r["worst"],w=w)
rows=[]
for (sel,val),mm in data.items():
    painted=[m for m in mm.values() if m["count"]]
    if not painted: cat,st=4,"ไม่พบองค์ประกอบที่ถูกพื้นนี้ทาจริงบนเส้นทางที่กวาด (ไม่มีบนหน้า / ถูกกฎธีมมืดทับ / เป็นสถานะที่ยังไม่เปิด)"
    else:
        bad=[m for m in painted if m["worst"] and m["worst"]["ratio"]<4.5]
        meas=[m for m in painted if m["measured"]]
        if bad: cat,st=1,"ต้องแก้ (<4.5) — นอกจุดที่ระบุในใบ จึงรายงาน ไม่แก้"
        elif meas: cat,st=2,"ไม่ต้องแก้ — ข้อความ/ไอคอน/ช่องกรอกที่ทับผ่าน ≥4.5"
        else: cat,st=3,"ไม่ต้องแก้ — ไม่มีข้อความ/ไอคอนทับบนพื้นนี้"
    if "line-quantity" in sel: cat,st=0,"**แก้แล้วใบนี้ (A)** — โหมดมืดปักพื้น var(--card-paper) · สว่างผ่านเดิม"
    rows.append((cat,sel,val,where(sel,val),mm,st))
rows.sort(key=lambda r:(r[0],r[1]))
def fmt(mm):
    out=[]
    for t in ("dark","light"):
        m=mm.get(t)
        if not m or not m["count"]: out.append(f"{t}: -")
        elif m["worst"]: out.append(f"{t}: {m['worst']['ratio']} ({m['worst']['text'][:14]} rgb({m['worst']['fg']}) on rgb({m['worst']['bg']}))")
        else: out.append(f"{t}: ไม่มีข้อความทับ")
    return " · ".join(out)
esc=lambda s:s.replace("|","\|")
L=["| # | selector | ไฟล์:บรรทัด | ค่าที่ตั้ง | ratio ต่ำสุดที่เบราว์เซอร์คืน (ต่อโหมด) | สรุป |","|---|---|---|---|---|---|"]
for i,(cat,sel,val,loc,mm,st) in enumerate(rows,1):
    L.append(f"| {i} | `{esc(sel)}` | {loc} | `{val}` | {esc(fmt(mm))} | {st} |")
io.open("table-B.md","w",encoding="utf-8").write("\n".join(L))
from collections import Counter
c=Counter(r[0] for r in rows); print(len(rows),dict(c))
for r in rows:
    if r[0] in (0,1): print(r[0],r[1][:48],"|",r[2],"|",r[3],"|",fmt(r[4])[:170])
