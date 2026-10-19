import json
from collections import defaultdict, OrderedDict
def load(ph,th,w):
    return json.load(open(f"{ph}-inputs-{th}-{w}.json"))["rows"]
out=["| หน้า (สถานะ) | โหมด | กว้าง | ช่อง (ชนิด · จำนวน) | พื้น rgb (ด้านนอก) | ขอบก่อน rgb | ratio ก่อน | ขอบหลัง rgb | ratio หลัง | ผล |","|---|---|---|---|---|---|---|---|---|---|"]
tot=0;fail=0;rowsN=0
for th in ("dark","light"):
    for w in (1440,390):
        b=load("before",th,w); a=load("after",th,w)
        bm={}
        for r in b: bm.setdefault((r["route"],r["state"],r["field"]),[]).append(r)
        groups=OrderedDict()
        for r in a:
            key=(r["route"],r["state"],r["type"],r["host"].split(" ")[0] if r["host"]!="self" else "self", r["boundary"])
            g=groups.setdefault(key,{"n":0,"after":[],"before":[]})
            g["n"]+=1; g["after"].append(r)
            bb=bm.get((r["route"],r["state"],r["field"]))
            if bb: g["before"].append(bb.pop(0))
        for (route,state,typ,host,bd),g in groups.items():
            ra=min(g["after"],key=lambda r:r["ratio"]); rb=min(g["before"],key=lambda r:r["ratio"]) if g["before"] else None
            ok=ra["ratio"]>=3; tot+=g["n"]; fail+=0 if ok else g["n"]; rowsN+=1
            out.append(f"| {route} ({state}) | {th} | {w} | {typ}{'' if host=='self' else ' ใน '+ra['host'].replace('wrapper ','')} · {g['n']} | {ra['outsideRgb']} | {rb['edgeRgb'] if rb else '-'} | {rb['ratio'] if rb else '-'} | {ra['edgeRgb']} ({ra['boundary']}) | **{ra['ratio']}** | {'✅' if ok else '❌'} |")
open("table-inputs.md","w",encoding="utf-8").write("\n".join(out))
print("groups",rowsN,"field-measurements",tot,"fail",fail)
for th in ("dark","light"):
    for w in (1440,390):
        a=load("after",th,w); b=load("before",th,w)
        print(th,w,"fields",len(a),"before<3:",sum(r['ratio']<3 for r in b),"after<3:",sum(r['ratio']<3 for r in a),"min after",min(r['ratio'] for r in a))
