const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear cuerpos en formato JSON
app.use(express.json());

// Datos de ejemplo en memoria
let items = [
  { id: 1, nombre: 'Primer elemento', descripcion: 'Elemento de prueba inicial' },
  { id: 2, nombre: 'Segundo elemento', descripcion: 'Otro elemento de ejemplo' }
];

// Ruta principal
app.get('/', (req, res) => {
  res.json({
    mensaje: '¡Bienvenido a tu API con Express!',
    rutasDisponibles: [
      'GET /api/items',
      'GET /api/items/:id',
      'POST /api/items'
    ]
  });
});

// Obtener todos los elementos
app.get('/api/items', (req, res) => {
  res.json({
    total: items.length,
    data: items
  });
});

// Obtener un elemento por ID
app.get('/api/items/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = items.find((el) => el.id === id);

  if (!item) {
    return res.status(404).json({ error: 'Elemento no encontrado' });
  }

  res.json(item);
});

// Crear un nuevo elemento
app.post('/api/items', (req, res) => {
  const { nombre, descripcion } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El campo "nombre" es obligatorio' });
  }

  const nuevoItem = {
    id: items.length > 0 ? items[items.length - 1].id + 1 : 1,
    nombre,
    descripcion: descripcion || ''
  };

  items.push(nuevoItem);
  res.status(201).json(nuevoItem);
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
