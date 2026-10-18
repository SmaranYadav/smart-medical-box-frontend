
const API_URL = "http://127.0.0.1:5000/api/auth";

// Display messages safely
function showMessage(element, message, success = false) {
    if (!element) return;

    element.textContent = message;
    element.style.color = success ? "#198754" : "#dc3545";
}

// ===============================
// LOGIN
// ===============================
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const message = document.getElementById("message");
        const button = document.getElementById("loginBtn");

        button.disabled = true;
        showMessage(message, "Signing in...", true);

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({
                    email: document.getElementById("email").value.trim(),
                    password: document.getElementById("password").value
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Login failed.");
            }

            showMessage(message, "Login successful!", true);

            // Navigate after successful authentication
            window.location.href = "dashboard.html";

        } catch (error) {
            if (error.message === "Failed to fetch") {
                showMessage(
                    message,
                    "Cannot connect to the server. Check whether Flask is running."
                );
            } else {
                showMessage(message, error.message);
            }
        } finally {
            button.disabled = false;
        }
    });
}


// ===============================
// REGISTRATION
// ===============================
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const message = document.getElementById("message");
        const button = document.getElementById("registerBtn");

        const fullName =
            document.getElementById("full_name").value.trim();

        const email =
            document.getElementById("email").value.trim();

        const mobileNumber =
            document.getElementById("mobile_number").value.trim();

        const password =
            document.getElementById("password").value;

        if (!fullName || !email || !mobileNumber || !password) {
            showMessage(message, "Please fill in all fields.");
            return;
        }

        if (password.length < 8) {
            showMessage(
                message,
                "Password must contain at least 8 characters."
            );
            return;
        }

        button.disabled = true;
        showMessage(message, "Creating your account...", true);

        try {
            const response = await fetch(`${API_URL}/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({
                    full_name: fullName,
                    email: email,
                    mobile_number: mobileNumber,
                    password: password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "Registration failed."
                );
            }

            showMessage(
                message,
                "Account created successfully! Redirecting to login...",
                true
            );

            registerForm.reset();

            setTimeout(() => {
                window.location.href = "index.html";
            }, 1200);

        } catch (error) {
            if (error.message === "Failed to fetch") {
                showMessage(
                    message,
                    "Cannot connect to the backend. Check whether Flask is running."
                );
            } else {
                showMessage(message, error.message);
            }
        } finally {
            button.disabled = false;
        }
    });
}
