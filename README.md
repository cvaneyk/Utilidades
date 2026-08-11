<img width="100%" height="100%" alt="tools carlosvaneyk online_" src="https://github.com/user-attachments/assets/7e916c3e-6df4-4589-a003-3ea1625c930b" />

# 🛠️ Utilidades — Utility Suite

Una suite de utilidades web todo-en-uno, con frontend en React y backend en FastAPI. Diseñada para ser desplegada fácilmente con Docker o EasyPanel.

---

## ✨ Herramientas incluidas

| Herramienta | Descripción |
|---|---|
| 🔗 **Acortador de URLs** | Acorta URLs usando la API de [is.gd](https://is.gd) o genera códigos locales. Registra clics y permite eliminar enlaces. |
| 📷 **Generador de QR** | Genera códigos QR personalizados (colores, tamaño) para URLs, texto, email, teléfono y WiFi. Opcionalmente acorta URLs con is.gd antes de codificar. |
| 🖼️ **Conversor de imágenes a WebP** | Convierte imágenes (JPG, PNG, etc.) a formato WebP en lotes de hasta 10 ficheros (máx. 5 MB por imagen). |
| 🔑 **Generador de contraseñas** | Crea contraseñas seguras configurando longitud, mayúsculas, minúsculas, números y símbolos. Incluye indicador de fortaleza. |
| 📝 **Convertidor Texto → HTML** | Transforma texto plano o Markdown a HTML válido con soporte para encabezados, negritas, cursivas, listas, código y enlaces. |
| 🔢 **Contador de palabras** | Analiza un texto y devuelve caracteres totales, caracteres sin espacios, palabras, frases, párrafos y tiempo estimado de lectura. |
| 🔐 **Codificador/Decodificador Base64** | Codifica o decodifica texto en Base64 de forma instantánea. |
| 🎬 **Conversor de Vídeo** | Convierte vídeos (MOV, MP4, AVI, MKV, WebM) a MP4 (H.264 + AAC) o WebM (VP9 + Opus) con ffmpeg. Incluye API síncrona/asíncrona protegida por API key, ideal para n8n y automatizaciones. |
| ✒️ **Editor SVG** | Edita código SVG con resaltado de sintaxis y vista previa en vivo. Sube un archivo .svg o pega el código, y descarga el resultado como SVG o PNG (escala configurable, fondo transparente). |

---

## 🏗️ Arquitectura

```
┌─────────────┐        ┌──────────────────┐        ┌───────────┐
│   Frontend  │ ──────▶│  Backend (API)   │ ──────▶│  MongoDB  │
│  React + TS │        │  FastAPI + Python │        │           │
│  Tailwind   │        │  Puerto 8001      │        │ Puerto    │
│  Puerto 3000│        └──────────────────┘        │  27017    │
└─────────────┘                                    └───────────┘
```

- **Frontend:** React (Create React App + CRACO), Tailwind CSS, shadcn/ui, servido con Nginx.
- **Backend:** FastAPI (Python), Motor (MongoDB async), Pillow, qrcode, httpx.
- **Base de datos:** MongoDB para almacenar shortlinks y registros de estado.

---

## 🚀 Despliegue rápido con Docker Compose

### Requisitos previos
- Docker y Docker Compose instalados.

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/cvaneyk/Utilidades.git
cd Utilidades

# 2. Configurar variables de entorno (editar si es necesario)
cp .env.example .env   # si existe, o crear manualmente

# 3. Levantar los servicios
docker-compose up -d --build
```

La app estará disponible en:
- Frontend: `http://localhost:3000`
- API: `http://localhost:8001/api`

### Variables de entorno necesarias

| Variable | Descripción | Ejemplo |
|---|---|---|
| `MONGO_URL` | Cadena de conexión a MongoDB | `mongodb://mongo:27017` |
| `DB_NAME` | Nombre de la base de datos | `utilidades` |
| `CORS_ORIGINS` | Orígenes permitidos para CORS | `http://localhost:3000` |
| `CONVERT_API_KEY` | (Opcional) API key para proteger el conversor de vídeo. Si no se define, el endpoint es público | `mi-clave-secreta` |
| `MAX_VIDEO_SIZE_MB` | (Opcional) Tamaño máximo de vídeo aceptado, por defecto 200 | `200` |
| `VIDEO_TIMEOUT_SECONDS` | (Opcional) Tiempo máximo de conversión, por defecto 600 | `600` |
| `VIDEO_JOB_TTL_SECONDS` | (Opcional) Tiempo de vida de los jobs asíncronos y sus archivos, por defecto 3600 | `3600` |

---

## ☁️ Despliegue en EasyPanel

Consulta la guía detallada en [`DEPLOY_EASYPANEL.md`](./DEPLOY_EASYPANEL.md).

---

## 📡 API — Endpoints principales

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/qr/generate` | Genera uno o varios códigos QR |
| `POST` | `/api/shortlinks/create` | Crea shortlinks (is.gd o local) |
| `GET` | `/api/shortlinks` | Lista todos los shortlinks |
| `DELETE` | `/api/shortlinks/{id}` | Elimina un shortlink |
| `POST` | `/api/images/convert-to-webp` | Convierte imágenes a WebP |
| `POST` | `/api/password/generate` | Genera una contraseña segura |
| `POST` | `/api/text-to-html` | Convierte texto/Markdown a HTML |
| `POST` | `/api/word-counter` | Cuenta palabras y caracteres |
| `POST` | `/api/base64` | Codifica / decodifica Base64 |
| `POST` | `/api/video/convert` | Conversión síncrona: la respuesta es el binario convertido. Solo para vídeos cortos (los proxies suelen cortar peticiones largas). Header `X-API-Key` si `CONVERT_API_KEY` está configurada. Campos form-data: `file` (binario), `quality` (`fast`/`balanced`/`quality`) y `target_format` (`mp4`/`webm`, por defecto `mp4`) |
| `POST` | `/api/video/convert/async` | Conversión asíncrona (recomendada): devuelve `{"job_id": "..."}` al instante. Mismos campos y auth que la síncrona |
| `GET` | `/api/video/jobs/{job_id}` | Estado del job: `processing`, `done` o `error` |
| `GET` | `/api/video/jobs/{job_id}/download` | Descarga el vídeo convertido cuando el job está `done`. Los jobs expiran a la hora (`VIDEO_JOB_TTL_SECONDS`) |
| `GET` | `/api/video/health` | Estado del conversor: ffmpeg disponible, si requiere API key y tamaño máximo |

### Ejemplo: convertir MOV a MP4 o WebM desde n8n o curl (flujo asíncrono)

```bash
# 1. Subir el vídeo → devuelve el job_id al instante
curl -X POST https://tu-dominio.com/api/video/convert/async \
  -H "X-API-Key: TU_API_KEY" \
  -F "file=@video.mov" -F "quality=balanced" -F "target_format=webm"
# → {"job_id": "abc123", "status": "processing"}

# 2. Consultar estado (repetir hasta "done")
curl -H "X-API-Key: TU_API_KEY" https://tu-dominio.com/api/video/jobs/abc123

# 3. Descargar el resultado
curl -H "X-API-Key: TU_API_KEY" \
  https://tu-dominio.com/api/video/jobs/abc123/download -o video.webm
```

En n8n: nodo **HTTP Request** (POST async, body `Form-Data` con campo binario `file`) → nodo **Wait** → **HTTP Request** GET del estado en bucle hasta `done` → **HTTP Request** GET de descarga con formato de respuesta `File`. Para vídeos cortos también puedes llamar directamente a `POST /api/video/convert` (síncrono).

---

## 🧰 Stack tecnológico

**Frontend**
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui
- Nginx (producción)

**Backend**
- Python 3.11+
- FastAPI
- Motor (MongoDB async driver)
- Pillow (procesamiento de imágenes)
- ffmpeg (conversión de vídeo)
- qrcode
- httpx

---

## 📄 Licencia

Copyright (C) 2026 cvaneyk
This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU General Public License for more details.
You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
