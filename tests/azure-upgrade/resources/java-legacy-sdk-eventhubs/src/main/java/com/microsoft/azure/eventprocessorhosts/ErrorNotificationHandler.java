package com.microsoft.azure.eventprocessorhosts;

import com.microsoft.azure.eventprocessorhost.ExceptionReceivedEventArgs;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.function.Consumer;

public class ErrorNotificationHandler implements Consumer<ExceptionReceivedEventArgs> {

    private static final Logger LOGGER = LoggerFactory.getLogger(ErrorNotificationHandler.class);

    @Override
    public void accept(ExceptionReceivedEventArgs eventArgs) {
        LOGGER.error(
            "Host {} received general error notification during {}",
            eventArgs.getHostname(),
            eventArgs.getAction(),
            eventArgs.getException()
        );
    }
}
