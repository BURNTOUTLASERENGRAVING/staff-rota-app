// staff-rota-backend/server.js - V1.1
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
    { id: 'user-foh-003', name: 'John Doe', gender: 'male', icon: '👨', role: 'FOH', pin: '1234', wage: 11.44 },
    { id: 'user-boh-004', name: 'Jane Smith', gender: 'female', icon: '👩', role: 'BOH', pin: '5678', wage: 12.50 }
];
let nextUserId = 5;

// --- CORS Configuration ---
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://burntoutlaserengraving.github.io',
      'http://127.0.0.1:5500' // For local testing with Live Server
    ];
    // Allow requests with no origin (like Postman) or from allowed sources
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Block other origins
    return callback(new Error('Not allowed by CORS'), false);
  },
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// --- MIDDLEWARE ---
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format is "Bearer <token>"
    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }
    try {
        // Verify the token and attach the decoded user payload to the request
        req.user = jwt.verify(token, JWT_SECRET);
        next(); 
    } catch (err) {
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
};

const isOwner = (req, res, next) => {
    // This middleware should run AFTER authMiddleware
    if (req.user && req.user.role === 'Owner') {
        return next();
    }
    return res.status(403).json({ message: 'Forbidden. Owner access required.' });
};

// --- API ENDPOINTS ---

// GET all users (public-facing info only)
app.get('/api/users', (req, res) => {
    // IMPORTANT: Never send sensitive info like PINs or wages in a public list.
    // We create a new array of user objects, excluding the sensitive properties.
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
    
    // The payload for the token should only contain non-sensitive identifiers.
    const userPayloadForToken = { id: user.id, role: user.role, name: user.name };
    const token = jwt.sign(userPayloadForToken, JWT_SECRET, { expiresIn: '8h' });
    
    // Return the token and the same non-sensitive user info to the frontend.
    res.json({ message: "Login successful", token, user: userPayloadForToken });
});

// POST to create a new user (Protected Route)
app.post('/api/users', authMiddleware, isOwner, (req, res) => {
    const { name, gender, role, wage } = req.body;

    if (!name || !gender || !role || wage === undefined || wage < 0) {
        return res.status(400).json({ message: 'Name, gender, role, and a valid wage are required.' });
    }
    if (staffMembers.some(m => m.name.toLowerCase() === name.toLowerCase())) {
        return res.status(409).json({ message: `An account with the name "${name}" already exists.` }); // 409 Conflict is more appropriate
    }

    const icon = gender === 'male' ? '👨' : gender === 'female' ? '👩' : '👤';
    const newId = `user-${role.toLowerCase().substring(0,3)}-${String(nextUserId++).padStart(3, '0')}`;
    
    const newStaffMember = { 
      id: newId, 
      name, 
      gender, 
      icon, 
      role, 
      pin: '0000', // Default PIN
      wage: parseFloat(wage) // Ensure wage is stored as a number
    };
    
    staffMembers.push(newStaffMember);

    // Return the public version of the newly created staff member.
    const { pin, wage: hiddenWage, ...publicUser } = newStaffMember;
    res.status(201).json({ message: 'Staff member created successfully!', user: publicUser });
});

// --- SERVER START ---
app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
});
