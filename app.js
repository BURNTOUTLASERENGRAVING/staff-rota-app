// app.js - V2.1 with Feature Implementation
console.log("app.js loaded");

// ===================================================================================
// CONFIGURATION & STATE
// =================================================S==================================
const BACKEND_URL = 'https://staff-rota-backend.onrender.com';
const ROLES = { OWNER: 'Owner', MANAGER: 'Manager' };

// --- App State ---
let staffMembers = [];
let authToken = null;
let currentUser = null;
let staffMemberToLogin = null;
let activeView = 'home';
let currentDate = new Date(); // For the main calendar
let availabilityWeekStartDate = getStartOfWeek(new Date()); // For the availability view

// --- Mock Data ---
let staffAvailability = {}; // { userId: { 'YYYY-MM-DD': ['Morning', 'Evening'] } }
let holidayRequests = [
    { id: 1, userId: 'user-foh-003', userName: 'John Doe', type: 'holiday', startDate: '2025-06-23', endDate: '2025-06-25', status: 'pending' },
    { id: 2, userId: 'user-boh-004', userName: 'Jane Smith', type: 'holiday', startDate: '2025-07-01', endDate: '2025-07-01', status: 'approved' }
];
const mockRota = {
  '2025-06-09': { 'user-foh-003': '09:00-17:00', 'user-boh-004': '09:00-17:00', 'user-manager-002': '09:00-17:00' },
  '2025-06-10': { 'user-foh-003': '12:00-20:00' },
  '2025-06-11': { 'user-foh-003': '12:00-20:00' },
  '2025-06-12': { 'user-boh-004': '10:00-18:00', 'user-manager-002': '09:00-17:00' },
  '2025-06-13': { 'user-foh-003': '12:00-20:00', 'user-boh-004': '14:00-22:00' },
};


// ===================================================================================
// DOM SELECTORS
// ===================================================================================
const landingPage = document.getElementById('landing-page');
const appContainer = document.getElementById('app-container');
const toastContainer = document.getElementById('toast-container');
const mainContent = document.getElementById('main-content');

// ===================================================================================
// DATE & TIME UTILS
// ===================================================================================
function getStartOfWeek(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(date.setDate(diff));
}

function formatDate(date, options = { year: 'numeric', month: '2-digit', day: '2-digit' }) {
    return date.toLocaleDateString('en-CA', options); // YYYY-MM-DD format
}

function calculateHours(timeString) {
    if (!timeString || !timeString.includes('-')) return 0;
    const [start, end] = timeString.split('-');
    const startDate = new Date(`1970-01-01T${start}:00`);
    const endDate = new Date(`1970-01-01T${end}:00`);
    let diff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    if (diff < 0) diff += 24; // Handle overnight shifts
    return diff;
}

// ===================================================================================
// UI & VIEW MANAGEMENT
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
    // Re-render content for the newly activated view
    renderActiveViewContent();
}

function updateAppUI() {
    if (!currentUser) return;
    const userInfoFull = document.getElementById('user-info-full');
    const userInfoShort = document.getElementById('user-info-short');
    userInfoFull.textContent = `${currentUser.name} (${currentUser.role})`;
    userInfoShort.textContent = currentUser.name.charAt(0);

    const canAccessAdmin = currentUser.role === ROLES.OWNER || currentUser.role === ROLES.MANAGER;
    document.getElementById('nav-admin')?.classList.toggle('hidden', !canAccessAdmin);
    document.getElementById('nav-dashboard')?.classList.toggle('hidden', !canAccessAdmin);
    
    if (!canAccessAdmin && (activeView === 'admin' || activeView === 'dashboard')) {
        showView('home');
    }
}

function renderActiveViewContent() {
    // This function decides what to re-render when a view is shown.
    switch (activeView) {
        case 'home': renderHomePage(); break;
        case 'calendar': renderCalendar(); break;
        case 'my-availability': renderAvailability(); break;
        case 'holiday-request': renderHolidayRequests(); break;
        case 'shift-swap': renderShiftSwapList(); break;
        case 'admin':
            document.querySelector('.admin-tab-btn.active').click(); // Re-render the active admin tab
            break;
    }
}

