import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const source = readFileSync("extension/content.js", "utf8");

describe("extension send flow", () => {
  let store: Record<string, unknown>;
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    store = {};
    vi.stubGlobal("chrome", { storage: { local: {
      get: (_k: unknown, cb: (d: Record<string, unknown>) => void) => { setTimeout(() => cb(store), 0); },
      set: (d: Record<string, unknown>, cb?: () => void) => { Object.assign(store, d); cb?.(); },
    } } });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  const running = (pending: unknown) => ({
    running: true, msg: "Olá {nome}", min: 6, max: 10, index: 0, log: [],
    queue: [{ phone: "5521967473033", name: "Lohan" }], pending,
  });

  it("keeps working on the opened chat after WhatsApp removes the number from the address", async () => {
    store.rz_state = running({ index: 0, phone: "5521967473033", at: Date.now(), tries: 1 });
    window.eval(source);
    await vi.advanceTimersByTimeAsync(2100);
    expect(document.getElementById("rz-panel")!.classList.contains("open")).toBe(true);
    expect((store.rz_state as { pending: { tries: number } }).pending.tries).toBe(1);
  });

  it("gives up on a contact whose chat did not open after repeated attempts", async () => {
    store.rz_state = running({ index: 0, phone: "5521967473033", at: Date.now() - 600000, tries: 2 });
    window.eval(source);
    await vi.advanceTimersByTimeAsync(2100);
    const s = store.rz_state as { index: number; running: boolean; log: { err: string }[] };
    expect(s.index).toBe(1);
    expect(s.running).toBe(false);
    expect(s.log[0].err).toBe("conversa não abriu");
  });
});
