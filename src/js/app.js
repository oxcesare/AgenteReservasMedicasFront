import {
  createAppointment,
  createAvailability,
  deleteAppointment,
  deleteAvailability,
  getDoctorAvailability,
  updateAppointment,
  updateAvailability
} from "./api.js";
import { APPOINTMENT_UI_STATUS } from "./config.js";
import {
  availabilityBadgeClass,
  buildDayRange,
  formatDateForInput,
  formatLongDate,
  formatTimeRange,
  normalizeSlot,
  toTimeInputValue,
  uiStatusToApi
} from "./utils.js";

const state = {
  slots: [],
  selectedDate: "",
  doctorId: 1,
  totalAvailableSlots: 0
};

const elements = {
  doctorId: document.querySelector("#doctorId"),
  clinicId: document.querySelector("#clinicId"),
  selectedDate: document.querySelector("#selectedDate"),
  loadDayButton: document.querySelector("#loadDayButton"),
  newSlotButton: document.querySelector("#newSlotButton"),
  currentDateLabel: document.querySelector("#currentDateLabel"),
  slotsTableBody: document.querySelector("#slotsTableBody"),
  slotCount: document.querySelector("#slotCount"),
  bookedCount: document.querySelector("#bookedCount"),
  availableCount: document.querySelector("#availableCount"),
  toastMessage: document.querySelector("#toastMessage"),
  slotForm: document.querySelector("#slotForm"),
  slotModalTitle: document.querySelector("#slotModalTitle"),
  slotId: document.querySelector("#slotId"),
  slotDate: document.querySelector("#slotDate"),
  slotRanges: document.querySelector("#slotRanges"),
  addRangeButton: document.querySelector("#addRangeButton"),
  slotRangesHelp: document.querySelector("#slotRangesHelp"),
  slotClinicId: document.querySelector("#slotClinicId"),
  appointmentForm: document.querySelector("#appointmentForm"),
  appointmentModalTitle: document.querySelector("#appointmentModalTitle"),
  appointmentId: document.querySelector("#appointmentId"),
  appointmentSlotId: document.querySelector("#appointmentSlotId"),
  appointmentSlotSummary: document.querySelector("#appointmentSlotSummary"),
  patientName: document.querySelector("#patientName"),
  patientLastName: document.querySelector("#patientLastName"),
  patientPhone: document.querySelector("#patientPhone"),
  patientEmail: document.querySelector("#patientEmail"),
  appointmentNotes: document.querySelector("#appointmentNotes"),
  deleteAppointmentButton: document.querySelector("#deleteAppointmentButton")
};

const slotModal = new bootstrap.Modal(document.querySelector("#slotModal"));
const appointmentModal = new bootstrap.Modal(document.querySelector("#appointmentModal"));
const feedbackToast = new bootstrap.Toast(document.querySelector("#feedbackToast"), {
  delay: 2800
});

function showToast(message, isError = false) {
  const toastElement = document.querySelector("#feedbackToast");
  toastElement.classList.toggle("bg-danger", isError);
  toastElement.classList.toggle("bg-success", !isError);
  elements.toastMessage.textContent = message;
  feedbackToast.show();
}

function getSelectedDoctorId() {
  return Number(elements.doctorId.value) || 1;
}

function getSelectedClinicId() {
  return Number(elements.clinicId.value) || 1;
}

function createRangeRow(startValue = "", endValue = "", isLocked = false) {
  const wrapper = document.createElement("div");
  wrapper.className = `slot-range-row${isLocked ? " is-locked" : ""}`;
  wrapper.innerHTML = `
    <div class="slot-range-label">Franja horaria</div>
    <div class="row g-2 align-items-end">
      <div class="col-12 col-md-5">
        <label class="form-label" for="">Hora inicio</label>
        <input class="form-control" data-role="range-start" type="time" value="${startValue}" required ${isLocked ? "disabled" : ""} />
      </div>
      <div class="col-12 col-md-5">
        <label class="form-label" for="">Hora fin</label>
        <input class="form-control" data-role="range-end" type="time" value="${endValue}" required ${isLocked ? "disabled" : ""} />
      </div>
      <div class="col-12 col-md-2 d-grid">
        <button class="btn btn-outline-danger" data-role="remove-range" type="button" ${isLocked ? "disabled" : ""}>Quitar</button>
      </div>
    </div>
  `;
  return wrapper;
}

