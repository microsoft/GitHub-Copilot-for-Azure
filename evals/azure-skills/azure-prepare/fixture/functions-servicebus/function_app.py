import azure.functions as func
import logging
import json

app = func.FunctionApp()

@app.service_bus_queue_trigger(arg_name="msg",
                                queue_name="orders",
                                connection="ServiceBusConnection")
def process_order(msg: func.ServiceBusMessage):
    body = json.loads(msg.get_body().decode("utf-8"))
    logging.info("Processing order: %s", body)
