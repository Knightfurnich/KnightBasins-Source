import json,sys
from collections import defaultdict
d=json.load(open(sys.argv[1]))
g=defaultdict(list)
for r in d["rows"]: g[(r["point"],r["state"],r["what"])].append(r)
for k,v in sorted(g.items(),key=lambda x:(x[0][0],x[0][1])):
    m=min(v,key=lambda r:r["ratio"]); print(k[0],k[1],k[2][:36],"n=",len(v),"min",m["ratio"],m["fg"],"on",m["bg"],m["kind"])
