# ⚡ MotorSense - Dashboard de RPM, Temperatura y Consumo de Amperaje

Una aplicación web industrial construida con **Node.js** y **Express** especializada en el monitoreo y telemetría en tiempo real de **Velocidad de Rotación (RPM)**, **Temperatura Térmica (°C)** y **Consumo de Corriente/Amperaje (A)** en motores, bombas, compresores y turbinas.

---

## 🌟 Variables de Medición Monitoreadas

1. **Velocidad de Rotación (`RPM`)**:
   - Rango: 0 – 4000 RPM.
   - Umbrales: Advertencia > 3100 RPM / < 1000 RPM, Crítico > 3500 RPM / < 400 RPM.
2. **Temperatura de Operación y Devanado (`°C`)**:
   - Rango: 0 – 120 °C (Monitoreo de calentamiento y degradación de rodamientos/aislamiento).
   - Umbrales: Advertencia > 75 °C, Crítico > 90 °C.
3. **Consumo de Amperaje (`A`)**:
   - Rango: 0 – 50 A (Corriente absorbida bajo carga de trabajo).
   - Umbrales: Advertencia > 28 A, Crítico > 38 A.
4. **Potencia Activa Estimada (`kW`)**:
   - Estimación trifásica en tiempo real para 440V ($\sqrt{3} \times V \times I \times \cos(\phi)$).

---

## 🚀 Puesta en Marcha

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Iniciar la aplicación**:
   ```bash
   npm start
   ```

3. **Abrir en tu navegador**:
   Visita: [http://localhost:3000](http://localhost:3000)

---

## 🛠️ Equipos Monitoreados por Defecto

- **`MOT-01`**: Motor Principal M1 (Trifásico 25HP - Línea de Producción 1)
- **`MOT-02`**: Compresor Industrial C1 (Tornillo - Sala de Compresores)
- **`MOT-03`**: Bomba Centrífuga B1 (Circulación - Planta de Bombeo)
- **`MOT-04`**: Turbina Extractora T1 (Ventilación - Nave Norte)

---

## 📡 Endpoints de la API REST

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/mediciones` | Lista mediciones con filtros (`tipo`, `equipoId`, `estado`, `limit`) |
| `POST` | `/api/mediciones` | Registra una nueva lectura de RPM, Temperatura o Amperaje |
| `GET` | `/api/mediciones/stats` | Resumen de promedios, máximos/mínimos y estado de flota |
| `POST` | `/api/mediciones/simular-pulso` | Inyecta variaciones físicas sincronizadas (Carga $\rightarrow$ Amperaje $\rightarrow$ RPM $\rightarrow$ Temp) |
| `DELETE` | `/api/mediciones/:id` | Elimina una medición individual |
| `POST` | `/api/mediciones/reset` | Restaura el dataset de motores a valores iniciales |
| `GET` | `/api/mediciones/export/csv` | Descarga el histórico de mediciones en formato CSV |

---

## ☁️ Despliegue en Google Cloud Run

### Opción 1: Despliegue directo desde código fuente (Recomendado)
```bash
# Cloud Build compila la imagen usando el Dockerfile y la despliega en Cloud Run
gcloud run deploy motorsense-dashboard \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

### Opción 2: Compilación y despliegue manual con Artifact Registry
```bash
# 1. Construir y subir imagen a Artifact Registry o Container Registry
gcloud builds submit --tag gcr.io/TU_PROJECT_ID/motorsense-dashboard

# 2. Desplegar el contenedor en Cloud Run
gcloud run deploy motorsense-dashboard \
  --image gcr.io/TU_PROJECT_ID/motorsense-dashboard \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

