import sys

sys.path.insert(0, "/Volumes/WorkDrive/Develop/02_Ipjuhae/.paperclip-scratch")
import pc

ISSUE = "e550f840-70bd-4c91-b277-54db6e93e67c"
body = pc.read("/Volumes/WorkDrive/Develop/02_Ipjuhae/.paperclip-scratch/dow1152-cto-review.md")
res = pc.comment(ISSUE, body)
print("comment:", res.get("id"))
