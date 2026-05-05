package com.example.legacy;

import com.microsoft.azure.management.Azure;
import com.microsoft.azure.management.compute.VirtualMachine;
import com.microsoft.azure.management.resources.ResourceGroup;
import com.microsoft.azure.management.resources.fluentcore.arm.Region;

import java.io.File;

/**
 * Legacy Azure SDK sample. Lists virtual machines in a resource group using
 * the deprecated com.microsoft.azure.* SDK and file-based authentication.
 *
 * Intentionally pre-migration: do not "fix" by hand — this file exists so the
 * azure-upgrade skill's integration test can drive the migration to com.azure.
 */
public class App {

    public static void main(String[] args) throws Exception {
        File credFile = new File(System.getenv("AZURE_AUTH_LOCATION"));
        Azure azure = Azure.configure()
                .withLogLevel(com.microsoft.rest.LogLevel.BASIC)
                .authenticate(credFile)
                .withDefaultSubscription();

        ResourceGroup rg = azure.resourceGroups()
                .define("example-rg")
                .withRegion(Region.US_EAST)
                .create();

        System.out.println("Created resource group: " + rg.name() + " in " + rg.region());

        for (VirtualMachine vm : azure.virtualMachines().listByResourceGroup(rg.name())) {
            System.out.println("VM: " + vm.name() + " region=" + vm.region());
        }
    }
}
