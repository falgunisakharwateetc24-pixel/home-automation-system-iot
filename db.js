const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_FILE = path.join(__dirname, 'data', 'db.json');

// Ensure data folder and db.json exist
function ensureDb() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const salt = bcrypt.genSaltSync(10);
    const defaultPasswordHash = bcrypt.hashSync('password123', salt);

    // Initial default state
    const initialData = {
      users: [
        {
          id: 'user_falguni',
          name: 'Falguni',
          email: 'falguni@sbjain.edu.in',
          passwordHash: defaultPasswordHash,
          createdAt: new Date().toISOString()
        }
      ],
      device: {
        relay: 'OFF',
        line1: 'SmartHome System',
        line2: 'WELCOME',
        currentTemp: 28.0,
        currentHumidity: 45.0,
        lastPing: new Date(Date.now() - 5000).toISOString() // Recently online for demo
      },
      records: [
        {
          id: 'rec_1',
          temperature: 28,
          humidity: 45,
          timestamp: Date.now() - 600000,
          date: formatKolkataDate(new Date(Date.now() - 600000)),
          time: formatKolkataTime(new Date(Date.now() - 600000))
        },
        {
          id: 'rec_2',
          temperature: 29,
          humidity: 46,
          timestamp: Date.now() - 480000,
          date: formatKolkataDate(new Date(Date.now() - 480000)),
          time: formatKolkataTime(new Date(Date.now() - 480000))
        },
        {
          id: 'rec_3',
          temperature: 28,
          humidity: 44,
          timestamp: Date.now() - 360000,
          date: formatKolkataDate(new Date(Date.now() - 360000)),
          time: formatKolkataTime(new Date(Date.now() - 360000))
        },
        {
          id: 'rec_4',
          temperature: 27,
          humidity: 47,
          timestamp: Date.now() - 240000,
          date: formatKolkataDate(new Date(Date.now() - 240000)),
          time: formatKolkataTime(new Date(Date.now() - 240000))
        },
        {
          id: 'rec_5',
          temperature: 28,
          humidity: 45,
          timestamp: Date.now() - 120000,
          date: formatKolkataDate(new Date(Date.now() - 120000)),
          time: formatKolkataTime(new Date(Date.now() - 120000))
        },
        {
          id: 'rec_6',
          temperature: 28,
          humidity: 45,
          timestamp: Date.now() - 10000,
          date: formatKolkataDate(new Date(Date.now() - 10000)),
          time: formatKolkataTime(new Date(Date.now() - 10000))
        }
      ]
    };

    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

// Helpers for Asia/Kolkata timezone formatting
// Time format: HH:MM AM/PM
function formatKolkataTime(dateObj = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return formatter.format(dateObj);
  } catch (e) {
    // Fallback if timezone not supported
    return dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
}

// Date format: DD-MM-YYYY
function formatKolkataDate(dateObj = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).formatToParts(dateObj);

    const day = parts.find(p => p.type === 'day')?.value || '01';
    const month = parts.find(p => p.type === 'month')?.value || '01';
    const year = parts.find(p => p.type === 'year')?.value || '2026';
    return `${day}-${month}-${year}`;
  } catch (e) {
    return dateObj.toLocaleDateString('en-GB').replace(/\//g, '-');
  }
}

// Thread-safe / Atomic DB Read
function readDb() {
  ensureDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading db.json:', err);
    return { users: [], records: [], device: {} };
  }
}

// Thread-safe Atomic DB Write
function writeDb(data) {
  const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, DB_FILE);
}

// User Methods
function findUserByEmail(email) {
  const db = readDb();
  return db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

function createUser({ name, email, password }) {
  const db = readDb();
  if (findUserByEmail(email)) {
    throw new Error('User with this email already exists');
  }
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);
  const newUser = {
    id: 'user_' + Date.now(),
    name,
    email: email.toLowerCase(),
    passwordHash,
    createdAt: new Date().toISOString()
  };
  db.users.push(newUser);
  writeDb(db);
  return { id: newUser.id, name: newUser.name, email: newUser.email };
}

function verifyUserPassword(user, password) {
  return bcrypt.compareSync(password, user.passwordHash);
}

// Device Status & Control
function getDeviceState() {
  const db = readDb();
  const lastPing = db.device.lastPing ? new Date(db.device.lastPing).getTime() : 0;
  // ESP8266 reports every 10-15s. Consider online if pinged within last 35 seconds.
  const isOnline = (Date.now() - lastPing) < 35000;

  return {
    ...db.device,
    isOnline,
    lastPingFormatted: db.device.lastPing ? formatKolkataTime(new Date(db.device.lastPing)) : 'Never',
    lastPingAgoSeconds: db.device.lastPing ? Math.round((Date.now() - lastPing) / 1000) : null
  };
}

function setRelay(state) {
  const db = readDb();
  db.device.relay = (state === 'ON' || state === true || state === '1') ? 'ON' : 'OFF';
  writeDb(db);
  return db.device.relay;
}

function setLcdText(line1, line2) {
  const db = readDb();
  // Constrain to max 16 characters each
  db.device.line1 = (line1 || '').substring(0, 16);
  db.device.line2 = (line2 || '').substring(0, 16);
  writeDb(db);
  return { line1: db.device.line1, line2: db.device.line2 };
}

// Record Methods
function addRecord(temperature, humidity) {
  const db = readDb();
  const now = new Date();

  const tempVal = Number(temperature);
  const humVal = Number(humidity);

  const newRecord = {
    id: 'rec_' + Date.now(),
    temperature: isNaN(tempVal) ? 28 : Math.round(tempVal * 10) / 10,
    humidity: isNaN(humVal) ? 45 : Math.round(humVal * 10) / 10,
    timestamp: now.getTime(),
    date: formatKolkataDate(now),
    time: formatKolkataTime(now)
  };

  // Update device's current reading and ping time
  db.device.currentTemp = newRecord.temperature;
  db.device.currentHumidity = newRecord.humidity;
  db.device.lastPing = now.toISOString();

  // Prepend new record so newest is at the top
  db.records.unshift(newRecord);

  // Keep last 500 records to prevent json file from becoming excessively huge
  if (db.records.length > 500) {
    db.records = db.records.slice(0, 500);
  }

  writeDb(db);
  return newRecord;
}

function getRecords({ page = 1, limit = 5 }) {
  const db = readDb();
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 5);

  const total = db.records.length;
  const totalPages = Math.ceil(total / limitNum) || 1;
  const startIndex = (pageNum - 1) * limitNum;
  const paginatedRecords = db.records.slice(startIndex, startIndex + limitNum);

  return {
    records: paginatedRecords,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages
    }
  };
}

function deleteRecord(id) {
  const db = readDb();
  const initialLength = db.records.length;
  db.records = db.records.filter(r => r.id !== id);
  if (db.records.length !== initialLength) {
    writeDb(db);
    return true;
  }
  return false;
}

function clearAllRecords() {
  const db = readDb();
  db.records = [];
  writeDb(db);
  return true;
}

// Initial ensure on load
ensureDb();

module.exports = {
  findUserByEmail,
  createUser,
  verifyUserPassword,
  getDeviceState,
  setRelay,
  setLcdText,
  addRecord,
  getRecords,
  deleteRecord,
  clearAllRecords,
  formatKolkataTime,
  formatKolkataDate
};
