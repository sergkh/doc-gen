import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import path from "path";
import { mkdtemp, rm } from "fs/promises";
import {
  assertPresentationRevision,
  atomicWrite,
  commitPresentation,
  ensureCourseRepository,
  presentationHistory,
  presentationPath,
  presentationRevision,
  repositoryDirty,
  restorePresentationFiles,
} from "@/presentations/git";
import { PresentationConflictError } from "@/presentations/models";

let temporaryRoot = "";
const topicUid = "123e4567-e89b-12d3-a456-426614174000";

beforeEach(async () => {
  temporaryRoot = await mkdtemp("/tmp/doc-gen-presentations-");
  process.env.PRESENTATIONS_DIR = temporaryRoot;
});

afterEach(async () => {
  delete process.env.PRESENTATIONS_DIR;
  await rm(temporaryRoot, { recursive: true, force: true });
});

describe("presentation Git repositories", () => {
  it("tracks path-specific revisions and restores with a new commit", async () => {
    const repository = await ensureCourseRepository({ id: 7, name: "Course" });
    const deck = path.join(presentationPath(7, topicUid), "deck.marp.md");
    await atomicWrite(deck, "---\nmarp: true\n---\n\n# One\n");
    const first = await commitPresentation(repository, topicUid, "Create deck");
    expect(first).toHaveLength(40);
    expect(await repositoryDirty(repository)).toBe(false);

    await atomicWrite(deck, "---\nmarp: true\n---\n\n# Two\n");
    const second = await commitPresentation(repository, topicUid, "Update slide");
    expect(second).not.toBe(first);
    expect(await presentationRevision(repository, topicUid)).toBe(second);
    expect((await presentationHistory(repository, topicUid)).map((entry) => entry.message))
      .toEqual(["Update slide", "Create deck"]);

    await expect(assertPresentationRevision(repository, topicUid, first))
      .rejects.toBeInstanceOf(PresentationConflictError);

    await restorePresentationFiles(repository, topicUid, first);
    const restored = await Bun.file(deck).text();
    expect(restored).toContain("# One");
    const restoreCommit = await commitPresentation(repository, topicUid, "Restore");
    expect(restoreCommit).not.toBe(first);
    expect((await presentationHistory(repository, topicUid))[0]?.message).toBe("Restore");
  });
});

