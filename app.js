// app.js - V2.0 with Redesigned UI Logic
console.log("app.js loaded");

// ===================================================================================
// CONFIGURATION & STATE
// ===================================================================================
const BACKEND_URL = 'https://staff-rota-backend.onrender.com';
const ROLES = { OWNER: 'Owner', MANAGER: 'Manager' };

let staffMembers = [];
let authToken = null;
let currentUser = null;
let staffMemberToLogin = null;
let activeView = 'home'; // Tracks the current main page view (without '-view')

// ===================================================================================
// MOCK DATA (to demonstrate UI before backend is fully built)
// ===================================================================================
const mockRota = {
  '2025-06-09': { // Monday
    'user-foh-003': '8AM-4PM', 'user-boh-004': '8AM-4PM', 'user-manager-002': '8AM-4PM'
  },
  '2025-06-10': { // Tuesday
    'user-foh-003': '12PM-8PM'
  }
};
const mockTasks = ['Wipe down tables', 'Restock front fridge', 'Check bathrooms'];
const mockMessages = [{ name: 'Lyndsey', text: 'Team meeting at 2pm tomorrow!'}, { name: 'Jane Smith', text: 'We are running low on coffee beans.'}];

// ===================================================================================
// DOM ELEMENT SELECTORS
// ===================================================================================
const landingPage = document.getElementById('landing-page');
const appContainer = document.getElementById('app-container');
const toastContainer = document.getElementById('toast-container');
const mainContent = document.getElementById('main-content');

// ===================================================================================
// UTILITY & UI FUNCTIONS
// ===================================================================================
function showToast(message, type = 'info', duration = 3500) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 500); }, duration);
    }, 10);
}

function showView(viewName) {
    activeView = viewName;
    mainContent.querySelectorAll('section').forEach(view => view.classList.add('hidden'));
    document.getElementById(`${viewName}-view`)?.classList.remove('hidden');

    document.querySelectorAll('#sidebar-nav .nav-btn').forEach(button => {
        button.classList.toggle('active', button.id === `nav-${viewName}`);
    });
}

function updateAppUI() {
    if (!currentUser) return;

    const userInfoSpan = document.getElementById('user-info');
    const adminNavBtn = document.getElementById('nav-admin');
    const dashboardNavBtn = document.getElementById('nav-dashboard');
    
    userInfoSpan.textContent = currentUser ? `${currentUser.name} (${currentUser.role})` : '';

    const canAccessAdmin = currentUser.role === ROLES.OWNER || currentUser.role === ROLES.MANAGER;
    adminNavBtn?.classList.toggle('hidden', !canAccessAdmin);
    dashboardNavBtn?.classList.toggle('hidden', !canAccessAdmin);

    // If a non-admin user is somehow on an admin view, redirect them to home
    const isAdminView = activeView === 'admin' || activeView === 'dashboard';
    if (!canAccessAdmin && isAdminView) {
        showView('home');
    }
}

// ===================================================================================
// FEATURE RENDERING
// ===================================================================================
function renderLandingPage() {
    landingPage.classList.remove('hidden');
    appContainer.classList.add('hidden');
    const iconsContainer = document.getElementById('staff-icons-container');
    iconsContainer.innerHTML = '';
    
    if (!staffMembers || staffMembers.length === 0) {
        document.getElementById('landing-page-message').textContent = 'Could not load staff profiles.';
        return;
    }
    
    document.getElementById('landing-page-message').textContent = 'Please select your profile to continue:';
    staffMembers.forEach(member => {
        const iconDiv = document.createElement('div');
        iconDiv.className = 'staff-icon';
        iconDiv.dataset.id = member.id;
        iconDiv.innerHTML = `<span class="icon-placeholder">${member.icon}</span><span class="staff-name">${member.name}</span><span class="staff-role">${member.role}</span>`;
        iconDiv.addEventListener('click', () => openPinEntryScreen(member));
        iconsContainer.appendChild(iconDiv);
    });
}

function renderAdminUsersList() {
    const userList = document.getElementById('user-accounts-list');
    if (!userList) return;
    userList.innerHTML = '';
    staffMembers.sort((a,b) => a.name.localeCompare(b.name)).forEach(user => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="user-details">
                <span class="icon-placeholder">${user.icon}</span>
                <span>
                    <strong>${user.name}</strong><br>
                    <small style="color: var(--text-secondary);">${user.role}</small>
                </span>
            </div>
            <div class="user-actions">
                <button class="btn btn-secondary btn-sm">Reset PIN</button>
                <button class="btn btn-secondary btn-sm">Edit</button>
                ${currentUser.id !== user.id ? '<button class="btn btn-danger btn-sm">Delete</button>' : ''}
            </div>
        `;
        userList.appendChild(li);
    });
}

function renderHomePage() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const rotaToday = mockRota[today] || {};
    
    const workingList = document.getElementById('whos-working-today');
    workingList.innerHTML = '';
    if(Object.keys(rotaToday).length > 0) {
        Object.keys(rotaToday).forEach(userId => {
            const staff = staffMembers.find(s => s.id === userId);
            if(!staff) return;
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="shift-role-indicator ${staff.role.toLowerCase()}"></div>
                <span>${staff.name}</span>
                <span class="shift-time">${rotaToday[userId]}</span>`;
            workingList.appendChild(li);
        });
    } else {
        workingList.innerHTML = '<li>No one scheduled today.</li>';
    }

    const taskList = document.getElementById('your-tasks-today');
    taskList.innerHTML = '<li>' + mockTasks.join('</li><li>') + '</li>';
    
    const messageList = document.getElementById('message-board-list');
    messageList.innerHTML = '';
    mockMessages.forEach(msg => messageList.innerHTML += `<li><strong>${msg.name}:</strong> ${msg.text}</li>`);
}

