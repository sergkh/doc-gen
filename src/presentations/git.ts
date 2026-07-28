import path from "path";
import { mkdir, rename, stat } from "fs/promises";
import type { Course } from "@/stores/models";
import type { PresentationHistoryEntry } from "./models";
import { PresentationConflictError, PresentationDirtyError } from "./models";

const courseLocks = new Map<number, Promise<void>>();

export function presentationsRoot(): string {
  return path.resolve(process.env.PRESENTATIONS_DIR ?? path.join(process.cwd(), "presentations"));
}

export function courseRepositoryPath(courseId: number): string {
  if (!Number.isInteger(courseId) || courseId <= 0) throw new Error("Некоректний ID курсу.");
  return path.join(presentationsRoot(), `course-${courseId}`);
}

export function presentationRelativePath(topicUid: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(topicUid)) throw new Error("Некоректний UID теми.");
  return path.posix.join("topics", topicUid, "presentation");
}

export function presentationPath(courseId: number, topicUid: string): string {
  return path.join(courseRepositoryPath(courseId), presentationRelativePath(topicUid));
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function run(command: string[], cwd?: string): Promise<string> {
  const process = Bun.spawn(command, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...globalThis.process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(stderr.trim() || `${command[0]} завершився з кодом ${exitCode}.`);
  }
  return stdout.trim();
}

export async function runGit(repository: string, args: string[]): Promise<string> {
  return run(["git", "-C", repository, ...args]);
}

export async function atomicWrite(filePath: string, content: string | Uint8Array): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
  await Bun.write(temporary, content);
  await rename(temporary, filePath);
}

export async function ensureCourseRepository(course: Pick<Course, "id" | "name">): Promise<string> {
  const repository = courseRepositoryPath(course.id);
  await mkdir(repository, { recursive: true });
  if (await exists(path.join(repository, ".git"))) return repository;

  await run(["git", "init", "--initial-branch=main", repository]);
  await runGit(repository, ["config", "user.name", "Doc Gen"]);
  await runGit(repository, ["config", "user.email", "doc-gen@localhost"]);
  await runGit(repository, ["config", "commit.gpgsign", "false"]);
  await atomicWrite(
    path.join(repository, ".gitattributes"),
    "*.svg binary\n*.png binary\n*.jpg binary\n*.jpeg binary\n",
  );
  await atomicWrite(
    path.join(repository, "course.json"),
    `${JSON.stringify({ id: course.id, name: course.name }, null, 2)}\n`,
  );
  await runGit(repository, ["add", "--", ".gitattributes", "course.json"]);
  await runGit(repository, ["commit", "-m", "Initialize presentation repository"]);
  return repository;
}

export async function syncCourseSnapshot(repository: string, course: Pick<Course, "id" | "name">): Promise<void> {
  await atomicWrite(
    path.join(repository, "course.json"),
    `${JSON.stringify({ id: course.id, name: course.name }, null, 2)}\n`,
  );
}

export async function repositoryDirty(repository: string): Promise<boolean> {
  return (await runGit(repository, ["status", "--porcelain"])).length > 0;
}

export async function presentationRevision(repository: string, topicUid: string): Promise<string> {
  const relative = presentationRelativePath(topicUid);
  return runGit(repository, ["log", "-1", "--format=%H", "--", relative]);
}

export async function assertPresentationRevision(
  repository: string,
  topicUid: string,
  baseRevision: string,
): Promise<void> {
  const current = await presentationRevision(repository, topicUid);
  if (current !== baseRevision) throw new PresentationConflictError(current);
}

export async function commitPresentation(
  repository: string,
  topicUid: string,
  message: string,
): Promise<string> {
  const relative = presentationRelativePath(topicUid);
  await runGit(repository, ["add", "--", relative, "course.json"]);
  const staged = await runGit(repository, ["diff", "--cached", "--name-only", "--", relative, "course.json"]);
  if (!staged) return presentationRevision(repository, topicUid);
  await runGit(repository, ["commit", "-m", message]);
  return presentationRevision(repository, topicUid);
}

export async function presentationHistory(
  repository: string,
  topicUid: string,
): Promise<PresentationHistoryEntry[]> {
  const relative = presentationRelativePath(topicUid);
  const output = await runGit(repository, [
    "log",
    "--format=%H%x1f%aI%x1f%s",
    "--",
    relative,
  ]);
  if (!output) return [];
  return output.split("\n").map((line) => {
    const [revision = "", authoredAt = "", message = ""] = line.split("\u001f");
    return { revision, authoredAt, message };
  });
}

export async function restorePresentationFiles(
  repository: string,
  topicUid: string,
  revision: string,
): Promise<void> {
  if (!/^[0-9a-f]{7,40}$/i.test(revision)) throw new Error("Некоректна Git-ревізія.");
  const relative = presentationRelativePath(topicUid);
  await runGit(repository, ["cat-file", "-e", `${revision}:${relative}/deck.marp.md`]);
  await runGit(repository, ["restore", "--source", revision, "--", relative]);
}

export async function withCourseRepositoryLock<T>(courseId: number, action: () => Promise<T>): Promise<T> {
  const previous = courseLocks.get(courseId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.then(() => current);
  courseLocks.set(courseId, queued);
  await previous;
  try {
    return await action();
  } finally {
    release();
    if (courseLocks.get(courseId) === queued) courseLocks.delete(courseId);
  }
}

export async function assertCleanRepository(repository: string): Promise<void> {
  if (await repositoryDirty(repository)) throw new PresentationDirtyError();
}

export async function repositoryExists(courseId: number): Promise<boolean> {
  return exists(path.join(courseRepositoryPath(courseId), ".git"));
}

export async function presentationFilesExist(courseId: number, topicUid: string): Promise<boolean> {
  return exists(path.join(presentationPath(courseId, topicUid), "deck.marp.md"));
}
