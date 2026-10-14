#!/usr/bin/env python3
"""Protected GitHub gate for K11 independent signed editorial review.

Never execute PR code or trust PR descriptions/agent claims as instructions.
GitHub Actions (not the GPU worker) enforces protected source boundaries,
checks a separate local reviewer's Ed25519 signature, then asks GitHub to
enforce its native branch rules. No Copilot subscription is required.
"""
import base64
import binascii
import difflib
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
import urllib.request

import tdq_draft_triage as tdq

REPO = "CrashyCrash/offbeat-website"
RELEASE = "tdq-editorial-release"
HOLD = "tdq-release-hold"
SOURCE_STATUS = "TDQ Verified Editorial Source"
REVIEW_STATUS = "TDQ Signed Independent Review"
PUBLIC_KEY = Path(__file__).with_name("reviewer-public.pem")
COMMENT = re.compile(r"<!-- TDQ-SIGNED-REVIEW-V1\n([^\n]{1,8000})\n-->")
BRANCH = re.compile(r"tdq/proof-auto-[0-9a-f]{14}\Z")
SHA = re.compile(r"[0-9a-f]{40}\Z")
# These patterns are additional triage only; no regex proves factual accuracy.
FACT_RISK = re.compile(
    r"(?i)(?:\d|[$%]|\b(?:free|license|lifetime|subscription|price|pricing|"
    r"guarantee|always|never|only|every|best|verified|tested|ranked|"
    r"compatible|ship|deliver|promise|respond|reply|available|"
    r"copyright|monetiz|tomorrow|today|quickly|immediately|"
    r"day|week|month|hour|year|faster|slow|safe|unsafe)\b)"
)


def api(endpoint, method="GET", fields=None):
    cmd = ["gh", "api", "--hostname", "github.com", "-X", method,
           "repos/" + REPO + "/" + endpoint]
    for key, value in (fields or {}).items():
        cmd += ["-f", key + "=" + str(value)]
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
    if p.returncode:
        raise ValueError("trusted GitHub request failed: " + endpoint.split("/")[0])
    return json.loads(p.stdout)


def git(*args):
    return tdq.git(*args).decode("utf-8", "strict").strip()


def status(sha, name, state, description):
    api("statuses/" + sha, "POST", {
        "state": state, "context": name, "description": description[:125],
        "target_url": os.environ["GITHUB_SERVER_URL"] + "/" + REPO +
                      "/actions/runs/" + os.environ["GITHUB_RUN_ID"]
    })


