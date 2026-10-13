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
    for line in difflib.unified_diff(before.splitlines(), after.splitlines(), n=0):
        if line.startswith("+") and not line.startswith("+++"):
            add += 1
            changes.append(line[1:])
            added.append(line[1:])
        elif line.startswith("-") and not line.startswith("---"):
            rem += 1
            changes.append(line[1:])
    # Even one changed HTML line may be huge; bound total changed bytes too.
    if add > 40 or rem > 40 or add + rem > 75 or sum(map(len, changes)) > 2500:
        raise ValueError("editorial patch exceeds conservative size budget")
    if any(FACT_RISK.search(x) for x in added):
        # Conservative policy: any NEW obvious numeric/price/timeline/spec
        # assertion goes to a stronger review lane, including safe deletions.
        raise ValueError("potential factual/commercial/timing claim requires stronger review")
    return report


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
    for item in reversed(comments):
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
                    or signed["verdict"] != "APPROVE"
                    or signed["reviewer"] != "k11-isolated-ollama-review"
                    or not isinstance(signed["reason"], str)
                    or not 30 <= len(signed["reason"]) <= 1500
                    or not isinstance(signed["issued_at"], int)
                    or not isinstance(signed["expires_at"], int)
                    or not now - 21600 <= signed["issued_at"] <= now + 60
                    or not now < signed["expires_at"] <= signed["issued_at"] + 21600):
                continue
            if verify_signature(signed, envelope["signature"]):
                return True
        except (ValueError, TypeError, KeyError, OSError):
            continue
    return False


def ruleset_ready():
    r = api("rulesets/22973860")
    if (r.get("enforcement") != "active" or r.get("target") != "branch"
            or r.get("source") != REPO
            or (r.get("bypass_actors") or [])
            or r.get("current_user_can_bypass") != "never"):
        raise ValueError("active non-bypass ruleset required")
    refs = (r.get("conditions") or {}).get("ref_name") or {}
    if "refs/heads/main" not in refs.get("include", []):
        raise ValueError("protected main branch not scoped")
    checks, pull = None, None
    for rule in r.get("rules") or []:
        if rule.get("type") == "required_status_checks":
            checks = rule.get("parameters")
        if rule.get("type") == "pull_request":
            pull = rule.get("parameters")
    required = {x.get("context"): x.get("integration_id") for x in
                (checks or {}).get("required_status_checks", [])}
    if (not checks or checks.get("strict_required_status_checks_policy") is not True
            or required != {SOURCE_STATUS: 15368, REVIEW_STATUS: 15368}
            or not pull or pull.get("required_review_thread_resolution") is not True
            or pull.get("dismiss_stale_reviews_on_push") is not True):
        raise ValueError("native GitHub protection is not the independently signed TDQ policy")


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


def finalize(pr):
    number, sha, old, path = check(pr)
    ruleset_ready()
    # Status contexts are issued *only* by this protected GitHub Actions
    # workflow after verifying candidate bytes and an independent signature.
    status(sha, SOURCE_STATUS, "success", "Bounded source verified on protected main")
    status(sha, REVIEW_STATUS, "success", "Distinct-key K11 reviewer signature verified")
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
    ruleset_ready()
    result = api("pulls/" + str(number) + "/merge", "PUT", {
        "sha": sha, "merge_method": "merge",
        "commit_title": "Protected signed local TDQ editorial release (#%d)" % number})
    if not result.get("merged"):
        raise ValueError("native protected GitHub merge refused")
    print("TDQ_NATIVE_MERGED pr=%d head=%s merge=%s path=%s" %
          (number, sha, result["sha"], path))


def selftest():
    old = b'<!doctype html><main><p>Vague guidance.</p></main>'
    new = b'<!doctype html><main><p>Clearer guidance.</p></main>'
    low_risk_editorial(old, new, "guide.html")
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
    ruleset_ready()  # Fail closed until protected rule migration is proven.
    prs = api("pulls?state=open&per_page=100")
    if len(prs) >= 100:
        raise ValueError("unbounded PR inventory")
    for pr in sorted(prs, key=lambda x: x["number"]):
        if (not (pr.get("head") or {}).get("ref", "").startswith("tdq/proof-auto-")
                or RELEASE not in {x.get("name") for x in pr.get("labels", [])}
                or HOLD in {x.get("name") for x in pr.get("labels", [])}):
            continue
        try:
            finalize(pr)
            return
        except (ValueError, KeyError, TypeError, OSError,
                subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            print("TDQ_RELEASE_WITHHELD pr=%s reason=%s" %
                  (pr.get("number"), str(e)[:140]), file=sys.stderr)
    print("TDQ_NO_VERIFIED_RELEASE_AVAILABLE")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError,
            subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        print("TDQ_PROTECTED_ABORTED " + str(error)[:140], file=sys.stderr)
        sys.exit(2)
