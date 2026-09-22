# Calendario de Reservas Medicas

Frontend base en HTML, CSS y JavaScript para gestionar disponibilidad y citas usando una API de FastAPI.

## Estructura

- `index.html`: layout principal y modales.
- `src/styles/main.css`: estilos del calendario y layout centrado.
- `src/js/config.js`: configuracion general y enumeraciones.
- `src/js/api.js`: cliente HTTP para FastAPI.
- `src/js/utils.js`: formato, mapeos y normalizacion de slots.
- `src/js/app.js`: logica UI, eventos y renderizado.

## API usada

- `GET /api/doctors/:id/availability?desde=...&hasta=...`
- `POST /api/doctors/:id/availability`
- `PUT /api/doctors/:id/availability/:slotId`
- `DELETE /api/doctors/:id/availability/:slotId`
- `POST /api/citas`
- `PUT /api/citas/:citaId`
- `DELETE /api/citas/:citaId`

## Instalacion

1. Instala dependencias con `npm install`.
2. Levanta cualquier servidor estatico desde la raiz del proyecto.
3. Asegura que FastAPI este disponible en `http://localhost:8000`.

## Nota importante

La interfaz intenta actualizar el estatus de la cita enviando `estado_actual` en `PUT /api/citas/:id`. Si tu endpoint actual no acepta ese campo, la UI mostrara un mensaje para que ajustes el contrato del backend.