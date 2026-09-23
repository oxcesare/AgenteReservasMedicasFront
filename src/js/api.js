import { API_BASE_URL } from "./config.js";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    },
    ...options
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Error HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}

export function getDoctorAvailability(doctorId, fromIso, toIso, page = 1, pageSize = 50) {
  const query = new URLSearchParams();

  if (fromIso) {
    query.set("desde", fromIso);
  }

  if (toIso) {
    query.set("hasta", toIso);
  }

  query.set("pagina", String(page));
  query.set("tamano_pagina", String(pageSize));

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request(`/doctors/${doctorId}/availability${suffix}`);
}

export function createAvailability(doctorId, payload) {
  return request(`/doctors/${doctorId}/availability`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateAvailability(doctorId, slotId, payload) {
  return request(`/doctors/${doctorId}/availability/${slotId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteAvailability(doctorId, slotId) {
  return request(`/doctors/${doctorId}/availability/${slotId}`, {
    method: "DELETE"
  });
}

export function createAppointment(payload) {
  return request("/citas", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateAppointment(appointmentId, payload) {
  return request(`/citas/${appointmentId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteAppointment(appointmentId) {
  return request(`/citas/${appointmentId}`, {
    method: "DELETE"
  });
}
