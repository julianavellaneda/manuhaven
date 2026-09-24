// The upload routes and /api/files against real Postgres and the fs driver:
// uploads land under the owner's prefix, and nobody else can read, replace or
// probe them.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createProject, getOwnedProject } from "@/lib/db/queries/projects";
import { getManuscript } from "@/lib/db/queries/manuscripts";
import { getStorage } from "@/lib/storage";
import { closeDb, createTestUser, removeTestUsers } from "../db/helpers";

const session = vi.hoisted(() => ({
  user: null as { id: string; email: string; name: string } | null,
}));
vi.mock("@/lib/auth/session", () => ({
  getSessionUser: async () => session.user,
}));

const { POST: uploadCover } = await import("@/app/api/projects/[id]/cover/route");
const { POST: uploadManuscript } = await import(
  "@/app/api/projects/[id]/manuscript/route"
);
const { GET: getFile } = await import("@/app/api/files/[...key]/route");

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 3, 4]);
const DOC = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "One" }] },
    { type: "paragraph", content: [{ type: "text", text: "Three little words." }] },
  ],
};

let storageDir: string;
let alice: string;
let bob: string;
let aliceProject: string;

function as(userId: string | null) {
  session.user = userId ? { id: userId, email: "", name: "" } : null;
}

function multipart(url: string, fields: Record<string, Blob | string>) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  // Serialize once so the request carries a Content-Length, as a browser's does.
  const probe = new Request("http://test", { method: "POST", body: form });
  return probe.arrayBuffer().then(
    (body) =>
      new Request(url, {
        method: "POST",
        body,
        headers: {
          "content-type": probe.headers.get("content-type")!,
          "content-length": String(body.byteLength),
        },
      }),
  );
}

async function postCover(
  projectId: string,
  bytes: Uint8Array<ArrayBuffer>,
  name = "c.png",
) {
  const req = await multipart("http://test/api", { file: new File([bytes], name) });
  return uploadCover(req, { params: Promise.resolve({ id: projectId }) });
}

async function postManuscript(
  projectId: string,
  text: string,
  fileType = "txt",
  tiptapJson: unknown = DOC,
) {
  const req = await multipart("http://test/api", {
    file: new File([text], "book.txt"),
    fileType,
    tiptapJson: JSON.stringify(tiptapJson),
  });
  return uploadManuscript(req, { params: Promise.resolve({ id: projectId }) });
}

function fetchFile(key: string) {
  return getFile(new Request("http://test"), {
    params: Promise.resolve({ key: key.split("/") }),
  });
}

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(tmpdir(), "manuhaven-files-"));
  vi.stubEnv("STORAGE_DRIVER", "fs");
  vi.stubEnv("STORAGE_DIR", storageDir);
  alice = await createTestUser("alice");
  bob = await createTestUser("bob");
  ({ id: aliceProject } = await createProject(alice, { title: "A", genre: null }));
});

beforeEach(() => as(alice));

afterAll(async () => {
  await removeTestUsers(alice, bob);
  await closeDb();
  await rm(storageDir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("cover upload", () => {
  it("requires a session", async () => {
    as(null);
    expect((await postCover(aliceProject, PNG)).status).toBe(401);
  });

  it("stores a sniffed image under the owner's prefix and serves it inline", async () => {
    const res = await postCover(aliceProject, PNG, "renamed.jpg");
    expect(res.status).toBe(200);
    const key = `${alice}/${aliceProject}/cover.png`;
    expect(await res.json()).toEqual({ coverUrl: `/api/files/${alice}/${aliceProject}/cover.png` });
    expect((await getOwnedProject(alice, aliceProject))?.coverKey).toBe(key);

    const file = await fetchFile(key);
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("image/png");
    expect(file.headers.get("content-disposition")).toMatch(/^inline/);
    expect(file.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(PNG);
  });

  it("removes the old file when the cover changes type", async () => {
    await postCover(aliceProject, PNG);
    expect((await postCover(aliceProject, JPEG)).status).toBe(200);
    expect(await getStorage().get(`${alice}/${aliceProject}/cover.png`)).toBeNull();
    expect((await getOwnedProject(alice, aliceProject))?.coverKey).toBe(
      `${alice}/${aliceProject}/cover.jpg`,
    );
  });

  it("rejects SVG and other non-images", async () => {
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>");
    expect((await postCover(aliceProject, svg, "c.png")).status).toBe(415);
  });

  it("refuses another user's project without writing anything", async () => {
    as(bob);
    expect((await postCover(aliceProject, PNG)).status).toBe(404);
    expect(await getStorage().get(`${bob}/${aliceProject}/cover.png`)).toBeNull();
  });

  it("refuses a body over the size limit before reading it", async () => {
    const req = new Request("http://test/api", {
      method: "POST",
      body: "x",
      headers: {
        "content-type": "multipart/form-data; boundary=x",
        "content-length": String(20 * 1024 * 1024),
      },
    });
    const res = await uploadCover(req, { params: Promise.resolve({ id: aliceProject }) });
    expect(res.status).toBe(413);
  });
});

describe("manuscript upload", () => {
  it("stores the original and recomputes words and chapters", async () => {
    const res = await postManuscript(aliceProject, "One\n\nThree little words.");
    expect(res.status).toBe(200);
    const manuscript = await getManuscript(alice, aliceProject);
    expect(manuscript?.fileKey).toBe(`${alice}/${aliceProject}/manuscript/original.txt`);
    expect(manuscript?.fileType).toBe("txt");
    expect(manuscript?.wordCount).toBe(4);
    expect(manuscript?.chapters).toEqual([{ title: "One", wordCount: 4 }]);

    const file = await fetchFile(manuscript!.fileKey!);
    expect(file.headers.get("content-disposition")).toBe(
      'attachment; filename="original.txt"',
    );
  });

  it("rejects a file whose bytes don't match its declared type", async () => {
    expect((await postManuscript(aliceProject, "plain text", "docx")).status).toBe(415);
  });

  it("rejects a body that is not a Tiptap document", async () => {
    expect(
      (await postManuscript(aliceProject, "text", "txt", { type: "evil" })).status,
    ).toBe(400);
  });

  it("refuses another user's project", async () => {
    as(bob);
    expect((await postManuscript(aliceProject, "hijack")).status).toBe(404);
  });
});

describe("/api/files", () => {
  it("requires a session", async () => {
    as(null);
    expect((await fetchFile(`${alice}/${aliceProject}/cover.jpg`)).status).toBe(401);
  });

  it("hides another user's file", async () => {
    as(bob);
    expect((await fetchFile(`${alice}/${aliceProject}/cover.jpg`)).status).toBe(404);
  });

  it("hides a file filed under the caller's id but another user's project", async () => {
    await getStorage().put(`${bob}/${aliceProject}/cover.png`, PNG);
    as(bob);
    expect((await fetchFile(`${bob}/${aliceProject}/cover.png`)).status).toBe(404);
  });

  it.each([
    ["traversal", (u: string, p: string) => `${u}/${p}/../../../etc/passwd`],
    ["non-uuid project", (u: string) => `${u}/not-a-uuid/cover.png`],
    ["too short", (u: string) => `${u}/cover.png`],
    ["missing file", (u: string, p: string) => `${u}/${p}/cover.webp`],
  ])("404s on %s", async (_label, keyFor) => {
    expect((await fetchFile(keyFor(alice, aliceProject))).status).toBe(404);
  });
});
