/**
 * Trigger Tests for deploy-to-aks
 *
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "deploy-to-aks";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    // Common customer prompts for deploying apps to existing AKS clusters
    const shouldTriggerPrompts: string[] = [
      // Core deployment scenarios
      "deploy my app to AKS",
      "deploy to Azure Kubernetes Service",
      "deploy my Node.js application to an existing AKS cluster",
      "I need to deploy my API to my Kubernetes cluster on Azure",
      "help me deploy a container to AKS",

      // Containerization
      "containerize my application for AKS deployment",
      "generate a Dockerfile for deploying to Azure Kubernetes",

      // Manifest generation
      "generate Kubernetes manifests for my Azure deployment",
      "create deployment YAML for my AKS cluster",

      // CI/CD
      "set up CI/CD pipeline for AKS deployment",

      // Migration
      "migrate my app to Azure Kubernetes Service",
    ];

    test.each(shouldTriggerPrompts)(
      'triggers on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      }
    );
  });

  describe("Should NOT Trigger", () => {
    // Near-miss: Azure but not AKS deployment
    const azureNonAksPrompts: string[] = [
      "set up Azure Functions for my API",
      "configure Azure Front Door for my web app",
      "create a storage account in Azure",
      "monitor my App Service logs",
      "configure Azure DevOps pipelines",
    ];

    // Near-miss: other cloud providers
    const otherCloudPrompts: string[] = [
      "deploy my app to EKS on AWS",
      "deploy to GKE using Cloud Build",
      "configure Istio service mesh on minikube",
      "create a Kubernetes operator in Go",
      "set up EC2 instances",
    ];

    // Generic infrastructure (no Azure/AKS keywords)
    const genericInfraPrompts: string[] = [
      "write a Dockerfile for local development",
      "set up Docker Compose for my microservices",
      "push an image to Docker Hub",
      "debug a failing Docker build",
      "configure SSL certificates",
    ];

    const shouldNotTriggerPrompts = [
      ...azureNonAksPrompts,
      ...otherCloudPrompts,
      ...genericInfraPrompts,
    ];

    test.each(shouldNotTriggerPrompts)(
      'does not trigger on: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(false);
      }
    );
  });

  describe("Trigger Keywords Snapshot", () => {
    test("skill keywords match snapshot", () => {
      expect(triggerMatcher.getKeywords()).toMatchSnapshot();
    });

    test("skill description triggers match snapshot", () => {
      expect({
        name: skill.metadata.name,
        description: skill.metadata.description,
        extractedKeywords: triggerMatcher.getKeywords()
      }).toMatchSnapshot();
    });
  });

  describe("Edge Cases", () => {
    test("handles mixed case input", () => {
      const result = triggerMatcher.shouldTrigger("DEPLOY MY APP TO AKS");
      expect(result.triggered).toBe(true);
    });

    test("handles multi-keyword match in conversational prompt", () => {
      const result = triggerMatcher.shouldTrigger("kubernetes deploy on azure");
      expect(result.triggered).toBe(true);
    });

    test("handles empty prompt", () => {
      const result = triggerMatcher.shouldTrigger("");
      expect(result.triggered).toBe(false);
    });
  });
});
