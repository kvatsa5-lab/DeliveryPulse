/**
 * API integration tests against a real worker runtime (workerd + miniflare D1/R2).
 *
 * The route handlers read their bindings from the module-level `cloudflare:workers`
 * env, so they cannot be exercised by importing the built worker in plain Node --
 * that is why the original suite only covered HTML. These tests drive a running
 * dev server over HTTP instead, which is the only way to cover the paths that
 * matter most here: runbook approval, the upload allowlist, and identity handling.
 *
 * If a server cannot be reached or started the tests skip with a clear reason
 * rather than failing, so a machine without the toolchain does not report a red
 * suite it cannot fix. Skips are visible in the runner summary.
 */
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { readdir } from "node:fs/promises";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const BASE = process.env.DP_TEST_BASE_URL ?? "http://localhost:3000";
const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const APPROVER = "kshitij.vatsa@sonatype.com";
const ENGINEER = "junior.engineer@sonatype.com";
const BOOT_TIMEOUT_MS = 90_000;

/** Unique per run so tests never collide on titles or depend on a clean database. */
let sequence = 0;
const uniqueTitle = (label) => `test-${process.pid}-${++sequence}-${label}`;

let child = null;
let skipReason = null;
/** Set when a non-approver row could be added, enabling the deny-path test. */
let engineerSeeded = false;

function as(email, init = {}) {
  const headers = { ...(init.headers ?? {}) };
  if (email) headers["oai-authenticated-user-email"] = email;
  return { ...init, headers };
}

const api = (path, email, init) => fetch(`${BASE}${path}`, as(email, init));