function syncRangeButtons() {
  const rows = Array.from(elements.slotRanges.querySelectorAll(".slot-range-row"));
  const canRemove = rows.length > 1 && !elements.slotId.value;

  rows.forEach((row) => {
    const removeButton = row.querySelector('[data-role="remove-range"]');
    if (!removeButton) {
      return;
    }

    removeButton.disabled = row.classList.contains("is-locked") || !canRemove;
  });
}

function setSlotFormMode(isEditing) {
  elements.addRangeButton.classList.toggle("d-none", isEditing);
  elements.slotRangesHelp.textContent = isEditing
    ? "La edicion mantiene una sola franja para este slot existente."
    : "Agrega una o varias franjas para la fecha seleccionada.";
}

function clearRangeRows() {
  elements.slotRanges.innerHTML = "";
}

function addRangeRow(startValue = "", endValue = "", isLocked = false) {
  elements.slotRanges.append(createRangeRow(startValue, endValue, isLocked));
  syncRangeButtons();
}

function collectRanges() {
  return Array.from(elements.slotRanges.querySelectorAll(".slot-range-row")).map((row) => ({
    hora_inicio: row.querySelector('[data-role="range-start"]').value,
    hora_fin: row.querySelector('[data-role="range-end"]').value
  }));
}

function validateRanges(ranges) {
  if (!ranges.length) {
    throw new Error("Agrega al menos una franja horaria.");
  }

  const hasEmptyValues = ranges.some((range) => !range.hora_inicio || !range.hora_fin);
  if (hasEmptyValues) {
    throw new Error("Completa la hora de inicio y fin en cada franja.");
  }

  const hasInvalidOrder = ranges.some((range) => range.hora_inicio >= range.hora_fin);
  if (hasInvalidOrder) {
    throw new Error("Cada franja debe tener una hora fin mayor que la hora inicio.");
  }
}

function isSlotOnSelectedDate(slot, selectedDate) {
  const startDate = slot.startDateTime?.slice(0, 10);
  const endDate = slot.endDateTime?.slice(0, 10);
  return startDate === selectedDate && endDate === selectedDate;
}

function renderSummary() {
  elements.slotCount.textContent = String(state.totalAvailableSlots || state.slots.length);
  elements.bookedCount.textContent = String(
    state.slots.filter((slot) => Boolean(slot.appointmentId) || slot.availabilityState === "RESERVADO").length
  );
  elements.availableCount.textContent = String(state.slots.filter((slot) => slot.availabilityState === "DISPONIBLE").length);
}

