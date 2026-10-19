import json,sys
from collections import Counter
d=json.load(open(sys.argv[1])); c=Counter()
for r in d["rows"]:
    c[(r["route"],r["state"],r["field"].split("[")[0],r["host"][:38],r["boundary"],r["edgeRgb"],r["outsideRgb"],r["ratio"])]+=1
for k,v in sorted(c.items()): print(v,k)
