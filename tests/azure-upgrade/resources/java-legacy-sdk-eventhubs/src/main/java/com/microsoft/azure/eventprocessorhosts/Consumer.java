package com.microsoft.azure.eventprocessorhosts;

import com.microsoft.azure.eventhubs.ConnectionStringBuilder;
import com.microsoft.azure.eventprocessorhost.EventProcessorHost;
import com.microsoft.azure.eventprocessorhost.EventProcessorOptions;
import com.microsoft.azure.eventprocessorhost.InMemoryCheckpointManager;
import com.microsoft.azure.eventprocessorhost.InMemoryLeaseManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.lang.reflect.Method;
import java.util.Arrays;

/**
 * Standalone in-memory Event Hubs consumer adapted from the logstash integration sample.
 */
public class Consumer {

    private static final Logger LOGGER = LoggerFactory.getLogger(Consumer.class);

    /**
     * Usage:
     * mvn -Dexec.mainClass=com.microsoft.azure.eventprocessorhosts.Consumer \
     *   -Dexec.args="Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=...;EntityPath=..." exec:java
     */
    public static void main(String... args) {
        try {
            if (args.length != 1 || !args[0].startsWith("Endpoint=sb") || !args[0].contains("EntityPath")) {
                LOGGER.error("The first and only argument must be the event hub connection string with the EntityPath.");
                LOGGER.error("Example: Endpoint=sb://namespace.servicebus.windows.net/;SharedAccessKeyName=name;SharedAccessKey=key;EntityPath=hub");
                System.exit(1);
            }

            String eventHubName = new ConnectionStringBuilder(args[0]).getEventHubName();
            InMemoryCheckpointManager checkpointManager = new InMemoryCheckpointManager();
            InMemoryLeaseManager leaseManager = new InMemoryLeaseManager();

            EventProcessorHost host = EventProcessorHost.EventProcessorHostBuilder
                .newBuilder(EventProcessorHost.createHostName("eventhubs-v3"), "$Default")
                .useUserCheckpointAndLeaseManagers(checkpointManager, leaseManager)
                .useEventHubConnectionString(args[0], eventHubName)
                .build();

            initializeInMemoryManagers(host, checkpointManager, leaseManager);

            EventProcessorOptions options = new EventProcessorOptions();
            options.setExceptionNotification(new ErrorNotificationHandler());

            host.registerEventProcessor(EventProcessor.class, options)
                .whenComplete((unused, error) -> {
                    if (error != null) {
                        LOGGER.error("Failure while registering event processor", error);
                    }
                })
                .thenAccept(unused -> {
                    System.out.println("Press enter to stop.");
                    try {
                        System.in.read();
                    } catch (Exception error) {
                        LOGGER.error("Keyboard read failed", error);
                    }
                })
                .thenCompose(unused -> host.unregisterEventProcessor())
                .exceptionally(error -> {
                    LOGGER.error("Failure while unregistering event processor", error);
                    return null;
                })
                .get();

            LOGGER.info("Done reading events.");
        } catch (Throwable throwable) {
            LOGGER.error("Something bad happened while consuming events.", throwable);
        }
    }

    private static void initializeInMemoryManagers(EventProcessorHost host,
                                                   InMemoryCheckpointManager checkpointManager,
                                                   InMemoryLeaseManager leaseManager) throws Exception {
        Method getHostContext = EventProcessorHost.class.getDeclaredMethod("getHostContext");
        getHostContext.setAccessible(true);

        Method checkpointManagerInit = Arrays.stream(InMemoryCheckpointManager.class.getDeclaredMethods())
            .filter(method -> method.getName().equals("initialize"))
            .findFirst()
            .orElseThrow(() -> new NoSuchMethodException("InMemoryCheckpointManager.initialize"));
        checkpointManagerInit.setAccessible(true);

        Method leaseManagerInit = Arrays.stream(InMemoryLeaseManager.class.getDeclaredMethods())
            .filter(method -> method.getName().equals("initialize"))
            .findFirst()
            .orElseThrow(() -> new NoSuchMethodException("InMemoryLeaseManager.initialize"));
        leaseManagerInit.setAccessible(true);

        Object hostContext = getHostContext.invoke(host);
        checkpointManagerInit.invoke(checkpointManager, hostContext);
        leaseManagerInit.invoke(leaseManager, hostContext);
    }
}
