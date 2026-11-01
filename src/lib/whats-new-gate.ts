// Queues the one-time popups so they never stack: What's new first, then a
// new belt target, then the guided tour. Each popup reports "checking" while
// it decides, "open" while shown and "done" once closed or not needed.

type State = "checking" | "open" | "done";
type Gate = "whatsNew" | "target";

const states: Record<Gate, State> = { whatsNew: "checking", target: "checking" };
const waiting = new Map<Gate, Set<() => void>>([
  ["whatsNew", new Set()],
  ["target", new Set()],
]);

function setState(gate: Gate, next: State) {
  states[gate] = next;
  if (next !== "done") return;
  for (const resolve of waiting.get(gate)!) resolve();
  waiting.get(gate)!.clear();
}

function whenDone(gate: Gate, timeoutMs: number): Promise<void> {
  if (states[gate] === "done") return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timer);
      waiting.get(gate)!.delete(finish);
      resolve();
    };
    // Only give up while still checking; an open popup waits for the person.
    const timer = window.setTimeout(() => states[gate] === "checking" && finish(), timeoutMs);
    waiting.get(gate)!.add(finish);
  });
}

export const setWhatsNewState = (next: State) => setState("whatsNew", next);
export const setTargetPopupState = (next: State) => setState("target", next);

/** Resolves once What's new is out of the way. */
export const whenWhatsNewDone = (timeoutMs = 10_000) => whenDone("whatsNew", timeoutMs);

/** Resolves once What's new and the target popup are both out of the way. */
export async function whenPopupsDone(timeoutMs = 10_000) {
  await whenDone("whatsNew", timeoutMs);
  await whenDone("target", timeoutMs);
}
