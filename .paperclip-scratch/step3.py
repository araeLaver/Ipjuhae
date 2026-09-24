import sys

sys.path.insert(0, "/Volumes/WorkDrive/Develop/02_Ipjuhae/.paperclip-scratch")
import pc

BASE = "/Volumes/WorkDrive/Develop/02_Ipjuhae/.paperclip-scratch/"

r1 = pc.comment("e550f840-70bd-4c91-b277-54db6e93e67c", pc.read(BASE + "dow1152-correction.md"))
print("DOW-1152 correction:", r1.get("id"))

r2 = pc.comment("f264822e-728b-4dfe-ae18-4ed9c5d625c7", pc.read(BASE + "dow1181-correction.md"))
print("DOW-1181 correction:", r2.get("id"))
