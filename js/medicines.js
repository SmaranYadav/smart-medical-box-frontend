
const API_URL = "http://127.0.0.1:5000/api/medicines";

const medicineList = document.getElementById("medicineList");
const medicineForm = document.getElementById("medicineForm");
const message = document.getElementById("message");
const frequencySelect = document.getElementById("frequency");
const doseTimesContainer =
    document.getElementById("doseTimesContainer");
const addMedicineBtn = document.getElementById("addMedicineBtn");

function showMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "#b42318" : "#16834a";
}

// Create one time input for each daily dose.
function renderDoseTimeInputs() {
    const frequency = Number(frequencySelect.value);
    doseTimesContainer.replaceChildren();

    for (let i = 1; i <= frequency; i++) {
        const wrapper = document.createElement("div");
        wrapper.className = "dose-field";

        const label = document.createElement("label");
        label.htmlFor = `doseTime${i}`;
        label.textContent = `Dose ${i} time`;

        const input = document.createElement("input");
        input.type = "time";
        input.id = `doseTime${i}`;
        input.required = true;

        wrapper.append(label, input);
        doseTimesContainer.appendChild(wrapper);
    }
}

frequencySelect.addEventListener("change", renderDoseTimeInputs);
renderDoseTimeInputs();

// Load medicines from the Flask API.
async function loadMedicines() {
    medicineList.textContent = "Loading medicines...";

    try {
        const response = await fetch(API_URL, {
            method: "GET",
            credentials: "include"
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || `Request failed (${response.status})`
            );
        }

        const medicines = data.medicines || [];
        medicineList.replaceChildren();

        if (medicines.length === 0) {
            medicineList.textContent = "No medicines found.";
            return;
        }

        medicines.forEach(medicine => {
            const item = document.createElement("article");
            item.className = "medicine";

            const name = document.createElement("h3");
            name.textContent = medicine.medicine_name || "Unnamed medicine";

            const dosage = document.createElement("p");
            dosage.textContent =
                `Dosage: ${medicine.dosage || "Not specified"}`;

            const times = document.createElement("p");
            const doseTimes = Array.isArray(medicine.dose_times)
                ? medicine.dose_times.join(", ")
                : "Not specified";
            times.textContent = `Dose times: ${doseTimes}`;

            const frequency = document.createElement("p");
            frequency.textContent =
                `Frequency: ${medicine.frequency ?? "—"} time(s) per day`;

            const dates = document.createElement("p");
            dates.textContent =
                `Course: ${medicine.start_date || "—"} to ${medicine.end_date || "—"}`;

            const instructions = document.createElement("p");
            instructions.textContent =
                `Instructions: ${medicine.instructions || "None"}`;

            const status = document.createElement("p");
            status.className = "status";

            const currentStatus = medicine.status || "Unknown";
            status.textContent = `Status: ${currentStatus}`;

            if (currentStatus === "Active") {
                status.classList.add("status-active");
            } else if (currentStatus === "Completed") {
                status.classList.add("status-completed");
            } else if (currentStatus === "Deleted") {
                status.classList.add("status-deleted");
            }

            item.append(
                name,
                dosage,
                times,
                frequency,
                dates,
                instructions,
                status
            );

            medicineList.appendChild(item);
        });
    } catch (error) {
        medicineList.textContent = error.message;
        console.error("Load medicines error:", error);
    }
}

// Submit a new medicine using the exact field names required by Flask.
medicineForm.addEventListener("submit", async event => {
    event.preventDefault();
    showMessage("");

    const frequency = Number(frequencySelect.value);
    const doseTimes = [];

    for (let i = 1; i <= frequency; i++) {
        const input = document.getElementById(`doseTime${i}`);
        doseTimes.push(input ? input.value : "");
    }

    if (doseTimes.some(value => !value)) {
        showMessage("Please enter every dose time.", true);
        return;
    }

    if (new Set(doseTimes).size !== doseTimes.length) {
        showMessage("Dose times must be different.", true);
        return;
    }

    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    if (!startDate || !endDate) {
        showMessage("Please enter both course dates.", true);
        return;
    }

    if (endDate < startDate) {
        showMessage("End date cannot be before start date.", true);
        return;
    }

    const medicine = {
        medicine_name:
            document.getElementById("medicineName").value.trim(),
        dosage:
            document.getElementById("dosage").value.trim(),
        frequency: frequency,
        dose_times: doseTimes,
        start_date: startDate,
        end_date: endDate,
        instructions:
            document.getElementById("instructions").value.trim()
    };

    addMedicineBtn.disabled = true;
    showMessage("Saving medicine...");

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(medicine)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || data.message ||
                `Could not save medicine (${response.status})`
            );
        }

        showMessage("Medicine added successfully!");
        medicineForm.reset();
        frequencySelect.value = "1";
        renderDoseTimeInputs();

        await loadMedicines();
    } catch (error) {
        showMessage(error.message, true);
        console.error("Add medicine error:", error);
    } finally {
        addMedicineBtn.disabled = false;
    }
});

document.getElementById("refreshBtn").addEventListener(
    "click",
    loadMedicines
);

// Initial page load.
loadMedicines();