function renderSlots() {
  if (!state.slots.length) {
    elements.slotsTableBody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">
            <h3 class="h5 mb-2">No hay fechas de disponibilidad registradas</h3>
            <p class="mb-0">Crea disponibilidad para esta fecha.</p>
          </div>
        </td>
      </tr>
    `;
    renderSummary();
    return;
  }

  elements.slotsTableBody.innerHTML = state.slots
    .map(
      (slot) => {
        const hasAppointment = Boolean(slot.appointmentId);
        const isReserved = slot.availabilityState === "RESERVADO";
        const isBlocked = slot.availabilityState === "BLOQUEADO";
        const canReserve = slot.availabilityState === "DISPONIBLE" && !hasAppointment;
        const canEditSlot = !isReserved && !isBlocked;
        const statusControl = hasAppointment
          ? `
              <select class="form-select status-select" data-role="status-select" data-slot-id="${slot.id}">
                ${Object.values(APPOINTMENT_UI_STATUS)
                  .map(
                    (status) => `
                      <option value="${status}" ${slot.appointmentStatusUi === status ? "selected" : ""}>
                        ${status}
                      </option>
                    `
                  )
                  .join("")}
              </select>
            `
          : `<input class="form-control status-select" type="text" value="${isReserved ? "Reservado" : isBlocked ? "Bloqueado" : "Sin cita"}" disabled />`;

        const patientLabel = slot.patient
          ? `${slot.patient.nombre ?? ""} ${slot.patient.apellido ?? ""}`.trim()
          : isReserved
            ? "Cita registrada"
            : "Sin paciente";

        const patientNote = slot.notes || (isReserved ? "Reserva creada desde API o fuente externa" : "Sin notas registradas");

        const appointmentButtonLabel = hasAppointment ? "Editar cita" : canReserve ? "Reservar" : "Reservado";

        return `
        <tr data-slot-id="${slot.id}">
          <td>
            <div class="slot-time">${formatTimeRange(slot.startDateTime, slot.endDateTime)}</div>
            <div class="slot-subtitle">Slot #${slot.id}</div>
          </td>
          <td>
            <span class="badge ${availabilityBadgeClass(slot.availabilityState)}">${slot.availabilityState}</span>
          </td>
          <td>
            ${statusControl}
          </td>
          <td>
            <div class="patient-block">
              <strong>${patientLabel}</strong>
              <small>${patientNote}</small>
            </div>
          </td>
          <td>
            <div class="d-flex justify-content-end gap-2 flex-wrap">
              <button class="btn btn-sm btn-outline-primary" type="button" data-role="edit-slot" data-slot-id="${slot.id}" ${canEditSlot ? "" : "disabled"}>Editar slot</button>
              <button class="btn btn-sm btn-primary" type="button" data-role="edit-appointment" data-slot-id="${slot.id}" ${canReserve || hasAppointment ? "" : "disabled"}>
                ${appointmentButtonLabel}
              </button>
              <button class="btn btn-sm btn-outline-danger" type="button" data-role="delete-slot" data-slot-id="${slot.id}">Eliminar</button>
            </div>
          </td>
        </tr>
      `;
      }
    )
    .join("");

  renderSummary();
}

async function loadAvailability() {
  const doctorId = getSelectedDoctorId();
  const selectedDate = elements.selectedDate.value;

  if (!selectedDate) {
    showToast("Selecciona una fecha para consultar disponibilidad.", true);
    return;
  }

  const { from, to } = buildDayRange(selectedDate);

  try {
    const response = await getDoctorAvailability(doctorId, from, to);
    const items = Array.isArray(response)
      ? response
      : response?.slots ?? response?.items ?? response?.results ?? response?.data ?? [];
    const filteredSlots = items
      .map(normalizeSlot)
      .filter((slot) => isSlotOnSelectedDate(slot, selectedDate))
      .sort((left, right) => left.startDateTime.localeCompare(right.startDateTime));

    state.doctorId = doctorId;
    state.selectedDate = selectedDate;
    state.totalAvailableSlots = filteredSlots.length;
    state.slots = filteredSlots;
    elements.currentDateLabel.textContent = `Agenda del ${formatLongDate(selectedDate)}`;
    renderSlots();
  } catch (error) {
    showToast(`No fue posible cargar la disponibilidad: ${error.message}`, true);
  }
}

function resetSlotForm() {
  elements.slotForm.reset();
  elements.slotId.value = "";
  elements.slotDate.value = elements.selectedDate.value;
  elements.slotClinicId.value = String(getSelectedClinicId());
  elements.slotModalTitle.textContent = "Nuevo slot";
  setSlotFormMode(false);
  clearRangeRows();
  addRangeRow();
}

function openEditSlot(slotId) {
  const slot = state.slots.find((item) => item.id === Number(slotId));

  if (!slot) {
    return;
  }

  elements.slotModalTitle.textContent = "Editar slot";
  elements.slotId.value = String(slot.id);
  elements.slotDate.value = state.selectedDate;
  elements.slotClinicId.value = String(slot.clinicId ?? getSelectedClinicId());
  setSlotFormMode(true);
  clearRangeRows();
  addRangeRow(toTimeInputValue(slot.startDateTime), toTimeInputValue(slot.endDateTime), false);
  slotModal.show();
}

async function handleSlotSubmit(event) {
  event.preventDefault();

  const ranges = collectRanges();

  try {
    validateRanges(ranges);
  } catch (error) {
    showToast(error.message, true);
    return;
  }

  const primaryRange = ranges[0];

  const updatePayload = {
    fecha: elements.slotDate.value,
    hora_inicio: primaryRange.hora_inicio,
    hora_fin: primaryRange.hora_fin,
    id_clinica: Number(elements.slotClinicId.value)
  };

  const createPayload = {
    id_doctor: getSelectedDoctorId(),
    id_clinica: Number(elements.slotClinicId.value),
    slots: [
      {
        fecha: elements.slotDate.value,
        franjas: ranges
      }
    ]
  };

  const slotId = elements.slotId.value;
  const doctorId = getSelectedDoctorId();

  try {
    if (slotId) {
      await updateAvailability(doctorId, slotId, updatePayload);
      showToast("Slot actualizado correctamente.");
    } else {
      await createAvailability(doctorId, createPayload);
      showToast("Slot creado correctamente.");
    }

    slotModal.hide();
    await loadAvailability();
  } catch (error) {
    showToast(`No fue posible guardar el slot: ${error.message}`, true);
  }
}

async function handleDeleteSlot(slotId) {
  const shouldDelete = window.confirm("Se eliminará este slot de disponibilidad. ¿Deseas continuar?");
  if (!shouldDelete) {
    return;
  }

  try {
    await deleteAvailability(getSelectedDoctorId(), slotId);
    showToast("Slot eliminado correctamente.");
    await loadAvailability();
  } catch (error) {
    showToast(`No fue posible eliminar el slot: ${error.message}`, true);
  }
}

function setAppointmentFieldsDisabled(disabled) {
  elements.patientName.disabled = disabled;
  elements.patientLastName.disabled = disabled;
  elements.patientPhone.disabled = disabled;
  elements.patientEmail.disabled = disabled;
}

function resetAppointmentForm() {
  elements.appointmentForm.reset();
  elements.appointmentId.value = "";
  elements.appointmentSlotId.value = "";
  elements.appointmentSlotSummary.textContent = "";
  elements.deleteAppointmentButton.classList.add("d-none");
  elements.appointmentModalTitle.textContent = "Reservar cita";
  setAppointmentFieldsDisabled(false);
}

function openAppointmentModal(slotId) {
  const slot = state.slots.find((item) => item.id === Number(slotId));

  if (!slot) {
    return;
  }

  resetAppointmentForm();

  if (!slot.appointmentId && slot.availabilityState !== "DISPONIBLE") {
    showToast("Solo puedes reservar citas sobre slots disponibles.", true);
    return;
  }

  elements.appointmentSlotId.value = String(slot.id);
  elements.appointmentNotes.value = slot.notes;
  elements.appointmentSlotSummary.textContent = `Slot #${slot.id} seleccionado: ${formatTimeRange(slot.startDateTime, slot.endDateTime)}.`;

  if (slot.appointmentId) {
    elements.appointmentId.value = String(slot.appointmentId);
    elements.appointmentModalTitle.textContent = "Editar cita";
    elements.deleteAppointmentButton.classList.remove("d-none");
    setAppointmentFieldsDisabled(true);
    elements.patientName.value = slot.patient?.nombre ?? "";
    elements.patientLastName.value = slot.patient?.apellido ?? "";
    elements.patientPhone.value = slot.patient?.telefono_whatsapp ?? "";
    elements.patientEmail.value = slot.patient?.email ?? "";
    elements.appointmentSlotSummary.textContent = `Editando la cita del slot #${slot.id}: ${formatTimeRange(slot.startDateTime, slot.endDateTime)}.`;
  }

  appointmentModal.show();
}

async function handleAppointmentSubmit(event) {
  event.preventDefault();

  const appointmentId = elements.appointmentId.value;
  const slotId = Number(elements.appointmentSlotId.value);

  try {
    if (appointmentId) {
      await updateAppointment(appointmentId, {
        id_slot: slotId,
        notas_paciente: elements.appointmentNotes.value.trim()
      });
      showToast("Cita actualizada correctamente.");
    } else {
      await createAppointment({
        id_slot: slotId,
        paciente: {
          nombre: elements.patientName.value.trim(),
          apellido: elements.patientLastName.value.trim(),
          telefono_whatsapp: elements.patientPhone.value.trim(),
          email: elements.patientEmail.value.trim()
        },
        notas_paciente: elements.appointmentNotes.value.trim()
      });
      showToast("Cita reservada correctamente.");
    }

    appointmentModal.hide();
    await loadAvailability();
  } catch (error) {
    showToast(`No fue posible guardar la cita: ${error.message}`, true);
  }
}

async function handleDeleteAppointment() {
  const appointmentId = elements.appointmentId.value;

  if (!appointmentId) {
    return;
  }

  const shouldDelete = window.confirm("La cita se eliminará y el slot quedará libre. ¿Deseas continuar?");
  if (!shouldDelete) {
    return;
  }

  try {
    await deleteAppointment(appointmentId);
    appointmentModal.hide();
    showToast("Cita eliminada correctamente.");
    await loadAvailability();
  } catch (error) {
    showToast(`No fue posible eliminar la cita: ${error.message}`, true);
  }
}

async function handleStatusChange(slotId, nextStatus) {
  const slot = state.slots.find((item) => item.id === Number(slotId));

  if (!slot) {
    return;
  }

  if (!slot.appointmentId) {
    showToast("Primero debes reservar una cita para este slot.", true);
    renderSlots();
    return;
  }

  try {
    await updateAppointment(slot.appointmentId, {
      id_slot: slot.id,
      notas_paciente: slot.notes,
      estado_actual: uiStatusToApi(nextStatus)
    });
    showToast("Estatus de cita actualizado.");
    await loadAvailability();
  } catch (error) {
    showToast(`No fue posible actualizar el estatus de la cita: ${error.message}`, true);
    renderSlots();
  }
}

async function handleDeleteAppointmentById(appointmentId) {
  try {
    await deleteAppointment(appointmentId);
    showToast("Cita cancelada correctamente.");
    await loadAvailability();
  } catch (error) {
    showToast(`No fue posible cancelar la cita: ${error.message}`, true);
    renderSlots();
  }
}

function handleTableClick(event) {
  const action = event.target.dataset.role;
  const slotId = event.target.dataset.slotId;

  if (!action || !slotId) {
    return;
  }

  if (action === "edit-slot") {
    openEditSlot(slotId);
    return;
  }

  if (action === "delete-slot") {
    handleDeleteSlot(slotId);
    return;
  }

  if (action === "edit-appointment") {
    openAppointmentModal(slotId);
  }
}

function handleTableChange(event) {
  if (event.target.dataset.role !== "status-select") {
    return;
  }

  const slotId = event.target.dataset.slotId;
  handleStatusChange(slotId, event.target.value);
}

function handleRangeActions(event) {
  if (event.target.id === "addRangeButton") {
    addRangeRow();
    return;
  }

  if (event.target.dataset.role !== "remove-range") {
    return;
  }

  if (elements.slotId.value) {
    return;
  }

  event.target.closest(".slot-range-row")?.remove();
  syncRangeButtons();
}

function bindEvents() {
  elements.loadDayButton.addEventListener("click", loadAvailability);
  elements.newSlotButton.addEventListener("click", resetSlotForm);
  elements.slotForm.addEventListener("submit", handleSlotSubmit);
  elements.slotForm.addEventListener("click", handleRangeActions);
  elements.appointmentForm.addEventListener("submit", handleAppointmentSubmit);
  elements.deleteAppointmentButton.addEventListener("click", handleDeleteAppointment);
  elements.slotsTableBody.addEventListener("click", handleTableClick);
  elements.slotsTableBody.addEventListener("change", handleTableChange);
}

function initializeDefaults() {
  const today = formatDateForInput(new Date());
  elements.doctorId.value = "1";
  elements.selectedDate.value = today;
  elements.slotDate.value = today;
  elements.slotClinicId.value = String(getSelectedClinicId());
  state.doctorId = 1;
  state.selectedDate = today;
  elements.currentDateLabel.textContent = `Agenda del ${formatLongDate(today)}`;
}

async function bootstrapApplication() {
  initializeDefaults();
  bindEvents();
  renderSummary();
  renderSlots();
  await loadAvailability();
}

bootstrapApplication();