class Structure(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tokens = []

    def handle_starttag(self, tag, attrs):
        self.tokens.append(("start", tag, tuple(attrs)))

    def handle_startendtag(self, tag, attrs):
        self.tokens.append(("empty", tag, tuple(attrs)))

    def handle_endtag(self, tag):
        self.tokens.append(("end", tag))

    def handle_decl(self, decl):
        self.tokens.append(("decl", decl))

    def unknown_decl(self, decl):
        self.tokens.append(("decl-unknown", decl))

    def handle_comment(self, data):
        self.tokens.append(("comment", data))

    def handle_entityref(self, name):
        self.tokens.append(("entity", name))

    def handle_charref(self, name):
        self.tokens.append(("charref", name))


def low_risk_editorial(old, new, path):
    # Do not autonomously rewrite legal notices or owner correspondence
    # promises even when the page otherwise looks like normal HTML.
    if path in ("privacy.html", "disclosure.html", "contact.html", "terms.html"):
        raise ValueError("policy, contact and disclosure pages need stronger approval")
    if len(old) > 350_000 or len(new) > 350_000:
        raise ValueError("oversized HTML source")
    before, after = old.decode("utf-8", "strict"), new.decode("utf-8", "strict")
    a, b = Structure(), Structure()
    a.feed(before)
    b.feed(after)
    if a.tokens != b.tokens:
        raise ValueError("markup attributes, declarations or comments changed")
    for tag in ("style", "svg", "template"):
        rx = re.compile(r"(?is)<" + tag + r"\b[^>]*>.*?</" + tag + r"\s*>")
        if rx.findall(before) != rx.findall(after):
            raise ValueError("protected embedded markup changed")
    main = re.compile(r"(?is)<main\b[^>]*>.*?</main\s*>")
    if len(main.findall(before)) != 1 or len(main.findall(after)) != 1:
        raise ValueError("one reader-visible main content element required")
    if main.findall(before) == main.findall(after):
        raise ValueError("metadata-only edit cannot enter release lane")
    report = tdq.analyze(old, new, path)
    if report["structured_data_changed"] or report["risk_lines"]:
        raise ValueError("changed structured data or factual-risk claims")
    add = rem = 0
    changes = []
    added = []
    removed = []
    for line in difflib.unified_diff(before.splitlines(), after.splitlines(), n=0):
        if line.startswith("+") and not line.startswith("+++"):
            add += 1
            changes.append(line[1:])
            added.append(line[1:])
        elif line.startswith("-") and not line.startswith("---"):
            rem += 1
            changes.append(line[1:])
            removed.append(line[1:])
    # Even one changed HTML line may be huge; bound total changed bytes too.
    if add > 40 or rem > 40 or add + rem > 75 or sum(map(len, changes)) > 2500:
        raise ValueError("editorial patch exceeds conservative size budget")
    # Permit removing an unsupported promotional claim only after the
    # separate actual signed semantic reviewer proves this is net beneficial.
    # NEVER allow deletion of required disclosure/legal/accessibility/safety
    # language just because it appears on a normal tutorial page.
    if any(re.search(r"(?i)\b(?:affiliate|disclos\w*|copyright|privacy|"
                     r"consent|refund|terms|accessib\w*|safety|warning)\b", x)
           for x in removed):
        raise ValueError("protected legal/disclosure/safety claim was removed")
    if any(FACT_RISK.search(x) for x in added):
        raise ValueError("new factual/commercial/timing claim needs stronger review")
    return report


class MergedButUnverified(RuntimeError):
    """A real GitHub merge happened but public deployment was NOT proven."""


def canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=False).encode("utf-8")


def verify_signature(payload, signature):
    if not PUBLIC_KEY.is_file() or len(signature) > 200:
        return False
    try:
        binary = base64.b64decode(signature, validate=True)
    except (ValueError, binascii.Error):
        return False
    if len(binary) != 64:  # Ed25519 signature size.
        return False
    with tempfile.TemporaryDirectory(prefix="tdq-signed-verdict-") as folder:
        data = Path(folder, "payload")
        sig = Path(folder, "signature")
        data.write_bytes(canonical(payload))
        sig.write_bytes(binary)
        p = subprocess.run(["openssl", "pkeyutl", "-verify", "-pubin",
                            "-inkey", str(PUBLIC_KEY), "-rawin",
                            "-in", str(data), "-sigfile", str(sig)],
                           capture_output=True, timeout=12)
        return p.returncode == 0


def signed_review(comments, pr, sha, base, path, now):
    if len(comments) >= 100:
        raise ValueError("review comments exceeded bounded API page")
    valid = []
    for item in comments:
        body = item.get("body") or ""
        matches = COMMENT.findall(body)
        if len(matches) != 1:
            continue
        try:
            envelope = json.loads(matches[0])
            if set(envelope) != {"payload", "signature"}:
                continue
            signed = envelope["payload"]
            if not isinstance(signed, dict) or set(signed) != {
                "schema", "repo", "pr", "head", "base", "paths", "verdict",
                "issued_at", "expires_at", "reviewer", "reason"}:
                continue
            if (signed["schema"] != "tdq-review-v1" or signed["repo"] != REPO
                    or signed["pr"] != pr or signed["head"] != sha
                    or signed["base"] != base or signed["paths"] != [path]
                    or signed["verdict"] not in ("APPROVE", "REJECT")
                    or signed["reviewer"] != "k11-isolated-ollama-review"
                    or not isinstance(signed["reason"], str)
                    or not 30 <= len(signed["reason"]) <= 1500
                    or not isinstance(signed["issued_at"], int)
                    or not isinstance(signed["expires_at"], int)
                    or not now - 21600 <= signed["issued_at"] <= now + 60
                    or not now < signed["expires_at"] <= signed["issued_at"] + 21600):
                continue
            if verify_signature(signed, envelope["signature"]):
                # Highest actual SIGNED timestamp wins, not GitHub comment
                # chronology. Reposting an old approved envelope cannot
                # override a newer separately signed REJECT.
                valid.append((signed["issued_at"],
                              signed["verdict"] == "REJECT",
                              signed["verdict"]))
        except (ValueError, TypeError, KeyError, OSError):
            continue
    if not valid:
        return False
    latest = max(valid)
    return latest[2] == "APPROVE"


