
self.addEventListener("install", (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
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
        vibrate: [250, 100, 250, 100, 450],
        renotify: true,
        requireInteraction: true,
        silent: false
    };

    event.waitUntil((async () => {
        await self.registration.showNotification(title, options);

        const windowClients = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true
        });

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
