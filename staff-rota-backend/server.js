// staff-rota-backend/server.js - V1.4
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secure-and-long-secret-key-for-jwt-a1b2c3d4e5';

// --- Default Data Factory ---
const createInitialData = () => {
    let nextUserId = 2; // Start after owner
    const initialStaff = [
        { id: 'user-owner-001', name: 'Site Owner', gender: 'other', icon: '👤', role: 'Owner', pin: '0000', wage: 0 }
    ];
    // Function to create multiple staff
    const createStaff = (count, role, baseWage, genderPool) => {
        for (let i = 0; i < count; i++) {
            const gender = genderPool[i % genderPool.length];
            const names = gender === 'male' ? ['James', 'Robert', 'Michael', 'David', 'Chris', 'Daniel', 'Paul', 'Mark', 'George', 'Steven'] : ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Nancy'];
            const lastNames = ['Smith', 'Jones', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson'];
            
            const name = `${names[i]} ${lastNames[i]}`;
            initialStaff.push({
                id: `user-${role.toLowerCase()}-${String(nextUserId++).padStart(3,'0')}`,
                name: name,
                gender: gender,
                icon: gender === 'male' ? '👨' : '👩',
                role: role,
                pin: '1234',
                wage: parseFloat((baseWage + (Math.random() * 2)).toFixed(2)), // small variation in wage
            });
        }
    };
    
    // Create detailed staff list
    createStaff(2, 'Manager', 15.00, ['female', 'male']);
    createStaff(3, 'Supervisor', 13.50, ['male', 'female', 'male']);
    createStaff(10, 'FOH', 11.44, ['female','male','female','male','female','female','male','female','male','female']);
    createStaff(10, 'BOH', 11.60, ['male','female','male','male','female','male','female','male','male','female']);

    return { staffMembers: initialStaff };
};


// --- In-memory "database" ---
let db = createInitialData();

// --- CORS Configuration ---
const corsOptions = {
  origin: true, // Allow all for simplicity with github.io, file://, etc.
  credentials: true,
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

const isOwner = (req, res, next) => {
    if (req.user && req.user.role === 'Owner') return next();
    return res.status(403).json({ message: 'Forbidden. Owner access required.' });
};

// --- API ENDPOINTS ---
app.get('/api/users', (req, res) => {
    const isFullRequest = req.query.full === 'true';

    if (isFullRequest) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token || token === 'null' || token === '') {
            return res.status(401).json({ message: 'Authentication required for full user data.' });
        }
        try {
            jwt.verify(token, JWT_SECRET);
            return res.json(db.staffMembers);
        } catch (err) {
            return res.status(403).json({ message: 'Invalid or expired token for full user data.' });
        }
    }
    const publicStaffInfo = db.staffMembers.map(({ pin, wage, ...user }) => user);
    res.json(publicStaffInfo);
});

app.post('/api/auth/login', (req, res) => {
    const { userId, pin } = req.body;
    const user = db.staffMembers.find(u => u.id === userId);
    
    if (!user || user.pin !== pin) {
        return res.status(401).json({ message: 'Invalid credentials. Please try again.' });
    }
    
    const userPayloadForToken = { id: user.id, role: user.role, name: user.name };
    const token = jwt.sign(userPayloadForToken, JWT_SECRET, { expiresIn: '8h' });
    
    res.json({ message: "Login successful", token, user: userPayloadForToken });
});

app.post('/api/users', authMiddleware, isOwner, (req, res) => {
    const { name, gender, role, wage } = req.body;
    if (!name || !gender || !role || wage === undefined || wage < 0) {
        return res.status(400).json({ message: 'Name, gender, role, and a valid wage are required.' });
    }
    if (db.staffMembers.some(m => m.name.toLowerCase() === name.toLowerCase())) {
        return res.status(409).json({ message: `An account with the name "${name}" already exists.` });
    }
    const nextId = (db.staffMembers.length > 0 ? Math.max(...db.staffMembers.map(u => parseInt(u.id.split('-').pop(), 10))) : 0) + 1;

    const icon = gender === 'male' ? '👨' : gender === 'female' ? '👩' : '👤';
    const newId = `user-${role.toLowerCase().substring(0,3)}-${String(nextId).padStart(3, '0')}`;
    const newStaffMember = { id: newId, name, gender, icon, role, pin: '0000', wage: parseFloat(wage) };
    db.staffMembers.push(newStaffMember);
    const { pin, ...publicUser } = newStaffMember; // send back wage so admin list can update
    res.status(201).json({ message: 'Staff member created successfully!', user: publicUser });
});

app.patch('/api/users/me/pin', authMiddleware, (req, res) => {
    const { currentPin, newPin } = req.body;
    if (!currentPin || !newPin || newPin.length !== 4) {
        return res.status(400).json({ message: "Valid current and new PIN (4 digits) are required." });
    }
    
    const user = db.staffMembers.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (user.pin !== currentPin) {
        return res.status(403).json({ message: 'Your current PIN is incorrect.' });
    }
    user.pin = newPin;
    res.status(200).json({ message: 'PIN updated successfully!' });
});

app.delete('/api/data/wipe', authMiddleware, isOwner, (req, res) => {
    console.log(`Data wipe initiated by ${req.user.name}`);
    db = createInitialData();
    res.status(200).json({ message: 'All application data has been wiped successfully.' });
});

app.patch('/api/users/:userId/pin', authMiddleware, isOwner, (req, res) => {
    const { userId } = req.params;
    const user = db.staffMembers.find(u => u.id === userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    // Generate a new random 4-digit PIN
    const newPin = String(Math.floor(1000 + Math.random() * 9000));
    user.pin = newPin;

    res.status(200).json({ message: `${user.name}'s PIN has been reset.`, newPin: newPin });
});

app.put('/api/users/:userId', authMiddleware, isOwner, (req, res) => {
    const { userId } = req.params;
    const { name, gender, role, wage } = req.body;
    
    const userIndex = db.staffMembers.findIndex(u => u.id === userId);
    if (userIndex === -1) return res.status(404).json({ message: "User not found."});

    const icon = gender === 'male' ? '👨' : gender === 'female' ? '👩' : '👤';
    
    const updatedUser = {
        ...db.staffMembers[userIndex],
        name,
        gender,
        role,
        wage: parseFloat(wage),
        icon
    };
    db.staffMembers[userIndex] = updatedUser;

    res.status(200).json({ message: "User updated successfully."});
});

// --- SERVER START ---
app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
});