// ===================================================================================
// PAGE & COMPONENT RENDERING
// ===================================================================================
function renderLandingPage() {
    landingPage.classList.remove('hidden');
    appContainer.classList.add('hidden');
    // Fetch and render staff icons
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

function renderHomePage() {
    // Who's working today
    const todayStr = formatDate(new Date());
    const rotaToday = mockRota[todayStr] || {};
    const workingList = document.getElementById('whos-working-today');
    workingList.innerHTML = '';
    const staffWorkingIds = Object.keys(rotaToday);
    if(staffWorkingIds.length > 0) {
        staffWorkingIds.forEach(userId => {
            const staff = staffMembers.find(s => s.id === userId);
            if (!staff) return;
            workingList.innerHTML += `<li><div class="shift-role-indicator ${staff.role.toLowerCase()}"></div><span>${staff.name}</span><span class="shift-time">${rotaToday[userId]}</span></li>`;
        });
    } else {
        workingList.innerHTML = '<li class="no-data">No one scheduled today.</li>';
    }
    
    // Message Board
    const messageList = document.getElementById('message-board-list');
    messageList.innerHTML = '';
    mockMessages.forEach(msg => messageList.innerHTML += `<li><strong>${msg.name}:</strong> ${msg.text}</li>`);
    
    // Upcoming Shifts for current user
    const upcomingShiftsList = document.getElementById('your-upcoming-shifts');
    upcomingShiftsList.innerHTML = '<li class="no-data">You have no upcoming shifts.</li>'; // Placeholder
}

function renderCalendar() {
    const calendarGrid = document.querySelector('#calendar-view .calendar-grid');
    const monthYearEl = document.getElementById('calendar-month-year');
    calendarGrid.innerHTML = '';
    
    const displayDate = new Date(currentDate);
    displayDate.setDate(1); // Start with the first day of the month
    monthYearEl.textContent = displayDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    const firstDay = (displayDate.getDay() + 6) % 7; // 0 = Monday
    const daysInMonth = new Date(displayDate.getFullYear(), displayDate.getMonth() + 1, 0).getDate();

    // Previous month's trailing days
    const prevMonthLastDate = new Date(displayDate.getFullYear(), displayDate.getMonth(), 0);
    for (let i = firstDay; i > 0; i--) {
        const day = prevMonthLastDate.getDate() - i + 1;
        calendarGrid.innerHTML += `<div class="calendar-day other-month"><div class="day-number">${day}</div></div>`;
    }
    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = formatDate(new Date(displayDate.getFullYear(), displayDate.getMonth(), i));
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day current-month';
        if (i === new Date().getDate() && displayDate.getMonth() === new Date().getMonth() && displayDate.getFullYear() === new Date().getFullYear()) {
            dayCell.classList.add('today');
        }

        let shiftsHtml = '';
        if(mockRota[dateStr]) {
            shiftsHtml = Object.entries(mockRota[dateStr]).map(([userId, time]) => {
                const staff = staffMembers.find(s => s.id === userId);
                return staff ? `<li class="${staff.role.toLowerCase()}">${staff.name}</li>` : '';
            }).join('');
        }
        dayCell.innerHTML = `<div class="day-number">${i}</div><ul>${shiftsHtml}</ul>`;
        calendarGrid.appendChild(dayCell);
    }
}

function changeCalendarMonth(offset) {
    currentDate.setMonth(currentDate.getMonth() + offset);
    renderCalendar();
}

