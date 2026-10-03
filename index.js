const express = require('express');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON y servir archivos estáticos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Definición de umbrales para RPM, Temperatura y Consumo de Amperaje
const UMBRALES = {
  rpm: {
    nombre: 'Velocidad de Rotación',
    unidad: 'RPM',
    rangoMin: 0,
    rangoMax: 4000,
    advMin: 1000,
    advMax: 3100,
    critMin: 400,
    critMax: 3500
  },
  temperatura: {
    nombre: 'Temperatura de Operación',
    unidad: '°C',
    rangoMin: 0,
    rangoMax: 120,
    advMin: 20,
    advMax: 75,
    critMin: 10,
    critMax: 90
  },
  amperaje: {
    nombre: 'Consumo de Corriente',
    unidad: 'A',
    rangoMin: 0,
    rangoMax: 50,
    advMin: 2,
    advMax: 28,
    critMin: 0.5,
    critMax: 38
  }
};

function calcularEstado(tipo, valor) {
  const umbral = UMBRALES[tipo];
  if (!umbral) return 'normal';

  if (valor >= umbral.critMax || (umbral.critMin !== undefined && valor <= umbral.critMin)) {
    return 'critico';
  }
  if (valor >= umbral.advMax || (umbral.advMin !== undefined && valor <= umbral.advMin)) {
    return 'advertencia';
  }
  return 'normal';
}

// Sensores de Máquinas y Motores Industriales
const MOTORES_BASE = [
  { id: 'MOT-01', nombre: 'Motor Principal M1 (Trifásico 25HP)', ubicacion: 'Línea de Producción 1' },
  { id: 'MOT-02', nombre: 'Compresor Industrial C1 (Tornillo)', ubicacion: 'Sala de Compresores' },
  { id: 'MOT-03', nombre: 'Bomba Centrífuga B1 (Circulación)', ubicacion: 'Planta de Bombeo Hidráulico' },
  { id: 'MOT-04', nombre: 'Turbina Extractora T1 (Ventilación)', ubicacion: 'Nave Industrial Norte' }
];

let mediciones = [];
let nextId = 1;

// Inicializar mediciones con física realista de motores industriales
function inicializarMediciones() {
  mediciones = [];
  nextId = 1;
  const ahora = Date.now();
  const puntosHistoricos = 30; // 30 lecturas por motor y métrica

  for (let i = puntosHistoricos; i >= 0; i--) {
    const timestamp = new Date(ahora - i * 2 * 60 * 1000).toISOString();

    MOTORES_BASE.forEach((motor, mIdx) => {
      // Estado dinámico del motor con relación física (Carga -> Amperaje -> RPM -> Temperatura)
      const fase = (i / 4) + mIdx;
      const factorCarga = 0.5 + 0.35 * Math.sin(fase) + (Math.random() - 0.5) * 0.1;

      // 1. RPM: Nominal ~2400 a 2800 con ligera caída bajo carga alta
      const rpmBase = 2650 - factorCarga * 150 + (Math.random() - 0.5) * 40;
      const rpmVal = Math.round(rpmBase);
      const rpmEstado = calcularEstado('rpm', rpmVal);

      mediciones.push({
        id: nextId++,
        sensorId: `${motor.id}-RPM`,
        equipoId: motor.id,
        nombre: `${motor.nombre} - Tacómetro`,
        tipo: 'rpm',
        valor: rpmVal,
        unidad: 'RPM',
        ubicacion: motor.ubicacion,
        estado: rpmEstado,
        timestamp
      });

      // 2. Amperaje: Proporcional a la carga del motor (nominal 12A a 26A)
      const ampBase = 8 + factorCarga * 18 + (Math.random() - 0.5) * 1.5;
      const ampVal = Number(Math.max(1, ampBase).toFixed(2));
      const ampEstado = calcularEstado('amperaje', ampVal);

      mediciones.push({
        id: nextId++,
        sensorId: `${motor.id}-AMP`,
        equipoId: motor.id,
        nombre: `${motor.nombre} - Sensor Corriente`,
        tipo: 'amperaje',
        valor: ampVal,
        unidad: 'A',
        ubicacion: motor.ubicacion,
        estado: ampEstado,
        timestamp
      });

      // 3. Temperatura: Inercia térmica basada en el amperaje acumulado
      const tempBase = 42 + factorCarga * 24 + Math.sin(i / 8) * 6 + (Math.random() - 0.5) * 1.2;
      const tempVal = Number(tempBase.toFixed(1));
      const tempEstado = calcularEstado('temperatura', tempVal);

      mediciones.push({
        id: nextId++,
        sensorId: `${motor.id}-TEMP`,
        equipoId: motor.id,
        nombre: `${motor.nombre} - Termopar Devanado`,
        tipo: 'temperatura',
        valor: tempVal,
        unidad: '°C',
        ubicacion: motor.ubicacion,
        estado: tempEstado,
        timestamp
      });
    });
  }
}

