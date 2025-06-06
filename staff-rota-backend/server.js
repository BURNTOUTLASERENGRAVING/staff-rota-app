// staff-rota-backend/server.js - V1.2
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;

// A real secret should be long, complex, and stored as an environment variable.
const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secure-and-long-secret-key-for-jwt-a1b2c3d4e5';
if (JWT_SECRET === 'your-very-secure-and-long-secret-key-for-jwt-a1b2c3d4e5') {
    console.warn('WARNING: Using default JWT_SECRET. Please set a secure secret in your environment variables for production.');
}

// --- In-memory "database" ---
let staffMembers = [
    { id: 'user-owner-001', name: 'Site Owner', gender: 'other', icon: '👤', role: 'Owner', pin: '0000', wage: 0 },
    { id: 'user-manager-002', name: 'Lyndsey', gender: 'female', icon: '👩', role: 'Manager', pin: '1234', wage: 15.00 },
    { id: 'user-foh-003', name: 'John Doe', gender: 'male', icon: '👨', role: 'FOH', pin: '1234', wage: 11.44 },
    { id: 'user-boh-004', name: 'Jane Smith', gender: 'female', icon: '👩', role: 'BOH', pin: '5678', wage: 12.50 }
];
let nextUserId = 5;

// Data that was previously mocked on the frontend
const rotaData = {
  '2025-06-09': { 'user-foh-003': '8AM-4PM', 'user-boh-004': '8AM-4PM', 'user-manager-002': '8AM-4PM' },
  '2025-06-10': { 'user-foh-003': '12PM-8PM' }
};
const tasksData = ['Wipe down tables', 'Restock front fridge', 'Check bathrooms'];
const messagesData = [
    { name: 'Lyndsey', text: 'Team meeting at 2pm tomorrow!' }, 
    { name: 'Jane Smith', text: 'We are running low on coffee beans.' }
];

// --- CORS Configuration ---
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [ 'https://burntoutlaserengraving.github.io', 'http://127.0.0.1:5500' ];
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'), false);
  },
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// --- MIDDLEWARE ---
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>
    if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next(); 
    } catch (err) {
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
};

const isOwner = (req, res, next) => {
    if (req.user && req.user.role === 'Owner') return next();
    return res.status(403).json({ message: 'Forbidden. Owner access required.' });
};

// --- API ENDPOINTS ---

app.get('/', (req, res) => res.json({ message: 'RotaApp Backend is running.' }));

// GET all users (public info only)
app.get('/api/users', (req, res) => {
    const publicStaffInfo = staffMembers.map(({ pin, wage, ...user }) => user);
    res.json(publicStaffInfo);
});

// POST login a user
app.post('/api/auth/login', (req, res) => {
    const { userId, pin } = req.body;
    const user = staffMembers.find(u => u.id === userId);
    
    if (!user || user.pin !== pin) {
        return res.status(401).json({ message: 'Invalid credentials. Please try again.' });
    }
    
    const userPayloadForToken = { id: user.id, role: user.role, name: user.name };
    const token = jwt.sign(userPayloadForToken, JWT_SECRET, { expiresIn: '8h' });
    
    res.json({ message: "Login successful", token, user: userPayloadForToken });
});

// POST create a new user (Protected Route for Owner)
app.post('/api/users', authMiddleware, isOwner, (req, res) => {
    const { name, gender, role, wage } = req.body;
    if (!name || !gender || !role || wage === undefined || wage < 0) {
        return res.status(400).json({ message: 'Name, gender, role, and a valid wage are required.' });
    }
    if (staffMembers.some(m => m.name.toLowerCase() === name.toLowerCase())) {
        return res.status(409).json({ message: `An account with the name "${name}" already exists.` });
    }
    const icon = gender === 'male' ? '👨' : gender === 'female' ? '👩' : '👤';
    const newId = `user-${role.toLowerCase().substring(0,3)}-${String(nextUserId++).padStart(3, '0')}`;
    
    const newStaffMember = { id: newId, name, gender, icon, role, pin: '0000', wage: parseFloat(wage) };
    staffMembers.push(newStaffMember);
    const { pin, wage: hiddenWage, ...publicUser } = newStaffMember;
    res.status(201).json({ message: 'Staff member created successfully!', user: publicUser });
});


// GET DATA ENDPOINTS (Protected)
// These endpoints require a user to be logged in.

app.get('/api/rota', authMiddleware, (req, res) => {
    res.json(rotaData);
});

// An endpoint to get all data for the home page widgets at once.
app.get('/api/home/widgets', authMiddleware, (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const todaysRota = rotaData[today] || {};
    
    // Enrich rota data with staff names before sending
    const whoIsWorking = Object.keys(todaysRota).map(userId => {
        const staff = staffMembers.find(s => s.id === userId);
        return {
            userId: userId,
            name: staff ? staff.name : 'Unknown Staff',
            role: staff ? staff.role : 'Unknown',
            shift: todaysRota[userId]
        };
    });

    res.json({
        whoIsWorking: whoIsWorking,
        tasks: tasksData,
        messages: messagesData
    });
});


// --- SERVER START ---
app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
});
