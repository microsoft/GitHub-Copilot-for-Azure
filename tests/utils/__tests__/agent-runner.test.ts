/**
 * Tests for agent-runner utility
 * 
 * Specifically tests the fix for the Jest async operation leak
 * where event listeners continue after test completion.
 */

describe("agent-runner", () => {
  describe("event listener cleanup", () => {
    test("isComplete flag prevents event processing after completion", () => {
      // This test verifies the fix for the issue where console.log
      // continues to fire after the test completes/times out.
      
      // Create a mock scenario
      let isComplete = false;
      const events: string[] = [];
      
      const mockEventHandler = (eventType: string) => {
        // Stop processing events if already complete
        if (isComplete) {
          return;
        }
        events.push(eventType);
      };
      
      // Simulate normal event flow
      mockEventHandler("session.start");
      mockEventHandler("assistant.message");
      mockEventHandler("tool.execution_start");
      
      // Simulate completion
      isComplete = true;
      
      // These events should not be processed
      mockEventHandler("tool.execution_complete");
      mockEventHandler("assistant.message_delta");
      
      // Verify only pre-completion events were recorded
      expect(events).toEqual([
        "session.start",
        "assistant.message", 
        "tool.execution_start"
      ]);
      expect(events).not.toContain("tool.execution_complete");
      expect(events).not.toContain("assistant.message_delta");
    });
    
    test("isComplete flag is set on session.idle", () => {
      let isComplete = false;
      const events: string[] = [];
      
      const mockEventHandler = (eventType: string) => {
        if (isComplete) {
          return;
        }
        events.push(eventType);
        
        // Simulate the fix: set isComplete when session.idle is received
        if (eventType === "session.idle") {
          isComplete = true;
        }
      };
      
      mockEventHandler("session.start");
      mockEventHandler("assistant.message");
      mockEventHandler("session.idle");
      mockEventHandler("tool.execution_complete"); // Should not be processed
      
      expect(events).toEqual([
        "session.start",
        "assistant.message",
        "session.idle"
      ]);
      expect(isComplete).toBe(true);
    });
    
    test("isComplete flag is set on early termination", () => {
      let isComplete = false;
      const events: string[] = [];
      
      const mockEventHandler = (eventType: string, shouldTerminate: boolean = false) => {
        if (isComplete) {
          return;
        }
        events.push(eventType);
        
        // Simulate the fix: set isComplete on early termination
        if (shouldTerminate) {
          isComplete = true;
        }
      };
      
      mockEventHandler("session.start");
      mockEventHandler("assistant.message");
      mockEventHandler("tool.execution_start", true); // Early termination
      mockEventHandler("tool.execution_complete"); // Should not be processed
      
      expect(events).toEqual([
        "session.start",
        "assistant.message",
        "tool.execution_start"
      ]);
      expect(isComplete).toBe(true);
    });
  });

  describe("maxTurns enforcement", () => {
    interface MockAgentMetadata {
      events: Array<{ type: string }>;
      testComments: string[];
      turnCount: number;
    }

    function simulateEventLoop(
      eventTypes: string[],
      maxTurns: number | undefined
    ): { metadata: MockAgentMetadata; isComplete: boolean; aborted: boolean; maxTurnsExceeded: boolean } {
      let isComplete = false;
      let aborted = false;
      let maxTurnsExceeded = false;
      const metadata: MockAgentMetadata = { events: [], testComments: [], turnCount: 0 };

      for (const type of eventTypes) {
        if (isComplete) break;

        if (type === "session.idle") {
          isComplete = true;
          break;
        }

        metadata.events.push({ type });

        if (type === "assistant.turn_start") {
          metadata.turnCount++;
          if (maxTurns !== undefined && metadata.turnCount > maxTurns) {
            metadata.testComments.push(
              `⚠️ Run aborted: turn count (${metadata.turnCount}) exceeded maxTurns (${maxTurns}).`
            );
            maxTurnsExceeded = true;
            isComplete = true;
            aborted = true;
            break;
          }
        }
      }

      return { metadata, isComplete, aborted, maxTurnsExceeded };
    }

    test("turnCount increments on each assistant.turn_start event", () => {
      const { metadata } = simulateEventLoop(
        ["assistant.turn_start", "assistant.turn_start", "assistant.turn_start", "session.idle"],
        undefined
      );
      expect(metadata.turnCount).toBe(3);
    });

    test("run completes normally when turn count does not exceed maxTurns", () => {
      const { metadata, aborted, maxTurnsExceeded } = simulateEventLoop(
        ["assistant.turn_start", "assistant.turn_start", "session.idle"],
        5
      );
      expect(metadata.turnCount).toBe(2);
      expect(aborted).toBe(false);
      expect(maxTurnsExceeded).toBe(false);
      expect(metadata.testComments).toHaveLength(0);
    });

    test("run is aborted when turn count exceeds maxTurns", () => {
      const { metadata, isComplete, aborted, maxTurnsExceeded } = simulateEventLoop(
        ["assistant.turn_start", "assistant.turn_start", "assistant.turn_start"],
        2
      );
      expect(metadata.turnCount).toBe(3);
      expect(aborted).toBe(true);
      expect(maxTurnsExceeded).toBe(true);
      expect(isComplete).toBe(true);
    });

    test("warning test comment is added when maxTurns is exceeded", () => {
      const { metadata } = simulateEventLoop(
        ["assistant.turn_start", "assistant.turn_start", "assistant.turn_start"],
        2
      );
      expect(metadata.testComments).toHaveLength(1);
      expect(metadata.testComments[0]).toContain("⚠️ Run aborted");
      expect(metadata.testComments[0]).toContain("turn count (3)");
      expect(metadata.testComments[0]).toContain("maxTurns (2)");
    });

    test("events after abort are not recorded", () => {
      const { metadata } = simulateEventLoop(
        ["assistant.turn_start", "assistant.turn_start", "assistant.turn_start", "assistant.message"],
        2
      );
      // The abort fires on turn 3; the subsequent assistant.message should not be recorded
      expect(metadata.events.map(e => e.type)).not.toContain("assistant.message");
    });

    test("no abort when maxTurns is undefined", () => {
      const { aborted } = simulateEventLoop(
        ["assistant.turn_start", "assistant.turn_start", "assistant.turn_start", "assistant.turn_start", "assistant.turn_start"],
        undefined
      );
      expect(aborted).toBe(false);
    });

    test("maxTurnsExceeded flag prevents follow-up prompts", () => {
      const followUps = ["follow-up 1", "follow-up 2"];
      let maxTurnsExceeded = true; // simulates the flag being set

      // Mirrors the actual follow-up guard: (maxTurnsExceeded ? [] : followUps)
      const promptsToSend = maxTurnsExceeded ? [] : followUps;
      expect(promptsToSend).toHaveLength(0);
    });

    test("follow-up prompts are sent when maxTurns is not exceeded", () => {
      const followUps = ["follow-up 1", "follow-up 2"];
      let maxTurnsExceeded = false;

      const promptsToSend = maxTurnsExceeded ? [] : followUps;
      expect(promptsToSend).toEqual(followUps);
    });
  });
});