const json = (path, email, body, method = "POST") =>
  api(path, email, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

/** POST a multipart runbook with one attachment. */
function upload(email, title, { fileName, mimeType, bytes = "content" }) {
  const form = new FormData();
  form.set("type", "runbooks");
  form.set("title", title);
  form.set("product", "IQ Server");
  form.set("environment", "AWS");
  form.set("architecture", "HA");
  form.set("owner", "tester");
  form.set("attachment", new File([bytes], fileName, { type: mimeType }));
  return api("/api/operating", email, { method: "POST", body: form });
}

const listRunbooks = async (email = APPROVER) =>
  (await (await api("/api/operating?type=runbooks", email)).json()).records ?? [];

const findRunbook = async (title) =>
  (await listRunbooks()).find((record) => record.title === title);

async function reachable() {
  try {
    const response = await fetch(`${BASE}/api/me`, { signal: AbortSignal.timeout(2000) });
    return response.status === 403 || response.status === 200;
  } catch {
    return false;
  }
}

async function waitForServer(deadline) {
  while (Date.now() < deadline) {
    if (await reachable()) return true;
    if (child?.exitCode !== null && child?.exitCode !== undefined) return false;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

/**
 * Add a member whose role does not grant approval, so the deny path can be
 * exercised. There is no API for roster management (a genuine product gap), so
 * this writes to the local miniflare D1 file directly. Best effort: if the file
 * or the sqlite3 binary is missing, the dependent test skips.
 */
async function seedEngineer() {
  try {
    const dir = `${REPO_ROOT}.wrangler/state/v3/d1/miniflare-D1DatabaseObject`;
    const file = (await readdir(dir)).find(
      (name) => name.endsWith(".sqlite") && name !== "metadata.sqlite"
    );
    if (!file) return false;
    await execFileAsync("sqlite3", [
      `${dir}/${file}`,
      `INSERT OR IGNORE INTO team_members (email,role,active,created_at)
       VALUES ('${ENGINEER}','Delivery Engineer',1,'2026-01-01T00:00:00.000Z');`,
    ]);
    const me = await (await api("/api/me", ENGINEER)).json();
    return me?.member?.canApprove === false;
  } catch {
    return false;
  }
}

before(async () => {
  if (await reachable()) return;

  if (process.env.DP_TEST_BASE_URL) {
    skipReason = `no server reachable at ${BASE} (DP_TEST_BASE_URL was set)`;
    return;
  }

  child = spawn("npm", ["run", "dev"], {
    cwd: REPO_ROOT,
    stdio: "ignore",
    detached: false,
    env: { ...process.env, WRANGLER_LOG_PATH: "/dev/null" },
  });
  child.once("error", () => {});

  if (!(await waitForServer(Date.now() + BOOT_TIMEOUT_MS))) {
    skipReason = `dev server did not become ready within ${BOOT_TIMEOUT_MS / 1000}s`;
    return;
  }
  engineerSeeded = await seedEngineer();
});

after(async () => {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  const exited = await Promise.race([
    once(child, "exit").then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 5000)),
  ]);
  if (!exited) child.kill("SIGKILL");
});

/** Skips the current test when no runtime is available. */
const requireServer = (t) => (skipReason ? (t.skip(skipReason), true) : false);

describe("identity and access", () => {
  it("denies anonymous callers on every collection", async (t) => {
    if (requireServer(t)) return;
    for (const path of [
      "/api/engagements",
      "/api/me",
      "/api/operating?type=runbooks",
      "/api/operating?type=improvements",
      "/api/operating?type=assessments",
    ]) {
      const response = await api(path, null);
      assert.equal(response.status, 403, `${path} must reject anonymous access`);
      assert.equal((await response.json()).code, "ACCESS_DENIED");
    }
  });

  it("denies an authenticated address that is not on the roster", async (t) => {
    if (requireServer(t)) return;
    const response = await api("/api/engagements", "stranger@nowhere.example");
    assert.equal(response.status, 403);
  });

  it("reports the signed-in member and their approval right", async (t) => {
    if (requireServer(t)) return;
    const { member } = await (await api("/api/me", APPROVER)).json();
    assert.equal(member.email, APPROVER);
    assert.equal(member.canApprove, true);
  });
});

describe("request body handling", () => {
  // Regression: these all returned 500 SERVER_ERROR, reporting a caller mistake
  // as a server fault and inflating the 5xx rate that alerting hangs off.
  const malformed = {
    "truncated JSON": '{"engagementId":,}',
    "empty body": "",
    "a JSON array": "[1,2,3]",
    "a bare string": '"hello"',
    "JSON null": "null",
  };

  for (const [label, body] of Object.entries(malformed)) {
    it(`answers 400, not 500, for ${label}`, async (t) => {
      if (requireServer(t)) return;
      const response = await api("/api/updates", APPROVER, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      assert.equal(response.status, 400, `${label} must be a client error`);
      assert.equal((await response.json()).code, "VALIDATION_FAILED");
    });
  }
});

describe("runbook approval", () => {
  it("creates a runbook awaiting review", async (t) => {
    if (requireServer(t)) return;
    const title = uniqueTitle("create");
    const response = await json("/api/operating", APPROVER, {
      type: "runbooks",
      title,
      product: "Nexus Repository",
      environment: "Kubernetes",
      architecture: "HA",
      owner: "tester",
    });
    assert.equal(response.status, 201);
    assert.equal((await findRunbook(title))?.approval, "Review needed");
  });

  it("approves a runbook and persists the new state", async (t) => {
    if (requireServer(t)) return;
    const title = uniqueTitle("approve");
    const { id } = await (
      await json("/api/operating", APPROVER, {
        type: "runbooks",
        title,
        product: "Lifecycle",
        environment: "GCP",
        architecture: "Single node",
        owner: "tester",
      })
    ).json();

    const response = await json(
      `/api/operating?type=runbooks&id=${id}`,
      APPROVER,
      { approval: "Approved" },
      "PATCH"
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).approval, "Approved");
    assert.equal((await findRunbook(title))?.approval, "Approved");
  });

  it("can send an approved runbook back for review", async (t) => {
    if (requireServer(t)) return;
    const title = uniqueTitle("sendback");
    const { id } = await (
      await json("/api/operating", APPROVER, {
        type: "runbooks",
        title,
        product: "SBOM",
        environment: "Azure",
        architecture: "HA",
        owner: "tester",
      })
    ).json();

    await json(`/api/operating?type=runbooks&id=${id}`, APPROVER, { approval: "Approved" }, "PATCH");
    await json(`/api/operating?type=runbooks&id=${id}`, APPROVER, { approval: "Review needed" }, "PATCH");
    assert.equal((await findRunbook(title))?.approval, "Review needed");
  });

  it("rejects an approval state outside the enum", async (t) => {
    if (requireServer(t)) return;
    const response = await json(
      "/api/operating?type=runbooks&id=1",
      APPROVER,
      { approval: "Rubber-stamped" },
      "PATCH"
    );
    assert.equal(response.status, 400);
    assert.ok((await response.json()).fields.approval);
  });

  it("answers 404 for a runbook that does not exist", async (t) => {
    if (requireServer(t)) return;
    const response = await json(
      "/api/operating?type=runbooks&id=987654",
      APPROVER,
      { approval: "Approved" },
      "PATCH"
    );
    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, "NOT_FOUND");
  });

  it("rejects a malformed id", async (t) => {
    if (requireServer(t)) return;
    const response = await json(
      "/api/operating?type=runbooks&id=abc",
      APPROVER,
      { approval: "Approved" },
      "PATCH"
    );
    assert.equal(response.status, 400);
    assert.ok((await response.json()).fields.id);
  });

  it("refuses approval from a member without the right", async (t) => {
    if (requireServer(t)) return;
    if (!engineerSeeded) {
      t.skip("could not add a non-approver member to the local database");
      return;
    }

    const title = uniqueTitle("deny");
    const { id } = await (
      await json("/api/operating", ENGINEER, {
        type: "runbooks",
        title,
        product: "IQ Server",
        environment: "AWS",
        architecture: "HA",
        owner: "junior",
      })
    ).json();

    for (const approval of ["Approved", "Deprecated"]) {
      const response = await json(
        `/api/operating?type=runbooks&id=${id}`,
        ENGINEER,
        { approval },
        "PATCH"
      );
      assert.equal(response.status, 403, `${approval} must be refused`);
      assert.equal((await response.json()).code, "ACCESS_DENIED");
    }

    assert.equal(
      (await findRunbook(title))?.approval,
      "Review needed",
      "a refused attempt must not change stored state"
    );

    // Authoring is intentionally open; only the state change is gated.
    const allowed = await json(
      `/api/operating?type=runbooks&id=${id}`,
      APPROVER,
      { approval: "Approved" },
      "PATCH"
    );
    assert.equal(allowed.status, 200);
  });
});

