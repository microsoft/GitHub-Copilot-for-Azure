/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from "assert";
import { areToolCallsSuccess, doesAssistantMessageIncludeKeyword, isSkillInvoked, run } from "../runner.js";
import { describe, it } from "mocha";

describe("azureRoleSelectorTests", function () {
    it("invokes azure-role-selector skill for AcrPull prompt", async function () {
        const agentMetadata = await run({
            prompt: "What role should I assign to my managed identity to read images in a Azure Container Registry?"
        });
        
        const isAzureRoleSelectorSkillUsed = isSkillInvoked(agentMetadata, "azure-role-selector");
        const isAcrPullRoleMentioned = doesAssistantMessageIncludeKeyword(agentMetadata, "AcrPull");
        const areDocumentationToolCallsSuccess = areToolCallsSuccess(agentMetadata, "azure-documentation");
        

        assert.ok(isAzureRoleSelectorSkillUsed, "azure-role-selector skill should be invoked");
        assert.ok(isAcrPullRoleMentioned, "AcrPull role should be mentioned in the assistant message");
        assert.ok(areDocumentationToolCallsSuccess, "Should have azure-documentation tool calls and they are success");
    });
});