// Inicializar almacén en memoria
inicializarMediciones();

// --- RUTAS DE LA API ---

// 1. Obtener mediciones con filtros
app.get('/api/mediciones', (req, res) => {
  let { tipo, estado, equipoId, sensorId, limit = 100 } = req.query;
  let filtradas = [...mediciones];

  if (tipo && tipo !== 'todos') {
    filtradas = filtradas.filter((m) => m.tipo.toLowerCase() === tipo.toLowerCase());
  }

  if (estado && estado !== 'todos') {
    filtradas = filtradas.filter((m) => m.estado.toLowerCase() === estado.toLowerCase());
  }

  if (equipoId && equipoId !== 'todos') {
    filtradas = filtradas.filter((m) => m.equipoId === equipoId);
  }

  if (sensorId) {
    filtradas = filtradas.filter((m) => m.sensorId === sensorId);
  }

  // Ordenar cronológicamente descendente
  filtradas.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const total = filtradas.length;
  const limiteNum = Math.min(parseInt(limit, 10) || 100, 500);
  const data = filtradas.slice(0, limiteNum);

  res.json({
    total,
    retornadas: data.length,
    data
  });
});

// 2. Estadísticas de RPM, Temperatura y Amperaje
app.get('/api/mediciones/stats', (req, res) => {
  const statsPorTipo = {};
  const conteoEstado = { normal: 0, advertencia: 0, critico: 0 };

  // Inicializar tipos monitoreados
  Object.keys(UMBRALES).forEach((tipo) => {
    statsPorTipo[tipo] = {
      tipo,
      nombre: UMBRALES[tipo].nombre,
      unidad: UMBRALES[tipo].unidad,
      conteo: 0,
      min: Infinity,
      max: -Infinity,
      suma: 0,
      promedio: 0,
      ultima: null
    };
  });

  mediciones.forEach((m) => {
    conteoEstado[m.estado] = (conteoEstado[m.estado] || 0) + 1;

    if (!statsPorTipo[m.tipo]) {
      statsPorTipo[m.tipo] = {
        tipo: m.tipo,
        nombre: m.tipo.toUpperCase(),
        unidad: m.unidad || '',
        conteo: 0,
        min: Infinity,
        max: -Infinity,
        suma: 0,
        promedio: 0,
        ultima: null
      };
    }

    const s = statsPorTipo[m.tipo];
    s.conteo++;
    s.suma += m.valor;
    if (m.valor < s.min) s.min = m.valor;
    if (m.valor > s.max) s.max = m.valor;

    if (!s.ultima || new Date(m.timestamp) > new Date(s.ultima.timestamp)) {
      s.ultima = m;
    }
  });

  // Calcular promedios
  Object.values(statsPorTipo).forEach((s) => {
    if (s.conteo > 0) {
      s.promedio = s.tipo === 'rpm' 
        ? Math.round(s.suma / s.conteo) 
        : Number((s.suma / s.conteo).toFixed(2));
      s.min = s.tipo === 'rpm' ? Math.round(s.min) : Number(s.min.toFixed(2));
      s.max = s.tipo === 'rpm' ? Math.round(s.max) : Number(s.max.toFixed(2));
    } else {
      s.min = 0;
      s.max = 0;
      s.promedio = 0;
    }
  });

  // Estadísticas agrupadas por motor
  const statsMotores = MOTORES_BASE.map((motor) => {
    const medsMotor = mediciones.filter((m) => m.equipoId === motor.id);
    const ultimaRpm = medsMotor.filter((m) => m.tipo === 'rpm').slice(-1)[0];
    const ultimaTemp = medsMotor.filter((m) => m.tipo === 'temperatura').slice(-1)[0];
    const ultimaAmp = medsMotor.filter((m) => m.tipo === 'amperaje').slice(-1)[0];

    return {
      id: motor.id,
      nombre: motor.nombre,
      ubicacion: motor.ubicacion,
      rpm: ultimaRpm ? ultimaRpm.valor : 0,
      temperatura: ultimaTemp ? ultimaTemp.valor : 0,
      amperaje: ultimaAmp ? ultimaAmp.valor : 0,
      estadoGeneral: (ultimaRpm?.estado === 'critico' || ultimaTemp?.estado === 'critico' || ultimaAmp?.estado === 'critico')
        ? 'critico'
        : (ultimaRpm?.estado === 'advertencia' || ultimaTemp?.estado === 'advertencia' || ultimaAmp?.estado === 'advertencia')
          ? 'advertencia'
          : 'normal'
    };
  });

  res.json({
    totalMediciones: mediciones.length,
    conteoEstado,
    statsPorTipo,
    umbrales: UMBRALES,
    motores: statsMotores
  });
});

