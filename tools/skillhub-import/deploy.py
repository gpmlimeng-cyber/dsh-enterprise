#!/usr/bin/env python3
"""上传 + 发布 + 全员分配 8 个由 skillhub.cn 真实技能转换而来的 .dshskill。

[INPUT]: /opt/work/skillhub-import/converted/*.dshskill、管理端 PKCE 凭据、运行中的 server
[OUTPUT]: /opt/work/skillhub-import/evidence/*.json + stdout 逐条证据
[POS]: 导入链路第 2 步;不退休任何技能、不改现有 3 个技能、不改源码
"""
import json
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common_auth as auth  # noqa: E402

BASE = auth.BASE
ROOT = "/opt/work/skillhub-import"
CONV = os.path.join(ROOT, "converted")
EVID = os.path.join(ROOT, "evidence")

IDS = ["dev-expert", "parenting-expert", "cn-financial-scraper", "libai-skill",
       "baozheng-skills", "smart-charts", "luhe-paper-free", "interactive-architecture-diagram"]

results = []
failures = []


def save(name, text):
    os.makedirs(EVID, exist_ok=True)
    with open(os.path.join(EVID, name), "w", encoding="utf-8") as fh:
        fh.write(text)


def upload(token, path, filename):
    artifact = open(path, "rb").read()
    boundary = "----dshsbup" + uuid.uuid4().hex
    head = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"artifact\"; "
            f"filename=\"{filename}\"\r\nContent-Type: application/zip\r\n\r\n").encode()
    payload = head + artifact + f"\r\n--{boundary}--\r\n".encode()
    idem = str(uuid.uuid4())
    status, _, body = auth.call(auth.urllib.request.Request(
        f"{BASE}/enterprise/admin/v1/skills/versions", data=payload, method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}",
                 "Idempotency-Key": idem, "Accept": "application/json",
                 "Authorization": f"Bearer {token}"}))
    return status, idem, body.decode(errors="replace"), len(artifact)


def publish(token, version_id):
    status, _, body = auth.call(auth.urllib.request.Request(
        f"{BASE}/enterprise/admin/v1/skills/versions/{version_id}/actions/publish",
        data=b"{}", method="POST",
        headers={"Content-Type": "application/json", "Accept": "application/json",
                 "If-Match": "0", "Authorization": f"Bearer {token}"}))
    return status, body.decode(errors="replace")


def assign_all(token, package_id, revision):
    body = json.dumps({"assignments": [{"subjectType": "ALL", "subjectId": None}]}).encode()
    idem = str(uuid.uuid4())
    status, _, raw = auth.call(auth.urllib.request.Request(
        f"{BASE}/enterprise/admin/v1/skills/{package_id}/assignments/batch",
        data=body, method="POST",
        headers={"Content-Type": "application/json", "Accept": "application/json",
                 "Idempotency-Key": idem, "If-Match": str(revision),
                 "Authorization": f"Bearer {token}"}))
    return status, idem, raw.decode(errors="replace")


