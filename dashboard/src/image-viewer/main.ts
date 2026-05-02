const params = new URLSearchParams(window.location.search);
const path = params.get("path");
const container = document.getElementById("container") as HTMLDivElement;
const errorEl = document.getElementById("error") as HTMLParagraphElement;

function showError(message: string): void {
    errorEl.textContent = message;
    errorEl.hidden = false;
}

if (!path) {
    showError("Missing 'path' query parameter.");
} else if (path.includes("..")) {
    showError("Invalid path.");
} else {
    const fileName = path.split("/").pop() ?? "image";
    document.title = fileName;

    const img = document.createElement("img");
    img.className = "iv-image";
    img.alt = fileName;
    img.src = `/api/fetch?path=${encodeURIComponent(path)}`;
    img.onerror = () => {
        img.remove();
        showError("Failed to load image.");
    };
    container.appendChild(img);
}
