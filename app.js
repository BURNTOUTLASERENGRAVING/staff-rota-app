// app.js - Staff Rota & Task Checklist Application (Frontend)
console.log("app.js loaded");

// ===================================================================================
// CONFIGURATION
// ===================================================================================
const BACKEND_URL = 'https://staff-rota-backend.onrender.com'; 

const ROLES = { FOH: 'FOH', BOH: 'BOH', SUPERVISOR: 'Supervisor', MANAGER: 'Manager', OWNER: 'Owner' };

// ===================================================================================
// APPLICATION STATE
// ===================================================================================
let staffMembers = [];
let rota = {}; // Placeholder for future data
let currentUserId = null;
let currentUserName = null;
let currentUserRole = null;
let authToken = null;
let staffMemberToLogin = null; // Holds the user object selected on the landing page

// ===================================================================================
// DOM ELEMENT SELECTORS
// ===================================================================================
const landingPage = document.getElementById('landing-page');
const staffIconsContainer = document.getElementById('staff-icons-container');
const landingPageMessage = document.getElementById('landing-page-message');
const appContainer = document.getElementById('app-container');
const appHeader = document.querySelector('#app-container header');
const pinEntryView = document.getElementById('pin-entry-view');
const pinInput = document.getElementById('pin-input');
const pinLoginForm = document.getElementById('pin-login-form');
const pinLoginUserDisplay = document.getElementById('pin-login-user-display');
const pinCancelBtn = document.getElementById('pin-cancel-btn');
const signOutButton = document.getElementById('sign-out-btn');
const userInfoSpan = document.getElementById('user-info');

// Admin Panel Elements
const adminView = document.getElementById('admin-view');
const accountManagementSection = document.getElementById('account-management-section');
const adminCreateAccountForm = document.getElementById('admin-create-account-form');
const adminNewAccountNameInput = document.getElementById('admin-new-account-name');
const adminNewAccountGenderSelect = document.getElementById('admin-new-account-gender');
const adminNewAccountRoleSelect = document.getElementById('admin-new-account-role');
const userAccountsList = document.getElementById('user-accounts-list');
const adminToggleButton = document.getElementById('admin-toggle-btn');

const toastContainer = document.getElementById('toast-container');

// ===================================================================================
// UTILITY FUNCTIONS
// ===================================================================================
function showToast(message, type = 'info', duration = 3000) {
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

function getStaffMemberById(userId) {
    return staffMembers.find(s => s.id === userId);
}

// ===================================================================================
// UI RENDERING & VIEW MANAGEMENT
// ===================================================================================
function showView(viewId) {
    document.querySelectorAll('main section').forEach(section => {
        section.classList.add('hidden');
    });
    const view = document.getElementById(viewId);
    if (view) {
        view.classList.remove('hidden');
    }
}

function renderLandingPage() {
    appContainer.classList.add('hidden');
    landingPage.classList.remove('hidden');
    staffIconsContainer.innerHTML = '';

    if (staffMembers && staffMembers.length > 0) {
        landingPageMessage.textContent = "Please select your profile to continue:";
        const sortedStaff = [...staffMembers].sort((a, b) => a.name.localeCompare(b.name));
        sortedStaff.forEach(member => {
            const iconDiv = document.createElement('div');
            iconDiv.className = `staff-icon role-${member.role.toLowerCase()}`;
            iconDiv.dataset.id = member.id;
            iconDiv.innerHTML = `<span class="icon-placeholder">${member.icon}</span><div class="staff-name">${member.name}</div><div class="staff-role">${member.role}</div>`;
            iconDiv.addEventListener('click', () => openPinEntryScreen(member.id));
            staffIconsContainer.appendChild(iconDiv);
        });
    } else {
        landingPageMessage.textContent = "Could not load staff profiles.";
        staffIconsContainer.innerHTML = '<p class="no-data">Could not connect to the server. Please check Render.com dashboard for backend status and refresh the page.</p>';
    }
}

function updateHeaderUI() {
    if (authToken && currentUserId) {
        appHeader.classList.remove('hidden');
        userInfoSpan.textContent = `${currentUserName} (${currentUserRole})`;
        adminToggleButton.classList.toggle('hidden', !(currentUserRole === ROLES.OWNER || currentUserRole === ROLES.MANAGER));
    } else {
        appHeader.classList.add('hidden');
    }
}

// ===================================================================================
// AUTHENTICATION & ACCOUNT MANAGEMENT
// ===================================================================================
function openPinEntryScreen(userId) {
    staffMemberToLogin = getStaffMemberById(userId);
    if (!staffMemberToLogin) {
        showToast('Error: User profile not found.', 'error');
        return;
    }
    pinLoginUserDisplay.textContent = staffMemberToLogin.name;
    pinInput.value = '';
    landingPage.classList.add('hidden');
    appContainer.classList.remove('hidden');
    showView('pin-entry-view');
    setTimeout(() => pinInput.focus(), 50);
}

function handleCancelPinEntry() {
    staffMemberToLogin = null;
    pinInput.value = '';
    renderLandingPage(); 
}

async function handlePinLogin(event) {
    event.preventDefault();
    const enteredPin = pinInput.value;
    if (!staffMemberToLogin) {
        showToast('Error: No user selected for login.', 'error');
        return;
    }
    if (!/^\d{4}$/.test(enteredPin)) {
        showToast('PIN must be 4 digits.', 'error');
        pinInput.value = '';
        return;
    }

    try {
        showToast("Verifying PIN...", "info", 2000);
        const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: staffMemberToLogin.id, pin: enteredPin })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Login failed.');
        }
        
        authToken = data.token;
        currentUserId = data.user.id;
        currentUserName = data.user.name;
        currentUserRole = data.user.role;

        localStorage.setItem('authToken', authToken);
        localStorage.setItem('loggedInUser', JSON.stringify(data.user));

        showToast(`Welcome, ${currentUserName}!`, 'success');
        initializeAppUI();

    } catch (error) {
        showToast(error.message, 'error');
        pinInput.value = '';
        pinInput.focus();
    }
}

