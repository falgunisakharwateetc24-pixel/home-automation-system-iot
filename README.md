# 🏠 Smart Home Automation System (IoT + Web Application)

> **Developed with ❤️ by Falguni and Team**  
> **Department of Electronics and Telecommunication (ETC), SB Jain, Nagpur**

---

## 📌 Project Overview
A complete, end-to-end **Smart Home Automation & IoT Telemetry System** connecting an **ESP8266 (NodeMCU CP2102)** microcontroller with an **Express.js & Node.js** web application deployable on **Render**.

---

## 🔌 Hardware Circuit & Pin Connections

| Component | NodeMCU Pin | GPIO Pin | Description / Notes |
| :--- | :--- | :--- | :--- |
| **DHT11 Sensor** | **D5** | GPIO 14 | Digital Signal Pin for Temperature & Humidity |
| **DHT11 VCC & GND** | **3V3 / VIN & GND** | — | Power (+3.3V or 5V) and Ground |
| **16x2 LCD (I2C) SCL** | **D1** | GPIO 5 | I2C Clock Line (@ address `0x27`) |
| **16x2 LCD (I2C) SDA** | **D2** | GPIO 4 | I2C Data Line (@ address `0x27`) |
| **16x2 LCD VCC & GND** | **VIN (5V) & GND** | — | I2C backpack power (5V recommended for bright backlight) |
| **Relay / Appliance Switch**| **D3** | GPIO 0 | Control signal for relay module (Active LOW) |
| **Relay VCC & GND** | **VIN (5V) & GND** | — | Relay module coil power |

---

## 💻 Tech Stack
- **Frontend**: HTML5, Tailwind CSS, Chart.js, JetBrains Mono & Outfit Google Fonts
- **Backend**: Express.js & Node.js
- **Database**: Simple JSON File Database (`data/db.json`)
- **Deployment Platform**: Render (`render.yaml` + auto-detecting Web Service)
- **IoT Firmware**: Arduino C++ for NodeMCU ESP8266 (`esp8266/smart_home_esp8266.ino`)

---

## 🚀 How to Run Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```
Or for auto-reload during development:
```bash
npm run dev
```

### 3. Open in Browser
Visit: **[http://localhost:3000](http://localhost:3000)**

- **Default User Credentials**:
  - **Email**: `falguni@sbjain.edu.in`
  - **Password**: `password123`
  - *(Or click the **"⚡ Quick Demo Fill (Falguni)"** button on the login card, or register a new user)*

---

## ☁️ How to Deploy to Render (Free Web Service)

1. Push this project to your GitHub account:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for Smart Home Automation System"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/smart-home-automation.git
   git push -u origin main
   ```
2. Go to **[Render.com](https://render.com/)** and sign in.
3. Click **New +** -> **Web Service**.
4. Select your GitHub repository.
5. Render will automatically detect the settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
6. Click **Deploy Web Service**.
7. Once deployed, Render will provide your public URL, e.g.:
   ```
   https://smart-home-automation-xxxx.onrender.com
   ```

---

## 📡 Configuring the NodeMCU ESP8266

1. Open **Arduino IDE**.
2. Install the **ESP8266 Board Package** if not already installed:
   - Go to `File` > `Preferences` > `Additional Board Manager URLs`:  
     `http://arduino.esp8266.com/stable/package_esp8266com_index.json`
   - Go to `Tools` > `Board` > `Boards Manager...` and install **esp8266**.
3. Install required libraries from `Sketch` > `Include Library` > `Manage Libraries...`:
   - `DHT sensor library` by Adafruit
   - `LiquidCrystal I2C` by Frank de Brabander or Marco Schwartz
   - `ArduinoJson` (v6.x) by Benoit Blanchon
4. Open [smart_home_esp8266.ino](file:///c:/Users/HP/OneDrive/Documents/VAC/esp8266/smart_home_esp8266.ino).
5. Configure WiFi and your Render URL:
   ```cpp
   const char* ssid = "ESP8266";
   const char* password = "12345678";
   
   // Enter your Render URL here:
   const char* serverUrl = "https://your-app-name.onrender.com";
   ```
6. Select Board: `NodeMCU 1.0 (ESP-12E Module)` or `Generic ESP8266 Module`.
7. Select your COM Port and click **Upload**.

---

## 📺 Hardware LCD Display Sequence

### In Setup:
1. `R1: SmartHome System` / `R2: WELCOME` (`delay(3s)`)
2. `R1: CONNECTING TO` / `R2: WiFi.........`
3. Upon connection: `R1: CONNECTED TO` / `R2: WiFi...SUCCESS`

### In Loop (Continuous ~10s Cycle):
1. **Room Temperature**: `R1: ROOM TEMP` | `R2: 28 'C` (`delay(2s)`)
2. **Humidity**: `R1: HUMIDITY` | `R2: 45 %` (`delay(2s)`)
3. **Smart LCD Text**: `R1: SMART DISPLAY` (or custom Field 1) | `R2: MyData` (or custom Field 2) (`delay(2s)`)
4. **Relay Actuator**: `R1: RELAY STATUS` | `R2: ON` or `OFF` (`delay(2s)`)
5. Simultaneously sends DHT11 readings to server and fetches latest Relay and LCD state.

---

## 🖥️ Web Application Features

1. **Authentication**:
   - Register new account (Name, Email, Password)
   - Login with JWT authentication & session retention
2. **Page 2: Web Dashboard**:
   - **Header**:
     - Web App Name: *Smart Home Automation System*
     - Greeting: *Welcome Falguni*
     - **ESP8266 Live Status**: Pulsing green badge when **ONLINE**, red badge when **OFFLINE** (based on ping timestamp)
     - Light/Dark theme toggle
   - **Tab 1: Monitoring & Records**:
     - **Section 1**: Current Room Temperature & Humidity in Cards with Large Font UI/UX Gauge / Seek Bar (Colorful gradients).
     - **Telemetry Graphs**: Real-time trend graphs for Temperature and Humidity.
     - **Section 2: Saved Records**: Paginated table with format:  
       `# | Temperature | Humidity | Time | Date | Action (Delete)`  
       `1 | 28 'C | 45% | HH:MM AM | DD-MM-YYYY | Delete`  
       *(Timezone: Asia/Kolkata +5:30)*
   - **Tab 2: Smart LCD Display**:
     - 2 Text Input fields (Max 16 characters each)
     - Character length counters (`x/16`)
     - **Realistic 16x2 LCD hardware screen simulator** with backlit dot-matrix preview
     - Save button to sync with hardware LCD
   - **Tab 3: Appliance / Relay Switch**:
     - Innovative 3D tactile power switch with glowing neon ring
     - Real-time instant status sync with ESP8266 hardware pin D3
     - Haptic audio feedback upon toggling
3. **Footer**:
   - `Developed with ❤️ by Falguni and Team. Department of ETC, SB Jain, Nagpur` (with animated pulse heartbeat icon)
