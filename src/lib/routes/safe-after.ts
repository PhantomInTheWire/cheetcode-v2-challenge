import { after } from "next/server";

export function scheduleAfter(task: () => void | Promise<void>): void {
  try {
    after(async () => {
      try {
        await task();
      } catch {
        return;
      }
    });
  } catch {
    try {
      const result = task();
      if (result && typeof result === "object" && "then" in result) {
        void (result as Promise<void>).catch(() => undefined);
      }
    } catch {
      return;
    }
  }
}
