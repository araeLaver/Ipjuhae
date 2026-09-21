import re

src = open("db/migrate.ts", encoding="utf-8").read()
# active migration array: entries quoted '<name>.sql'
names = re.findall(r"'([^']+\.sql)'", src)
seen, ordered = set(), []
for n in names:
    if n not in seen:
        seen.add(n)
        ordered.append(n)
print("active entries in db/migrate.ts:", len(ordered))
print("  schema.sql included:", "schema.sql" in ordered)
print("  sql migrations:", len([n for n in ordered if n.startswith("migration-")]))
print("  last 3:", ordered[-3:])
