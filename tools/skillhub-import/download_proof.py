#!/usr/bin/env python3
"""分配有效性证明:员工设备对该技能是否有下载授权(GET /skills/versions/{id}/download) + SHA-256 对齐。

[INPUT]: evidence/verify-admin-skills.json(新技能的 versionId/sha256)、员工端 PKCE
[OUTPUT]: evidence/download-proof.json + stdout
[POS]: 只读复核;证明"全员分配"在运行时面真的放行
"""
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common_auth as auth  # noqa: E402

EVID = "/opt/work/skillhub-import/evidence"
PICK = "dev-expert"


def main():
    items = json.load(open(os.path.join(EVID, "verify-admin-skills.json"), encoding="utf-8"))
    it = [x for x in items if x["skillId"] == PICK][0]
    v = [x for x in it["versions"] if x["status"] == "PUBLISHED"][0]
    vid, want = v["id"], v["sha256"]
    inst = open(os.path.join(EVID, "device-installation-id.txt"), encoding="utf-8").read().strip()
    tok = auth.device_token(inst)
    st, headers, body = auth.call(auth.urllib.request.Request(
        "%s/enterprise/api/v1/skills/versions/%s/download" % (auth.BASE, vid),
        headers={"Authorization": "Bearer " + tok, "Accept": "application/zip"}))
    got = hashlib.sha256(body).hexdigest()
    rec = {"skillId": PICK, "versionId": vid, "http": st, "bytes": len(body),
           "expectedSha256": want, "actualSha256": got, "match": got == want,
           "contentDisposition": headers.get("Content-Disposition"),
           "contentType": headers.get("Content-Type")}
    print(json.dumps(rec, ensure_ascii=False, indent=1))
    json.dump(rec, open(os.path.join(EVID, "download-proof.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    return 0 if st == 200 and rec["match"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
