(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    if (standaloneQuery.matches || navigator.standalone === true) {
        return;
    }

    let installPrompt = null;
    const banner = document.createElement("aside");
    banner.className = "pwa-install";
    banner.setAttribute("aria-label", "Install Medico app");

    const installButton = document.createElement("button");
    installButton.type = "button";
    installButton.textContent = "Install Medico";
    installButton.setAttribute("aria-expanded", "false");

    const hint = document.createElement("p");
    hint.className = "pwa-install-hint";
    hint.hidden = true;
    hint.textContent = "In Chrome, open the menu ⋮ and choose Install app or Add to Home screen.";

    installButton.addEventListener("click", async () => {
        if (!installPrompt) {
            hint.hidden = !hint.hidden;
            installButton.setAttribute("aria-expanded", String(!hint.hidden));
            return;
        }

        try {
            await installPrompt.prompt();
            const choice = await installPrompt.userChoice;
            installPrompt = null;

            if (choice.outcome === "accepted") {
                banner.remove();
                return;
            }

            hint.hidden = false;
            hint.textContent = "You can install Medico later from Chrome's menu.";
            installButton.setAttribute("aria-expanded", "true");
        } catch (error) {
            console.error("Could not open the app installation prompt:", error);
            hint.hidden = false;
            hint.textContent = "Open Chrome's menu and choose Install app or Add to Home screen.";
            installButton.setAttribute("aria-expanded", "true");
        }
    });

    banner.append(installButton, hint);
    document.body.append(banner);

    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        installPrompt = event;
    });

    window.addEventListener("appinstalled", () => banner.remove());

    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("./sw.js")
                .catch(error => console.error("Could not register the app service worker:", error));
        });
    }
})();
