import { describe, expect, it } from "vitest";

/** NFR-031: every automated acceptance criterion has a test whose name starts with its ID. */
const criteria = import.meta.glob<string>("../docs/specification/09-acceptance-criteria.md", {
  query: "?raw",
  import: "default",
  eager: true,
});
const tests = import.meta.glob<string>("./*.test.{ts,tsx}", { query: "?raw", import: "default", eager: true });

const lines = Object.values(criteria)[0].split("\n").filter((line) => /^- `ACC-\d{3}`/.test(line));
const automated = lines.filter((line) => !line.includes("*manual*")).map((line) => /ACC-\d{3}/.exec(line)![0]);
const source = Object.entries(tests)
  .filter(([path]) => !path.endsWith("spec.test.ts"))
  .map(([, text]) => text)
  .join("\n");

describe("specification", () => {
  it("lists acceptance criteria", () => {
    expect(automated.length).toBeGreaterThan(20);
  });

  it.each(automated)("%s has a test named after it", (id) => {
    expect(source).toMatch(new RegExp(`\\bit(?:\\.each\\([\\s\\S]*?\\))?\\("${id} `));
  });

  it("names only criteria that exist", () => {
    const named = new Set([...source.matchAll(/\("(ACC-\d{3}) /g)].map((m) => m[1]));
    const known = new Set(lines.map((line) => /ACC-\d{3}/.exec(line)![0]));
    expect([...named].filter((id) => !known.has(id))).toEqual([]);
  });
});