def main():
    token = auth.admin_token()

    print("===== 0. 基线:现有技能的 assignment 真实形状 =====")
    status, before_items, err, pages = auth.admin_skills_all(token)
    print("GET /enterprise/admin/v1/skills -> HTTP %s, %d 包, %d 页" % (status, len(before_items), pages))
    if status != 200:
        sys.exit("基线失败: %s" % err)
    save("admin-skills-before.json", json.dumps(before_items, ensure_ascii=False, indent=2))
    for it in before_items:
        if it["skillId"] in ("code-review", "new-member-onboarding", "expense-reimbursement"):
            print("  [现有] skillId=%-24s packageId=%s category=%r revision=%s status=%s"
                  % (it["skillId"], it["id"], it.get("category"), it.get("revision"), it.get("status")))
            print("         assignments 原文 = %s" % json.dumps(it.get("assignments"), ensure_ascii=False))

    print("\n===== 1. 上传 + 发布 =====")
    for sid in IDS:
        pkg = os.path.join(CONV, sid + ".dshskill")
        print("\n--- %s ---" % sid)
        up_status, idem, text, size = upload(token, pkg, sid + ".dshskill")
        print("  POST /enterprise/admin/v1/skills/versions Idempotency-Key=%s artifact=%dB -> HTTP %s"
              % (idem, size, up_status))
        save("upload-%s.json" % sid, text)
        if up_status not in (200, 201):
            print("  body: %s" % text[:600])
            failures.append("%s 上传 HTTP %s: %s" % (sid, up_status, text[:300]))
            results.append({"skillId": sid, "uploadHttp": up_status, "error": text[:500]})
            continue
        up = json.loads(text)["data"]
        version_id = up["id"]
        print("  versionId=%s status=%s revision=%s sourceDshVersion=%r sizeBytes=%s skillCount=%s sha256=%s"
              % (version_id, up.get("status"), up.get("revision"), up.get("sourceDshVersion"),
                 up.get("sizeBytes"), up.get("skillCount"), str(up.get("sha256"))[:16]))
        pub_status, text = publish(token, version_id)
        print("  POST /versions/%s/actions/publish (If-Match: 0) -> HTTP %s" % (version_id, pub_status))
        save("publish-%s.json" % sid, text)
        pub = json.loads(text)["data"] if pub_status in (200, 201) else {}
        print("  publish status=%s revision=%s packageId=%s"
              % (pub.get("status"), pub.get("revision"), pub.get("packageId")))
        rec = {"skillId": sid, "versionId": version_id, "uploadHttp": up_status, "publishHttp": pub_status,
               "publishStatus": pub.get("status"), "packageId": pub.get("packageId"),
               "sourceDshVersion": up.get("sourceDshVersion"), "sizeBytes": up.get("sizeBytes"),
               "sha256": up.get("sha256"), "skillCount": up.get("skillCount"),
               "skills": [s.get("name") for s in (up.get("skills") or [])]}
        if pub_status not in (200, 201) or pub.get("status") != "PUBLISHED":
            failures.append("%s 发布失败 HTTP %s status=%s" % (sid, pub_status, pub.get("status")))
        results.append(rec)

    print("\n===== 2. 全员分配(照实测形状 subjectType=ALL) =====")
    status, items, err, _ = auth.admin_skills_all(token)
    if status != 200:
        sys.exit("分配前读取失败: %s" % err)
    save("admin-skills-after-publish.json", json.dumps(items, ensure_ascii=False, indent=2))
    by_skill = {it["skillId"]: it for it in items}
    for rec in results:
        sid = rec["skillId"]
        if rec.get("publishStatus") != "PUBLISHED":
            continue
        cur = by_skill.get(sid)
        if cur is None:
            failures.append("%s 上传后未在管理端出现" % sid)
            continue
        package_id, revision = cur["id"], cur["revision"]
        body = {"assignments": [{"subjectType": "ALL", "subjectId": None}]}
        print("\n--- %s packageId=%s revision=%s ---" % (sid, package_id, revision))
        print("  POST /enterprise/admin/v1/skills/%s/assignments/batch" % package_id)
        print("  body=%s" % json.dumps(body, ensure_ascii=False))
        status, idem, text = assign_all(token, package_id, revision)
        print("  Idempotency-Key=%s If-Match=%s -> HTTP %s" % (idem, revision, status))
        print("  body: %s" % text[:400])
        save("assign-%s.json" % sid, text)
        rec.update({"packageId": package_id, "assignHttp": status, "assignIfMatch": revision})
        try:
            rec["assignments"] = json.loads(text).get("data")
        except Exception:
            rec["assignments"] = text[:300]
        if status not in (200, 201):
            failures.append("%s 分配失败 HTTP %s: %s" % (sid, status, text[:300]))
        else:
            print("  分配结果 = %s" % json.dumps(rec["assignments"], ensure_ascii=False))

    save("deploy-results.json", json.dumps({"ids": IDS, "results": results, "failures": failures},
                                           ensure_ascii=False, indent=2))
    print("\n===== 结论: %s =====" % ("全部成功" if not failures else "%d 项失败" % len(failures)))
    for f in failures:
        print("  ! %s" % f)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
