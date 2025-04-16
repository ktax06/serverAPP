// Importa la librería Express para crear y configurar el servidor web
import express from "express";
// Importa la librería mysql2/promise para trabajar con bases de datos MySQL de forma asíncrona (promesas)
import mysql from "mysql2/promise";
// Importa la clase WebSocketServer de la librería 'ws' para crear un servidor de WebSocket
import { WebSocketServer } from "ws";
// Importa la librería 'http' nativa de Node.js para crear un servidor HTTP básico
import http from "http";

// Crea una instancia de la aplicación Express
const app = express();
// Crea un servidor HTTP utilizando la aplicación Express como su manejador de peticiones
const server = http.createServer(app);
// Crea una instancia del servidor de WebSocket, asociándolo al servidor HTTP y definiendo la ruta '/ws' para las conexiones WebSocket
const wss = new WebSocketServer({ server, path: "/ws" });

// Configura el middleware de Express para que pueda analizar el cuerpo de las peticiones HTTP en formato JSON
app.use(express.json());

// Configuración de la conexión a la base de datos MySQL
const dbConfig = {
  host: 'localhost',    // Dirección del servidor de la base de datos MySQL
  user: 'querido',       // Nombre de usuario para la conexión a MySQL (¡Debes cambiar esto por tu usuario real!)
  password: 'querido',   // Contraseña para la conexión a MySQL (¡Debes cambiar esto por tu contraseña real!)
  database: 'proyectoarduino' // Nombre de la base de datos a la que se conectará
};

// Crea un pool de conexiones a la base de datos MySQL. Un pool permite reutilizar conexiones en lugar de crear una nueva por cada petición, mejorando la eficiencia.
const pool = mysql.createPool(dbConfig);

// Variable para almacenar el último UID recibido a través de WebSocket. Inicializada con un mensaje de espera.
let lastUID = "Esperando UID...";

// Define un evento que se ejecuta cuando un nuevo cliente (en este caso, el ESP8266) se conecta al servidor WebSocket
wss.on("connection", (ws) => {
  console.log("ESP8266 conectado por WebSocket");

  // Define un evento que se ejecuta cuando el cliente WebSocket conectado envía un mensaje
  ws.on("message", (message) => {
    // Imprime en la consola el UID recibido, convirtiendo el buffer del mensaje a una cadena de texto
    console.log("UID recibido:", message.toString());
    // Actualiza la variable lastUID con el UID recibido
    lastUID = message.toString();
    // Llama a la función broadcastUID para enviar el UID a todos los clientes WebSocket conectados
    broadcastUID();
  });
});

// Función para enviar el valor de lastUID a todos los clientes WebSocket conectados
function broadcastUID() {
  // Itera sobre todos los clientes conectados al servidor WebSocket
  wss.clients.forEach((client) => {
    // Verifica si el cliente está en estado 'abierto' (readyState === 1) para poder enviar mensajes
    if (client.readyState === 1) {
      // Envía el valor de lastUID al cliente como un mensaje de texto
      client.send(lastUID);
    }
  });
}

