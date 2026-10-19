"use client";
import { Component, type ReactNode } from "react";
import { Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DiagnosticActions } from "./diagnostic-actions";

const report = (kind: "error" | "unhandledrejection" | "react") => { void window.desktop?.reportIncident({ kind }).catch(() => {}); };

export class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {
    report("react");
    // The recovery screen is usable even if DesktopShell never finished loading.
    void window.desktop?.markReady().catch(() => {});
  }
  private error = () => report("error");
  private rejection = () => report("unhandledrejection");
  componentDidMount() {
    window.addEventListener("error", this.error);
    window.addEventListener("unhandledrejection", this.rejection);
  }
  componentWillUnmount() {
    window.removeEventListener("error", this.error);
    window.removeEventListener("unhandledrejection", this.rejection);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="desktop-titlebar shrink-0" />
      <main className="flex flex-1 items-center justify-center px-8">
        <div className="w-full max-w-md">
          <Layers3 className="mb-7 size-10 text-primary" strokeWidth={1.5} />
          <h1 className="text-2xl font-semibold tracking-tight">界面暂时出了点问题</h1>
          <p className="mb-7 mt-3 text-sm leading-7 text-muted-foreground">重新加载以重试，本地设置会保留。再次出现时，请导出诊断。</p>
          <Button className="mb-5" onClick={() => location.reload()}>重新加载</Button>
          <DiagnosticActions available={typeof window !== "undefined" && !!window.desktop} />
        </div>
      </main>
    </div>;
  }
}