// 3. Crear nueva medición manual
app.post('/api/mediciones', (req, res) => {
  const { equipoId, sensorId, nombre, tipo, valor, unidad, ubicacion, estado } = req.body;

  if (!tipo || valor === undefined || isNaN(Number(valor))) {
    return res.status(400).json({
      error: 'Campos obligatorios inválidos. Se requiere "tipo" (rpm, temperatura o amperaje) y un "valor" numérico.'
    });
  }

  const tipoLimpio = tipo.toLowerCase().trim();
  const valNum = tipoLimpio === 'rpm' ? Math.round(Number(valor)) : Number(Number(valor).toFixed(2));
  const estadoCalculado = estado || calcularEstado(tipoLimpio, valNum);
  const motorEncontrado = MOTORES_BASE.find((m) => m.id === equipoId);

  const nuevaMedicion = {
    id: nextId++,
    sensorId: sensorId || (motorEncontrado ? `${motorEncontrado.id}-${tipoLimpio.toUpperCase()}` : `SENS-CUSTOM-${Date.now().toString().slice(-4)}`),
    equipoId: equipoId || (motorEncontrado ? motorEncontrado.id : 'CUSTOM'),
    nombre: nombre || (motorEncontrado ? `${motorEncontrado.nombre} - ${tipoLimpio.toUpperCase()}` : `Sensor ${tipoLimpio.toUpperCase()}`),
    tipo: tipoLimpio,
    valor: valNum,
    unidad: unidad || (UMBRALES[tipoLimpio] ? UMBRALES[tipoLimpio].unidad : ''),
    ubicacion: ubicacion || (motorEncontrado ? motorEncontrado.ubicacion : 'Planta General'),
    estado: estadoCalculado,
    timestamp: new Date().toISOString()
  };

  mediciones.push(nuevaMedicion);

  if (mediciones.length > 2500) {
    mediciones = mediciones.slice(-1800);
  }

  res.status(201).json({
    mensaje: 'Medición de motor registrada con éxito',
    data: nuevaMedicion
  });
});

// 4. Simulador de pulso de telemetría para motores (RPM, Temperatura, Amperaje)
app.post('/api/mediciones/simular-pulso', (req, res) => {
  const nuevasLecturas = [];
  const ahora = new Date().toISOString();

  MOTORES_BASE.forEach((motor) => {
    // Buscar valores previos
    const prevRpm = mediciones.filter((m) => m.sensorId === `${motor.id}-RPM`).slice(-1)[0]?.valor || 2600;
    const prevAmp = mediciones.filter((m) => m.sensorId === `${motor.id}-AMP`).slice(-1)[0]?.valor || 16.5;
    const prevTemp = mediciones.filter((m) => m.sensorId === `${motor.id}-TEMP`).slice(-1)[0]?.valor || 52;

    // Probabilidad de sobrecarga aleatoria o pico transitorio de arranque
    const sobrecarga = Math.random() < 0.10;
    const variacionCarga = sobrecarga ? 1.4 : (1 + (Math.random() - 0.49) * 0.12);

    // Amperaje varía primero
    let nuevoAmp = Number((prevAmp * (0.85 + 0.15 * variacionCarga) + (Math.random() - 0.5) * 1.2).toFixed(2));
    nuevoAmp = Math.max(1.5, Math.min(48, nuevoAmp));

    // RPM responde inversamente a la carga pesada o fluctúa naturalmente
    let deltaRpm = (nuevoAmp > 28 ? -80 : 25) + (Math.random() - 0.5) * 60;
    let nuevoRpm = Math.round(Math.max(300, Math.min(3800, prevRpm + deltaRpm)));

    // Temperatura responde a amperaje (inercia térmica)
    let deltaTemp = (nuevoAmp > 24 ? 0.8 : -0.3) + (Math.random() - 0.48) * 0.5;
    let nuevoTemp = Number(Math.max(18, Math.min(115, prevTemp + deltaTemp)).toFixed(1));

    // Crear lecturas
    const lecturas = [
      {
        sensorId: `${motor.id}-RPM`,
        equipoId: motor.id,
        nombre: `${motor.nombre} - Tacómetro`,
        tipo: 'rpm',
        valor: nuevoRpm,
        unidad: 'RPM'
      },
      {
        sensorId: `${motor.id}-AMP`,
        equipoId: motor.id,
        nombre: `${motor.nombre} - Sensor Corriente`,
        tipo: 'amperaje',
        valor: nuevoAmp,
        unidad: 'A'
      },
      {
        sensorId: `${motor.id}-TEMP`,
        equipoId: motor.id,
        nombre: `${motor.nombre} - Termopar Devanado`,
        tipo: 'temperatura',
        valor: nuevoTemp,
        unidad: '°C'
      }
    ];

    lecturas.forEach((item) => {
      const estado = calcularEstado(item.tipo, item.valor);
      const m = {
        id: nextId++,
        sensorId: item.sensorId,
        equipoId: item.equipoId,
        nombre: item.nombre,
        tipo: item.tipo,
        valor: item.valor,
        unidad: item.unidad,
        ubicacion: motor.ubicacion,
        estado,
        timestamp: ahora
      };
      mediciones.push(m);
      nuevasLecturas.push(m);
    });
  });

  res.json({
    mensaje: 'Pulso de telemetría de motores generado correctamente',
    lecturasGeneradas: nuevasLecturas.length,
    data: nuevasLecturas
  });
});

