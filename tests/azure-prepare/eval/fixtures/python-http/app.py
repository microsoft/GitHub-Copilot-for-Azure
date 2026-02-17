from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/api/hello")
def hello():
    return jsonify({"message": "Hello from Python Azure Functions!"})

@app.route("/api/items", methods=["GET"])
def get_items():
    items = [
        {"id": 1, "name": "Widget A", "price": 9.99},
        {"id": 2, "name": "Widget B", "price": 19.99},
    ]
    return jsonify(items)

if __name__ == "__main__":
    app.run(debug=True)
