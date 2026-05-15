package com.microsoft.azure.eventprocessorhosts;

import com.microsoft.azure.eventhubs.EventData;
import com.microsoft.azure.eventprocessorhost.CloseReason;
import com.microsoft.azure.eventprocessorhost.IEventProcessor;
import com.microsoft.azure.eventprocessorhost.PartitionContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicLong;

public class EventProcessor implements IEventProcessor {

    private static final Logger LOGGER = LoggerFactory.getLogger(EventProcessor.class);
    private static final AtomicLong TOTAL_COUNT = new AtomicLong();

    @Override
    public void onOpen(PartitionContext context) {
        LOGGER.debug("Partition {} is opening", context.getPartitionId());
    }

    @Override
    public void onClose(PartitionContext context, CloseReason reason) {
        LOGGER.debug("Partition {} is closing for reason {}", context.getPartitionId(), reason);
    }

    @Override
    public void onError(PartitionContext context, Throwable error) {
        LOGGER.error("Partition {}", context.getPartitionId(), error);
    }

    @Override
    public void onEvents(PartitionContext context, Iterable<EventData> events) {
        int eventCount = 0;
        for (EventData data : events) {
            try {
                LOGGER.debug("Received event: {}", new String(data.getBytes(), StandardCharsets.UTF_8));
                eventCount++;
                TOTAL_COUNT.incrementAndGet();
            } catch (Exception error) {
                LOGGER.error("Processing failed for an event", error);
            }
        }

        LOGGER.debug("Partition {} processed a batch of size {} for host {}", context.getPartitionId(), eventCount, context.getOwner());
        LOGGER.info("************* Consumed {} total events (so far) **********", TOTAL_COUNT.get());
    }
}
