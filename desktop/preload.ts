import { contextBridge, ipcRenderer } from "electron";
import type { DesktopAPI, Page } from "../shared/contracts";

const api: DesktopAPI = {
  setTitleBarColors: colors => ipcRenderer.invoke("desktop:titlebar:colors", colors),
  getInfo: () => ipcRenderer.invoke("desktop:info"),
  getPreferences: () => ipcRenderer.invoke("desktop:preferences:get"),
  setPreferences: patch => ipcRenderer.invoke("desktop:preferences:set", patch),
  exportPreferences: () => ipcRenderer.invoke("desktop:preferences:export"),
  importPreferences: () => ipcRenderer.invoke("desktop:preferences:import"),
  resetPreferences: () => ipcRenderer.invoke("desktop:preferences:reset"),
  getLoginSettings: () => ipcRenderer.invoke("desktop:login:get"),
  setLoginEnabled: enabled => ipcRenderer.invoke("desktop:login:set", enabled),
  getUpdateState: () => ipcRenderer.invoke("desktop:update:get"),
  checkForUpdates: () => ipcRenderer.invoke("desktop:update:check"),
  downloadUpdate: () => ipcRenderer.invoke("desktop:update:download"),
  installUpdate: () => ipcRenderer.invoke("desktop:update:install"),
  onUpdateState(callback) {
    const listener = (_event: Electron.IpcRendererEvent, state: import("../shared/contracts").UpdateState) => callback(state);
    ipcRenderer.on("desktop:update:state", listener);
    return () => ipcRenderer.removeListener("desktop:update:state", listener);
  },
  onCommandPalette(callback) {
    const listener = () => callback();
    ipcRenderer.on("desktop:commands", listener);
    return () => ipcRenderer.removeListener("desktop:commands", listener);
  },
  chooseDirectory: () => ipcRenderer.invoke("desktop:directory:choose"),
  openDataDirectory: () => ipcRenderer.invoke("desktop:data:open"),
  exportDiagnostics: () => ipcRenderer.invoke("desktop:diagnostics:export"),
  openLogsDirectory: () => ipcRenderer.invoke("desktop:logs:open"),
  reportIncident: incident => ipcRenderer.invoke("desktop:incident", incident),
  markReady: () => ipcRenderer.invoke("desktop:ready"),
  openDocumentation: document => ipcRenderer.invoke("desktop:documentation:open", document),
  onNavigate(callback) {
    const listener = (_event: Electron.IpcRendererEvent, page: Page) => {
      if (["overview", "components", "settings", "about"].includes(page)) callback(page);
    };
    ipcRenderer.on("desktop:navigate", listener);
    return () => ipcRenderer.removeListener("desktop:navigate", listener);
  },
};
contextBridge.exposeInMainWorld("desktop", api);
