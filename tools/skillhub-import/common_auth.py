#!/usr/bin/env python3
"""企业 auth 公共件：PKCE 链路 -> 管理端 token / 设备端 token。

[INPUT]: /opt/owndsh/CREDENTIALS.txt 与运行中的 server(BASE 环境变量可覆盖);员工端
         installation_id 由 INSTALLATION_ID 环境变量或调用参数提供,源码不内置任何设备标识
[OUTPUT]: admin_token() / device_token(installation_id) 两个函数 + 无重定向 HTTP 调用器
[POS]: skills-batch 三个脚本(deploy/verify)共用的鉴权底座，避免复制粘贴漂移
"""
import base64
import hashlib
import json
import os
import re
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

BASE = os.environ.get("BASE", "http://127.0.0.1:18080")
CRED = "/opt/owndsh/CREDENTIALS.txt"
REDIRECT = "http://127.0.0.1:9999/callback"
# 员工端 installation_id 必须是服务端已注册的 ACTIVE 设备,属环境相关标识,故不内置默认值。
# 由环境变量 INSTALLATION_ID 提供,或由调用方通过 device_token(<已注册设备 id>) 传入。
DEVICE_INSTALLATION = os.environ.get("INSTALLATION_ID")
DEVICE_CLIENT = "dsh-desktop"
ADMIN_CLIENT = "ent-admin-cli"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def call(req):
    """返回 (status, headers, body)；HTTP 错误也原样返回，不吞异常。"""
    try:
        with OPENER.open(req, timeout=60) as resp:
            return resp.status, dict(resp.headers), resp.read()
    except urllib.error.HTTPError as exc:
        return exc.code, dict(exc.headers or {}), exc.read()


def creds():
    user = pw = None
    for line in open(CRED, encoding="utf-8"):
        if "管理员用户名" in line:
            user = line.split(":", 1)[1].strip()
        if "管理员密码" in line:
            pw = line.split(":", 1)[1].strip()
    if not user or not pw:
        sys.exit("CREDENTIALS.txt 缺少管理员用户名/密码")
    return user, pw


def _pkce_login(client_id: str, installation_id: str, verbose: bool = True):
    user, pw = creds()
    verifier = b64url(secrets.token_bytes(48))
    challenge = b64url(hashlib.sha256(verifier.encode()).digest())
    assert len(challenge) == 43, len(challenge)
    q = urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": REDIRECT,
        "state": secrets.token_urlsafe(24),
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "installation_id": installation_id,
    })
    status, headers, body = call(urllib.request.Request(
        f"{BASE}/enterprise/auth/v1/authorize?{q}", headers={"Accept": "application/json"}))
    if status == 200:
        d = json.loads(body)["data"]
        transaction, csrf, sources = d["transactionId"], d["csrfToken"], d["sources"]
    elif status in (302, 303):
        loc = headers.get("Location", "")
        m = re.search(r"transaction_id=([^&\s]+)", loc)
        if not m:
            sys.exit(f"authorize {status} 无 transaction_id: {loc}")
        transaction = m.group(1)
        _, _, body = call(urllib.request.Request(
            f"{BASE}/enterprise/auth/v1/sources?transaction_id={transaction}"))
        d = json.loads(body)["data"]
        csrf, sources = d["csrfToken"], d["sources"]
    else:
        sys.exit(f"authorize 失败 client={client_id} status={status} body={body[:400]!r}")
    local = [s for s in sources
             if str(s.get("type", "")).upper() in ("LOCAL", "PASSWORD", "INTERNAL")]
    src = (local or sources)[0]
    if verbose:
        print(f"[auth] client={client_id} installation={installation_id} "
              f"authorize={status} source={src['id']}/{src.get('name')}/{src.get('type')}")

    boundary = "----dshsb" + secrets.token_hex(16)
    fields = {"transactionId": transaction, "sourceId": str(src["id"]),
              "csrfToken": csrf, "username": user, "password": pw}
    chunks = [f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
              for k, v in fields.items()]
    chunks.append(f"--{boundary}--\r\n".encode())
    status, headers, body = call(urllib.request.Request(
        f"{BASE}/enterprise/auth/v1/password", data=b"".join(chunks), method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}",
                 "Accept": "application/json"}))
    loc = ""
    if status == 200:
        loc = json.loads(body)["data"].get("redirectUri") or ""
    elif status in (302, 303):
        loc = headers.get("Location", "")
    else:
        sys.exit(f"password 失败 client={client_id} status={status} body={body[:600]!r}")
    m = re.search(r"[?&]code=([^&]+)", loc)
    if not m:
        sys.exit(f"password 未返回 code: {loc}")
    code = urllib.parse.unquote(m.group(1))

    status, _, body = call(urllib.request.Request(
        f"{BASE}/enterprise/auth/v1/token",
        data=json.dumps({"grantType": "authorization_code", "code": code,
                         "clientId": client_id, "redirectUri": REDIRECT,
                         "codeVerifier": verifier,
                         "installationId": installation_id}).encode(),
        method="POST", headers={"Content-Type": "application/json",
                                "Accept": "application/json"}))
    if status != 200:
        sys.exit(f"token 失败 client={client_id} status={status} body={body[:600]!r}")
    data = json.loads(body)["data"]
    if verbose:
        print(f"[auth] token OK clientId={data.get('clientId')} len={len(data['accessToken'])}")
    return data["accessToken"]


def admin_token(verbose: bool = True) -> str:
    """管理端 token：client_id=ent-admin-cli + 随机 uuid4 installation_id。"""
    return _pkce_login(ADMIN_CLIENT, str(uuid.uuid4()), verbose)


def device_token(installation_id: str = None, verbose: bool = True) -> str:
    """员工端 token：必须是已注册 ACTIVE 设备的 installation_id + client_id=dsh-desktop。"""
    installation_id = installation_id or DEVICE_INSTALLATION
    if not installation_id:
        sys.exit("缺少员工端 installation_id:请设置环境变量 INSTALLATION_ID,或传入已注册设备 id")
    return _pkce_login(DEVICE_CLIENT, installation_id, verbose)


def bearer(token: str) -> dict:
    return {"Accept": "application/json", "Authorization": f"Bearer {token}"}


def get_json(path: str, token: str):
    status, _, body = call(urllib.request.Request(BASE + path, headers=bearer(token)))
    try:
        return status, json.loads(body)
    except Exception:
        return status, body.decode(errors="replace")


def admin_skills_all(token: str, limit: int = 50):
    """管理端技能列表带游标分页，这里翻完全部页。"""
    items, cursor, pages = [], None, 0
    while True:
        path = f"/enterprise/admin/v1/skills?limit={limit}"
        if cursor:
            path += "&cursor=" + urllib.parse.quote(cursor)
        status, payload = get_json(path, token)
        pages += 1
        if status != 200:
            return status, items, payload, pages
        data = payload["data"]
        items.extend(data["items"])
        if not data["page"]["hasMore"]:
            return status, items, None, pages
        cursor = data["page"]["nextCursor"]
        if pages > 40:
            raise RuntimeError("翻页超过 40 页，疑似游标未前进")
