import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePreferencesPatch } from "../shared/preferences";

test("accepts only supported appearance preferences", () => {
  assert.deepEqual(validatePreferencesPatch({ themeMode: "dark", colorTheme: "claude.css", reducedMotion: true }),
    { themeMode: "dark", colorTheme: "claude.css", reducedMotion: true });
});
for (const input of [null, [], "dark", { themeMode: "invalid" }, { colorTheme: "../private.css" },
  { colorTheme: "missing.css" }, { reducedMotion: "yes" }, { sidebarCollapsed: 1 }, { extra: true }]) {
  test(`rejects invalid preference patch ${JSON.stringify(input)}`, () => {
    assert.throws(() => validatePreferencesPatch(input), /设置参数无效/);
  });
}
