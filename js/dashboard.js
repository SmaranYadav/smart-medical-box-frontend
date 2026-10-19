
const API_BASE = window.API_BASE_URL;
const API_URL = `${API_BASE}/medicines`;

let reminderTimer = null;
const notifiedDoses = new Set();
let serviceWorkerRegistration = null;
let reminderAudioContext = null;

document.addEventListener("DOMContentLoaded", initializeDashboard);

// ---------------- API HELPER ----------------

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        credentials: "include",
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.error || data.message || `Request failed (${response.status})`
        );
    }

    return data;
}

// ---------------- INITIALIZE ----------------

async function initializeDashboard() {
    setupNavigation();
    setupMedicineModal();
    setupPushNotifications();

    try {
        await loadProfile();
    } catch (error) {
        console.warn("Could not load profile:", error.message);
    }

    try {
        await loadMedicines();
    } catch (error) {
        console.error("Dashboard error:", error);
        showMessage(error.message, true);
    }
}

// ---------------- PROFILE AND NAVIGATION ----------------

async function loadProfile() {
    const data = await apiRequest(`${API_BASE}/auth/me`);
    const welcome = document.getElementById("welcome");

    if (welcome && data.user) {
        welcome.textContent = `Welcome, ${data.user.full_name || "User"}!`;
    }
}

function setupNavigation() {
    document.getElementById("trackerNav")?.addEventListener("click", () => {
        document.getElementById("tracker")?.scrollIntoView({
            behavior: "smooth"
        });
    });

    document.getElementById("medicinesNav")?.addEventListener("click", () => {
        window.location.href = "medicines.html";
    });

    document.getElementById("remindersNav")?.addEventListener("click", () => {
        document.getElementById("reminderPanel")?.scrollIntoView({
            behavior: "smooth"
        });
    });

    document.getElementById("logoutBtn")?.addEventListener("click", async () => {
        try {
            await apiRequest(`${API_BASE}/auth/logout`, {
                method: "POST"
            });

            window.location.href = "index.html";
        } catch (error) {
            showMessage("Logout failed: " + error.message, true);
        }
    });
}

// ---------------- MEDICINE MODAL ----------------

function setupMedicineModal() {
    const modal = document.getElementById("medicineModal");
    const form = document.getElementById("medicineForm");

    document.getElementById("addMedicineBtn")?.addEventListener("click", () => {
        form?.reset();

        const today = localDateString(new Date());

        document.getElementById("start_date").value = today;
        document.getElementById("end_date").value = today;
        document.getElementById("formMessage").textContent = "";

        modal?.classList.add("open");
    });

    document.getElementById("cancelModal")?.addEventListener("click", () => {
        modal?.classList.remove("open");
    });

    modal?.addEventListener("click", event => {
        if (event.target === modal) {
            modal.classList.remove("open");
        }
    });

    document.getElementById("frequency")?.addEventListener("change", event => {
        const count = Number(event.target.value);
        const input = document.getElementById("dose_times");

        const defaults = {
            1: "09:00",
            2: "09:00,21:00",
            3: "08:00,14:00,20:00",
            4: "08:00,12:00,16:00,20:00"
        };

        input.value = defaults[count] || "";
    });

    form?.addEventListener("submit", async event => {
        event.preventDefault();

        const message = document.getElementById("formMessage");
        const saveButton = document.getElementById("saveMedicineBtn");

        const times = document.getElementById("dose_times").value
            .split(",")
            .map(value => value.trim());

        const frequency = Number(
            document.getElementById("frequency").value
        );

        if (
            times.length !== frequency ||
            times.some(value => !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
        ) {
            message.textContent =
                "Enter the correct number of dose times in HH:MM format.";
            return;
        }

        if (new Set(times).size !== times.length) {
            message.textContent = "Each dose time must be different.";
            return;
        }

        const startDate = document.getElementById("start_date").value;
        const endDate = document.getElementById("end_date").value;

        if (endDate < startDate) {
            message.textContent =
                "The end date cannot be before the start date.";
            return;
        }

        const payload = {
            medicine_name: document.getElementById("medicine_name").value.trim(),
            dosage: document.getElementById("dosage").value.trim(),
            frequency,
            dose_times: times,
            start_date: startDate,
            end_date: endDate,
            instructions: document.getElementById("instructions").value.trim()
        };

        saveButton.disabled = true;
        message.textContent = "Saving medicine...";

        try {
            await apiRequest(API_URL, {
                method: "POST",
                body: JSON.stringify(payload)
            });

            modal.classList.remove("open");
            showMessage("Medicine added successfully.");
            await loadMedicines();
        } catch (error) {
            message.textContent = error.message;
        } finally {
            saveButton.disabled = false;
        }
    });
}

// ---------------- LOAD AND DISPLAY MEDICINES ----------------

function getMedicines(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.medicines)) return data.medicines;
    if (Array.isArray(data.data)) return data.data;
    return [];
}

async function loadMedicines() {
    const data = await apiRequest(API_URL);
    const medicines = getMedicines(data);

    renderMedicines(medicines);
    updateStatistics(medicines);
}

