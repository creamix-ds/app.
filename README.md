# creamixds.com

Sitio estático (GitHub Pages). Los servicios y el formulario de contacto funcionan con Google Sheets + Apps Script.

- Configuración: en `index.html`, arriba del `<script>`, completar `API_URL` (URL de Apps Script que termina en `/exec`) y `PANEL_URL` (panel de AppSheet).
- Los servicios se cargan/editan desde AppSheet o directo en la hoja "CreamixDS — Base" (pestaña Servicios).
- Los mensajes del formulario quedan en la pestaña Mensajes y llegan por mail a creamixds@gmail.com.
