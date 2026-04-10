# 🛠️ Utilidades — E1 Utility Suite

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
- qrcode
- httpx

---

## 📄 Licencia

Este proyecto no especifica licencia. Todos los derechos reservados al autor.
