import path from "node:path";

export function validateTitleBarColors(input: unknown): { color: string; symbolColor: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("标题栏颜色无效");
  const colors = input as Record<string, unknown>;
  if (Object.keys(colors).length !== 2 || ![colors.background, colors.foreground].every(value => typeof value === "string" && /^#[\da-f]{6}$/i.test(value))) throw new Error("标题栏颜色无效");
  return { color: colors.background as string, symbolColor: colors.foreground as string };
}

export function isTrustedRendererUrl(input: string, devUrl?: string): boolean {
  try {
    const url = new URL(input);
    if (url.username || url.password || url.port && url.protocol === "app:") return false;
    return url.protocol === "app:" && url.host === "desktop" ||
      !!devUrl && url.origin === new URL(devUrl).origin;
  } catch { return false; }
}
export function resolveAssetPath(input: string, root: string): string | null {
  try {
    if (!isTrustedRendererUrl(input) || new URL(input).protocol !== "app:") return null;
    let pathname = decodeURIComponent(new URL(input).pathname);
    if (/[\\\0:]/.test(pathname) || pathname.split("/").includes("..")) return null;
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = path.resolve(root, "." + pathname);
    const relative = path.relative(root, file);
    return relative.startsWith("..") || path.isAbsolute(relative) ? null : file;
  } catch { return null; }
}
export function documentationUrl(key: unknown): string {
  if (key === "electron") return "https://www.electronjs.org/docs/latest/";
  if (key === "credit") return "https://github.com/linux-do/credit";
  throw new Error("不支持的文档链接");
}
