// staff-rota-backend/server.js - V1.2
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secure-and-long-secret-key-for-jwt-a1b2c3d4e5';

// --- In-memory "database" ---
let staffMembers = [
    { id: 'user-owner-001', name: 'Site Owner', gender: 'other', icon: '👤', role: 'Owner', pin: '0000', wage: 0 },
    { id: 'user-manager-002', name: 'Lyndsey', gender: 'female', icon: '👩', role: 'Manager', pin: '1234', wage: 15.00 },
    { id: 'user-foh-003', name: 'John Doe', gender: 'male', icon: '👨', role: 'FOH', pin: '1111', wage: 11.44 },
    { id: 'user-boh-004', name: 'Jane Smith', gender: 'female', icon: '👩', role: 'BOH', pin: '5678', wage: 12.50 }
];
let nextUserId = 5;

// --- CORS Configuration ---
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://burntoutlaserengraving.github.io',
      'http://127.0.0.1:5500', // For local testing with Live Server
      'null' // Allow files opened directly
    ];
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
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });
    
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next(); 
    } catch (err) {
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
};

const isManagerOrOwner = (req, res, next) => {
    if (req.user && (req.user.role === 'Owner' || req.user.role === 'Manager')) {
        return next();
    }
    return res.status(403).json({ message: 'Forbidden. Manager access required.' });
};
const isOwner = (req, res, next) => {
    if (req.user && req.user.role === 'Owner') return next();
    return res.status(403).json({ message: 'Forbidden. Owner access required.' });
};

// --- API ENDPOINTS ---

// GET users
// By default, gets public info. With ?full=true and auth, gets sensitive info.
app.get('/api/users', (req, res) => {
    const isFullRequest = req.query.full === 'true';

    // To get the full list with wages, the user must be authenticated.
    if (isFullRequest) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) return res.status(401).json([]);

        try {
            jwt.verify(token, JWT_SECRET);
            // Authenticated, return the full staffMembers object
            return res.json(staffMembers);
        } catch (err) {
            return res.status(403).json([]);
        }
    }
    
    // Otherwise, return public info only.
    const publicStaffInfo = staffMembers.map(({ pin, wage, ...user }) => user);
    res.json(publicStaffInfo);
});


// POST to login a user
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

// POST to create a new user (Owner only)
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

// PATCH to change the current user's PIN
app.patch('/api/users/me/pin', authMiddleware, (req, res) => {
    const { currentPin, newPin } = req.body;
    if (!currentPin || !newPin || newPin.length !== 4) {
        return res.status(400).json({ message: "Valid current and new PIN (4 digits) are required." });
    }
    
    const user = staffMembers.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (user.pin !== currentPin) {
        return res.status(403).json({ message: 'Your current PIN is incorrect.' });
    }

    user.pin = newPin;
    res.status(200).json({ message: 'PIN updated successfully!' });
});

// --- SERVER START ---
app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
});