function renderAvailability() {
    const grid = document.getElementById('availability-grid');
    const weekDisplay = document.getElementById('availability-week-display');
    grid.innerHTML = '';

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const slots = ["Unavailable", "Morning", "Afternoon", "Evening"];
    const tempDate = new Date(availabilityWeekStartDate);

    const endDate = new Date(tempDate);
    endDate.setDate(tempDate.getDate() + 6);
    weekDisplay.textContent = `${tempDate.toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})} – ${endDate.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'})}`;
    
    const userAvail = staffAvailability[currentUser.id] || {};

    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(availabilityWeekStartDate);
        dayDate.setDate(availabilityWeekStartDate.getDate() + i);
        const dateStr = formatDate(dayDate);
        const dayCol = document.createElement('div');
        dayCol.className = 'availability-day-column';
        let slotsHtml = `<h4>${days[i]}<br><small>${dayDate.getDate()}</small></h4>`;
        
        const dayAvailability = userAvail[dateStr] || [];
        const isUnavailable = dayAvailability.includes('Unavailable');

        slots.forEach(slot => {
            const isChecked = dayAvailability.includes(slot);
            const isDisabled = slot !== 'Unavailable' && isUnavailable;
            slotsHtml += `<label class="${isDisabled ? 'disabled' : ''}"><input type="checkbox" data-date="${dateStr}" value="${slot}" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}/> ${slot}</label>`;
        });

        dayCol.innerHTML = slotsHtml;
        grid.appendChild(dayCol);
    }
}

function changeAvailabilityWeek(offset) {
    availabilityWeekStartDate.setDate(availabilityWeekStartDate.getDate() + (offset * 7));
    renderAvailability();
}

function renderHolidayRequests() {
    const list = document.getElementById('user-holiday-request-list');
    list.innerHTML = '';
    const userRequests = holidayRequests.filter(r => r.userId === currentUser.id);

    if (userRequests.length === 0) {
        list.innerHTML = '<li class="no-data">You have no pending or past requests.</li>';
        return;
    }
    userRequests.forEach(r => {
        list.innerHTML += `<li><span>${r.startDate} to ${r.endDate}</span> <span class="status-badge ${r.status}">${r.status}</span></li>`;
    });
}

function renderShiftSwapList() {
    const list = document.getElementById('swap-shift-list');
    list.innerHTML = `<li class="no-data">You have no upcoming shifts to swap.</li>`; // Placeholder
}