describe("runbook attachments", () => {
  it("stores an allowed document and exposes its metadata", async (t) => {
    if (requireServer(t)) return;
    const title = uniqueTitle("attach");
    const response = await upload(APPROVER, title, {
      fileName: "failover.txt",
      mimeType: "text/plain",
      bytes: "drain traffic\npromote standby\n",
    });
    assert.equal(response.status, 201);

    const [attachment] = (await findRunbook(title))?.attachments ?? [];
    assert.ok(attachment, "attachment metadata should be returned with the runbook");
    assert.equal(attachment.fileName, "failover.txt");
    assert.equal(attachment.contentType, "text/plain");
    assert.ok(attachment.sizeBytes > 0);
  });

  // Regression: a .exe declaring application/octet-stream was accepted and
  // written to R2, because the check was OR'd and octet-stream was allowlisted.
  it("refuses an executable however it labels itself, leaving no orphan row", async (t) => {
    if (requireServer(t)) return;
    for (const mimeType of [
      "application/x-msdownload",
      "application/octet-stream",
      "text/plain",
      "",
    ]) {
      const title = uniqueTitle("exe");
      const response = await upload(APPROVER, title, {
        fileName: "payload.exe",
        mimeType,
        bytes: "MZ fake",
      });
      assert.equal(response.status, 400, `.exe as "${mimeType}" must be refused`);
      assert.equal((await response.json()).code, "UNSUPPORTED_TYPE");
      assert.equal(
        await findRunbook(title),
        undefined,
        "a refused upload must not leave a runbook behind"
      );
    }
  });

  it("accepts a generic MIME type for a vetted extension", async (t) => {
    if (requireServer(t)) return;
    for (const [fileName, mimeType] of [
      ["notes.md", "application/octet-stream"],
      ["notes.txt", "text/plain; charset=utf-8"],
      ["values.yaml", "application/octet-stream"],
    ]) {
      const title = uniqueTitle("generic");
      const response = await upload(APPROVER, title, { fileName, mimeType });
      assert.equal(response.status, 201, `${fileName} as "${mimeType}" must be accepted`);
    }
  });

  it("serves a download with headers that keep it private and inert", async (t) => {
    if (requireServer(t)) return;
    const title = uniqueTitle("download");
    await upload(APPROVER, title, {
      fileName: "steps.txt",
      mimeType: "text/plain",
      bytes: "step one",
    });
    const [attachment] = (await findRunbook(title))?.attachments ?? [];

    const response = await api(`/api/attachments/${attachment.id}`, APPROVER);
    assert.equal(response.status, 200);
    // A member-gated file must never be retained by a shared cache.
    assert.match(response.headers.get("cache-control") ?? "", /private/);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("content-disposition") ?? "", /attachment; filename="steps\.txt"/);
    assert.equal(await response.text(), "step one");
  });

  it("does not serve attachments to anonymous callers", async (t) => {
    if (requireServer(t)) return;
    const title = uniqueTitle("private");
    await upload(APPROVER, title, { fileName: "secret.txt", mimeType: "text/plain" });
    const [attachment] = (await findRunbook(title))?.attachments ?? [];

    assert.equal((await api(`/api/attachments/${attachment.id}`, null)).status, 403);
  });

  it("deletes the runbook, its attachment row, and the stored object", async (t) => {
    if (requireServer(t)) return;
    const title = uniqueTitle("delete");
    await upload(APPROVER, title, { fileName: "gone.txt", mimeType: "text/plain" });
    const runbook = await findRunbook(title);
    const attachmentId = runbook.attachments[0].id;

    const response = await api(`/api/operating?type=runbooks&id=${runbook.id}`, APPROVER, {
      method: "DELETE",
    });
    assert.equal(response.status, 200);
    assert.equal(await findRunbook(title), undefined);
    assert.equal((await api(`/api/attachments/${attachmentId}`, APPROVER)).status, 404);
  });
});

