import express from "express";
import { WebSocketServer } from "ws";
import http from "http";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

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

app.use(express.static("dist")); // sirve el sitio de Astro

server.listen(3000, () => {
  console.log("Servidor WebSocket+Astro escuchando en http://localhost:3000");
});