function renderMedicines(medicines) {
    const list = document.getElementById("medicineList");
    if (!list) return;

    list.replaceChildren();

    if (medicines.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent =
            "No medicines added yet. Click + Add medicine to begin.";
        list.appendChild(empty);
        return;
    }

    medicines.forEach(medicine => {
        const status = medicine.status || "Active";
        const card = document.createElement("div");
        card.className = "medicine";

        const details = document.createElement("div");
        details.style.flex = "1";

        const name = document.createElement("h3");
        name.textContent = medicine.medicine_name || "Medicine";
        details.appendChild(name);

        const lines = [
            `${medicine.dosage || ""} · ${medicine.frequency || 1} dose(s) daily`,
            `${medicine.start_date || ""} to ${medicine.end_date || ""}`,
            `Dose times: ${formatDoseTimes(medicine.dose_times)}`,
            `Status: ${status}`,
            medicine.instructions
                ? `Instructions: ${medicine.instructions}`
                : ""
        ];

        lines.filter(Boolean).forEach(line => {
            const paragraph = document.createElement("p");
            paragraph.textContent = line;
            details.appendChild(paragraph);
        });

        const actions = document.createElement("div");
        actions.className = "actions";

        if (status === "Active") {
            actions.appendChild(
                createButton("Complete", "primary small-btn", () =>
                    completeMedicine(medicine.medicine_id)
                )
            );
        }

        if (status !== "Deleted") {
            actions.appendChild(
                createButton("Extend", "primary small-btn secondary", () =>
                    extendMedicine(medicine)
                )
            );
        }

        actions.appendChild(
            createButton("Delete", "primary small-btn danger", () =>
                deleteMedicine(medicine.medicine_id)
            )
        );

        card.append(details, actions);
        list.appendChild(card);
    });
}

function formatDoseTimes(times) {
    if (Array.isArray(times)) return times.join(", ");

    if (typeof times === "string") {
        try {
            const parsed = JSON.parse(times);
            if (Array.isArray(parsed)) return parsed.join(", ");
        } catch {
            return times;
        }
    }

    return "Not specified";
}

function createButton(label, className, callback) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", callback);
    return button;
}

// ---------------- DASHBOARD STATISTICS ----------------

function updateStatistics(medicines) {
    const today = localDateString(new Date());

    const active = medicines.filter(medicine =>
        medicine.status === "Active"
    );

    const completed = medicines.filter(medicine =>
        medicine.status === "Completed"
    );

    const dosesToday = active.reduce((total, medicine) => {
        const start = String(medicine.start_date || "").slice(0, 10);
        const end = String(medicine.end_date || "").slice(0, 10);

        if (today < start || today > end) return total;

        return total + parseDoseTimes(medicine.dose_times).length;
    }, 0);

    document.getElementById("activeCount").textContent = active.length;
    document.getElementById("doseCount").textContent = dosesToday;
    document.getElementById("completedCount").textContent = completed.length;
}

function parseDoseTimes(times) {
    if (Array.isArray(times)) return times;

    if (typeof times === "string") {
        try {
            const parsed = JSON.parse(times);
            if (Array.isArray(parsed)) return parsed;
        } catch {
            return times.split(",").map(value => value.trim()).filter(Boolean);
        }
    }

    return [];
}

// ---------------- COMPLETE, EXTEND, DELETE ----------------

