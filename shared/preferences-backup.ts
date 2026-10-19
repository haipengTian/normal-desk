import type { Preferences } from "./contracts";
import { validatePreferencesPatch } from "./preferences";

export type PortablePreferences = Omit<Preferences, "trayEnabled">;
export function exportPreferences(preferences: Preferences) {
  const { themeMode, colorTheme, reducedMotion, sidebarCollapsed } = preferences;
  return { format: "desktop-starter/preferences", version: 1, preferences: { themeMode, colorTheme, reducedMotion, sidebarCollapsed } };
}
export function parsePreferencesBackup(raw: string): PortablePreferences {
  if (raw.length > 65536) throw new Error("设置文件不能超过 64 KiB");
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error("设置文件不是有效的 JSON"); }
  if (!data || data.format !== "desktop-starter/preferences" || data.version !== 1 ||
    Object.keys(data).some(key => !["format", "version", "preferences"].includes(key))) throw new Error("不支持的设置备份格式或版本");
  const preferences = validatePreferencesPatch(data.preferences);
  const keys = ["themeMode", "colorTheme", "reducedMotion", "sidebarCollapsed"];
  if (Object.keys(preferences).length !== keys.length || !keys.every(key => Object.hasOwn(preferences, key))) throw new Error("设置备份缺少字段或包含非外观选项");
  return preferences as PortablePreferences;
}
