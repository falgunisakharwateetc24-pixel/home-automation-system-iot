const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'smart-home-secret-key-sbjain-etc-2026';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Optional Auth Middleware for dashboard actions
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// -------------------------------------------------------------
// AUTHENTICATION ROUTES
// -------------------------------------------------------------

// POST /api/auth/register
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const newUser = db.createUser({ name, email, password });
    const token = jwt.sign({ id: newUser.id, name: newUser.name, email: newUser.email }, JWT_SECRET, {
      expiresIn: '7d'
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: newUser
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Registration failed' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = db.verifyUserPassword(user, password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// -------------------------------------------------------------
// IoT (ESP8266) ENDPOINTS
// -------------------------------------------------------------

// POST /api/iot/data
// ESP8266 sends DHT11 readings every 10 seconds and receives current Relay & LCD text
app.post('/api/iot/data', (req, res) => {
  try {
    const { temperature, humidity } = req.body;

    if (temperature !== undefined && humidity !== undefined) {
      db.addRecord(temperature, humidity);
    }

    const device = db.getDeviceState();

    // Respond back to ESP8266 with latest actuator settings
    res.json({
      status: 'success',
      relay: device.relay,
      line1: device.line1 || 'SMART DISPLAY',
      line2: device.line2 || 'MyData'
    });
  } catch (error) {
    console.error('Error handling IoT data:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/iot/control
// For ESP8266 to poll control states if needed
app.get('/api/iot/control', (req, res) => {
  const device = db.getDeviceState();
  res.json({
    relay: device.relay,
    line1: device.line1,
    line2: device.line2
  });
});

// -------------------------------------------------------------
// WEB DASHBOARD ENDPOINTS
// -------------------------------------------------------------

// GET /api/dashboard/stats
app.get('/api/dashboard/stats', (req, res) => {
  const device = db.getDeviceState();
  // Get recent 20 records for smooth graphs
  const recent = db.getRecords({ page: 1, limit: 20 });

  res.json({
    device,
    graphData: recent.records.slice().reverse() // chronological order for charts
  });
});

// GET /api/records?page=1&limit=5
app.get('/api/records', (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 5;
  const result = db.getRecords({ page, limit });
  res.json(result);
});

// POST /api/records/simulate
// Allows manual testing & simulation of sensor readings from the browser
app.post('/api/records/simulate', (req, res) => {
  const { temperature, humidity } = req.body;
  const temp = temperature !== undefined ? temperature : (24 + Math.floor(Math.random() * 8));
  const hum = humidity !== undefined ? humidity : (40 + Math.floor(Math.random() * 20));
  const newRec = db.addRecord(temp, hum);
  res.json({ success: true, record: newRec });
});

// DELETE /api/records/:id
app.delete('/api/records/:id', (req, res) => {
  const { id } = req.params;
  const deleted = db.deleteRecord(id);
  if (deleted) {
    res.json({ success: true, message: 'Record deleted' });
  } else {
    res.status(404).json({ error: 'Record not found' });
  }
});

// DELETE /api/records (Clear all)
app.delete('/api/records', (req, res) => {
  db.clearAllRecords();
  res.json({ success: true, message: 'All records cleared' });
});

// POST /api/lcd (Tab 2: Max 16 chars per field)
app.post('/api/lcd', (req, res) => {
  let { line1, line2 } = req.body;
  line1 = (line1 || '').substring(0, 16);
  line2 = (line2 || '').substring(0, 16);

  const updated = db.setLcdText(line1, line2);
  res.json({
    success: true,
    message: 'LCD display text updated',
    data: updated
  });
});

// POST /api/relay (Tab 3: Innovative Button to Turn Appliance ON / OFF)
app.post('/api/relay', (req, res) => {
  const { state } = req.body;
  const updatedState = db.setRelay(state);
  res.json({
    success: true,
    message: `Appliance turned ${updatedState}`,
    relay: updatedState
  });
});

// Render Fallback to SPA (Express 5 compatible)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server on 0.0.0.0 for Render
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`  Smart Home Automation System Server Running!        `);
  console.log(`  Local URL:   http://localhost:${PORT}                `);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'} `);
  console.log(`  Render Port: ${PORT}                                 `);
  console.log(`=======================================================`);
});