async function completeMedicine(id) {
    if (!confirm("Mark this medicine course as completed?")) return;

    try {
        await apiRequest(`${API_URL}/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ action: "complete" })
        });

        showMessage("Medicine course completed successfully.");
        await loadMedicines();
    } catch (error) {
        showMessage(error.message, true);
    }
}

async function extendMedicine(medicine) {
    const currentDate = String(medicine.end_date || "").slice(0, 10);

    const newDate = prompt(
        "Enter the new course end date (YYYY-MM-DD):",
        currentDate
    );

    if (!newDate) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
        showMessage("Enter the date in YYYY-MM-DD format.", true);
        return;
    }

    if (newDate <= currentDate) {
        showMessage(
            "The new end date must be after the current end date.",
            true
        );
        return;
    }

    try {
        await apiRequest(`${API_URL}/${medicine.medicine_id}`, {
            method: "PATCH",
            body: JSON.stringify({
                action: "extend",
                end_date: newDate
            })
        });

        showMessage("Medicine course extended successfully.");
        await loadMedicines();
    } catch (error) {
        showMessage(error.message, true);
    }
}

async function deleteMedicine(id) {
    if (!confirm("Are you sure you want to delete this medicine?")) return;

    try {
        await apiRequest(`${API_URL}/${id}`, {
            method: "DELETE"
        });

        showMessage("Medicine deleted successfully.");
        await loadMedicines();
    } catch (error) {
        showMessage(error.message, true);
    }
}

// ---------------- PUSH NOTIFICATIONS ----------------

function setReminderStatus(message, isError = false) {
    const status = document.getElementById("reminderStatus");

    if (status) {
        status.textContent = message;
        status.style.color = isError ? "#d93025" : "#198754";
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = atob(base64);
    const output = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i++) {
        output[i] = rawData.charCodeAt(i);
    }

    return output;
}

async function setupPushNotifications() {
    const enableButton = document.getElementById("enableReminders");
    const testButton = document.getElementById("testPush");

    if (!enableButton || !testButton) return;

    document.addEventListener(
        "pointerdown",
        unlockReminderAudio,
        { once: true }
    );
    document.addEventListener(
        "keydown",
        unlockReminderAudio,
        { once: true }
    );

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setReminderStatus(
            "Push notifications are not supported by this browser.",
            true
        );
        enableButton.disabled = true;
        testButton.disabled = true;
        return;
    }

    if (!window.isSecureContext) {
        setReminderStatus(
            "Open this site through localhost or HTTPS to enable push notifications.",
            true
        );
        return;
    }

    try {
        serviceWorkerRegistration =
            await navigator.serviceWorker.register("./sw.js");

        await navigator.serviceWorker.ready;

        const existingSubscription =
            await serviceWorkerRegistration.pushManager.getSubscription();

        if (existingSubscription) {
            setReminderStatus(
                "A push subscription exists in this browser. You can test it."
            );
        } else {
            setReminderStatus(
                "Click Enable push notifications to subscribe this browser."
            );
        }
    } catch (error) {
        console.error("Service worker registration failed:", error);
        setReminderStatus(
            "Could not register the service worker: " + error.message,
            true
        );
    }

    enableButton.addEventListener("click", enablePushNotifications);
    testButton.addEventListener("click", sendTestPush);
}

async function enablePushNotifications() {
    const button = document.getElementById("enableReminders");

    try {
        if (!serviceWorkerRegistration) {
            serviceWorkerRegistration =
                await navigator.serviceWorker.register("./sw.js");
        }

        if (!("Notification" in window)) {
            throw new Error("Browser notifications are not supported.");
        }

        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
            throw new Error(
                "Notification permission was not granted. Check browser settings."
            );
        }

        setReminderStatus("Connecting to the push service...");

        const keyData = await apiRequest(`${API_BASE}/push/public-key`);

        if (!keyData.publicKey) {
            throw new Error("The server did not return a VAPID public key.");
        }

        const registration = await navigator.serviceWorker.ready;

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
            });
        }

        await apiRequest(`${API_BASE}/push/subscribe`, {
            method: "POST",
            body: JSON.stringify({
                subscription: subscription.toJSON()
            })
        });

        setReminderStatus(
            "Push notifications enabled! Your browser subscription was saved."
        );
        showMessage("Push notifications enabled successfully.");
    } catch (error) {
        console.error("Enable push failed:", error);
        setReminderStatus(error.message, true);
    } finally {
        if (button) button.disabled = false;
    }
}

async function sendTestPush() {
    const button = document.getElementById("testPush");

    if (button) button.disabled = true;

    try {
        setReminderStatus("Sending test notification...");

        const result = await apiRequest(`${API_BASE}/push/test`, {
            method: "POST"
        });

        setReminderStatus(
            result.message || "Test notification request completed."
        );
    } catch (error) {
        console.error("Test push failed:", error);
        setReminderStatus(error.message, true);
    } finally {
        if (button) button.disabled = false;
    }
}

// ---------------- OPTIONAL SOUND WHEN DASHBOARD IS OPEN ----------------

function getReminderAudioContext() {
    const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return null;

    if (!reminderAudioContext) {
        reminderAudioContext = new AudioContextClass();
    }

    return reminderAudioContext;
}

function unlockReminderAudio() {
    const audioContext = getReminderAudioContext();

    if (audioContext?.state === "suspended") {
        audioContext.resume().catch(error => {
            console.warn("Could not enable reminder audio:", error);
        });
    }
}

async function playReminderSound() {
    const soundOption = document.getElementById("reminderSound");

    if (!soundOption?.checked) return;

    try {
        const audioContext = getReminderAudioContext();
        if (!audioContext) return;
        if (audioContext.state === "suspended") {
            await audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = 880;
        gain.gain.value = 0.12;

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start();

        window.setTimeout(() => {
            oscillator.stop();
        }, 300);
    } catch (error) {
        console.warn("Could not play reminder sound:", error);
    }
}

// The service worker can notify an open dashboard when a push arrives.
navigator.serviceWorker?.addEventListener("message", event => {
    if (event.data?.type === "MEDICINE_PUSH_RECEIVED") {
        playReminderSound();
    }
});

// ---------------- UTILITIES ----------------

function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function showMessage(message, isError = false) {
    const notice = document.getElementById("notice");
    if (!notice) return;

    notice.textContent = message;
    notice.style.color = isError ? "#d93025" : "#07865b";

    if (!isError) {
        window.setTimeout(() => {
            if (notice.textContent === message) {
                notice.textContent = "";
            }
        }, 5000);
    }
}
