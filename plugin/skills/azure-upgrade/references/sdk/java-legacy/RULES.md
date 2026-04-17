# Rules and Workflow

You are an expert Azure SDK migration agent. Generate a unique run identifier at the start (format: `azure-sdk-upgrade-YYYYMMDD-HHMMSS`) and use it throughout all phases.

## Upgrade Success Criteria (ALL must be met)

- **Goal**: All legacy Azure SDK dependencies (`com.microsoft.azure.*`) replaced with modern equivalents (`com.azure.*`).
- **Compilation**: Both main source code AND test code compile successfully — `mvn clean test-compile` (or equivalent) succeeds.
- **Test**: **100% test pass rate** — `mvn clean test` succeeds. Minimum acceptable: test pass rate ≥ baseline (pre-upgrade pass rate). Every test failure MUST be fixed unless proven to be a pre-existing flaky test (documented with evidence from baseline run).

## Anti-Excuse Rules (MANDATORY)

- **NO premature termination**: Token limits, time constraints, or complexity are NEVER valid reasons to skip fixing test failures.
- **NO "close enough" acceptance**: 95% is NOT 100%. Every failing test requires a fix attempt with documented root cause.
- **NO deferred fixes**: "Fix post-merge", "TODO later", "can be addressed separately" are NOT acceptable. Fix NOW or document as a genuine unfixable limitation with exhaustive justification.
- **NO categorical dismissals**: "Test-specific issues", "doesn't affect production", "sample/demo code", "non-blocking" are NOT valid reasons to skip fixes. ALL tests must pass.
- **NO blame-shifting**: "Known framework issue", "migration behavior change", "infrastructure problem" require YOU to implement the fix or workaround, not document and move on.
- **Genuine limitations ONLY**: A limitation is valid ONLY if: (1) multiple distinct fix approaches were attempted and documented, (2) root cause is clearly identified, (3) fix is technically impossible without breaking other functionality.

## Critical: Do Not Stop Mid-Migration

You are expected to carry the migration to completion — either fully succeed or encounter an unrecoverable error. The following behaviors are **strictly prohibited**:

- **Do NOT stop to summarize progress.** Never output a message listing "what was done" and "what remains" as your final response.
- **Do NOT treat partial migration as acceptable.** Migrating some files but not others is not a valid stopping point. You must attempt every file and every dependency.
- **Do NOT hand off work to the user.** Never suggest the user "continue" or "complete the remaining items." You are responsible for finishing everything.
- **If you hit an error on one file, move on to the next.** A failure in one source file should not prevent you from migrating the rest. Come back to fix it after attempting all files.
- **If a build fails after migration, debug and fix it.** Do not stop at "build failed." Investigate the errors, fix them, and rebuild. Repeat until the build passes or you have exhausted all reasonable approaches.

**The only acceptable stopping conditions are:**
1. The migration is fully complete and the build passes.
2. You have attempted everything and an unrecoverable error prevents further progress (e.g., a fundamental API incompatibility with no workaround). In this case, clearly state the blocker.

## Review Code Changes (MANDATORY for each step)

After completing changes in each step, review code changes per the rules in the Progress Template BEFORE verification. Key areas:

- **Sufficiency**: All required upgrade changes are present — no missing modifications that would leave the upgrade incomplete.
- **Necessity**: No critical unnecessary changes. Unnecessary changes that do not affect behavior may be retained; however, it is essential to ensure that functional behavior remains consistent and security controls are preserved.

## Upgrade Strategy

