/*
 * ======================================================================================
 * Project: Smart Home Automation System (IoT NodeMCU ESP8266)
 * Developed by: Falguni and Team (Dept. of ETC, SB Jain, Nagpur)
 * 
 * Hardware Details:
 *   - Microcontroller: ESP8266 (NodeMCU CP2102)
 *   - Temperature & Humidity Sensor: DHT11 on Pin D5 (GPIO 14)
 *   - 16x2 LCD with I2C Backpack (@0x27): D1 (SCL / GPIO 5) & D2 (SDA / GPIO 4)
 *   - Relay / Appliance Switch: Pin D3 (GPIO 0)
 * 
 * Required Arduino Libraries:
 *   1. "DHT sensor library" by Adafruit (plus Adafruit Unified Sensor)
 *   2. "LiquidCrystal I2C" by Frank de Brabander or Marco Schwartz
 *   3. "ArduinoJson" by Benoit Blanchon (Version 6.x recommended)
 *   4. ESP8266WiFi & ESP8266HTTPClient (Built into ESP8266 Arduino Core)
 * ======================================================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ---------------------- PIN DEFINITIONS ----------------------
#define DHTPIN D5          // DHT11 Data Pin connected to D5 (GPIO 14)
#define DHTTYPE DHT11      // Sensor Type DHT11
#define RELAY_PIN D3       // Relay Module connected to D3 (GPIO 0)
#define I2C_SDA D2         // I2C Data line connected to D2 (GPIO 4)
#define I2C_SCL D1         // I2C Clock line connected to D1 (GPIO 5)

// Relay Trigger Logic (Most 5V relay modules are ACTIVE LOW: LOW = ON, HIGH = OFF)
// Set to false if your relay module is ACTIVE HIGH.
const bool RELAY_ACTIVE_LOW = true;

// ---------------------- WIFI & SERVER CONFIG ----------------------
// WiFi Credentials from prompt specifications:
const char* ssid = "ESP8266";
const char* password = "12345678";

// Render Web App URL:
// Leave blank initially as requested ("Keep it blank will add after deployment").
// Example after deploying to Render: "https://smart-home-automation.onrender.com"
const char* serverUrl = ""; 

// ---------------------- OBJECT INITIALIZATION ----------------------
// 16x2 LCD at I2C Address 0x27
LiquidCrystal_I2C lcd(0x27, 16, 2);
DHT dht(DHTPIN, DHTTYPE);

// Variables for Server Synchronized Data
String smartDisplayLine1 = "SMART DISPLAY";
String smartDisplayLine2 = "MyData";
String relayStatus = "OFF";
float currentTemp = 0.0;
float currentHumidity = 0.0;

// Helper to center or pad LCD text to 16 characters
void displayOnLCD(const String& line1, const String& line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  // Truncate to max 16 chars for safety
  String l1 = line1.substring(0, 16);
  lcd.print(l1);
  
  lcd.setCursor(0, 2); // row 1 (0-indexed)
  lcd.setCursor(0, 1);
  String l2 = line2.substring(0, 16);
  lcd.print(l2);
}

// Set physical relay hardware pin based on status
void setRelayState(const String& state) {
  bool turnOn = (state == "ON" || state == "on" || state == "1");
  if (RELAY_ACTIVE_LOW) {
    digitalWrite(RELAY_PIN, turnOn ? LOW : HIGH);
  } else {
    digitalWrite(RELAY_PIN, turnOn ? HIGH : LOW);
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n\n--- Smart Home Automation System Starting ---");

  // Initialize Relay Pin
  pinMode(RELAY_PIN, OUTPUT);
  setRelayState("OFF"); // Default relay state OFF

  // Initialize I2C for LCD
  Wire.begin(I2C_SDA, I2C_SCL);
  lcd.init();
  lcd.backlight();

  // Initialize DHT11 sensor
  dht.begin();

  // ------------------ SETUP SEQUENCE FROM PROMPT ------------------
  // R1: SmartHome System
  // R2: WELCOME
  displayOnLCD("SmartHome System", "WELCOME");
  Serial.println("LCD: SmartHome System | WELCOME");
  delay(3000); // delay(3S)

  // R1: CONNECTING TO
  // R2: WiFi.........
  displayOnLCD("CONNECTING TO", "WiFi.........");
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 25) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected Successfully!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());

    // R1: CONNECTED TO
    // R2: WiFi...SUCCESS
    displayOnLCD("CONNECTED TO", "WiFi...SUCCESS");
  } else {
    Serial.println("\nWiFi Connection Failed/Timed Out!");
    displayOnLCD("WiFi FAILED", "Check AP/Pass");
  }
  delay(2000);
}

// Function to exchange data with Render Express Backend
void syncWithServer() {
  if (strlen(serverUrl) == 0) {
    Serial.println("[Notice] Render URL is empty. Update 'serverUrl' with your Render URL.");
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Warning] WiFi not connected. Skipping server sync.");
    return;
  }

  WiFiClientSecure clientSecure;
  WiFiClient clientInsecure;
  HTTPClient http;
  
  String endpoint = String(serverUrl);
  if (endpoint.endsWith("/")) {
    endpoint = endpoint.substring(0, endpoint.length() - 1);
  }
  endpoint += "/api/iot/data";

  bool isHttps = endpoint.startsWith("https://");

  if (isHttps) {
    clientSecure.setInsecure(); // Allows HTTPS without loading root CA bundle
    http.begin(clientSecure, endpoint);
  } else {
    http.begin(clientInsecure, endpoint);
  }

  http.addHeader("Content-Type", "application/json");

  // Prepare JSON Payload to send Temperature and Humidity
  StaticJsonDocument<256> sendDoc;
  sendDoc["temperature"] = currentTemp;
  sendDoc["humidity"] = currentHumidity;
  sendDoc["deviceId"] = "ESP8266_NODE_01";

  String requestBody;
  serializeJson(sendDoc, requestBody);

  Serial.print("[HTTP POST] Sending data to: ");
  Serial.println(endpoint);
  Serial.println("Payload: " + requestBody);

  int httpCode = http.POST(requestBody);

  if (httpCode > 0) {
    String response = http.getString();
    Serial.printf("[HTTP Code: %d] Response: %s\n", httpCode, response.c_str());

    if (httpCode == HTTP_CODE_OK || httpCode == 201) {
      StaticJsonDocument<512> recvDoc;
      DeserializationError error = deserializeJson(recvDoc, response);

      if (!error) {
        // Fetch Relay Status from Server
        if (recvDoc.containsKey("relay")) {
          relayStatus = recvDoc["relay"].as<String>();
          setRelayState(relayStatus);
          Serial.println("Updated Relay: " + relayStatus);
        }

        // Fetch LCD Text from Server (Tab 2 fields)
        if (recvDoc.containsKey("line1")) {
          smartDisplayLine1 = recvDoc["line1"].as<String>();
          if (smartDisplayLine1.length() == 0) smartDisplayLine1 = "SMART DISPLAY";
        }
        if (recvDoc.containsKey("line2")) {
          smartDisplayLine2 = recvDoc["line2"].as<String>();
          if (smartDisplayLine2.length() == 0) smartDisplayLine2 = "MyData";
        }
      } else {
        Serial.print("JSON Parse error: ");
        Serial.println(error.c_str());
      }
    }
  } else {
    Serial.printf("[HTTP Error] POST failed, error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}

void loop() {
  // Read sensor values from DHT11
  float h = dht.readHumidity();
  float t = dht.readTemperature(); // Celsius

  if (isnan(h) || isnan(t)) {
    Serial.println("Failed to read from DHT11 sensor! Using fallback/previous values.");
  } else {
    currentTemp = t;
    currentHumidity = h;
    Serial.printf("Sensor Read -> Temp: %.1f °C, Humidity: %.1f %%\n", currentTemp, currentHumidity);
  }

  // Fetch Details from Server (LCD Data & Relay Data)
  // Send Details to Server (Temperature and Humidity)
  syncWithServer();

  // ------------------ DISPLAY CYCLE FROM PROMPT ------------------
  // 1.
  // R1: ROOM TEMP
  // R2: 28 'C
  // delay(2s)
  String tempStr = String((int)round(currentTemp)) + " 'C";
  displayOnLCD("ROOM TEMP", tempStr);
  delay(2000);

  // 2.
  // R1: HUMIDITY
  // R2: 45 %
  // delay(2s)
  String humStr = String((int)round(currentHumidity)) + " %";
  displayOnLCD("HUMIDITY", humStr);
  delay(2000);

  // 3.
  // Get below details from Server
  // R1: SMART DISPLAY
  // R2: MyData
  // delay(2s)
  displayOnLCD(smartDisplayLine1, smartDisplayLine2);
  delay(2000);

  // 4.
  // Get this from Server
  // R1: RELAY STATUS
  // R2: ON/OFF
  // delay(2s)
  displayOnLCD("RELAY STATUS", relayStatus);
  delay(2000);

  // Note: Total cycle time is ~8 to 10 seconds, which fulfills:
  // "Send Details to Server (Temperature and Humidity) Every 10 Seconds"
}