def policy_mode():
    """Preflight under legacy protection; release ONLY under new exact rules.

    Preflight writes trusted source/review statuses on actual K11 signed
    candidates but CANNOT merge or mark ready. This breaks the migration
    chicken-and-egg problem without weakening old DatBotty protections.
    """
    r = api("rulesets/22973860")
    if (r.get("enforcement") != "active" or r.get("target") != "branch"
            or r.get("source") != REPO):
        raise ValueError("active protected-main ruleset not present")
    refs = (r.get("conditions") or {}).get("ref_name") or {}
    # GitHub exclusion rules may use wildcards; no exclusion is acceptable
    # for this dedicated main-only release protection rule.
    if ("refs/heads/main" not in refs.get("include", [])
            or refs.get("exclude")):
        raise ValueError("protected main branch scope changed or excluded")
    checks, pull = None, None
    for rule in r.get("rules") or []:
        if rule.get("type") == "required_status_checks":
            checks = rule.get("parameters")
        if rule.get("type") == "pull_request":
            pull = rule.get("parameters")
    required = {x.get("context"): x.get("integration_id") for x in
                (checks or {}).get("required_status_checks", [])}
    if (not checks or checks.get("strict_required_status_checks_policy") is not True
            or not pull or pull.get("required_review_thread_resolution") is not True
            or pull.get("dismiss_stale_reviews_on_push") is not True):
        raise ValueError("native GitHub branch protection weakened")
    if required == {"DatBotty Deterministic Gate": 15368,
                    "DatBotty T1 Review": 15368}:
        return "PREFLIGHT_ONLY"
    if (required == {SOURCE_STATUS: 15368, REVIEW_STATUS: 15368}
            and not (r.get("bypass_actors") or [])
            and r.get("current_user_can_bypass") == "never"):
        return "PROTECTED_RELEASE"
    raise ValueError("unknown or unsafe protected-main policy; do not release")


def check(pr):
    number = pr["number"]
    fresh = api("pulls/" + str(number))
    head, base = fresh["head"], fresh["base"]
    if (fresh.get("state") != "open"
            or head.get("repo", {}).get("full_name") != REPO
            or not BRANCH.fullmatch(head.get("ref") or "")
            or base.get("ref") != "main"
            or RELEASE not in {x.get("name") for x in fresh.get("labels", [])}
            or HOLD in {x.get("name") for x in fresh.get("labels", [])}):
        raise ValueError("unqualified or held TDQ candidate")
    sha, old = head["sha"], base["sha"]
    main = api("git/ref/heads/main")["object"]["sha"]
    if not SHA.fullmatch(sha) or old != main:
        raise ValueError("stale main or invalid immutable head")
    command = ["git", "fetch", "--no-tags", "origin",
               "refs/pull/%d/head" % number]
    subprocess.run(command, check=True, capture_output=True, timeout=65)
    if git("rev-parse", "FETCH_HEAD") != sha:
        raise ValueError("candidate changed during checkout-free git fetch")
    subprocess.run(["git", "merge-base", "--is-ancestor", old, sha],
                   check=True, capture_output=True, timeout=15)
    changed = git("diff", "--no-renames", "--name-status", old, sha, "--")
    paths = tdq.bounded_paths(changed.splitlines())
    if len(paths) != 1:
        raise ValueError("standing release authority is single existing HTML only")
    path = paths[0]
    before = tdq.git("show", old + ":" + path)
    after = tdq.git("show", sha + ":" + path)
    low_risk_editorial(before, after, path)
    comments = api("issues/" + str(number) + "/comments?per_page=100")
    if not signed_review(comments, number, sha, old, path, int(time.time())):
        raise ValueError("no current independent K11 reviewer signed approval")
    return number, sha, old, path


def verify_pages_source():
    pages = api("pages")
    if (pages.get("build_type") != "legacy"
            or pages.get("source") != {"branch": "main", "path": "/"}
            or pages.get("cname") != "offbeatinc.com"):
        raise ValueError("public Pages source no longer main:/ offbeatinc.com")


