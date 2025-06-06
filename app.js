// app.js - V1 Clean & Simple
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
let activeView = 'home-view';

// ===================================================================================
// DOM ELEMENT SELECTORS
// ===================================================================================
const landingPage = document.getElementById('landing-page');
const staffIconsContainer = document.getElementById('staff-icons-container');
const appContainer = document.getElementById('app-container');
const header = document.querySelector('header');
const pinEntryView = document.getElementById('pin-entry-view');
const mainViews = document.querySelectorAll('main > section');
const toastContainer = document.getElementById('toast-container');
const adminView = document.getElementById('admin-view');

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
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, duration);
    }, 10);
}

function showView(viewId) {
    activeView = viewId;
    mainViews.forEach(view => view.classList.toggle('hidden', view.id !== viewId));
    document.querySelectorAll('nav button').forEach(button => {
        button.classList.remove('active');
        if (button.id === `nav-${viewId.replace('-view', '')}`) {
            button.classList.add('active');
        }
    });
}

function updateHeader() {
    if (!header) return;
    const userInfoSpan = document.getElementById('user-info');
    const adminBtn = document.getElementById('admin-toggle-btn');
    const dashboardNav = document.getElementById('nav-dashboard');

    const canAccessAdmin = currentUser && (currentUser.role === ROLES.OWNER || currentUser.role === ROLES.MANAGER);
    adminBtn.classList.toggle('hidden', !canAccessAdmin);
    dashboardNav.classList.toggle('hidden', !canAccessAdmin);

    userInfoSpan.textContent = currentUser ? `${currentUser.name} (${currentUser.role})` : '';
}

// ===================================================================================
// DATA RENDERING
// ===================================================================================
function renderLandingPage() {
    appContainer.classList.add('hidden');
    landingPage.classList.remove('hidden');
    staffIconsContainer.innerHTML = '';
    
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
        staffIconsContainer.appendChild(iconDiv);
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
                    <small style="color: var(--text-light);">${user.role}</small>
                </span>
            </div>
            <div class="user-actions">
                <button class="btn btn-secondary">Reset PIN</button>
                <button class="btn btn-secondary">Edit</button>
                ${currentUser.id !== user.id ? '<button class="btn btn-danger">Delete</button>' : ''}
            </div>
        `;
        userList.appendChild(li);
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
    showView('pin-entry-view');
    setTimeout(() => document.getElementById('pin-input').focus(), 50);
}

function handleSignOut() {
    showToast(`Goodbye, ${currentUser.name}!`, 'info');
    authToken = null;
    currentUser = null;
    localStorage.clear();
    header.classList.add('hidden');
    renderLandingPage();
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
    } catch (error) {
        showToast(error.message || 'Login failed.', 'error');
    }
}

async function handleCreateAccount(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.querySelector('#admin-new-account-name').value;
    const wage = form.querySelector('#admin-new-account-wage').value;
    const gender = form.querySelector('#admin-new-account-gender').value;
    const role = form.querySelector('#admin-new-account-role').value;

    if (!name || !gender || !role || !wage) {
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
// INITIALIZATION & EVENT LISTENERS
// ===================================================================================
function initializeAppUI() {
    appContainer.classList.remove('hidden');
    landingPage.classList.add('hidden');
    header.classList.remove('hidden');
    updateHeader();
    showView(activeView);
    if(currentUser.role === ROLES.OWNER) renderAdminUsersList();
    document.getElementById('account-management-section').classList.toggle('hidden', currentUser.role !== ROLES.OWNER);
}

function initEventListeners() {
    // Nav Buttons
    document.querySelector('nav').addEventListener('click', e => {
        if(e.target.tagName !== 'BUTTON') return;
        const targetViewId = `${e.target.id.replace('nav-','')}-view`;
        showView(targetViewId);
    });

    document.getElementById('admin-toggle-btn').addEventListener('click', () => {
        const currentlyAdmin = activeView === 'admin-view';
        showView(currentlyAdmin ? 'home-view' : 'admin-view');
    });

    // Auth
    document.getElementById('pin-login-form').addEventListener('submit', handlePinLogin);
    document.getElementById('pin-cancel-btn').addEventListener('click', renderLandingPage);
    document.getElementById('sign-out-btn').addEventListener('click', handleSignOut);

    // Admin
    document.getElementById('admin-create-account-form').addEventListener('submit', handleCreateAccount);
}

async function startApp() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/users`);
        staffMembers = await response.json();
    } catch (error) {
        console.error("Failed to fetch staff data:", error);
        staffMembers = [];
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