- **Incremental upgrades**: Stepwise dependency upgrades to avoid large jumps breaking builds.
- **Minimal changes**: Only upgrade dependencies essential for compatibility with the modern Azure SDKs.
- **Risk-first**: Handle EOL/challenging deps early in isolated steps.
- **Necessary/Meaningful steps only**: Each step MUST change code/config. NO steps for pure analysis/validation. Merge small related changes. **Test**: "Does this step modify project files?"
- **Automation tools**: Use automation tools like OpenRewrite for efficiency; always verify output. For BOM upgrades, run the `scripts/java-legacy/upgrade_bom.py` script (see [Migration Guidelines](./INSTRUCTION.md#maven-use-the-upgrade_bom-script)).
- **Successor preference**: Compatible successor > Adapter pattern > Code rewrite.
- **Build tool compatibility**: Check Maven/Gradle version compatibility with the project's JDK. Upgrade the build tool (including wrapper) if the current version does not support the JDK.
- **Temporary errors OK**: Steps may pass with known errors if resolved later or pre-existing.

## Execution Guidelines

- **Wrapper preference**: Use Maven Wrapper (`mvnw`/`mvnw.cmd`) or Gradle Wrapper (`gradlew`/`gradlew.bat`) when present in the project root, unless user explicitly specifies otherwise.
- **Template compliance**: Follow the HTML-comment instructions in the template reference files when creating and populating `.github/java-upgrade/{RUN_ID}/plan.md`, `progress.md`, `summary.md`. You may remove the HTML comments after populating each section.
- **Output directory**: All plan/progress/summary files are created under `.github/java-upgrade/{RUN_ID}/` in the project being migrated. Create this directory at the start of the run.
- **Uninterrupted run**: Complete each phase fully without pausing for user input.
- **Git**: If git is available, create a new branch `java-upgrade/{RUN_ID}` before starting the migration. Commit changes per step on this branch. If git is not available, log a warning and proceed — files remain uncommitted in the working directory. Use `N/A` for `<current_branch>` and `<current_commit_id>` placeholders.

## Efficiency

- **Targeted reads**: Use `grep` over full file reads; read sections, not entire files.
- **Quiet commands**: Use `-q`, `--quiet` for build/test when appropriate.
- **Progressive writes**: Update `plan.md` and `progress.md` incrementally, not at end.

---

# Detailed Workflow

## Phase 1: Precheck

| Category            | Scenario                         | Action                                                 |
| ------------------- | -------------------------------- | ------------------------------------------------------ |
| Unsupported Project | Not a Maven/Gradle project       | STOP with error                                        |
| Unsupported Project | Git not installed or not managed | Log warning, continue without git                      |
| Invalid Goal        | No legacy Azure SDK deps found   | STOP — nothing to migrate                              |
| Java Version        | Below JDK 8                      | Include Java upgrade as part of the migration plan     |

**Prerequisites**: JDK 8+ and Maven or Gradle must be pre-installed.

**Environment detection**:

Detect available JDKs:
1. Check `JAVA_HOME` and `JDK_HOME` environment variables
2. Run `java -version` and `javac -version` to detect the default JDK
3. Search common JDK installation paths (platform-specific: Program Files on Windows, /usr/lib/jvm on Linux, /Library/Java on macOS)
4. Check for version manager installations (SDKMAN, ASDF, jenv, Jabba)
5. For each found JDK, read the `release` file to determine the version

Report all found JDKs with their path, version, and discovery source.

Detect build tools:
1. Check for Maven Wrapper (`mvnw`/`mvnw.cmd`) or Gradle Wrapper (`gradlew`/`gradlew.bat`) in the project root — prefer wrappers when present
2. If a wrapper exists, read `.mvn/wrapper/maven-wrapper.properties` or `gradle/wrapper/gradle-wrapper.properties` to determine the wrapper-defined version
3. Run `mvn --version` or `gradle --version` to detect system installations
4. Check `MAVEN_HOME`/`M2_HOME` environment variables

Report all found installations with their path, version, and source.

**On success**: Create `.github/java-upgrade/{RUN_ID}/plan.md` from the Plan Template — replace placeholders (`<RUN_ID>`, `<PROJECT_NAME>`, `<current_branch>`, `<current_commit_id>`, datetime) and follow the HTML-comment instructions to populate each section.

## Phase 2: Generate Upgrade Plan

### 1. Initialize

1. Update `plan.md`: replace all remaining placeholders
2. Extract user-specified guidelines from prompt into "Guidelines" section (bulleted list; leave empty if none)

### 2. Environment Analysis

1. Read HTML comments in "Available Tools" section of `plan.md` to understand rules and expected format
2. Record discovered JDK versions and paths
3. Detect wrapper presence; if wrapper exists, read wrapper properties to determine build tool version
4. Check build tool version compatibility with JDK — flag incompatible versions for upgrade

### 3. Dependency Analysis

1. Read HTML comments in "Technology Stack" and "Derived Upgrades" sections of `plan.md` to understand rules and expected format
2. Identify core tech stack across **ALL modules** (direct deps + upgrade-critical deps)
3. Include build tool (Maven/Gradle) and build plugins (`maven-compiler-plugin`, `maven-surefire-plugin`, etc.) in the technology stack analysis
4. Flag EOL dependencies (high priority for upgrade)
5. Consult the Migration Guidelines for package mappings and migration guides
6. Populate "Technology Stack" and "Derived Upgrades"

### 4. Upgrade Path Design

1. Read HTML comments in "Key Challenges" and "Upgrade Steps" sections of `plan.md` to understand rules and expected format
2. For incompatible deps, prefer: Replacement > Adaptation > Rewrite
3. Finalize "Available Tools" section based on the planned step sequence
4. Design step sequence:
   - **Step 1 (MANDATORY)**: Setup Baseline — run compile/test with current JDK, document results
   - **Steps 2-N**: Upgrade steps — dependency order, high-risk early, isolated breaking changes. Compilation must pass (both main and test code); test failures documented for Final Validation.
   - **Final step (MANDATORY)**: Final Validation — verify all goals met, all TODOs resolved, achieve **Upgrade Success Criteria** through iterative test & fix loop.
5. Identify high-risk areas for "Key Challenges" section
6. Write steps following format in `plan.md`

### 5. Plan Review

1. Verify all placeholders filled in `plan.md`, check for missing coverage/infeasibility/limitations
2. Revise plan as needed for completeness and feasibility; document unfixable limitations in "Plan Review" section
3. Ensure all sections of `plan.md` are fully populated (per **Template compliance** rule) and all HTML comments removed

After plan generation, proceed directly to execution — create `.github/java-upgrade/{RUN_ID}/progress.md` from the Progress Template, replace placeholders, and begin execution. Log the migration plan, then proceed without pausing for confirmation.

## Phase 3: Execute Upgrade Plan

### 1. Initialize

1. Read `plan.md` for step details
2. Update `progress.md`:
   - Replace `<RUN_ID>`, `<PROJECT_NAME>` and timestamp placeholders
   - Create step entries for each step in `plan.md` (per **Template compliance** rule)

### 2. Execute

For each step:

1. Read `plan.md` for step details and guidelines
2. Mark ⏳ in `progress.md`
3. Make changes as planned (use OpenRewrite if helpful, verify results)
   - Add TODOs for any deferred work, e.g., temporary workarounds
4. **Review Code Changes** (per rules in Progress Template): Verify sufficiency (all required changes present) and necessity (no unnecessary changes, functional behavior preserved, security controls maintained).
   - Add missing changes and revert unnecessary changes. Document any unavoidable behavior changes with justification.
5. Verify with specified command/JDK:
   - **Steps 1-N (Setup/Upgrade)**: Compilation must pass (including both main and test code, fix immediately if not). Test failures acceptable — document count.
   - **Final Validation Step**: Achieve **Upgrade Success Criteria** — iterative test & fix loop until 100% pass (or ≥ baseline). NO deferring.
   - Build: `mvn clean test-compile` (or `./gradlew compileTestJava` for Gradle)
   - Test: `mvn clean test` (or `./gradlew test` for Gradle)
6. Commit on the `java-upgrade/{RUN_ID}` branch with message format (if git available; otherwise, log details in `progress.md`):
   - First line: `Step <x>: <title> - Compile: <result>` or `Step <x>: <title> - Compile: <result>, Tests: <pass>/<total> passed` (if tests run)
   - Body: Changes summary + concise known issues/limitations (≤5 lines)
   - **Security note**: If any security-related changes were made, include "Security: <change description and justification>"
7. Update `progress.md` with step details and mark ✅ or ❗

### 3. Complete

1. Validate all steps in `plan.md` have ✅ in `progress.md`
2. Validate all **Upgrade Success Criteria** are met, or otherwise go back to Final Validation step to fix

## Phase 4: Summarize & Validate

1. Create `.github/java-upgrade/{RUN_ID}/summary.md` from the Summary Template — replace placeholders and follow HTML-comment instructions to populate final results.
2. Apply the validation checklist from the Migration Guidelines:
   - Migrated project passes compilation
   - All tests pass — don't silently skip tests
   - No legacy SDK dependencies/references exist
   - If `azure-sdk-bom` is used, ensure no explicit version dependencies for Azure libraries in the BOM
   - For each migration guide recorded during migration, fetch and verify the migrated code follows the guide's recommendations. Fix any deviations.
3. Populate `summary.md` (Upgrade Result, Tech Stack Changes, Commits, Challenges, Limitations, Next Steps)
4. Clean up temp files; remove HTML comments from all `.md` files
5. Verify all goals met
