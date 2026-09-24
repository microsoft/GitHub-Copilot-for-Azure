import type { CopilotSession } from "@github/copilot-sdk";
import { afterEach, describe, expect, test, vi } from "vitest";
import { runComparisonConversation } from "../comparison-conversation.ts";

function mockSession() {
  const unsubscribe = vi.fn();
  return {
    unsubscribe,
    on: vi.fn<CopilotSession["on"]>().mockReturnValue(unsubscribe),
    sendAndWait: vi.fn<CopilotSession["sendAndWait"]>().mockResolvedValue(undefined),
    abort: vi.fn<CopilotSession["abort"]>().mockResolvedValue(undefined),
  };
}

describe("comparison conversation deadline", () => {
  afterEach(() => vi.useRealTimers());

  test("uses only the remaining budget on follow-ups and unsubscribes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const session = mockSession();
    session.sendAndWait.mockImplementationOnce(async () => {
      vi.setSystemTime(1400);
      return undefined;
    });
    const events = vi.fn();
    await runComparisonConversation(session, ["first", "second"], 1000, events);
    expect(session.sendAndWait).toHaveBeenNthCalledWith(1, { prompt: "first" }, 1000);
    expect(session.sendAndWait).toHaveBeenNthCalledWith(2, { prompt: "second" }, 600);
    expect(session.on).toHaveBeenCalledWith(events);
    expect(session.unsubscribe).toHaveBeenCalledOnce();
    expect(session.abort).not.toHaveBeenCalled();
  });

  test("does not start another turn when the total deadline has expired", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const session = mockSession();
    session.sendAndWait.mockImplementationOnce(async () => {
      vi.setSystemTime(2100);
      return undefined;
    });
    await expect(runComparisonConversation(session, ["first", "second"], 1000, vi.fn())).rejects.toThrow("timed out");
    expect(session.sendAndWait).toHaveBeenCalledOnce();
    expect(session.abort).toHaveBeenCalledOnce();
    expect(session.unsubscribe).toHaveBeenCalledOnce();
  });

  test("aborts and propagates a failed follow-up rather than returning a successful trajectory", async () => {
    const session = mockSession();
    session.sendAndWait.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("SDK timeout"));
    await expect(runComparisonConversation(session, ["first", "second"], 1000, vi.fn())).rejects.toThrow("SDK timeout");
    expect(session.abort).toHaveBeenCalledOnce();
    expect(session.unsubscribe).toHaveBeenCalledOnce();
  });

  test("surfaces abort failures along with the original failure", async () => {
    const session = mockSession();
    session.sendAndWait.mockRejectedValue(new Error("SDK timeout"));
    session.abort.mockRejectedValue(new Error("Abort failed"));
    await expect(runComparisonConversation(session, ["first"], 1000, vi.fn())).rejects.toBeInstanceOf(AggregateError);
    expect(session.unsubscribe).toHaveBeenCalledOnce();
  });
});
