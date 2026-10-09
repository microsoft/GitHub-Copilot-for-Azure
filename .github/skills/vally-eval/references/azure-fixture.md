# Azure fixture

Azure fixtures are pre-provisioned Azure resources as context for integration tests. Agent skills designed for operating Azure resources depends on these fixtures. When authoring vally eval suites, here are the things to keep in mind.

- The stimuli must declare the fixture manifest using a tag.
- The test prompt should omit the fixture information. The test runner will auto-inject the necessary context information of the fixture resources to the user prompt. The test prompt must not provide information that conflicts with the auto-injected fixture context.
- Persist fixture with caution. Some types of resources, such as database server and provisioned compute, can incur significant amount of cost by just staying active. Carefully evaluate the cost before deciding to persisting a resource.

For details on how Azure fixture provisioning works, see [azure-fixture-design-doc](../../../../docs/azure-fixture.md).