function handleSignOut() {
    const name = currentUserName;
    authToken = null;
    currentUserId = null;
    currentUserName = null;
    currentUserRole = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('loggedInUser');
    
    updateHeaderUI();
    renderLandingPage();
    showToast(`Goodbye, ${name}!`, 'info');
}

async function handleAdminCreateAccountSubmit(event) {
    event.preventDefault();
    if (!authToken) {
        showToast('Authentication error. Please log in again.', 'error');
        return;
    }

    const name = adminNewAccountNameInput.value.trim();
    const gender = adminNewAccountGenderSelect.value;
    const role = adminNewAccountRoleSelect.value;

    if (!name || !gender || !role) {
        showToast('Please fill out all fields to create an account.', 'warning');
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ name, gender, role })
        });

        const result = await response.json();

        if (!response.ok) { throw new Error(result.message || 'Failed to create account.'); }

        showToast(result.message, 'success');
        adminCreateAccountForm.reset();

        staffMembers.push(result.user);
        renderUserAccountsList();

    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

function renderUserAccountsList() {
    if (!userAccountsList) return;
    userAccountsList.innerHTML = ''; 

    if (!(currentUserRole === ROLES.OWNER)) {
        accountManagementSection.classList.add('hidden');
        return;
    }
    accountManagementSection.classList.remove('hidden');

    if (staffMembers.length === 0) {
        userAccountsList.innerHTML = `<li class="no-data">No accounts to display.</li>`;
        return;
    }
    
    const sortedStaff = [...staffMembers].sort((a, b) => a.name.localeCompare(b.name));

    sortedStaff.forEach(user => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="user-details">
                <span class="icon-placeholder">${user.icon}</span>
                <span><strong>${user.name}</strong> (${user.role})</span>
            </div>
            <div class="user-actions">
                <button class="reset-pin-btn" data-id="${user.id}">Reset PIN</button>
                <button class="edit-btn" data-id="${user.id}">Edit</button>
                ${user.role !== ROLES.OWNER ? `<button class="delete-btn" data-type="account" data-id="${user.id}">Delete</button>` : ''}
            </div>
        `;
        userAccountsList.appendChild(li);
    });
}

// ===================================================================================
// APPLICATION INITIALIZATION
// ===================================================================================
function initializeAppUI() {
    appContainer.classList.remove('hidden');
    landingPage.classList.add('hidden');
    updateHeaderUI();
    showView('home-view');
    
    if (currentUserRole === ROLES.OWNER) {
        renderUserAccountsList();
    }
}

async function startApp() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/users`);
        if (!response.ok) {
             const errorText = await response.text();
             console.error('Fetch error response:', errorText);
             throw new Error('Could not fetch staff list from server.');
        }
        staffMembers = await response.json();
    } catch (error) {
        console.error("Failed to fetch initial staff data:", error);
        staffMembers = [];
        showToast(error.message, 'error', 5000);
    }

    const savedToken = localStorage.getItem('authToken');
    const savedUser = JSON.parse(localStorage.getItem('loggedInUser'));

    if (savedToken && savedUser) {
        authToken = savedToken;
        currentUserId = savedUser.id;
        currentUserName = savedUser.name;
        currentUserRole = savedUser.role;
        showToast(`Welcome back, ${currentUserName}!`, 'info');
        initializeAppUI();
    } else {
        renderLandingPage();
    }

    initAppEventListeners();
}

function initAppEventListeners() {
    pinLoginForm.addEventListener('submit', handlePinLogin);
    pinCancelBtn.addEventListener('click', handleCancelPinEntry);
    signOutButton.addEventListener('click', handleSignOut);
    adminCreateAccountForm.addEventListener('submit', handleAdminCreateAccountSubmit);
    adminToggleButton.addEventListener('click', () => {
        const adminPanelVisible = !adminView.classList.contains('hidden');
        if (adminPanelVisible) {
            showView('home-view');
        } else {
            showView('admin-view');
        }
    });
}

document.addEventListener('DOMContentLoaded', startApp);
