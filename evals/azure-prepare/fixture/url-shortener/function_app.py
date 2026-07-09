import azure.functions as func
import json
import hashlib

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

links: dict[str, str] = {}

@app.route(route="shorten", methods=["POST"])
def shorten(req: func.HttpRequest) -> func.HttpResponse:
    body = req.get_json()
    url = body["url"]
    code = hashlib.md5(url.encode()).hexdigest()[:6]
    links[code] = url
    return func.HttpResponse(json.dumps({"short": f"/r/{code}"}), mimetype="application/json")

@app.route(route="r/{code}")
def redirect(req: func.HttpRequest, code: str) -> func.HttpResponse:
    url = links.get(code)
    if not url:
        return func.HttpResponse("Not found", status_code=404)
    return func.HttpResponse(status_code=302, headers={"Location": url})
