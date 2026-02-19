import json
import azure.functions as func

app = func.FunctionApp()


@app.route(route="hello", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def hello(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps({"message": "Hello from Python Azure Functions!"}),
        mimetype="application/json",
    )


@app.route(route="items", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def get_items(req: func.HttpRequest) -> func.HttpResponse:
    items = [
        {"id": 1, "name": "Widget A", "price": 9.99},
        {"id": 2, "name": "Widget B", "price": 19.99},
    ]
    return func.HttpResponse(
        json.dumps(items),
        mimetype="application/json",
    )
