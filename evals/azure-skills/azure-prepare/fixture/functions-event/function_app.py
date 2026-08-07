import azure.functions as func
import logging

app = func.FunctionApp()

@app.event_hub_message_trigger(arg_name="event",
                                event_hub_name="messages",
                                connection="EventHubConnection")
def process_message(event: func.EventHubEvent):
    logging.info("Processing message: %s", event.get_body().decode("utf-8"))
