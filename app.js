// app.js - V2.1 with Backend Data Fetching
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
// DOM ELEMENT SELECTORS
// ===================================================================================
const landingPage = document.getElementById('landing-page');
const appContainer = document.getElementById('app-container');
const toastContainer = document.getElementById('toast-container');
const mainContent = document.getElementById('main-content');

// ===================================================================================
// UTILITY & API FUNCTIONS
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

// Helper for fetching data from protected API routes
async function fetchApiData(endpoint) {
    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (!response.ok) {
        if (response.status === 403 || response.status === 401) handleSignOut(); // Auto-sign-out on auth error
        throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
}

function showView(viewName) {
    activeView = viewName;
    mainContent.querySelectorAll('section').forEach(view => view.classList.add('hidden'));
    const viewToShow = document.getElementById(`${viewName}-view`);
    viewToShow?.classList.remove('hidden');

    document.querySelectorAll('#sidebar-nav .nav-btn').forEach(button => {
        button.classList.toggle('active', button.id === `nav-${viewName}`);
    });

    // Re-render content if the view is data-driven
    if (viewName === 'home') renderHomePage();
    if (viewName === 'calendar') renderCalendar();
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
    
    const isAdminView = activeView === 'admin' || activeView === 'dashboard';
    if (!canAccessAdmin && isAdminView) showView('home');
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
    userList.innerHTML = '<li>Loading...</li>';
    staffMembers.sort((a,b) => a.name.localeCompare(b.name)).forEach( (user, index) => {
        if (index === 0) userList.innerHTML = ''; // Clear after first iteration
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

async function renderHomePage() {
    const workingList = document.getElementById('whos-working-today');
    const taskList = document.getElementById('your-tasks-today');
    const messageList = document.getElementById('message-board-list');

    // Set loading state
    workingList.innerHTML = '<li>Loading...</li>';
    taskList.innerHTML = '<li>Loading...</li>';
    messageList.innerHTML = '<li>Loading...</li>';

    try {
        const data = await fetchApiData('/api/home/widgets');
        
        workingList.innerHTML = '';
        if (data.whoIsWorking && data.whoIsWorking.length > 0) {
            data.whoIsWorking.forEach(staff => {
                const li = document.createElement('li');
                li.innerHTML = `<div class="shift-role-indicator ${staff.role.toLowerCase()}"></div><span>${staff.name}</span><span class="shift-time">${staff.shift}</span>`;
                workingList.appendChild(li);
            });
        } else {
            workingList.innerHTML = '<li>No one scheduled today.</li>';
        }

        taskList.innerHTML = data.tasks.map(task => `<li>${task}</li>`).join('');
        messageList.innerHTML = data.messages.map(msg => `<li><strong>${msg.name}:</strong> ${msg.text}</li>`).join('');

    } catch (error) {
        console.error("Failed to load home page data:", error);
        showToast("Could not load dashboard data.", "error");
        workingList.innerHTML = '<li>Error loading data.</li>';
        taskList.innerHTML = '<li>Error loading data.</li>';
        messageList.innerHTML = '<li>Error loading data.</li>';
    }
}

async function renderCalendar() {
  const calendarGrid = document.querySelector('#calendar-view .calendar-grid');
  calendarGrid.innerHTML = '<div class="calendar-day">Loading...</div>';
  
  try {
    const mockRota = await fetchApiData('/api/rota'); // Using mockRota as name for consistency

    // This is a placeholder logic for demonstration
    calendarGrid.innerHTML = ''; // Clear loading
    for(let i = 1; i <= 30; i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day current-month';
        let shiftsHtml = '';

        if (i === 9) { // This part remains hardcoded as example UI
            shiftsHtml = '<li class="manager">Lyndsey</li><li class="foh">John Doe</li><li class="boh">Jane Smith</li>';
        } else if (i === 10) {
            shiftsHtml = '<li class="foh">John Doe</li>';
        }

        dayCell.innerHTML = `<div class="day-number">${i}</div><ul>${shiftsHtml}</ul>`;
        calendarGrid.appendChild(dayCell);
    }
  } catch (error) {
      console.error("Failed to load calendar data:", error);
      calendarGrid.innerHTML = '<div class="calendar-day">Error loading rota.</div>';
  }
}

function renderAvailability() {
    // This function can remain as-is as it generates a static form structure
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
    
    if (activeView === 'pin-entry') activeView = 'home';
    showView(activeView);

    if(currentUser.role === ROLES.OWNER || currentUser.role === ROLES.MANAGER) {
      renderAdminUsersList();
    }
    renderAvailability(); // Static render
}

function initEventListeners() {
    document.querySelector('#sidebar-nav nav').addEventListener('click', e => {
        const navBtn = e.target.closest('.nav-btn');
        if (navBtn && navBtn.id) showView(navBtn.id.replace('nav-', ''));
    });
    document.getElementById('pin-login-form').addEventListener('submit', handlePinLogin);
    document.getElementById('pin-cancel-btn').addEventListener('click', () => renderLandingPage());
    document.getElementById('sign-out-btn').addEventListener('click', handleSignOut);
    
    document.querySelector('.admin-tabs').addEventListener('click', (e) => {
        if(e.target.tagName !== 'BUTTON') return;
        const targetTab = e.target.dataset.tab;
        document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        document.querySelectorAll('.admin-tab-content > div').forEach(content => {
            content.classList.toggle('hidden', content.id !== `admin-tab-${targetTab}`);
        });
    });
    document.getElementById('admin-create-account-form').addEventListener('submit', handleCreateAccount);
}

async function startApp() {
    // Initial fetch for staff members for the landing page is public
    try {
        const response = await fetch(`${BACKEND_URL}/api/users`);
        if (!response.ok) throw new Error('Server not available');
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
