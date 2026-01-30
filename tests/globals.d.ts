/**
 * Global type declarations for test utilities
 */

import { TriggerMatcher } from './utils/trigger-matcher';

declare global {
  var SKILLS_PATH: string;
  var TESTS_PATH: string;
  function getSkillPath(skillName: string): string;
  function getFixturesPath(skillName: string): string;

  namespace jest {
    interface Matchers<R> {
      toTriggerSkill(skillName: string, triggerMatcher: TriggerMatcher): R;
      toNotTriggerSkill(skillName: string, triggerMatcher: TriggerMatcher): R;
    }
  }
}

export {};
