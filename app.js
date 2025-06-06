// app.js - V3.0 - Stremio Inspired Redesign
console.log("app.js loaded");

// ===================================================================================
// STATE MANAGEMENT & CONFIG
// ===================================================================================
const BACKEND_URL = 'https://staff-rota-backend.onrender.com';
const ROLES = { OWNER: 'Owner', MANAGER: 'Manager' };

let state = {
    staffMembers: [],
    authToken: null,
    currentUser: null,
    rota: {},
    activeView: 'calendar',
    activeDetailId: null, // For tracking selected item in list (e.g., shiftId or userId)
};

// ===================================================================================
// DOM & UTILS
// ===================================================================================
const landingPage = document.getElementById('landing-page');
const appContainer = document.getElementById('app-container');
const sidebarNav = document.getElementById('sidebar-nav');
const mainAppContent = document.getElementById('main-app-content');
const templates = document.getElementById('view-templates');
// Other utils like formatDate, calculateHours remain the same...

function formatDate(date, options = { year: 'numeric', month: '2-digit', day: '2-digit' }) { return date.toLocaleDateString('en-CA', options); }
function showToast(message, type = 'info') { /* no changes */ }
function showModal(title, body, confirmCallback) { /* no changes */ }

// ===================================================================================
// MOCK DATA GENERATION
// ===================================================================================
function generateInitialMockData() {
    const rota = {};
    const startDate = new Date('2025-05-01');
    const endDate = new Date('2025-06-30');
    const foh = state.staffMembers.filter(s => s.role === 'FOH');
    const boh = state.staffMembers.filter(s => s.role === 'BOH');
    const supervisors = state.staffMembers.filter(s => s.role === 'Supervisor');
    const managers = state.staffMembers.filter(s => s.role === 'Manager');

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDate(d);
        const dayOfWeek = d.getDay();
        rota[dateStr] = [];

        if (dayOfWeek > 0 && dayOfWeek < 6) { // Weekdays
            if (managers[0]) rota[dateStr].push({ userId: managers[0].id, time: '09:00-17:00' });
            if (supervisors[0]) rota[dateStr].push({ userId: supervisors[0].id, time: '10:00-18:00' });
        }
        const staffCount = (dayOfWeek === 5 || dayOfWeek === 6) ? 5 : 3;
        for (let i = 0; i < staffCount; i++) {
            if (foh[i]) rota[dateStr].push({ userId: foh[i].id, time: i % 2 === 0 ? '11:00-19:00' : '15:00-23:00' });
            if (boh[i]) rota[dateStr].push({ userId: boh[i].id, time: i % 2 === 0 ? '10:00-18:00' : '14:00-22:00' });
        }
    }
    state.rota = rota;
}


// ===================================================================================
// CORE APP LOGIC (Auth, Initialization)
// ===================================================================================
async function appInit() {
    // Show landing page by default
    landingPage.classList.add('visible');
    appContainer.classList.add('hidden');
    
    await fetchAllUsers(false); // Fetch public info
    renderLandingPage();

    sidebarNav.addEventListener('click', (e) => {
        const navBtn = e.target.closest('.nav-btn');
        if (!navBtn) return;

        const view = navBtn.dataset.view;
        if (view) {
            state.activeView = view;
            state.activeDetailId = null;
            renderView();
        } else if (navBtn.id === 'nav-sign-out') {
            handleSignOut();
        }
    });
}

function handleSignOut() {
    state = { ...state, authToken: null, currentUser: null };
    localStorage.removeItem('authToken');
    landingPage.classList.remove('hidden');
    landingPage.classList.add('visible');
    appContainer.classList.add('hidden');
    mainAppContent.innerHTML = '';
}

async function handlePinLogin(e) {
    e.preventDefault();
    const pin = document.getElementById('pin-input').value;
    const userId = e.target.dataset.userid;
    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, pin })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        state.authToken = data.token;
        state.currentUser = data.user;
        localStorage.setItem('authToken', state.authToken);
        
        await fetchAllUsers(true);
        generateInitialMockData();
        
        document.getElementById('pin-entry-view')?.remove();
        landingPage.classList.add('hidden');
        landingPage.classList.remove('visible');
        appContainer.classList.remove('hidden');

        renderSidebar();
        renderView(); // Render the default view after login

    } catch (error) { 
        showToast(error.message || 'Login failed.', 'error'); 
        document.getElementById('pin-input').value = '';
    }
}

