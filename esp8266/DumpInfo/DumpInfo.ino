#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>
#include <SPI.h>
#include <MFRC522.h>

// WiFi
const char* ssid = "Casa1";
const char* password = "argentina";

// WebSocket
WebSocketsClient webSocket;
const char* serverAddress = "192.168.1.16"; // IP del servidor WebSocket (tu PC donde corre Astro)
const uint16_t serverPort = 3000;           // Puerto donde escuche el WebSocket
const char* serverPath = "/ws";             // Ruta del WebSocket

// MFRC522
#define RST_PIN 2
#define SS_PIN 15
MFRC522 mfrc522(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  Serial.println("Connecting to WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected! IP: " + WiFi.localIP().toString());

  SPI.begin();
  mfrc522.PCD_Init();

  webSocket.begin(serverAddress, serverPort, serverPath);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);

  Serial.println("Scan PICC to send UID to WebSocket server...");
}

void loop() {
  webSocket.loop();

  if (!mfrc522.PICC_IsNewCardPresent()) return;
  if (!mfrc522.PICC_ReadCardSerial()) return;

  String uidString = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    uidString += (mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
    uidString += String(mfrc522.uid.uidByte[i], HEX);
    if (i < mfrc522.uid.size - 1) uidString += ":";
  }

  Serial.println("Sending UID: " + uidString);
  webSocket.sendTXT(uidString);

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
  delay(1000);
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket disconnected");
      break;
    case WStype_CONNECTED:
      Serial.println("WebSocket connected");
      break;
    case WStype_TEXT:
      Serial.printf("Received from server: %s\n", payload);
      break;
  }
}
