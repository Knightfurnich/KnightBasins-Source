import json
from collections import OrderedDict
def load(ph,th,w): return json.load(open(f"{ph}-ph-{th}-{w}.json"))["rows"]
out=["| หน้า (สถานะ) | โหมด | กว้าง | ช่อง (ชนิด · จำนวน) | พื้น rgb | placeholder ก่อน (css) | ratio ก่อน | placeholder หลัง | ratio หลัง | สีที่พิมพ์ก่อน→หลัง | ผล |","|---|---|---|---|---|---|---|---|---|---|---|"]
typed_changed=0; fails=0; n=0; groups=0
for th in ("dark","light"):
    for w in (1440,390):
        b=load("before",th,w); a=load("after",th,w)
        bm={}
        for r in b: bm.setdefault((r["route"],r["state"],r["field"]),[]).append(r)
        gs=OrderedDict()
        for r in a:
            g=gs.setdefault((r["route"],r["state"],r["type"],r["bg"]),{"a":[],"b":[]})
            g["a"].append(r); bb=bm.get((r["route"],r["state"],r["field"]))
            if bb: g["b"].append(bb.pop(0))
        for (route,state,typ,bg),g in gs.items():
            ra=min(g["a"],key=lambda r:r["ratio"]); rb=min(g["b"],key=lambda r:r["ratio"])
            ok=ra["ratio"]>=4.5 or ra["disabled"] or ra["admin"]
            tc=all(x["typedCss"]==y["typedCss"] for x,y in zip(g["a"],g["b"]))
            typed_changed+=0 if tc else 1; fails+=0 if ok else len(g["a"]); n+=len(g["a"]); groups+=1
            out.append(f"| {route} ({state}) | {th} | {w} | {typ} · {len(g['a'])} | {bg} | {rb['phCss'][:34]} ({rb['phRgba'].split(' ')[-1]}) | {rb['ratio']} | {ra['phCss'][:34]} | **{ra['ratio']}** | {g['a'][0]['typedCss']} → {g['a'][0]['typedCss']} {'(เท่าเดิม)' if tc else '(เปลี่ยน!)'} | {'✅' if ok else '❌'} |")
open("table-placeholders.md","w",encoding="utf-8").write("\n".join(out))
print("groups",groups,"placeholders",n,"fail",fails,"typed-colour-changed groups",typed_changed)
for th in ("dark","light"):
    for w in (1440,390):
        a=load("after",th,w); b=load("before",th,w)
        print(th,w,"n",len(a),"before<4.5",sum(r['ratio']<4.5 for r in b),"after<4.5",sum(r['ratio']<4.5 for r in a),"min after",min(r['ratio'] for r in a),"typed same",all(x['typedCss']==y['typedCss'] for x,y in zip(a,b)))
