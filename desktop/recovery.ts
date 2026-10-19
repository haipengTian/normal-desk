interface RecoveryActions {
  prompt(reason: string): Promise<number>;
  reload(reason: string): void;
  export(): Promise<void>;
  quit(): void;
}

/** A user-driven recovery, with only one dialog per window at a time. */
export class RecoveryController {
  private active = false;
  constructor(private readonly actions: RecoveryActions) {}
  async run(reason: string): Promise<void> {
    if (this.active) return;
    this.active = true;
    try {
      for (;;) {
        const choice = await this.actions.prompt(reason);
        if (choice === 1) { await this.actions.export(); continue; }
        if (choice === 0) this.actions.reload(reason);
        else if (choice === 2) this.actions.quit();
        return;
      }
    } finally { this.active = false; }
  }
}