def finalize(pr, mode):
    number, sha, old, path = check(pr)
    verify_pages_source()
    if policy_mode() != mode:
        raise ValueError("main ruleset changed during candidate check")
    # Status contexts are issued *only* by this protected GitHub Actions
    # workflow after verifying candidate bytes and an independent signature.
    status(sha, SOURCE_STATUS, "success", "Bounded source verified on protected main")
    status(sha, REVIEW_STATUS, "success", "Distinct-key K11 reviewer signature verified")
    if mode != "PROTECTED_RELEASE":
        print("TDQ_PREFLIGHT_SIGNED_STATUSES_PROVEN_NO_MERGE pr=%d head=%s" %
              (number, sha), flush=True)
        return
    # GitHub GITHUB_TOKEN does NOT retrigger workflows after 'ready'. This
    # same execution must finish release without waiting on generated events.
    now = api("pulls/" + str(number))
    if now.get("draft") is True:
         # gh pr ready uses GraphQL, not the REST PR PATCH above.
        p = subprocess.run(["gh", "pr", "ready", str(number), "-R", REPO],
                           capture_output=True, text=True, timeout=35)
        if p.returncode:
            raise ValueError("provider refused moving approved draft to ready")
    # Re-evaluate immutable branch/head/base/label/signature and active rules
    # immediately before the atomic native provider merge.
    if check(pr)[:3] != (number, sha, old):
        raise ValueError("candidate or review changed before provider merge")
    if policy_mode() != "PROTECTED_RELEASE":
        raise ValueError("protected release authority removed before merge")
    result = api("pulls/" + str(number) + "/merge", "PUT", {
        "sha": sha, "merge_method": "merge",
        "commit_title": "Protected signed local TDQ editorial release (#%d)" % number})
    if not result.get("merged"):
        raise ValueError("native protected GitHub merge refused")
    merge_sha = result["sha"]
    print("TDQ_NATIVE_MERGED pr=%d head=%s merge=%s path=%s" %
          (number, sha, merge_sha, path), flush=True)
    merged = api("commits/" + merge_sha)
    if [p["sha"] for p in merged.get("parents", [])] != [old, sha]:
        raise MergedButUnverified("merge occurred but exact protected parentage is UNPROVEN")
    if api("git/ref/heads/main")["object"]["sha"] != merge_sha:
        raise MergedButUnverified("merge occurred but protected main moved unexpectedly")
    # GITHUB_TOKEN-driven merges may suppress normal Pages push builds.
    build = api("pages/builds", "POST")
    print("TDQ_PAGES_BUILD_REQUESTED " + str(build.get("status", "accepted")),
          flush=True)
    # The remote merge commit is NOT fetched into this Actions checkout.
    # We already verified protected parentage [old, candidate SHA]; the
    # candidate's immutable path blob is the published main result.
    expected = tdq.git("show", sha + ":" + path)
    url = "https://offbeatinc.com/" + path + "?tdq_verify=" + merge_sha[:12]
    for attempt in range(12):
        try:
            request = urllib.request.Request(
                url, headers={"User-Agent": "TaskDatty-public-byte-verify/1",
                              "Cache-Control": "no-cache"})
            with urllib.request.urlopen(request, timeout=12) as web:
                actual = web.read(350_001)
            if actual == expected:
                print("TDQ_PUBLIC_BYTES_VERIFIED path=" + path +
                      " merge=" + merge_sha, flush=True)
                return
        except (OSError, ValueError) as ex:
            print("TDQ_PUBLIC_READBACK_RETRY " + type(ex).__name__, flush=True)
        time.sleep(15)
    raise MergedButUnverified("MERGED_BUT_LIVE_PAGE_BYTES_UNPROVEN: " + path)