// Definición de una ruta GET en la API para obtener la lista de usuarios
app.get("/api/usuarios/lista", async (req, res) => {
  try {
    console.log("Recibiendo solicitud de lista de usuarios");
    // Obtiene una conexión del pool de conexiones MySQL
    const connection = await pool.getConnection();
    // Ejecuta una consulta SQL para seleccionar el id, nombre y uuid de todos los usuarios en la tabla 'usuarios'
    const [rows] = await connection.query('SELECT id, nombre, uuid FROM usuarios');
    // Libera la conexión de vuelta al pool para que pueda ser reutilizada
    connection.release();
    console.log("Lista de usuarios obtenida:", rows);

    // Envía una respuesta HTTP con estado 200 (OK) y un objeto JSON que contiene un mensaje y la lista de usuarios
    res.status(200).json({
      message: "Lista de usuarios obtenida correctamente",
      usuarios: rows
    });
  } catch (error) {
    // Si ocurre algún error durante la consulta o la conexión, lo imprime en la consola
    console.error("Error al obtener la lista de usuarios:", error);
    // Envía una respuesta HTTP con estado 500 (Internal Server Error) y un objeto JSON con un mensaje de error
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

// Definición de una ruta GET en la API para buscar un usuario por su UUID
app.get("/api/usuarios/buscar/:uuid", async (req, res) => {
  try {
    // Obtiene el valor del parámetro 'uuid' de la URL
    const { uuid } = req.params;

    console.log(`Buscando usuario con UUID: ${uuid}`);
    // Obtiene una conexión del pool de conexiones MySQL
    const connection = await pool.getConnection();
    // Ejecuta una consulta SQL para seleccionar el id y nombre del usuario cuya columna 'uuid' coincida con el parámetro
    const [rows] = await connection.query('SELECT id, nombre FROM usuarios WHERE uuid = ?', [uuid]);
    // Libera la conexión de vuelta al pool
    connection.release();

    // Si no se encuentra ningún usuario con el UUID proporcionado
    if (rows.length === 0) {
      // Envía una respuesta HTTP con estado 404 (Not Found) y un objeto JSON con un mensaje de error
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Si se encuentra un usuario, envía una respuesta HTTP con estado 200 (OK) y un objeto JSON con un mensaje y los datos del usuario
    res.status(200).json({
      message: "Usuario encontrado",
      usuario: rows[0]
    });
  } catch (error) {
    // Si ocurre algún error, lo imprime en la consola y envía una respuesta de error
    console.error("Error al buscar usuario por UUID:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

// Definición de una ruta POST en la API para guardar datos en la tabla 'taller'
app.post("/api/taller", async (req, res) => {
  try {
    // Obtiene el valor de 'usuario_id' del cuerpo de la petición JSON
    const { usuario_id } = req.body;

    // Valida que se haya proporcionado el 'usuario_id'
    if (!usuario_id) {
      // Si no se proporciona, envía una respuesta HTTP con estado 400 (Bad Request) y un mensaje de error
      return res.status(400).json({ error: "El usuario_id es obligatorio" });
    }

    // Obtiene la fecha actual en formato YYYY-MM-DD (utilizado en bases de datos)
    const fecha = new Date().toLocaleDateString("en-CA");
    // Obtiene la hora actual en formato HH:MM:SS
    const hora = new Date().toTimeString().split(" ")[0];

    // Obtiene una conexión del pool de conexiones MySQL
    const connection = await pool.getConnection();
    // Ejecuta una consulta SQL para insertar un nuevo registro en la tabla 'taller' con el usuario_id, fecha y hora actuales
    const [result] = await connection.execute(
      "INSERT INTO taller (usuario_id, fecha, hora) VALUES (?, ?, ?)",
      [usuario_id, fecha, hora]
    );
    // Libera la conexión de vuelta al pool
    connection.release();

    // Envía una respuesta HTTP con estado 201 (Created) y un objeto JSON con un mensaje de éxito y los datos insertados
    res.status(201).json({
      message: "Datos guardados en la tabla taller correctamente",
      id: result.insertId, // ID del registro insertado
      usuario_id,
      fecha,
      hora,
    });
  } catch (error) {
    // Si ocurre algún error, lo imprime en la consola y envía una respuesta de error
    console.error("Error al guardar datos en la tabla taller:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

// Definición de una ruta GET en la API para obtener la cantidad de datos de los últimos 10 días agrupados por fecha
app.get("/api/taller/ultimos-10-dias", async (req, res) => {
  try {
    // Ejecuta una consulta SQL para seleccionar la fecha y contar la cantidad de registros por fecha de los últimos 10 días, agrupados por fecha y ordenados descendentemente
    const connection = await pool.getConnection();
    const [rows] = await connection.query(`
      SELECT fecha, COUNT(*) AS cantidad
      FROM taller
      WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 10 DAY)
      GROUP BY fecha
      ORDER BY fecha DESC
    `);
    connection.release();

    // Envía una respuesta HTTP con estado 200 (OK) y un objeto JSON con un mensaje de éxito y los datos obtenidos
    res.status(200).json({
      message: "Datos de los últimos 10 días obtenidos correctamente",
      datos: rows,
    });
  } catch (error) {
    // Si ocurre algún error, lo imprime en la consola y envía una respuesta de error
    console.error("Error al obtener los datos de los últimos 10 días:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

// Definición de una ruta POST en la API para agregar nuevos usuarios
app.post("/api/usuarios", async (req, res) => {
  try {
    console.log("Recibiendo solicitud para agregar usuario");
    // Obtiene los valores de 'nombre' y 'uuid' del cuerpo de la petición JSON
    const { nombre, uuid } = req.body;

    // Valida que se haya proporcionado el 'nombre'
    if (!nombre) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }

    // Ejecuta una consulta SQL para insertar un nuevo usuario en la tabla 'usuarios'
    const connection = await pool.getConnection();
    const [result] = await connection.execute(
      'INSERT INTO usuarios (nombre, uuid) VALUES (?, ?)',
      [nombre, uuid || null] // Si no se proporciona UUID, se inserta NULL
    );
    connection.release();

    // Envía una respuesta HTTP con estado 201 (Created) y un objeto JSON con los datos del usuario creado y un mensaje de éxito
    res.status(201).json({
      id: result.insertId, // ID del usuario insertado
      nombre,
      uuid,
      message: "Usuario agregado correctamente"
    });
  } catch (error) {
    // Si ocurre algún error, lo imprime en la consola y envía una respuesta de error
    console.error("Error al agregar usuario:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

// Definición de una ruta GET en la API para obtener los datos de la tabla 'taller' correspondientes a la fecha actual
app.get("/api/taller/hoy", async (req, res) => {
  try {
    // Obtiene la fecha actual en formato YYYY-MM-DD
    const fechaActual = new Date().toLocaleDateString("en-CA");

    // Ejecuta una consulta SQL para seleccionar todos los registros de la tabla 'taller' cuya fecha coincida con la fecha actual
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM taller WHERE fecha = ?",
      [fechaActual]
    );
    connection.release();

    // Envía una respuesta HTTP con estado 200 (OK) y un objeto JSON con un mensaje de éxito, la fecha actual y los datos obtenidos
    res.status(200).json({
      message: "Datos de la tabla taller obtenidos correctamente",
      fecha: fechaActual,
      datos: rows,
    });
  } catch (error) {
    // Si ocurre algún error, lo imprime en la consola y envía una respuesta de error
    console.error("Error al obtener los datos de la tabla taller:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

// Definición de una ruta PUT en la API para actualizar el UUID de un usuario existente
app.put("/api/usuarios/:id/uuid", async (req, res) => {
  try {
    // Obtiene el ID del usuario de los parámetros de la URL
    const { id } = req.params;
    // Obtiene el nuevo UUID del cuerpo de la petición JSON
    const { uuid } = req.body;

    // Valida que se haya proporcionado el UUID
    if (!uuid) {
      return res.status(400).json({ error: "El UUID es obligatorio" });
    }

    // Ejecuta una consulta SQL para actualizar el UUID del usuario con el ID especificado
    const connection = await pool.getConnection();
    const [result] = await connection.execute(
      'UPDATE usuarios SET uuid = ? WHERE id = ?',
      [uuid, id]
    );
    connection.release();

    // Si no se encontró ningún usuario con el ID proporcionado
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Si la actualización fue exitosa, envía una respuesta JSON con un mensaje
    res.json({ message: "UUID actualizado correctamente" });
  } catch (error) {
    // Si ocurre algún error, lo imprime en la consola y envía una respuesta de error
    console.error("Error al actualizar UUID:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

// Definición de una ruta GET en la API para obtener todos los usuarios
app.get("/api/usuarios", async (req, res) => {
  try {
    // Obtiene una conexión del pool de conexiones MySQL
    const connection = await pool.getConnection();
    // Ejecuta una consulta SQL para seleccionar todos los registros de la tabla 'usuarios'
    const [rows] = await connection.query('SELECT * FROM usuarios');
    // Libera la conexión de vuelta al pool
    connection.release();

    // Envía la lista de usuarios como respuesta JSON
    res.json(rows);
  } catch (error) {
    // Si ocurre algún error, lo imprime en la consola y envía una respuesta de error
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

// Sirve los archivos estáticos de la aplicación Astro que se encuentran en la carpeta 'dist'
app.use(express.static("dist"));

// Inicia el servidor HTTP para que escuche las conexiones en el puerto 3000
server.listen(3000, () => {
  console.log("Servidor WebSocket+Astro escuchando en http://localhost:3000");
});