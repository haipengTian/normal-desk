"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";

export interface QuickCommand { id: string; label: string; hint?: string; run: () => void | Promise<void> }
export function CommandPalette({ open, onOpenChange, commands }: { open: boolean; onOpenChange: (open: boolean) => void; commands: QuickCommand[] }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const matches = commands.filter(command => command.label.toLowerCase().includes(query.trim().toLowerCase()));
  const activeId = matches[active]?.id;
  useEffect(() => {
    if (open && activeId) document.getElementById(`command-${activeId}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeId]);
  function changeOpen(value: boolean) { setQuery(""); setActive(0); onOpenChange(value); }
  function execute(command: QuickCommand) {
    changeOpen(false);
    Promise.resolve().then(command.run).catch(() => toast.error("操作未完成，请重试。"));
  }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogContent className="gap-0 overflow-hidden p-0" showCloseButton={false}>
      <DialogTitle className="sr-only">快捷操作</DialogTitle>
      <DialogDescription className="sr-only">搜索页面或操作，使用方向键选择，回车执行。</DialogDescription>
      <div className="flex items-center gap-3 border-b px-5 py-3"><Search className="size-4 shrink-0 text-muted-foreground" />
        <Input role="combobox" aria-label="搜索快捷操作" aria-expanded="true" aria-controls="quick-commands" aria-activedescendant={matches[active] ? `command-${matches[active].id}` : undefined}
          autoComplete="off" className="border-0 px-0 shadow-none focus-visible:ring-0" placeholder="搜索页面或操作…" value={query}
          onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={event => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault(); setActive(index => matches.length ? (index + (event.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length : 0);
            }
            if (event.key === "Enter" && !event.nativeEvent.isComposing && matches[active]) { event.preventDefault(); execute(matches[active]); }
          }} />
        <kbd className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">Esc</kbd>
      </div>
      <div id="quick-commands" role="listbox" aria-label="操作" className="max-h-[50vh] overflow-y-auto p-2">
        {matches.length ? matches.map((command, index) => <button key={command.id} id={`command-${command.id}`} role="option" aria-selected={index === active} tabIndex={-1}
          onMouseMove={() => setActive(index)} onClick={() => execute(command)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm", index === active && "bg-accent text-accent-foreground")}>
          <ArrowRight className="size-4 text-muted-foreground" /><span>{command.label}</span>{command.hint && <kbd className="ml-auto text-xs text-muted-foreground">{command.hint}</kbd>}
        </button>) : <p className="py-10 text-center text-sm text-muted-foreground">没有匹配的操作</p>}
      </div>
      <div className="flex gap-4 border-t px-5 py-3 text-xs text-muted-foreground"><span>↑ ↓ 选择</span><span>↵ 执行</span></div>
    </DialogContent>
  </Dialog>;
}
