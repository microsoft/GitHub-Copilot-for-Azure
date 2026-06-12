// Preserves the "container" query parameter across site-nav links.
(function () {
    const container = new URLSearchParams(window.location.search).get("container");
    if (!container) return;

    document.querySelectorAll(".site-nav-link").forEach(function (link) {
        const href = link.getAttribute("href");
        if (!href) return;
        const separator = href.includes("?") ? "&" : "?";
        link.setAttribute("href", href + separator + "container=" + encodeURIComponent(container));
    });
})();
