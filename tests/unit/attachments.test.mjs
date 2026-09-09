import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_ATTACHMENT_BYTES,
  attachmentExtension,
  isAttachmentAllowed,
  normalizeMimeType,
  safeFileName,
} from "../../lib/constants/attachments.ts";

/**
 * REGRESSION TEST for a confirmed upload bypass.
 *
 * The original check was `ALLOWED_TYPES.has(type) || ALLOWED_EXTENSIONS.has(ext)`
 * with `application/octet-stream` in the allowed types. Because the declared MIME
 * type is entirely caller-controlled -- and octet-stream is what curl and several
 * browsers send when they cannot classify a file -- any executable could claim
 * that type and be written to R2. Verified live against the dev server before the
 * fix: a .exe was accepted and stored.
 */
test("rejects an executable regardless of the MIME type it declares", () => {
  for (const declared of [
    "application/x-msdownload",
    "application/octet-stream",
    "text/plain",
    "application/pdf",
    "",
  ]) {
    assert.equal(
      isAttachmentAllowed("payload.exe", declared),
      false,
      `.exe must be rejected when declaring ${declared || "(no type)"}`
    );
  }
});

test("rejects other executable and script extensions", () => {
  for (const name of [
    "a.sh", "a.bat", "a.cmd", "a.ps1", "a.dll", "a.so",
    "a.jar", "a.py", "a.rb", "a.php", "a.html", "a.svg",
  ]) {
    assert.equal(
      isAttachmentAllowed(name, "application/octet-stream"),
      false,
      `${name} must not be storable`
    );
  }
});

test("rejects a file with no extension at all", () => {
  assert.equal(isAttachmentAllowed("runbook", "text/plain"), false);
  assert.equal(isAttachmentAllowed("", "text/plain"), false);
});

test("accepts the document types the team actually attaches", () => {
  const cases = [
    ["runbook.pdf", "application/pdf"],
    ["notes.txt", "text/plain"],
    ["notes.md", "text/markdown"],
    ["data.csv", "text/csv"],
    ["config.json", "application/json"],
    ["values.yaml", "application/x-yaml"],
    ["values.yml", "text/yaml"],
    ["doc.doc", "application/msword"],
    [
      "doc.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    ["sheet.xls", "application/vnd.ms-excel"],
    [
      "sheet.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  ];
  for (const [name, type] of cases) {
    assert.equal(isAttachmentAllowed(name, type), true, `${name} (${type})`);
  }
});

/**
 * The generic-type tolerance that made the original bug tempting. It has to keep
 * working -- real browsers send octet-stream for .md and .yaml -- but only once
 * the extension has been vetted.
 */
test("tolerates a generic MIME type once the extension is vetted", () => {
  assert.equal(isAttachmentAllowed("notes.md", "application/octet-stream"), true);
  assert.equal(isAttachmentAllowed("values.yaml", "application/octet-stream"), true);
  assert.equal(isAttachmentAllowed("notes.md", ""), true);
});

test("does not reject a valid file over MIME parameters or casing", () => {
  // A charset parameter is normal and must not cause a false rejection.
  assert.equal(isAttachmentAllowed("notes.txt", "text/plain; charset=utf-8"), true);
  assert.equal(isAttachmentAllowed("notes.txt", "TEXT/PLAIN"), true);
  assert.equal(isAttachmentAllowed("notes.txt", "  text/plain  "), true);
});

test("treats a vetted extension carrying a contradictory type as suspicious", () => {
  assert.equal(isAttachmentAllowed("notes.txt", "application/x-msdownload"), false);
});

test("normalizeMimeType strips parameters, whitespace and casing", () => {
  assert.equal(normalizeMimeType("text/plain; charset=utf-8"), "text/plain");
  assert.equal(normalizeMimeType("TEXT/PLAIN"), "text/plain");
  assert.equal(normalizeMimeType("  application/pdf  "), "application/pdf");
  assert.equal(normalizeMimeType(""), "");
});

test("attachmentExtension takes the last segment, lowercased", () => {
  assert.equal(attachmentExtension("a.tar.gz"), "gz");
  assert.equal(attachmentExtension("REPORT.PDF"), "pdf");
  assert.equal(attachmentExtension("noext"), "");
  assert.equal(attachmentExtension(".hidden"), "hidden");
});

/**
 * safeFileName feeds the `content-disposition` response header, so anything that
 * could break out of the quoted filename or traverse a path has to be neutralised.
 */
test("safeFileName neutralises path traversal", () => {
  const cleaned = safeFileName("../../etc/passwd");
  assert.doesNotMatch(cleaned, /\//);
  assert.equal(cleaned, ".._.._etc_passwd");
  assert.doesNotMatch(safeFileName("C:\\Windows\\system32\\a.txt"), /\\/);
});

test("safeFileName strips quotes and CRLF so the header cannot be injected", () => {
  const cleaned = safeFileName('evil"\r\nX-Injected: yes.txt');
  assert.doesNotMatch(cleaned, /["\r\n]/);
  assert.doesNotMatch(cleaned, /X-Injected: yes/);
});

test("safeFileName always yields a usable name", () => {
  assert.equal(safeFileName(""), "attachment");
  // Everything below sanitises to separators or dots only, which would otherwise
  // be served as a meaningless download name like "___" or "..".
  assert.equal(safeFileName("///"), "attachment");
  assert.equal(safeFileName(".."), "attachment");
  assert.equal(safeFileName("..."), "attachment");
  assert.equal(safeFileName("你好"), "attachment");
});

test("safeFileName caps length so the header stays bounded", () => {
  assert.equal(safeFileName(`${"a".repeat(500)}.txt`).length, 180);
});

test("the size ceiling is 10 MB", () => {
  assert.equal(MAX_ATTACHMENT_BYTES, 10 * 1024 * 1024);
});
