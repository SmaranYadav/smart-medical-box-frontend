
const SHELL_CACHE = "medico-app-shell-v1";
const APP_SHELL = [
    "./index.html",
    "./register.html",
    "./dashboard.html",
    "./medicines.html",
    "./manifest.webmanifest",
    "./css/style.css",
    "./js/config.js",
    "./js/app.js",
    "./js/dashboard.js",
    "./js/medicines.js",
    "./js/pwa.js",
    "./assets/icon-192.png",
    "./assets/icon-512.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames
            .filter(name => name.startsWith("medico-app-shell-") && name !== SHELL_CACHE)
            .map(name => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    const requestUrl = new URL(request.url);

    if (
        request.method !== "GET" ||
        requestUrl.origin !== self.location.origin ||
        requestUrl.pathname === "/api" ||
        requestUrl.pathname.startsWith("/api/")
    ) {
        return;
    }

    if (request.mode === "navigate") {
        event.respondWith((async () => {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    const cache = await caches.open(SHELL_CACHE);
                    await cache.put(request, response.clone());
                }
                return response;
            } catch {
                return await caches.match(request) ||
                    await caches.match(new URL("./index.html", self.registration.scope));
            }
        })());
        return;
    }

    event.respondWith((async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
            const cache = await caches.open(SHELL_CACHE);
            await cache.put(request, response.clone());
        }
        return response;
    })());
});

self.addEventListener("push", (event) => {
    let data = {};

    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = {
            body: event.data ? event.data.text() : "Time to take your medicine!"
        };
    }

    const title = data.title || "Smart Medical Box";
    const options = {
        body: data.body || "It's time to take your medicine.",
        icon: "./assets/icon-192.png",
        badge: "./assets/icon-192.png",
        tag: data.tag || "medicine-reminder",
        data: {
            url: data.url || "./dashboard.html"
        },
        vibrate: [700, 180, 700, 180, 1000, 250, 700],
        renotify: true,
        requireInteraction: true,
        silent: false
    };

    event.waitUntil((async () => {
        const windowClients = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true
        });
        const visibleDashboard = windowClients.find(client =>
            client.url.startsWith(self.registration.scope) &&
            new URL(client.url).pathname.endsWith("/dashboard.html") &&
            client.visibilityState === "visible"
        );

        if (visibleDashboard) {
            options.vibrate = [];
        }

        await self.registration.showNotification(title, options);

        for (const client of windowClients) {
            if (
                client.url.startsWith(self.registration.scope) &&
                new URL(client.url).pathname.endsWith("/dashboard.html")
            ) {
                client.postMessage({ type: "MEDICINE_PUSH_RECEIVED" });
            }
        }
    })());
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const targetUrl = new URL(
        event.notification.data?.url || "./dashboard.html",
        self.registration.scope
    ).href;

    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.startsWith(self.registration.scope)) {
                    client.focus();
                    return client.navigate(targetUrl);
                }
            }

            return clients.openWindow(targetUrl);
        })
    );
});
