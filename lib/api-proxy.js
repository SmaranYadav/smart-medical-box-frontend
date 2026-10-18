module.exports = async function handler(req, res) {
    const backendUrl = process.env.BACKEND_URL;

    if (!backendUrl) {
        res.status(500).json({ error: "BACKEND_URL is not configured" });
        return;
    }

    let target;
    try {
        const backend = new URL(backendUrl);
        if (backend.protocol !== "https:") {
            throw new Error("BACKEND_URL must use HTTPS");
        }
        target = new URL(req.url, backend);
        if (target.origin !== backend.origin) {
            throw new Error("Invalid API proxy destination");
        }
    } catch (error) {
        console.error("Invalid BACKEND_URL configuration:", error.message);
        res.status(500).json({ error: "Invalid BACKEND_URL configuration" });
        return;
    }

    try {
        const headers = new Headers();
        for (const name of ["accept", "content-type", "cookie", "user-agent"]) {
            const value = req.headers[name];
            if (value) headers.set(name, value);
        }

        let body;
        if (!["GET", "HEAD"].includes(req.method)) {
            if (req.body !== undefined) {
                body = Buffer.isBuffer(req.body)
                    ? req.body
                    : Buffer.from(
                        typeof req.body === "string"
                            ? req.body
                            : JSON.stringify(req.body)
                    );
                if (body.length > 1024 * 1024) {
                    res.status(413).json({ error: "Request body is too large" });
                    return;
                }
            } else {
                const chunks = [];
                let bodyLength = 0;
                for await (const chunk of req) {
                    bodyLength += chunk.length;
                    if (bodyLength > 1024 * 1024) {
                        res.status(413).json({ error: "Request body is too large" });
                        return;
                    }
                    chunks.push(chunk);
                }
                body = Buffer.concat(chunks);
            }
        }

        const upstream = await fetch(target, {
            method: req.method,
            headers,
            body,
            signal: AbortSignal.timeout(30000)
        });

        res.statusCode = upstream.status;
        for (const name of ["content-type", "cache-control"]) {
            const value = upstream.headers.get(name);
            if (value) res.setHeader(name, value);
        }
        const cookies = upstream.headers.getSetCookie();
        if (cookies.length) res.setHeader("set-cookie", cookies);

        const responseBody = Buffer.from(await upstream.arrayBuffer());
        res.setHeader("content-length", responseBody.length);
        res.end(responseBody);
    } catch (error) {
        console.error("API proxy request failed:", error.message);
        res.status(502).json({ error: "The backend API could not be reached" });
    }
};