def selftest():
    old = b'<!doctype html><main><p>Vague guidance.</p></main>'
    new = b'<!doctype html><main><p>Clearer guidance.</p></main>'
    low_risk_editorial(old, new, "guide.html")
    try:
        low_risk_editorial(old, new, "contact.html")
    except ValueError:
        pass
    else:
        raise AssertionError("automated release must not change contact policy")
    try:
        low_risk_editorial(
            b'<!doctype html><main><p>Affiliate disclosure is required.</p></main>',
            b'<!doctype html><main><p>Useful introduction.</p></main>',
            "guide.html")
    except ValueError:
        pass
    else:
        raise AssertionError("removing required disclosure must be held")
    for bad in (b'<main><p>Clearer guidance.</p></main>',
                b'<!doctype html><main><div>Clearer guidance.</div></main>',
                b'<!doctype html><main><p>Guaranteed $100.</p></main>',
                b'<!doctype html><main><!-- changed --><p>Fine.</p></main>',
                b'<!doctype html><main><p>' + b"x" * 3500 + b'</p></main>'):
        try:
            low_risk_editorial(old, bad, "guide.html")
        except ValueError:
            pass
        else:
            raise AssertionError("unsafe source modification was accepted")
    payload = {"schema":"tdq-review-v1","repo":REPO,"pr":1,
               "head":"a"*40,"base":"b"*40,"paths":["guide.html"],
               "verdict":"APPROVE","issued_at":123,"expires_at":456,
               "reviewer":"k11-isolated-ollama-review","reason":"Independent review verified this correction against policy."}
    assert not signed_review([], 1, "a"*40, "b"*40, "guide.html", 150)
    assert not signed_review([{"body":"<!-- TDQ-SIGNED-REVIEW-V1\n"+
                              json.dumps({"payload":payload,"signature":"junk"})+
                              "\n-->"}], 1, "a"*40, "b"*40, "guide.html", 150)
    # Exercise REAL Ed25519 signature verification using an ephemeral test
    # key, never the protected production reviewer private key.
    original_key = PUBLIC_KEY
    try:
        with tempfile.TemporaryDirectory(prefix="tdq-review-fixture-") as tmp:
            priv = Path(tmp, "reviewer.key")
            pub = Path(tmp, "reviewer.pub")
            source = Path(tmp, "payload")
            sig = Path(tmp, "signature")
            subprocess.run(["openssl", "genpkey", "-algorithm", "Ed25519",
                            "-out", str(priv)], check=True,
                           capture_output=True, timeout=15)
            subprocess.run(["openssl", "pkey", "-in", str(priv), "-pubout",
                            "-out", str(pub)], check=True,
                           capture_output=True, timeout=15)
            now = 100_000
            signed = dict(payload, issued_at=now, expires_at=now + 2000)
            source.write_bytes(canonical(signed))
            signature = subprocess.run(["openssl", "pkeyutl", "-sign",
                                        "-inkey", str(priv), "-rawin",
                                        "-in", str(source)], check=True,
                                       capture_output=True, timeout=15).stdout
            globals()["PUBLIC_KEY"] = pub
            encoded = base64.b64encode(signature).decode("ascii")
            assert verify_signature(signed, encoded)
            comment = lambda obj: [{"body":
                "<!-- TDQ-SIGNED-REVIEW-V1\n" +
                json.dumps({"payload": obj, "signature": encoded}) +
                "\n-->"}]
            # Real signed exact-head verification succeeds.
            assert signed_review(comment(signed), 1, "a"*40, "b"*40,
                                 "guide.html", now)
            assert not signed_review(comment(signed), 1, "c"*40, "b"*40,
                                     "guide.html", now)
            assert not signed_review(comment(signed), 1, "a"*40, "b"*40,
                                     "guide.html", now + 3000)
            # Later valid signed REJECT dominates earlier APPROVE.
            rejected = dict(signed, verdict="REJECT")
            # Rejection must carry a strictly newer signing time.
            rejected["issued_at"] = now + 1
            rejected["expires_at"] = now + 2001
            source.write_bytes(canonical(rejected))
            reject_sig = subprocess.run(["openssl", "pkeyutl", "-sign",
                                         "-inkey", str(priv), "-rawin",
                                         "-in", str(source)], check=True,
                                        capture_output=True, timeout=15).stdout
            reject_entry = {"body": "<!-- TDQ-SIGNED-REVIEW-V1\n" +
                json.dumps({"payload": rejected,
                            "signature": base64.b64encode(reject_sig).decode()}) +
                "\n-->"}
            assert not signed_review(comment(signed)+[reject_entry], 1,
                                     "a"*40, "b"*40, "guide.html", now)
            # A later posted replay of the old APPROVE cannot defeat REJECT.
            assert not signed_review(comment(signed)+[reject_entry]+comment(signed),
                                     1, "a"*40, "b"*40, "guide.html", now)
    finally:
        globals()["PUBLIC_KEY"] = original_key
    # The existing incompatible DatBotty rules may permit status-only
    # preflight, but no native merge. A mocked GitHub config exercises
    # exact integration IDs, active main scope and no bypass authority.
    legacy = {
        "enforcement": "active", "target": "branch", "source": REPO,
        "conditions": {"ref_name": {"include": ["refs/heads/main"],
                                     "exclude": []}},
        "bypass_actors": [{"actor_type": "User", "actor_id": 191937709}],
        "current_user_can_bypass": "pull_requests_only",
        "rules": [
            {"type": "pull_request", "parameters": {
                "required_review_thread_resolution": True,
                "dismiss_stale_reviews_on_push": True}},
            {"type": "required_status_checks", "parameters": {
                "strict_required_status_checks_policy": True,
                "required_status_checks": [
                    {"context": "DatBotty Deterministic Gate",
                     "integration_id": 15368},
                    {"context": "DatBotty T1 Review",
                     "integration_id": 15368}]}}]}
    orig_api = globals()["api"]
    try:
        globals()["api"] = lambda path: legacy
        assert policy_mode() == "PREFLIGHT_ONLY"
        new_rules = json.loads(json.dumps(legacy))
        new_rules["bypass_actors"] = []
        new_rules["current_user_can_bypass"] = "never"
        new_rules["rules"][1]["parameters"]["required_status_checks"] = [
            {"context": SOURCE_STATUS, "integration_id": 15368},
            {"context": REVIEW_STATUS, "integration_id": 15368}]
        globals()["api"] = lambda path: new_rules
        assert policy_mode() == "PROTECTED_RELEASE"
        for unsafe in ("excluded", "bypass", "status"):
            bad = json.loads(json.dumps(new_rules))
            if unsafe == "excluded":
                bad["conditions"]["ref_name"]["exclude"] = ["refs/heads/*"]
            elif unsafe == "bypass":
                bad["bypass_actors"] = [{"actor_type": "User",
                                        "actor_id": 191937709}]
            else:
                bad["rules"][1]["parameters"]["required_status_checks"][1][
                    "integration_id"] = 0
            globals()["api"] = lambda path, data=bad: data
            try:
                policy_mode()
            except ValueError:
                pass
            else:
                raise AssertionError("unsafe native ruleset accepted: " + unsafe)
    finally:
        globals()["api"] = orig_api
    print("TDQ_SIGNED_GATE_SELFTEST_OK")