function renderCalendar() {
  const calendarGrid = document.querySelector('#calendar-view .calendar-grid');
  calendarGrid.innerHTML = ''; // Clear everything
  
  for(let i = 1; i <= 30; i++) { // Placeholder logic
    const dayCell = document.createElement('div');
    dayCell.className = 'calendar-day current-month';
    let shiftsHtml = '';
    if (i === 9) {
        shiftsHtml = '<li class="manager">Lyndsey</li><li class="foh">John Doe</li><li class="boh">Jane Smith</li>';
    } else if (i === 10) {
        shiftsHtml = '<li class="foh">John Doe</li>';
    }
    dayCell.innerHTML = `<div class="day-number">${i}</div><ul>${shiftsHtml}</ul>`;
    calendarGrid.appendChild(dayCell);
  }
}

function renderAvailability() {
    const grid = document.getElementById('availability-grid');
    grid.innerHTML = '';
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const slots = ["Morning", "Afternoon", "Evening"];
    days.forEach(day => {
        const dayCol = document.createElement('div');
        dayCol.className = 'availability-day-column';
        let slotsHtml = `<h4>${day}</h4>`;
        slots.forEach(slot => {
            slotsHtml += `<label><input type="checkbox"/> ${slot}</label>`;
        });
        dayCol.innerHTML = slotsHtml;
        grid.appendChild(dayCol);
    });
}

// ===================================================================================
// AUTH & ACCOUNT MANAGEMENT
// ===================================================================================
function openPinEntryScreen(user) {
    staffMemberToLogin = user;
    document.getElementById('pin-login-user-display').textContent = user.name;
    document.getElementById('pin-input').value = '';
    landingPage.classList.add('hidden');
    appContainer.classList.remove('hidden');
    showView('pin-entry');
    setTimeout(() => document.getElementById('pin-input').focus(), 50);
}

async function handlePinLogin(e) {
    e.preventDefault();
    const pin = document.getElementById('pin-input').value;
    if (!staffMemberToLogin || !pin) return;

    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: staffMemberToLogin.id, pin })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        showToast(`Welcome, ${currentUser.name}!`, 'success');
        initializeAppUI();
    } catch (error) { showToast(error.message || 'Login failed.', 'error'); }
}

function handleSignOut() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    
    activeView = 'home';
    
    renderLandingPage();
    showToast("You have been signed out.", "info");
}

async function handleCreateAccount(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.querySelector('#admin-new-account-name').value;
    const wage = form.querySelector('#admin-new-account-wage').value;
    const gender = form.querySelector('#admin-new-account-gender').value;
    const role = form.querySelector('#admin-new-account-role').value;

    if (!name || !gender || !role || wage === undefined || wage === '') {
        return showToast('Please fill out all fields.', 'error');
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}`},
            body: JSON.stringify({ name, wage: parseFloat(wage), gender, role })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        showToast(result.message, 'success');
        staffMembers.push(result.user);
        renderAdminUsersList();
        form.reset();
    } catch (error) {
        showToast(error.message || 'Failed to create account.', 'error');
    }
}

// ===================================================================================
// INITIALIZATION
// ===================================================================================
function initializeAppUI() {
    appContainer.classList.remove('hidden');
    landingPage.classList.add('hidden');
    updateAppUI();
    
    // Default to 'home' view if the active one is invalid or auth-related
    if (activeView === 'pin-entry') activeView = 'home';
    showView(activeView);

    // Render initial page content
    if(currentUser.role === ROLES.OWNER || currentUser.role === ROLES.MANAGER) {
      renderAdminUsersList();
    }
    renderHomePage();
    renderCalendar();
    renderAvailability();
}

function initEventListeners() {
    // Sidebar Navigation
    document.querySelector('#sidebar-nav nav').addEventListener('click', e => {
        const navBtn = e.target.closest('.nav-btn');
        if (!navBtn || !navBtn.id) return;
        const viewName = navBtn.id.replace('nav-', '');
        showView(viewName);
    });

    // Auth Actions
    document.getElementById('pin-login-form').addEventListener('submit', handlePinLogin);
    document.getElementById('pin-cancel-btn').addEventListener('click', () => renderLandingPage());
    document.getElementById('sign-out-btn').addEventListener('click', handleSignOut);
    
    // Admin Tabs
    document.querySelector('.admin-tabs').addEventListener('click', (e) => {
        if(e.target.tagName !== 'BUTTON') return;
        const targetTab = e.target.dataset.tab;
        document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        document.querySelectorAll('.admin-tab-content > div').forEach(content => {
            content.classList.toggle('hidden', content.id !== `admin-tab-${targetTab}`);
        });
    });

    // Forms
    document.getElementById('admin-create-account-form').addEventListener('submit', handleCreateAccount);
}

async function startApp() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/users`);
        staffMembers = await response.json();
    } catch (error) {
        console.error("Failed to fetch staff data:", error);
        showToast('Cannot connect to the server.', 'error');
    }

    const savedToken = localStorage.getItem('authToken');
    const savedUser = JSON.parse(localStorage.getItem('currentUser'));

    if (savedToken && savedUser) {
        authToken = savedToken;
        currentUser = savedUser;
        initializeAppUI();
    } else {
        renderLandingPage();
    }

    initEventListeners();
}

document.addEventListener('DOMContentLoaded', startApp);
