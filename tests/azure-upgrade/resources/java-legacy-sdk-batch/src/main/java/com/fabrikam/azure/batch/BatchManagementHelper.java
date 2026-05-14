package com.fabrikam.azure.batch;

/**
 * Sample class to perform Azure batch management tasks, including:
 * - batch account management
 * - key query and management
 * - application and application package management
 * - checking for regional account quotas
 *
 */

import com.microsoft.azure.management.Azure;
import com.microsoft.azure.management.resources.fluentcore.arm.Region;
import com.microsoft.azure.management.batch.BatchAccount;
import com.microsoft.azure.management.batch.BatchAccountKeys;
import com.microsoft.azure.management.batch.AccountKeyType;
import java.util.List;
import java.lang.String;

public class BatchManagementHelper {

	Azure azure;

	BatchManagementHelper(Azure azureRef) {
		// set an initialzed and authenticated Azure management object for use by other methods in the class
		this.azure = azureRef;
	}

	// create a new batch account and tie it to a new Azure storage account 
	public BatchAccount createBatchAccountWithStorage(String batchAccountName, String storageAcctName,
			String resourceGroupName, Region batchAccountRegion) {
		BatchAccount azureBatchWithStorage = azure.batchAccounts().define(batchAccountName)
				.withRegion(batchAccountRegion)
				.withExistingResourceGroup(resourceGroupName)
				.withNewStorageAccount(storageAcctName)
				.create();
		return azureBatchWithStorage;
	}

	// delete a batch account and a storage account
	public void deleteBatchAccountWithStorage(String batchAccountName, String storageAccountName,
			String resourceGroupName) {
		azure.batchAccounts().delete(resourceGroupName, batchAccountName);
		azure.storageAccounts().delete(resourceGroupName, storageAccountName);
	}

    // create a batch account using the async API-the example here blocks and performs exactly like the regular create(), but you can customize the behavior and group 
	// it with other async operations from the management API 
	public BatchAccount createBatchAccountAsync(String batchAccountName, String resourceGroupName,
			Region batchAccountRegion) {
		// the call is set to block execution here, but you could do anything with the returned Observable from createAysnc(). See the RX library doc for more details.
		BatchAccount newAccWOStorage = azure.batchAccounts().define(batchAccountName).withRegion(batchAccountRegion)
				.withExistingResourceGroup(resourceGroupName).createAsync().toBlocking().last();
		return newAccWOStorage;
	}

	// return a list of the batch accounts across all regions 
	public List<BatchAccount> listBatchAccounts(String resourceGroupName) {
		List<BatchAccount> accountList = azure.batchAccounts().listByGroup(resourceGroupName);
		return accountList;
	}

	// return the quota for batch accounts in a region. Default is always one but you can submit a request to have it changed.
	public int getRegionQuota(Region batchAcctRegion) {
		int quota = azure.batchAccounts().getBatchAccountQuotaByLocation(batchAcctRegion);
		return quota;
	}

	// return an object with both the primary and secondary keys to the batch account. Keys can be used to authenticate
	// a BatchClient object to perform management tasks on pools, tasks, and jobs.
	public BatchAccountKeys getKeysForAccount(String batchAcctName, String resourceGroupName) {
		BatchAccountKeys keys = azure.batchAccounts().getByGroup(resourceGroupName, batchAcctName).getKeys();
		return keys;
	}

	// regenerate the keys for accessing the batch account programatically
	public BatchAccountKeys regenerateKeys(String batchAcctName, String resourceGroupName) {
		BatchAccount acct = azure.batchAccounts().getByGroup(resourceGroupName, batchAcctName);
		acct.regenerateKeys(AccountKeyType.PRIMARY);
		acct.regenerateKeys(AccountKeyType.SECONDARY);
		return acct.getKeys();
	}

	// check if a resource group in a given Azure region is at its batch account limit
	public boolean checkQuota(Region azureRegion, String resourceGroupName) {
		int accountInRegion = 0;
		// get the batch accounts for a given region
		List<BatchAccount> accounts = azure.batchAccounts().list();
		for (BatchAccount acct : accounts) {
			if (acct.region() == azureRegion) {
				accountInRegion++;
			}
		}
		if (accountInRegion >= azure.batchAccounts().getBatchAccountQuotaByLocation(azureRegion)) {
			return false;
		} else {
			return true;
		}
	}

	// create a batch account and add an application to the batch account
	public BatchAccount createBatchAccountWithApplication(String batchAccountName, Region regionName,
			String resourceGroupName, String storageAccount, String appId) {
		BatchAccount batchAccountWithId = azure.batchAccounts().define(batchAccountName)
			.withRegion(regionName)
			.withExistingResourceGroup(resourceGroupName)
			.defineNewApplication(appId)
				.withAllowUpdates(true)
				.attach()
			.withNewStorageAccount(storageAccount)
			.create();
		return batchAccountWithId;
	}

	// remove an application from a batch account
	public void deleteBatchApplicationFromAccount(String batchAccountName, Region regionName, String resoruceGroupName,
		String appID) {
		azure.batchAccounts().getByGroup(resoruceGroupName, batchAccountName)
		.update()
		.withoutApplication(appID)
		.apply();
	}

	public BatchAccount createBatchAccountWithApplicationPackage(String batchAccountName, Region regionName,
			String resourceGroupName, String appId, String appPackage, String storageAccountName) {
		try {
			BatchAccount batchAccountFromPackage = azure.batchAccounts().define(batchAccountName).withRegion(regionName)
					.withExistingResourceGroup(resourceGroupName).defineNewApplication(appId)
					.defineNewApplicationPackage(appPackage).withAllowUpdates(true).attach()
					.withNewStorageAccount(storageAccountName).create();
			return batchAccountFromPackage;
		} catch (Exception e) {
			e.printStackTrace();
			return null;
		}
	}
}
