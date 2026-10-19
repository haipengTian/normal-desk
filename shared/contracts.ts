export type ThemeMode = "system" | "light" | "dark";
export interface Preferences {
  themeMode: ThemeMode;
  colorTheme: string;
  reducedMotion: boolean;
  sidebarCollapsed: boolean;
  trayEnabled: boolean;
}
export interface WindowState { x: number; y: number; width: number; height: number; maximized: boolean }
export interface AppInfo {
  name: string; version: string; electron: string; chromium: string;
  platform: string; architecture: string; packaged: boolean; dataPath: string;
  startupWarning: string | null;
}
export type Page = "overview" | "components" | "settings" | "about";
export type Documentation = "electron" | "credit";
export interface LoginSettings { supported: boolean; enabled: boolean }
export interface UpdateState {
  phase: "unconfigured" | "unsupported" | "idle" | "checking" | "available" | "downloading" | "downloaded" | "error";
  version?: string;
  percent?: number;
  retry?: "check" | "download" | "install";
}
export interface DesktopAPI {
  setTitleBarColors(colors: { background: string; foreground: string }): Promise<void>;
  getInfo(): Promise<AppInfo>;
  getPreferences(): Promise<Preferences>;
  setPreferences(patch: Partial<Preferences>): Promise<Preferences>;
  exportPreferences(): Promise<boolean>;
  importPreferences(): Promise<Preferences | null>;
  resetPreferences(): Promise<Preferences | null>;
  getLoginSettings(): Promise<LoginSettings>;
  setLoginEnabled(enabled: boolean): Promise<LoginSettings>;
  getUpdateState(): Promise<UpdateState>;
  checkForUpdates(): Promise<void>;
  downloadUpdate(): Promise<void>;
  installUpdate(): Promise<void>;
  onUpdateState(callback: (state: UpdateState) => void): () => void;
  onCommandPalette(callback: () => void): () => void;
  chooseDirectory(): Promise<string | null>;
  openDataDirectory(): Promise<void>;
  exportDiagnostics(): Promise<boolean>;
  openLogsDirectory(): Promise<void>;
  reportIncident(incident: { kind: "error" | "unhandledrejection" | "react" }): Promise<void>;
  markReady(): Promise<void>;
  openDocumentation(document: Documentation): Promise<void>;
  onNavigate(callback: (page: Page) => void): () => void;
}
declare global { interface Window { desktop?: DesktopAPI } }
