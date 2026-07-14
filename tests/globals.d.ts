/**
 * Global type declarations for test utilities
 */

import { TriggerMatcher } from "./utils/trigger-matcher";

declare global {
  var OUTPUT_PATH: string;
  var TESTS_PATH: string;
  function setTestResult(data: { isPass: boolean, message?: string, skillInvocationRate?: number, expectsScreenshot: boolean }): void;

  namespace jest {
    interface Matchers<R> {
      toTriggerSkill(skillName: string, triggerMatcher: TriggerMatcher): R;
      toNotTriggerSkill(skillName: string, triggerMatcher: TriggerMatcher): R;
    }
  }
}

export { };
