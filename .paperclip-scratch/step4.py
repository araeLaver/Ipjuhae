import sys

sys.path.insert(0, "/Volumes/WorkDrive/Develop/02_Ipjuhae/.paperclip-scratch")
import pc

BASE = "/Volumes/WorkDrive/Develop/02_Ipjuhae/.paperclip-scratch/"
r = pc.comment("6a66e7b8-72d8-4973-9beb-445353572e63", pc.read(BASE + "dow1182-supp.md"))
print("DOW-1182 supplement:", r.get("id"))
