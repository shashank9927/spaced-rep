import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const pluginRequire = createRequire(require.resolve("@next/eslint-plugin-next"));
const { getRootDirs } = pluginRequire("./utils/get-root-dirs.js") as {
  getRootDirs: (context: { cwd: string; settings: { next?: { rootDir?: string | string[] } } }) => string[];
};

function roots(rootDir?: string | string[]) {
  return getRootDirs({ cwd: process.cwd(), settings: { next: { rootDir } } })
    .map((entry) => path.resolve(entry))
    .sort();
}

describe("installed Next ESLint directory lookup", () => {
  it("uses the isolated adapter rather than the vulnerable glob dependency", () => {
    expect(pluginRequire("fast-glob/package.json").name).toBe("@recallcode/next-eslint-glob");
  });

  it("resolves default, literal, trailing-slash, and absolute project roots", () => {
    expect(roots()).toEqual([process.cwd()]);
    expect(roots("app")).toEqual([path.resolve("app")]);
    expect(roots("app/")).toEqual([path.resolve("app")]);
    expect(roots(process.cwd())).toEqual([process.cwd()]);
  });

  it("resolves wildcard, brace, and array roots for Next's lint rules", () => {
    const expected = [path.resolve("app/auth"), path.resolve("app/onboarding")].sort();
    expect(roots("app/{auth,onboarding}")).toEqual(expected);
    expect(roots(["app/auth", "app/onboarding"])).toEqual(expected);
    const wildcardRoots = roots("app/*");
    expect(wildcardRoots).toContain(path.resolve("app/auth"));
    expect(wildcardRoots).toContain(path.resolve("app/onboarding"));
  });

  it("does not treat files or absent directories as application roots", () => {
    expect(roots("package.json")).toEqual([]);
    expect(roots("no-such-next-project")).toEqual([]);
  });
});