describe("weekly check-ins", () => {
  async function createEngagement() {
    const response = await json("/api/engagements", APPROVER, {
      customer: "Contoso",
      title: uniqueTitle("engagement"),
      products: "Nexus Repository",
      environment: "AWS",
      architecture: "Migration / upgrade",
      owner: "tester",
    });
    return (await response.json()).id;
  }

  it("records an update and rolls the status onto the engagement", async (t) => {
    if (requireServer(t)) return;
    const id = await createEngagement();
    const response = await json("/api/updates", APPROVER, {
      engagementId: id,
      status: "Blocked",
      progress: "Staging upgrade complete",
      nextStep: "Schedule the production window",
      risk: "Customer firewall change outstanding",
    });
    assert.equal(response.status, 201);

    const { engagements } = await (await api("/api/engagements", APPROVER)).json();
    const engagement = engagements.find((row) => row.id === id);
    assert.equal(engagement.status, "Blocked");
    assert.equal(engagement.risk, "Customer firewall change outstanding");
    assert.equal(engagement.nextStep, "Schedule the production window");
  });

  // Regression: the handler used to accept `submittedBy` from the body, so any
  // member could file an update under a colleague's name.
  it("attributes an update to the caller, ignoring a spoofed author", async (t) => {
    if (requireServer(t)) return;
    const id = await createEngagement();
    await json("/api/updates", APPROVER, {
      engagementId: id,
      status: "In progress",
      progress: "p",
      nextStep: "n",
      risk: "r",
      submittedBy: "attacker@evil.example",
    });

    const body = await (await api("/api/engagements", APPROVER)).text();
    assert.ok(
      !body.includes("attacker@evil.example"),
      "the body-supplied author must be ignored"
    );
  });

  it("rejects an update for an engagement that does not exist", async (t) => {
    if (requireServer(t)) return;
    const response = await json("/api/updates", APPROVER, {
      engagementId: 987654,
      status: "Blocked",
      progress: "p",
      nextStep: "n",
      risk: "r",
    });
    // D1 does not enforce the foreign key, so the handler has to check.
    assert.equal(response.status, 404);
  });

  it("rejects a status outside the enum", async (t) => {
    if (requireServer(t)) return;
    const response = await json("/api/updates", APPROVER, {
      engagementId: await createEngagement(),
      status: "Totally fine",
      progress: "p",
      nextStep: "n",
      risk: "r",
    });
    assert.equal(response.status, 400);
    assert.ok((await response.json()).fields.status);
  });
});

describe("unknown record types", () => {
  it("rejects an unrecognised type on every verb", async (t) => {
    if (requireServer(t)) return;
    assert.equal((await api("/api/operating?type=nope", APPROVER)).status, 400);
    assert.equal((await json("/api/operating", APPROVER, { type: "nope" })).status, 400);
    assert.equal(
      (await json("/api/operating?type=nope&id=1", APPROVER, { approval: "Approved" }, "PATCH")).status,
      400
    );
    assert.equal(
      (await api("/api/operating?type=nope&id=1", APPROVER, { method: "DELETE" })).status,
      400
    );
  });
});
