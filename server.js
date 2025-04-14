import express from "express";
import mysql from "mysql2/promise";
import { WebSocketServer } from "ws";
import http from "http";


const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// Configurar middleware para procesar JSON
app.use(express.json());

// Configuración de la conexión a la base de datos MySQL
const dbConfig = {
  host: 'localhost',
  user: 'querido',        // Cambia esto por tu usuario de MySQL
  password: 'querido',        // Cambia esto por tu contraseña de MySQL
  database: 'proyectoarduino'
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

let lastUID = "Esperando UID...";

wss.on("connection", (ws) => {
  console.log("ESP8266 conectado por WebSocket");

  ws.on("message", (message) => {
    console.log("UID recibido:", message.toString());
    lastUID = message.toString();
    broadcastUID();
  });
});

function broadcastUID() {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(lastUID);
    }
  });
}

// API para obtener la lista de usuarios
app.get("/api/usuarios/lista", async (req, res) => {
  try {
    console.log("Recibiendo solicitud de lista de usuarios");
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT id, nombre, uuid FROM usuarios');
    connection.release();
    console.log("Lista de usuarios obtenida:", rows);

    res.status(200).json({
      message: "Lista de usuarios obtenida correctamente",
      usuarios: rows
    });
  } catch (error) {
    console.error("Error al obtener la lista de usuarios:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

// API para buscar un usuario por UUID
app.get("/api/usuarios/buscar/:uuid", async (req, res) => {
  try {
    const { uuid } = req.params;

    console.log(`Buscando usuario con UUID: ${uuid}`);
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT id, nombre FROM usuarios WHERE uuid = ?', [uuid]);
    connection.release();

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.status(200).json({
      message: "Usuario encontrado",
      usuario: rows[0]
    });
  } catch (error) {
    console.error("Error al buscar usuario por UUID:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

// API para guardar datos en la tabla taller
app.post("/api/taller", async (req, res) => {
  try {
    const { usuario_id } = req.body;

    // Validar que se proporcione el usuario_id
    if (!usuario_id) {
      return res.status(400).json({ error: "El usuario_id es obligatorio" });
    }

    // Obtener la fecha y hora actuales
    const fecha = new Date().toLocaleDateString("en-CA"); // Formato YYYY-MM-DD
    const hora = new Date().toTimeString().split(" ")[0]; // Formato HH:MM:SS

    // Insertar datos en la tabla taller
    const connection = await pool.getConnection();
    const [result] = await connection.execute(
      "INSERT INTO taller (usuario_id, fecha, hora) VALUES (?, ?, ?)",
      [usuario_id, fecha, hora]
    );
    connection.release();

    res.status(201).json({
      message: "Datos guardados en la tabla taller correctamente",
      id: result.insertId,
      usuario_id,
      fecha,
      hora,
    });
  } catch (error) {
    console.error("Error al guardar datos en la tabla taller:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

// API para obtener la cantidad de datos de los últimos 10 días agrupados por fecha
app.get("/api/taller/ultimos-10-dias", async (req, res) => {
  try {
    // Consultar los datos de los últimos 10 días agrupados por fecha
    const connection = await pool.getConnection();
    const [rows] = await connection.query(`
      SELECT fecha, COUNT(*) AS cantidad
      FROM taller
      WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 10 DAY)
      GROUP BY fecha
      ORDER BY fecha DESC
    `);
    connection.release();

    res.status(200).json({
      message: "Datos de los últimos 10 días obtenidos correctamente",
      datos: rows,
    });
  } catch (error) {
    console.error("Error al obtener los datos de los últimos 10 días:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

// API para agregar usuarios
app.post("/api/usuarios", async (req, res) => {
  try {
    console.log("Recibiendo solicitud para agregar usuario");
    const { nombre, uuid } = req.body;
    
    // Validar datos
    if (!nombre) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }
    
    // Insertar usuario en la base de datos
    const connection = await pool.getConnection();
    const [result] = await connection.execute(
      'INSERT INTO usuarios (nombre, uuid) VALUES (?, ?)',
      [nombre, uuid || null]
    );
    connection.release();
    
    res.status(201).json({
      id: result.insertId,
      nombre,
      uuid,
      message: "Usuario agregado correctamente"
    });
  } catch (error) {
    console.error("Error al agregar usuario:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

// API para obtener los datos de la tabla taller con la fecha actual
app.get("/api/taller/hoy", async (req, res) => {
  try {
    // Obtener la fecha actual en formato YYYY-MM-DD
    // Obtener la fecha actual en la zona horaria local
    const fechaActual = new Date().toLocaleDateString("en-CA"); // Formato YYYY-MM-DD

    // Consultar los datos de la tabla taller con la fecha actual
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM taller WHERE fecha = ?",
      [fechaActual]
    );
    connection.release();

    res.status(200).json({
      message: "Datos de la tabla taller obtenidos correctamente",
      fecha: fechaActual,
      datos: rows,
    });
  } catch (error) {
    console.error("Error al obtener los datos de la tabla taller:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

// API para actualizar el UUID de un usuario existente
app.put("/api/usuarios/:id/uuid", async (req, res) => {
  try {
    const { id } = req.params;
    const { uuid } = req.body;
    
    if (!uuid) {
      return res.status(400).json({ error: "El UUID es obligatorio" });
    }
    
    const connection = await pool.getConnection();
    const [result] = await connection.execute(
      'UPDATE usuarios SET uuid = ? WHERE id = ?',
      [uuid, id]
    );
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    
    res.json({ message: "UUID actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar UUID:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

// API para obtener todos los usuarios
app.get("/api/usuarios", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM usuarios');
    connection.release();
    
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

app.use(express.static("dist")); // sirve el sitio de Astro

server.listen(3000, () => {
  console.log("Servidor WebSocket+Astro escuchando en http://localhost:3000");
});