// staff-rota-backend/server.js
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secure-and-long-secret-key-for-jwt-a1b2c3d4e5';

// --- In-memory "database" ---
let staffMembers = [
    { id: 'user-owner-001', name: 'Site Owner', gender: 'other', icon: '👤', role: 'Owner', pin: '0000' },
    { id: 'user-foh-002', name: 'John Doe', gender: 'male', icon: '👨', role: 'FOH', pin: '1234' },
    { id: 'user-boh-003', name: 'Jane Smith', gender: 'female', icon: '👩', role: 'BOH', pin: '5678' }
];
let nextUserId = 4;

// --- CORS Configuration ---
const allowedOrigins = [
  'https://burntoutlaserengraving.github.io',
  'http://127.0.0.1:5500' 
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || /\.ngrok-free\.app$/.test(origin)) {
      return callback(null, true);
    }
    console.error(`CORS Error: Origin ${origin} not allowed.`);
    return callback(new Error('Not allowed by CORS'), false);
  },
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// --- Authorization Middleware ---
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
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
    return res.status(403).json({ message: 'Forbidden. You do not have permission.' });
};


// --- API Endpoints ---
app.get('/api/users', (req, res) => {
    const publicStaffInfo = staffMembers.map(user => ({
        id: user.id, name: user.name, gender: user.gender, icon: user.icon, role: user.role
    }));
    res.json(publicStaffInfo);
});

app.post('/api/auth/login', (req, res) => {
    const { userId, pin } = req.body;
    const user = staffMembers.find(u => u.id === userId);
    if (!user || pin !== user.pin) {
        return res.status(401).json({ message: 'Invalid credentials. Please try again.' });
    }
    const userPayloadForToken = { id: user.id, role: user.role, name: user.name };
    const token = jwt.sign(userPayloadForToken, JWT_SECRET, { expiresIn: '8h' });
    res.json({ message: "Login successful", token, user: userPayloadForToken });
});

app.post('/api/users', authMiddleware, isOwner, (req, res) => {
    const { name, gender, role } = req.body;
    if (!name || !gender || !role) return res.status(400).json({ message: 'All fields are required.' });
    if (staffMembers.some(m => m.name.toLowerCase() === name.toLowerCase())) return res.status(400).json({ message: `Account "${name}" already exists.` });

    const icon = gender === 'male' ? '👨' : gender === 'female' ? '👩' : '👤';
    const newId = `user-${role.toLowerCase().substring(0,3)}-${String(nextUserId++).padStart(3, '0')}`;
    const newStaffMember = { id: newId, name, gender, icon, role, pin: '0000' };
    staffMembers.push(newStaffMember);

    const publicNewStaffMember = { id: newStaffMember.id, name, gender, icon, role };
    res.status(201).json({ message: 'Staff member created successfully!', user: publicNewStaffMember });
});

app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
});