async function fetchAllUsers(isFull) {
    const url = `${BACKEND_URL}/api/users${isFull ? '?full=true' : ''}`;
    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${state.authToken || ''}` } });
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        state.staffMembers = await res.json();
    } catch (error) { console.error("Failed to fetch users:", error); state.staffMembers = []; }
}

// ===================================================================================
// RENDERING ENGINE
// ===================================================================================
function renderView() {
    renderSidebar(); // Always re-render sidebar to update active state
    mainAppContent.innerHTML = ''; // Clear main content

    const viewConfig = {
        home: { type: 'full', content: 'home-view-content' },
        calendar: { type: 'two-column', list: 'calendar-list-content' },
        admin: { type: 'two-column', list: 'staff-list-content' },
        dashboard: {type: 'full', content: 'dashboard-view-content' },
        settings: {type: 'full', content: 'my-settings-view-content' },
        // ... add other views here
    };

    const config = viewConfig[state.activeView] || { type: 'full', content: 'placeholder-content-wip' };

    let wrapper;
    if (config.type === 'full') {
        wrapper = templates.content.getElementById('full-width-wrapper').cloneNode(true);
        const mainArea = wrapper.querySelector('#main-content-area');
        const contentTemplate = templates.content.getElementById(config.content).cloneNode(true);
        mainArea.appendChild(contentTemplate);
        
        if (state.activeView === 'home') renderHomePage(mainArea);
        if (state.activeView === 'dashboard') renderDashboard(mainArea);
        
    } else if (config.type === 'two-column') {
        wrapper = templates.content.getElementById('two-column-wrapper').cloneNode(true);
        const listColumn = wrapper.querySelector('#content-list-column');
        const detailArea = wrapper.querySelector('#main-content-area');
        
        const listTemplate = templates.content.getElementById(config.list).cloneNode(true);
        listColumn.appendChild(listTemplate);

        if (state.activeView === 'calendar') renderCalendarList(listColumn);
        if (state.activeView === 'admin') renderStaffList(listColumn);
        
        // Render detail view or placeholder
        const detailTemplateId = state.activeDetailId ? (state.activeView === 'calendar' ? 'shift-details-content' : 'admin-staff-details-content') : 'details-view-placeholder';
        const detailTemplate = templates.content.getElementById(detailTemplateId).cloneNode(true);
        detailArea.appendChild(detailTemplate);
        
        if (state.activeDetailId) {
            if (state.activeView === 'calendar') renderShiftDetails(detailArea, state.activeDetailId);
            if (state.activeView === 'admin') renderStaffDetails(detailArea, state.activeDetailId);
        }
    }
    mainAppContent.appendChild(wrapper);
}

function renderSidebar() {
    sidebarNav.innerHTML = '';
    const isAdmin = state.currentUser && (state.currentUser.role === ROLES.OWNER || state.currentUser.role === ROLES.MANAGER);
    const navItems = [
        { view: 'home', icon: '<svg.../></svg>', label: 'Home'}, // SVGs are large, omitting for brevity
        { view: 'calendar', icon: '<svg.../></svg>', label: 'Rota'},
        { view: 'dashboard', icon: '<svg.../></svg>', label: 'Dashboard', admin: true},
        { view: 'admin', icon: '<svg.../></svg>', label: 'Admin', admin: true},
        { view: 'settings', icon: '<svg.../></svg>', label: 'Settings'},
    ];

    navItems.forEach(item => {
        if (item.admin && !isAdmin) return;
        const btn = document.createElement('button');
        btn.className = 'nav-btn';
        if (state.activeView === item.view) btn.classList.add('active');
        btn.dataset.view = item.view;
        // In full code, use item.icon. Here's a placeholder:
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:24px;height:24px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>${item.label}</span>`;
        sidebarNav.appendChild(btn);
    });

    const signOutBtn = document.createElement('button');
    signOutBtn.className = 'nav-btn';
    signOutBtn.id = 'nav-sign-out';
    signOutBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:24px;height:24px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg><span>Sign Out</span>`;
    sidebarNav.appendChild(signOutBtn);
}

function renderLandingPage() {
    const iconsContainer = document.getElementById('staff-icons-container');
    iconsContainer.innerHTML = '';
    if(state.staffMembers.length > 0) {
        state.staffMembers.forEach(member => {
            const iconDiv = document.createElement('div');
            iconDiv.className = 'staff-icon';
            iconDiv.addEventListener('click', () => openPinEntryScreen(member));
            iconDiv.innerHTML = `<span class="icon-placeholder">${member.icon}</span><span class="staff-name">${member.name}</span>`;
            iconsContainer.appendChild(iconDiv);
        });
    } else {
        document.getElementById('landing-page-message').textContent = 'Could not load staff profiles.';
    }
}

function openPinEntryScreen(member) {
    const existing = document.getElementById('pin-entry-view');
    if (existing) existing.remove();
    
    const template = templates.content.getElementById('pin-entry-view').cloneNode(true);
    template.querySelector('#pin-login-user-display').textContent = member.name;
    const form = template.querySelector('#pin-login-form');
    form.dataset.userid = member.id;
    form.addEventListener('submit', handlePinLogin);
    template.querySelector('#pin-cancel-btn').addEventListener('click', () => template.remove());
    
    document.body.appendChild(template);
    template.querySelector('#pin-input').focus();
}

function renderCalendarList(container) {
    const listItems = container.querySelector('#calendar-list-items');
    listItems.innerHTML = '';

    const sortedDates = Object.keys(state.rota).sort();
    
    sortedDates.forEach(dateStr => {
        const shifts = state.rota[dateStr];
        if (shifts.length === 0) return;

        const dayGroup = document.createElement('div');
        dayGroup.className = 'day-group';

        const title = document.createElement('h3');
        title.textContent = new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' });
        dayGroup.appendChild(title);
        
        const shiftList = document.createElement('ul');
        shifts.forEach((shift, index) => {
            const staff = state.staffMembers.find(s => s.id === shift.userId);
            if (!staff) return;

            const shiftId = `${dateStr}-${index}`;
            const li = document.createElement('li');
            li.className = 'shift-card';
            li.dataset.shiftid = shiftId;
            if (shiftId === state.activeDetailId) li.classList.add('active');

            li.innerHTML = `
                <div class="shift-card-role">${staff.icon}</div>
                <div class="shift-card-details">
                    <strong>${staff.name}</strong>
                    <span>${shift.time}</span>
                </div>
            `;
            shiftList.appendChild(li);
        });
        dayGroup.appendChild(shiftList);
        listItems.appendChild(dayGroup);
    });
    
    listItems.addEventListener('click', e => {
        const card = e.target.closest('.shift-card');
        if(card) {
            state.activeDetailId = card.dataset.shiftid;
            renderView(); // Re-render the whole view to update detail pane
        }
    });
}

function renderShiftDetails(container, shiftId) {
    const [dateStr, shiftIndex] = shiftId.split('-');
    const shift = state.rota[dateStr]?.[shiftIndex];
    if(!shift) return;
    const staff = state.staffMembers.find(s => s.id === shift.userId);

    container.querySelector('#detail-shift-date').textContent = new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' });
    container.querySelector('#detail-shift-time').textContent = shift.time;
    container.querySelector('#detail-shift-user-icon').textContent = staff.icon;
    container.querySelector('#detail-shift-user-name').textContent = staff.name;
}

// Stubs for other render functions
function renderStaffList(container) { /* Renders staff into .staff-card elements */ }
function renderStaffDetails(container, userId) { /* Renders user form */ }
function renderHomePage(container) { /* Renders dashboard widgets */ }
function renderDashboard(container) { /* Renders dashboard widgets */ }


// ===================================================================================
// APP ENTRY POINT
// ===================================================================================
document.addEventListener('DOMContentLoaded', appInit);
