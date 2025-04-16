#include <ESP8266WiFi.h>      // Librería para la conexión WiFi en ESP8266
#include <WebSocketsClient.h> // Librería para la comunicación WebSocket
#include <SPI.h>              // Librería para la comunicación Serial Peripheral Interface (SPI)
#include <MFRC522.h>          // Librería para el lector RFID MFRC522

// Sección de configuración de la red WiFi
const char* ssid = "Casa1";       // Nombre de la red WiFi a la que se conectará el ESP8266
const char* password = "argentina"; // Contraseña de la red WiFi

// Sección de configuración del WebSocket
WebSocketsClient webSocket;          // Objeto para manejar la conexión WebSocket
const char* serverAddress = "192.168.1.16"; // Dirección IP del servidor WebSocket (donde corre Astro en tu PC)
const uint16_t serverPort = 3000;          // Puerto en el que el servidor WebSocket está escuchando
const char* serverPath = "/ws";            // Ruta del WebSocket en el servidor

// Sección de configuración del lector RFID MFRC522
#define RST_PIN 2  // Pin de Reset para el módulo MFRC522 conectado al pin digital 2 del ESP8266
#define SS_PIN 15 // Pin de Slave Select (también conocido como SDA) para el módulo MFRC522 conectado al pin digital 15 del ESP8266
MFRC522 mfrc522(SS_PIN, RST_PIN); // Crea una instancia de la clase MFRC522

void setup() {
  Serial.begin(115200); // Inicializa la comunicación serial a una velocidad de 115200 baudios

  // Conexión a la red WiFi
  WiFi.begin(ssid, password);
  Serial.println("Connecting to WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected! IP: " + WiFi.localIP().toString()); // Imprime la dirección IP asignada al ESP8266

  // Inicialización del bus SPI
  SPI.begin();
  // Inicialización del módulo MFRC522
  mfrc522.PCD_Init();

  // Configuración del cliente WebSocket
  webSocket.begin(serverAddress, serverPort, serverPath); // Inicia la conexión al servidor WebSocket
  webSocket.onEvent(webSocketEvent);                     // Asigna la función 'webSocketEvent' para manejar los eventos del WebSocket
  webSocket.setReconnectInterval(5000);                 // Establece el intervalo de reintento de conexión en 5 segundos

  Serial.println("Scan PICC to send UID to WebSocket server..."); // Mensaje para el usuario
}

void loop() {
  webSocket.loop(); // Mantiene la conexión WebSocket activa y verifica si hay eventos pendientes

  // Verifica si hay una nueva tarjeta presente en el campo del lector RFID
  if (!mfrc522.PICC_IsNewCardPresent()) return;

  // Selecciona una de las tarjetas presentes
  if (!mfrc522.PICC_ReadCardSerial()) return;

  // Lectura del UID de la tarjeta
  String uidString = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    // Formatea cada byte del UID como hexadecimal con un cero inicial si es necesario
    uidString += (mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
    uidString += String(mfrc522.uid.uidByte[i], HEX);
    // Agrega un separador de dos puntos entre los bytes del UID (excepto para el último byte)
    if (i < mfrc522.uid.size - 1) uidString += ":";
  }

  Serial.println("Sending UID: " + uidString); // Imprime el UID leído en el puerto serial
  webSocket.sendTXT(uidString);              // Envía el UID como texto al servidor WebSocket

  // Detiene la comunicación con la tarjeta actual
  mfrc522.PICC_HaltA();
  // Detiene el cifrado en el PCD
  mfrc522.PCD_StopCrypto1();

  delay(1000); // Pequeña pausa antes de la siguiente lectura
}

// Función que se llama cuando ocurren eventos en la conexión WebSocket
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket disconnected"); // Se ejecuta cuando la conexión WebSocket se desconecta
      break;
    case WStype_CONNECTED:
      Serial.println("WebSocket connected");    // Se ejecuta cuando la conexión WebSocket se establece
      break;
    case WStype_TEXT:
      Serial.printf("Received from server: %s\n", payload); // Se ejecuta cuando se recibe un mensaje de texto del servidor
      break;
  }
}