// 5. Telemetría del Servidor Host / Nodo Nube
app.get('/api/mediciones/servidor', (req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPct = Number(((usedMem / totalMem) * 100).toFixed(1));

  const cpus = os.cpus();
  const numCpus = cpus.length;
  const uptime = os.uptime();

  res.json({
    hostname: os.hostname(),
    plataforma: `${os.type()} ${os.release()} (${os.arch()})`,
    nodeVersion: process.version,
    uptimeSegundos: uptime,
    uptimeFormato: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
    cpu: {
      modelo: cpus[0] ? cpus[0].model.trim() : 'Genérica',
      nucleos: numCpus
    },
    memoria: {
      totalMB: Math.round(totalMem / (1024 * 1024)),
      usadoMB: Math.round(usedMem / (1024 * 1024)),
      libreMB: Math.round(freeMem / (1024 * 1024)),
      porcentajeUso: memPct
    }
  });
});

// 6. Eliminar medición por ID
app.delete('/api/mediciones/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = mediciones.findIndex((m) => m.id === id);

  if (index === -1) {
    return res.status(404).json({ error: `Medición #${id} no encontrada` });
  }

  const eliminada = mediciones.splice(index, 1)[0];
  res.json({ mensaje: 'Medición eliminada exitosamente', data: eliminada });
});

// 7. Resetear histórico a dataset predeterminado
app.post('/api/mediciones/reset', (req, res) => {
  inicializarMediciones();
  res.json({
    mensaje: 'Dataset de motores reiniciado exitosamente',
    total: mediciones.length
  });
});

// 8. Exportar mediciones en formato CSV
app.get('/api/mediciones/export/csv', (req, res) => {
  let csv = 'ID,EquipoID,SensorID,Nombre,Tipo,Valor,Unidad,Ubicacion,Estado,FechaHora\n';
  const ordenadas = [...mediciones].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  ordenadas.forEach((m) => {
    csv += `"${m.id}","${m.equipoId || ''}","${m.sensorId}","${m.nombre.replace(/"/g, '""')}","${m.tipo}",${m.valor},"${m.unidad}","${m.ubicacion.replace(/"/g, '""')}","${m.estado}","${m.timestamp}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="mediciones_rpm_temp_amperaje.csv"');
  res.status(200).send(csv);
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Cuerpo de solicitud JSON inválido o malformado' });
  }
  console.error('Error interno del servidor:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor vinculando a 0.0.0.0 (requerido para contenedores Cloud Run)
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`⚡ Dashboard de Motores (RPM, Temperatura, Amperaje)`);
  console.log(`🚀 Ejecutándose en puerto ${PORT}`);
  console.log(`📡 API REST disponible en /api/mediciones`);
  console.log(`=======================================================`);
});

// Manejo elegante de señales para Google Cloud Run (SIGTERM / SIGINT)
process.on('SIGTERM', () => {
  console.log('⚠️ Señal SIGTERM recibida. Cerrando conexiones de forma ordenada...');
  server.close(() => {
    console.log('Servidor finalizado limpiamente.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('⚠️ Señal SIGINT recibida.');
  server.close(() => {
    process.exit(0);
  });
});
