#!/usr/bin/env python3
"""基线读取:管理端技能列表(含 assignment 真实形状) + 员工端可见技能 + 设备查证。

[INPUT]: /opt/owndsh/CREDENTIALS.txt、运行中的 server(127.0.0.1:18080)
[OUTPUT]: /opt/work/skillhub-import/evidence/*.json + stdout 证据
[POS]: skillhub 导入任务的第 0 步:先读真值,不凭记忆
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common_auth as auth  # noqa: E402

EVID = "/opt/work/skillhub-import/evidence"
os.makedirs(EVID, exist_ok=True)


def save(name, obj):
    with open(os.path.join(EVID, name), "w", encoding="utf-8") as fh:
        if isinstance(obj, str):
            fh.write(obj)
        else:
            json.dump(obj, fh, ensure_ascii=False, indent=2)
    print("  [saved] %s" % name)


def main():
    token = auth.admin_token()
    print("\n===== 1. 管理端技能列表(基线) =====")
    status, items, err, pages = auth.admin_skills_all(token)
    print("GET /enterprise/admin/v1/skills -> HTTP %s, %d 个包, 翻 %d 页" % (status, len(items), pages))
    if status != 200:
        sys.exit("基线失败: %s" % err)
    save("admin-skills-baseline.json", items)
    for it in items:
        print("- skillId=%s packageId=%s category=%r status=%s revision=%s updatedAt=%s"
              % (it["skillId"], it["id"], it.get("category"), it.get("status"),
                 it.get("revision"), it.get("updatedAt")))
        print("    displayName=%r description=%r" % (it.get("displayName"), (it.get("description") or "")[:80]))
        print("    assignments(原文)= %s" % json.dumps(it.get("assignments"), ensure_ascii=False))
        vers = it.get("versions") or []
        for v in vers:
            print("    version id=%s sourceDshVersion=%r status=%s revision=%s skillCount=%s size=%s"
                  % (v.get("id"), v.get("sourceDshVersion"), v.get("status"), v.get("revision"),
                     v.get("skillCount"), v.get("sizeBytes")))
            for s in (v.get("skills") or []):
                print("        entry name=%r" % (s.get("name"),))

    print("\n===== 2. 设备:找 name=api-verify 且 ACTIVE 的 installation_id =====")
    found = None
    for path in ("/enterprise/admin/v1/devices?limit=200",
                 "/enterprise/admin/v1/devices",
                 "/enterprise/admin/v1/device/list"):
        st, payload = auth.get_json(path, token)
        if st == 200 and isinstance(payload, dict) and "data" in payload:
            body = payload["data"]
            devs = body.get("items") if isinstance(body, dict) else None
            if devs is None and isinstance(body, list):
                devs = body
            print("GET %s -> HTTP %s, devices=%d" % (path, st, len(devs or [])))
            save("admin-devices-baseline.json", payload)
            for d in (devs or []):
                print("   device id=%s name=%r status=%s installationId=%s platform=%s"
                      % (d.get("id"), d.get("name"), d.get("status"),
                         d.get("installationId") or d.get("installation_id"),
                         d.get("platform")))
                if d.get("name") == "api-verify" and d.get("status") == "ACTIVE":
                    found = d.get("installationId") or d.get("installation_id")
            break
        else:
            print("GET %s -> HTTP %s %s" % (path, st, str(payload)[:160]))

    if not found:
        print("!! 未能从管理端取到 api-verify 设备 installationId, 回退到 skills-batch 记录的常量")
        found = auth.DEVICE_INSTALLATION
    print("device installation_id = %s" % found)
    save("device-installation-id.txt", found + "\n")

    print("\n===== 3. 员工端可见技能(基线) =====")
    dtok = auth.device_token(found)
    st, payload = auth.get_json("/enterprise/api/v1/skills", dtok)
    print("GET /enterprise/api/v1/skills -> HTTP %s" % st)
    save("employee-skills-baseline.json", payload)
    data = payload.get("data") if isinstance(payload, dict) else None
    entries = data if isinstance(data, list) else (data or {}).get("items") if isinstance(data, dict) else None
    print("条目数 = %s" % (len(entries) if entries is not None else "n/a"))
    if entries:
        print("单条字段 = %s" % json.dumps(sorted(entries[0].keys()), ensure_ascii=False))
        for e in entries:
            print("   - packageId=%s skillId=%s name=%r category=%s versionId=%s"
                  % (e.get("id"), e.get("skillId"), e.get("name"), e.get("category"), e.get("versionId")))
    if entries:
        pid = entries[0].get("id")
        st2, payload2 = auth.get_json("/enterprise/api/v1/skills/%s" % pid, dtok)
        print("GET /enterprise/api/v1/skills/%s -> HTTP %s" % (pid, st2))
        save("employee-skill-detail-baseline.json", payload2)
        print(json.dumps(payload2, ensure_ascii=False)[:1200])


if __name__ == "__main__":
    main()