function renderAdminView(tabName) {
    document.querySelectorAll('.admin-tab-content > div').forEach(c => c.classList.add('hidden'));
    document.getElementById(`admin-tab-${tabName}`).classList.remove('hidden');

    switch(tabName) {
        case 'staff': renderAdminUsersList(); break;
        case 'rota': renderAdminAvailabilityViewer(); break;
        case 'wages': renderWagesReport(); break;
        case 'holidays': renderAdminHolidays(); break;
    }
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
                    <small style="color: var(--text-secondary);">${user.role} - £${user.wage.toFixed(2)}/hr</small>
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

function renderAdminAvailabilityViewer() {
    const container = document.getElementById('admin-availability-viewer');
    container.innerHTML = `<h4>Weekly Availability for ${availabilityWeekStartDate.toLocaleDateString()}</h4><div id="admin-availability-viewer-grid" class="grid-2-col"></div>`;
    const grid = document.getElementById('admin-availability-viewer-grid');

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    for(let i=0; i<7; i++) {
        const dayDate = new Date(availabilityWeekStartDate);
        dayDate.setDate(availabilityWeekStartDate.getDate() + i);
        const dateStr = formatDate(dayDate);
        let availableStaff = [];
        
        for (const member of staffMembers) {
            const userAvail = staffAvailability[member.id] || {};
            if (userAvail[dateStr] && !userAvail[dateStr].includes('Unavailable')) {
                availableStaff.push(`<li>${member.name} (${userAvail[dateStr].join(', ')})</li>`);
            }
        }
        if (availableStaff.length === 0) {
            availableStaff.push('<li class="no-data">None</li>');
        }
        grid.innerHTML += `<div class="day-col card card-nested"><h5>${days[i]}</h5><ul>${availableStaff.join('')}</ul></div>`;
    }
}

function renderWagesReport() {
    const tableBody = document.querySelector('#wage-report-table tbody');
    tableBody.innerHTML = '';
    let hasData = false;
    staffMembers.forEach(member => {
        if (member.role === 'Owner') return; // Owners typically don't get hourly pay
        
        let totalHours = 0;
        for(let i=0; i<7; i++) {
            const dayDate = new Date(availabilityWeekStartDate);
            dayDate.setDate(availabilityWeekStartDate.getDate() + i);
            const dateStr = formatDate(dayDate);
            if (mockRota[dateStr] && mockRota[dateStr][member.id]) {
                totalHours += calculateHours(mockRota[dateStr][member.id]);
                hasData = true;
            }
        }
        
        const estimatedPay = totalHours * member.wage;
        tableBody.innerHTML += `
            <tr>
                <td>${member.name}</td>
                <td>${totalHours.toFixed(1)} hrs</td>
                <td>£${member.wage.toFixed(2)}</td>
                <td><strong>£${estimatedPay.toFixed(2)}</strong></td>
            </tr>
        `;
    });
    if (!hasData) {
        tableBody.innerHTML = '<tr><td colspan="4" class="no-data">No rota data found for this week.</td></tr>';
    }
}

function renderAdminHolidays() {
    const list = document.getElementById('admin-pending-holidays');
    list.innerHTML = '';
    const pending = holidayRequests.filter(r => r.status === 'pending');
    if (pending.length === 0) {
        list.innerHTML = '<li class="no-data">No pending requests.</li>';
        return;
    }
    pending.forEach(r => {
        list.innerHTML += `
            <li>
                <span><strong>${r.userName}</strong> requests ${r.startDate} to ${r.endDate}</span>
                <div class="holiday-actions">
                    <button class="btn btn-sm btn-primary" data-id="${r.id}" data-action="approve">Approve</button>
                    <button class="btn btn-sm btn-danger" data-id="${r.id}" data-action="deny">Deny</button>
                </div>
            </li>
        `;
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

    if (!name || !gender || !role || wage === '') return showToast('Please fill out all fields.', 'error');
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ name, wage: parseFloat(wage), gender, role })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        showToast(result.message, 'success');
        // Re-fetch all users to get updated list + full details like wage
        await fetchAllUsers(); 
        renderAdminUsersList();
        form.reset();
    } catch (error) {
        showToast(error.message || 'Failed to create account.', 'error');
    }
}

async function handleChangePin(e) {
    e.preventDefault();
    const form = e.target;
    const currentPin = form.querySelector('#current-pin').value;
    const newPin = form.querySelector('#new-pin').value;
    const confirmNewPin = form.querySelector('#confirm-new-pin').value;
    
    if (newPin !== confirmNewPin) return showToast('New PINs do not match.', 'error');
    if (newPin.length < 4) return showToast('PIN must be 4 digits.', 'error');

    try {
        const response = await fetch(`${BACKEND_URL}/api/users/me/pin`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}`},
            body: JSON.stringify({ currentPin, newPin })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        showToast(result.message, 'success');
        form.reset();
    } catch(error) {
        showToast(error.message || 'Failed to update PIN.', 'error');
    }
}


// ===================================================================================
// DATA FETCHING & EVENT HANDLERS
// ===================================================================================
async function fetchAllUsers() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/users?full=true`, {
             headers: { 'Authorization': `Bearer ${authToken || ''}` }
        });
        staffMembers = await response.json();
    } catch (error) {
        console.error("Failed to fetch staff data:", error);
        showToast('Cannot connect to the server.', 'error');
    }
}

