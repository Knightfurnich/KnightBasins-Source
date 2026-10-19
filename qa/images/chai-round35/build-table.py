import json
from collections import defaultdict
NEED={"text":4.5,"ui":3.0,"exception":None}
def load(ph,th,w):
    d=json.load(open(f"{ph}-points-{th}-{w}.json")); g=defaultdict(list)
    for r in d["rows"]: g[(r["point"],r["state"],r["what"])].append(r)
    return g
L={(ph,th,w):load(ph,th,w) for ph in("before","after") for th in("dark","light") for w in(1440,390)}
NAMES={1:"1 บัตรสินค้า (role=checkbox ไม่ติ๊ก) ×30",2:"2 checkbox ติดตั้ง",3:"3 checkbox รวม VAT",4:"4 ป้ายจำนวนในเมนู",5:"5 ปุ่ม ทำซ้ำ (disabled)",6:"6 ปุ่ม ย้อนกลับ",7:"7 เลขขั้นตอน /studio",8:"8 ไอคอนค้นหา/จัดเรียง",9:"9 placeholder ค้นหา",10:"10 placeholder ค้นหาผลงาน",11:"11 × ของ edge-marker",12:"12 ปุ่ม LINE"}
def pid(k):
    p,s,w=k
    if p==5: return 6 if s=="enabled" else 5
    return p
keys=sorted({(pid(k),k) for g in L.values() for k in g},key=lambda x:(x[0],x[1][1],x[1][2]))
lines=["| จุด | ส่วนที่วัด | เกณฑ์ | มืด 1440 ก่อน→หลัง | มืด 390 ก่อน→หลัง | สว่าง 1440 ก่อน→หลัง | สว่าง 390 ก่อน→หลัง | fg / bg หลัง (มืด 1440) | ผล |","|---|---|---|---|---|---|---|---|---|"]
allok=True
for n,k in keys:
    cells=[];ok=True;need=None;detail=""
    for th in("dark","light"):
        for w in (1440,390):
            b=L[("before",th,w)].get(k); a=L[("after",th,w)].get(k)
            if not a: cells.append("-"); continue
            am=min(a,key=lambda r:r["ratio"]); bm=min(b,key=lambda r:r["ratio"]) if b else None
            need=NEED[am["kind"]]
            if need is not None and am["ratio"]<need: ok=False
            cells.append(f"{bm['ratio'] if bm else '-'} → **{am['ratio']}**")
            if th=="dark" and w==1440: detail=f"{am['fg']} / {am['bg']}"
    allok&=ok
    nm=NAMES[n]; 
    lines.append(f"| {nm} | {k[1]}: {k[2][:40]} | {'≥'+str(need) if need else 'ข้อยกเว้น'} | "+" | ".join(cells)+f" | {detail} | {'✅' if ok else '❌'} |")
open("table-12-points.md","w",encoding="utf-8").write("\n".join(lines))
print("\n".join(lines)); print("ALL OK" if allok else "FAIL")
