#!/usr/bin/env python3
"""回读验证:管理端 / 员工端 / 单技能详情 / 原有 3 技能未变对照。

[INPUT]: evidence/admin-skills-baseline.json、employee-skills-baseline.json、运行中的 server
[OUTPUT]: evidence/verify-*.json + stdout 逐条证据
[POS]: 导入链路第 3 步;只读,不改任何状态
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common_auth as auth  # noqa: E402

EVID = "/opt/work/skillhub-import/evidence"
NEW = ["dev-expert", "parenting-expert", "cn-financial-scraper", "libai-skill",
       "baozheng-skills", "smart-charts", "luhe-paper-free", "interactive-architecture-diagram"]
LEGACY = ["code-review", "new-member-onboarding", "expense-reimbursement"]


def save(name, obj):
    with open(os.path.join(EVID, name), "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=2)
    print("  [saved] %s" % name)


def main():
    token = auth.admin_token()
    fails = []

    print("\n########## 回读 1:管理端 GET /enterprise/admin/v1/skills ##########")
    status, items, err, pages = auth.admin_skills_all(token)
    print("HTTP %s, %d 包, %d 页" % (status, len(items), pages))
    save("verify-admin-skills.json", items)
    if status != 200:
        sys.exit("管理端读取失败: %s" % err)
    by = {it["skillId"]: it for it in items}
    for sid in NEW:
        it = by.get(sid)
        if not it:
            fails.append("管理端缺少新技能 %s" % sid)
            print("  !! 缺少 %s" % sid)
            continue
        pub = [v for v in it["versions"] if v.get("status") == "PUBLISHED"]
        print("  [新] skillId=%-30s category=%-4s status=%-7s revision=%s assignments=%s"
              % (sid, it.get("category"), it.get("status"), it.get("revision"),
                 json.dumps(it.get("assignments"), ensure_ascii=False)))
        print("       displayName=%r" % it.get("displayName"))
        print("       description=%r" % (it.get("description") or "")[:100])
        print("       versionId=%s sourceDshVersion=%r skillCount=%s entry=%s"
              % (pub[0]["id"] if pub else None, pub[0].get("sourceDshVersion") if pub else None,
                 pub[0].get("skillCount") if pub else None,
                 [s.get("name") for s in (pub[0].get("skills") or [])] if pub else None))
        if it.get("category") not in ("工程", "办公", "通用", "安全"):
            fails.append("%s category 不是映射后的中文值: %r" % (sid, it.get("category")))
        if not pub:
            fails.append("%s 无 PUBLISHED 版本" % sid)
        if not it.get("assignments") or it["assignments"][0].get("subjectType") != "ALL" \
                or it["assignments"][0].get("status") != "ACTIVE":
            fails.append("%s 未完成全员分配" % sid)

    print("\n########## 回读 1b:原有 3 技能逐字段对照(管理端) ##########")
    before = {it["skillId"]: it for it in json.load(open(os.path.join(EVID, "admin-skills-baseline.json"), encoding="utf-8"))}
    for sid in LEGACY:
        b, a = before.get(sid), by.get(sid)
        if not a:
            fails.append("原有技能 %s 在管理端消失" % sid)
            continue
        same = json.dumps(b, ensure_ascii=False, sort_keys=True) == json.dumps(a, ensure_ascii=False, sort_keys=True)
        print("  [原有] %-24s 与基线逐字段一致=%s category=%r->%r revision=%s->%s assignments=%s"
              % (sid, same, b.get("category"), a.get("category"), b.get("revision"), a.get("revision"),
                 json.dumps(a.get("assignments"), ensure_ascii=False)))
        if not same:
            bk, ak = set(b.keys()), set(a.keys())
            diff = {k: (b.get(k), a.get(k)) for k in bk | ak if b.get(k) != a.get(k)}
            print("        DIFF=%s" % json.dumps(diff, ensure_ascii=False)[:600])
            fails.append("原有技能 %s 管理端投影发生变化" % sid)
    save("verify-legacy-admin-compare.json", {"before": {k: before[k] for k in LEGACY if k in before},
                                              "after": {k: by[k] for k in LEGACY if k in by}})

    print("\n########## 回读 2:员工端 GET /enterprise/api/v1/skills ##########")
    inst = open(os.path.join(EVID, "device-installation-id.txt"), encoding="utf-8").read().strip()
    dtok = auth.device_token(inst)
    st, payload = auth.get_json("/enterprise/api/v1/skills", dtok)
    save("verify-employee-skills.json", payload)
    print("HTTP %s (设备 installation_id=%s)" % (st, inst))
    entries = payload.get("data") if isinstance(payload, dict) else None
    base_payload = json.load(open(os.path.join(EVID, "employee-skills-baseline.json"), encoding="utf-8"))
    base_entries = base_payload.get("data") or []
    print("条目数: 基线 %d -> 现在 %d (增加 %d)" % (len(base_entries), len(entries or []),
                                              len(entries or []) - len(base_entries)))
    if len(entries or []) != len(base_entries) + len(NEW):
        fails.append("员工端条目数不是 +%d (基线 %d, 现在 %d)"
                     % (len(NEW), len(base_entries), len(entries or [])))
    print("单条字段 = %s" % json.dumps(sorted((entries or [{}])[0].keys()), ensure_ascii=False))
    newentries = {e["skillId"]: e for e in (entries or [])}
    for sid in NEW:
        e = newentries.get(sid)
        if not e:
            fails.append("员工端看不到 %s" % sid)
            print("  !! 员工端缺少 %s" % sid)
            continue
        print("  [新] skillId=%-30s packageId=%s displayName=%r category=%-4s sourceDshVersion=%r sizeBytes=%s skillCount=%s"
              % (sid, e.get("id"), e.get("displayName"), e.get("category"), e.get("sourceDshVersion"),
                 e.get("sizeBytes"), e.get("skillCount")))
    print("  -- 原有 3 技能在员工端的条目(与基线对照) --")
    base_by = {e["skillId"]: e for e in base_entries}
    for sid in LEGACY:
        b, a = base_by.get(sid), newentries.get(sid)
        same = json.dumps(b, ensure_ascii=False, sort_keys=True) == json.dumps(a, ensure_ascii=False, sort_keys=True)
        print("  [原有] %-24s 与基线一致=%s category=%r packageId=%s"
              % (sid, same, (a or {}).get("category"), (a or {}).get("id")))
        if not same:
            fails.append("原有技能 %s 员工端投影变化" % sid)
    save("verify-legacy-employee-compare.json", {"before": base_by, "after": newentries})

    print("\n########## 回读 3:任取 1 个新技能详情 GET /enterprise/api/v1/skills/{id} ##########")
    pick = "interactive-architecture-diagram"
    pid = newentries[pick]["id"]
    st, detail = auth.get_json("/enterprise/api/v1/skills/%s" % pid, dtok)
    save("verify-skill-detail-%s.json" % pick, detail)
    print("HTTP %s id=%s" % (st, pid))
    print(json.dumps(detail, ensure_ascii=False, indent=1))
    d = detail.get("data") or {}
    for f in ("id", "skillId", "displayName", "description", "category", "versionId",
              "sourceDshVersion", "sizeBytes", "sha256", "skillCount", "skills", "updatedAt"):
        if d.get(f) in (None, "", []):
            fails.append("详情字段缺失: %s" % f)
    print("字段完整性: %s" % ("PASS" if not [f for f in ("id", "skillId", "displayName", "description",
          "category", "versionId", "sourceDshVersion", "sizeBytes", "sha256", "skillCount", "skills",
          "updatedAt") if d.get(f) in (None, "", [])] else "FAIL"))

    print("\n########## 结论 ##########")
    if fails:
        for f in fails:
            print("  ! %s" % f)
    else:
        print("  四条回读全部通过,原 3 技能与基线逐字段一致")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
