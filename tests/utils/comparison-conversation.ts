import type { SessionEvent } from "@github/copilot-sdk";

type ComparisonSession = {
  on(handler: (event: SessionEvent) => void): () => void;
  sendAndWait(options: { prompt: string }, timeout: number): Promise<unknown>;
  abort(): Promise<void>;
};

/** One deadline across the entire conversation, matching the Claude executor. */
export async function runComparisonConversation(
  session: ComparisonSession,
  prompts: string[],
  timeout: number,
  onEvent: (event: SessionEvent) => void,
): Promise<void> {
  const deadline = Date.now() + timeout;
  const unsubscribe = session.on(onEvent);
  try {
    for (const prompt of prompts) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error(`Comparison timed out after ${timeout}ms.`);
      await session.sendAndWait({ prompt }, remaining);
    }
  } catch (error) {
    try {
      await session.abort();
    } catch (abortError) {
      throw new AggregateError([error, abortError], "Comparison failed and the Copilot session could not be aborted.", { cause: abortError });
    }
    throw error;
  } finally {
    unsubscribe();
  }
}