function handleAvailabilityChange(e) {
    if (e.target.type !== 'checkbox') return;
    
    const { date, value } = e.target.dataset;
    const isChecked = e.target.checked;
    
    if (!staffAvailability[currentUser.id]) {
        staffAvailability[currentUser.id] = {};
    }
    if (!staffAvailability[currentUser.id][date]) {
        staffAvailability[currentUser.id][date] = [];
    }
    
    const dayAvailability = new Set(staffAvailability[currentUser.id][date]);
    
    if (value === 'Unavailable') {
        if (isChecked) dayAvailability.clear();
        dayAvailability.add('Unavailable');
    } else {
        dayAvailability.delete('Unavailable');
        isChecked ? dayAvailability.add(value) : dayAvailability.delete(value);
    }
    
    staffAvailability[currentUser.id][date] = Array.from(dayAvailability);
    renderAvailability(); // Re-render to handle disable states
}

function handleHolidayRequestSubmit(e) {
    e.preventDefault();
    const form = e.target;
    // ... logic to create and push new holiday request ...
    showToast('Holiday request submitted.', 'success');
    form.reset();
    renderHolidayRequests();
    // In a real app, this would be an API call
}

function handleAdminHolidayActions(e) {
    const target = e.target;
    if (target.tagName !== 'BUTTON') return;
    const { id, action } = target.dataset;
    
    const request = holidayRequests.find(r => r.id == id);
    if (!request) return;
    request.status = action; // 'approve' or 'deny'

    showToast(`Request from ${request.userName} has been ${action}d.`, 'success');
    renderAdminHolidays();
    // In real app, API call here
}

function initEventListeners() {
    // Nav
    document.querySelector('#sidebar-nav').addEventListener('click', e => {
        const navBtn = e.target.closest('.nav-btn');
        if (navBtn && navBtn.id && navBtn.id.startsWith('nav-')) {
            showView(navBtn.id.replace('nav-', ''));
        } else if (navBtn && navBtn.id === 'sign-out-btn') {
            handleSignOut();
        }
    });

    // Calendar Controls
    document.getElementById('calendar-prev-month').addEventListener('click', () => changeCalendarMonth(-1));
    document.getElementById('calendar-next-month').addEventListener('click', () => changeCalendarMonth(1));

    // Availability Controls
    document.getElementById('availability-prev-week').addEventListener('click', () => changeAvailabilityWeek(-1));
    document.getElementById('availability-next-week').addEventListener('click', () => changeAvailabilityWeek(1));
    document.getElementById('availability-grid').addEventListener('change', handleAvailabilityChange);
    
    // Auth
    document.getElementById('pin-login-form').addEventListener('submit', handlePinLogin);
    document.getElementById('pin-cancel-btn').addEventListener('click', () => renderLandingPage());
    
    // Forms
    document.getElementById('admin-create-account-form').addEventListener('submit', handleCreateAccount);
    document.getElementById('change-pin-form').addEventListener('submit', handleChangePin);
    document.getElementById('holiday-request-form').addEventListener('submit', handleHolidayRequestSubmit);

    // Admin Tabs & Actions
    document.querySelector('.admin-tabs').addEventListener('click', e => {
        if(e.target.tagName !== 'BUTTON') return;
        document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        renderAdminView(e.target.dataset.tab);
    });
    document.getElementById('admin-pending-holidays').addEventListener('click', handleAdminHolidayActions);
}

// ===================================================================================
// APP START
// ===================================================================================
async function startApp() {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = JSON.parse(localStorage.getItem('currentUser'));

    if (savedToken && savedUser) {
        authToken = savedToken;
        currentUser = savedUser;
        await fetchAllUsers();
        initializeAppUI();
    } else {
        await fetchAllUsers(); // Fetch public info for landing page
        renderLandingPage();
    }

    initEventListeners();
}

function initializeAppUI() {
    appContainer.classList.remove('hidden');
    landingPage.classList.add('hidden');
    updateAppUI();
    
    if (activeView === 'pin-entry' || !document.getElementById(`${activeView}-view`)) {
        activeView = 'home';
    }
    showView(activeView);
}

document.addEventListener('DOMContentLoaded', startApp);
