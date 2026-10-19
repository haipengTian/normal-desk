import type { Preferences, WindowState } from "../shared/contracts";
import { DEFAULT_PREFERENCES, validatePreferencesPatch } from "../shared/preferences";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

interface State { version: 1; preferences: Preferences; window: WindowState | null }
function validWindow(value: unknown): value is WindowState {
  if (!value || typeof value !== "object") return false;
  const state = value as WindowState;
  return [state.x, state.y, state.width, state.height].every(Number.isFinite) &&
    state.width > 0 && state.height > 0 && typeof state.maximized === "boolean";
}
export class SettingsStore {
  warning: string | null = null;
  private state: State = { version: 1, preferences: { ...DEFAULT_PREFERENCES }, window: null };
  private pending: Promise<unknown> = Promise.resolve();
  private file: string;
  constructor(private directory: string) { this.file = path.join(directory, "settings.json"); }
  async load(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    let raw: string;
    try { raw = await readFile(this.file, "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
    try {
      const data: unknown = JSON.parse(raw);
      if (!data || typeof data !== "object") throw new Error("Invalid settings");
      const stored = data as State;
      if (stored.version !== 1 || !(stored.window === null || validWindow(stored.window))) throw new Error("Invalid settings");
      const preferences = validatePreferencesPatch(stored.preferences);
      this.state = { version: 1, preferences: { ...DEFAULT_PREFERENCES, ...preferences }, window: stored.window };
    } catch {
      const backup = `settings.invalid-${Date.now()}.json`;
      await rename(this.file, path.join(this.directory, backup));
      this.warning = `设置文件异常，已备份到 ${backup}，本次使用默认设置。`;
    }
  }
  get preferences(): Preferences { return { ...this.state.preferences }; }
  get window(): WindowState | null { return this.state.window ? { ...this.state.window } : null; }
  private enqueue(change: (state: State) => State): Promise<void> {
    const write = this.pending.then(async () => {
      const next = change(this.state);
      await writeFile(this.file + ".tmp", JSON.stringify(next, null, 2) + "\n", "utf8");
      await rename(this.file + ".tmp", this.file);
      this.state = next;
    });
    this.pending = write.catch(() => {});
    return write;
  }
  async update(input: unknown): Promise<Preferences> {
    const patch = validatePreferencesPatch(input);
    await this.enqueue(state => ({ ...state, preferences: { ...state.preferences, ...patch } }));
    return this.preferences;
  }
  async reset(): Promise<Preferences> { return this.update({ ...DEFAULT_PREFERENCES }); }
  async saveWindow(state: WindowState): Promise<void> {
    if (!validWindow(state)) throw new Error("窗口参数无效");
    const copy = { ...state };
    await this.enqueue(current => ({ ...current, window: copy }));
  }
}
