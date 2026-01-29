import azure.functions as func

app = func.FunctionApp()

@app.route(route="hello")
def hello(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse("Hello!")
