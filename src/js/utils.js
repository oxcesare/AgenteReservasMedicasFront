import { APPOINTMENT_API_STATUS, APPOINTMENT_UI_STATUS } from "./config.js";

export function pad(value) {
  return String(value).padStart(2, "0");
}

export function formatDateForInput(date) {
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-");
}

export function buildDayRange(dateValue) {
  return {
    from: `${dateValue}T00:00:00`,
    to: `${dateValue}T23:59:59`
  };
}

export function combineDateAndTime(dateValue, timeValue) {
  return `${dateValue}T${timeValue}:00`;
}

export function formatTimeRange(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${formatHour(start)} - ${formatHour(end)}`;
}

export function formatLongDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

export function formatHour(date) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function toTimeInputValue(isoValue) {
  const date = new Date(isoValue);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function availabilityBadgeClass(state) {
  switch (state) {
    case "RESERVADO":
      return "text-bg-warning-subtle text-warning-emphasis";
    case "BLOQUEADO":
      return "text-bg-secondary-subtle text-secondary-emphasis";
    default:
      return "text-bg-success-subtle text-success-emphasis";
  }
}

export function apiStatusToUi(apiStatus) {
  switch (apiStatus) {
    case APPOINTMENT_API_STATUS.CONFIRMADA:
      return APPOINTMENT_UI_STATUS.CONFIRMED;
    case APPOINTMENT_API_STATUS.CANCELADA:
      return APPOINTMENT_UI_STATUS.CANCELLED;
    case APPOINTMENT_API_STATUS.COMPLETADA:
      return APPOINTMENT_UI_STATUS.COMPLETED;
    case APPOINTMENT_API_STATUS.NO_ASISTIO:
      return APPOINTMENT_UI_STATUS.CANCELLED;
    case APPOINTMENT_API_STATUS.PROGRAMADA:
    default:
      return APPOINTMENT_UI_STATUS.PENDING;
  }
}

export function uiStatusToApi(uiStatus) {
  switch (uiStatus) {
    case APPOINTMENT_UI_STATUS.CONFIRMED:
      return APPOINTMENT_API_STATUS.CONFIRMADA;
    case APPOINTMENT_UI_STATUS.CANCELLED:
      return APPOINTMENT_API_STATUS.CANCELADA;
    case APPOINTMENT_UI_STATUS.COMPLETED:
      return APPOINTMENT_API_STATUS.COMPLETADA;
    case APPOINTMENT_UI_STATUS.PENDING:
    default:
      return APPOINTMENT_API_STATUS.PROGRAMADA;
  }
}

export function normalizeSlot(rawSlot) {
  const appointment = rawSlot.cita ?? rawSlot.appointment ?? null;
  const patient = appointment?.paciente ?? rawSlot.paciente ?? null;
  const appointmentId = appointment?.id_cita ?? rawSlot.id_cita ?? rawSlot.appointment_id ?? null;
  const appointmentStatus = appointment?.estado_actual ?? rawSlot.estado_actual ?? rawSlot.appointment_status ?? null;
  const startDateTime = rawSlot.fecha_hora_inicio ?? rawSlot.start ?? combineDateAndTime(rawSlot.fecha, rawSlot.hora_inicio);
  const endDateTime = rawSlot.fecha_hora_fin ?? rawSlot.end ?? combineDateAndTime(rawSlot.fecha, rawSlot.hora_fin);

  return {
    id: rawSlot.id_slot ?? rawSlot.id ?? rawSlot.slot_id,
    clinicId: rawSlot.id_clinica ?? rawSlot.clinic_id ?? null,
    availabilityState: rawSlot.estado ?? rawSlot.slot_estado ?? rawSlot.availability_status ?? "DISPONIBLE",
    startDateTime,
    endDateTime,
    appointmentId,
    appointmentStatusUi: apiStatusToUi(appointmentStatus),
    appointmentStatusApi: appointmentStatus,
    patient,
    notes: appointment?.notas_paciente ?? rawSlot.notas_paciente ?? ""
  };
}
