import type { Preferences } from "./contracts";
import themes from "./themes.generated.json";
export const DEFAULT_PREFERENCES: Preferences = {
  themeMode: "system", colorTheme: "default.css", reducedMotion: false, sidebarCollapsed: false, trayEnabled: false,
};
export function validatePreferencesPatch(input: unknown): Partial<Preferences> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("设置参数无效");
  for (const [key, value] of Object.entries(input)) {
    const valid = key === "themeMode" ? ["system", "light", "dark"].includes(value as string)
      : key === "colorTheme" ? themes.some(theme => theme.id === value)
      : key === "reducedMotion" || key === "sidebarCollapsed" || key === "trayEnabled" ? typeof value === "boolean" : false;
    if (!valid) throw new Error("设置参数无效");
  }
  return { ...input };
}
