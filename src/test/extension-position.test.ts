import { readFileSync } from "node:fs";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const source = readFileSync("extension/content.js", "utf8");
describe("extension launcher placement", () => {
  let store: Record<string, unknown>;
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    store = {};
    vi.stubGlobal("chrome", { storage: { local: {
      get: (key: string | string[], callback: (data: Record<string, unknown>) => void) => callback(store),
      set: (data: Record<string, unknown>, callback?: () => void) => { Object.assign(store, data); callback?.(); },
    } } });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  const start = () => { window.eval(source); return document.getElementById("rz-toggle") as HTMLButtonElement; };
  it("defaults to the upper-left at 18px on each axis", () => {
    const button = start();
    expect(button.style.left).toBe("18px");
    expect(button.style.top).toBe("18px");
  });
  it("adjusts placement and saves it in extension storage", () => {
    const button = start();
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(button.style.left).toBe("28px");
    expect(store.rz_button_position).toEqual({ x: 28, y: 18 });
  });
  it("restores the saved position on the next page", () => {
    store.rz_button_position = { x: 230, y: 140 };
    const button = start();
    expect(button.style.left).toBe("230px");
    expect(button.style.top).toBe("140px");
  });
});