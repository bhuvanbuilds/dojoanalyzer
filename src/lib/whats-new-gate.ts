// Lets the guided tour wait for the What's new popup. The popup reports
// "checking" while it fetches, "open" while shown and "done" once it's closed
// or has nothing to show; the tour starts only after "done".

type State = "checking" | "open" | "done";

let state: State = "checking";
const waiting = new Set<() => void>();

export function setWhatsNewState(next: State) {
  state = next;
  if (next !== "done") return;
  for (const resolve of waiting) resolve();
  waiting.clear();
}

/** Resolves once What's new is out of the way (or after `timeoutMs`, as a safety net). */
export function whenWhatsNewDone(timeoutMs = 10_000): Promise<void> {
  if (state === "done") return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timer);
      waiting.delete(finish);
      resolve();
    };
    // Only give up while still checking; an open popup waits for the person.
    const timer = window.setTimeout(() => state === "checking" && finish(), timeoutMs);
    waiting.add(finish);
  });
}