def main():
    if "--self-test" in sys.argv:
        selftest()
        return
    if os.environ.get("GITHUB_REPOSITORY") != REPO:
        raise ValueError("wrong repository; no release authority")
    if not all(os.environ.get(x) for x in ("GH_TOKEN", "GITHUB_RUN_ID",
                                           "GITHUB_SERVER_URL")):
        raise ValueError("missing trusted workflow identity")
    selftest()
    mode = policy_mode()  # Legacy remains protected, preflight only.
    prs = api("pulls?state=open&per_page=100")
    if len(prs) >= 100:
        raise ValueError("unbounded PR inventory")
    for pr in sorted(prs, key=lambda x: x["number"]):
        if (not (pr.get("head") or {}).get("ref", "").startswith("tdq/proof-auto-")
                or RELEASE not in {x.get("name") for x in pr.get("labels", [])}
                or HOLD in {x.get("name") for x in pr.get("labels", [])}):
            continue
        try:
            finalize(pr, mode)
            return
        except (ValueError, KeyError, TypeError, OSError,
                subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            print("TDQ_RELEASE_WITHHELD pr=%s reason=%s" %
                  (pr.get("number"), str(e)[:140]), file=sys.stderr)
    print("TDQ_NO_VERIFIED_RELEASE_AVAILABLE")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError, MergedButUnverified,
            subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        print("TDQ_PROTECTED_ABORTED " + str(error)[:140], file=sys.stderr)
        sys.exit(2)
