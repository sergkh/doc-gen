const testFiles: string[] = [];

for await (const file of new Bun.Glob("**/*.test.ts").scan({ cwd: "tests", onlyFiles: true })) {
  testFiles.push(`tests/${file}`);
}

testFiles.sort();

if (testFiles.length === 0) {
  console.error("No test files found");
  process.exit(1);
}

for (const testFile of testFiles) {
  console.log(`\nRunning ${testFile}`);
  const child = Bun.spawn(["bun", "test", testFile], {
    cwd: import.meta.dir + "/..",
    env: Bun.env,
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await child.exited;
  if (exitCode !== 0) {
    console.error(`\nFailed: ${testFile}`);
    process.exit(exitCode);
  }
}

console.log(`\nAll ${testFiles.length} test files passed.`);
