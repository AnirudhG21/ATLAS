const API_URL = 'http://localhost:8000';
let token = localStorage.getItem('token');
let username = localStorage.getItem('username');
let localTasks = [];

// DOM Elements
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const sidebar = document.getElementById('sidebar');
const profileIcon = document.getElementById('profile-icon');
const dateDisplay = document.getElementById('date-display');
const taskList = document.getElementById('task-list');
const trashList = document.getElementById('trash-list');
const modal = document.getElementById('task-modal');
const modalTitle = document.querySelector('#task-modal h3');
const modalBtn = document.querySelector('#task-modal button[type="submit"]');
let editingTaskId = null;
const views = {
    dashboard: document.getElementById('view-dashboard'),
    trash: document.getElementById('view-trash'),
    settings: document.getElementById('view-settings')
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    // Profile Click
    const profileContainer = document.querySelector('.profile-container');
    profileContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        profileContainer.classList.toggle('active');
    });

    // Close Interaction
    window.addEventListener('click', () => {
        profileContainer.classList.remove('active');
    });

    // Theme
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('theme-toggle').checked = true;
    }

    // Sidebar
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }

    const today = new Date();
    dateDisplay.textContent = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    if (token) {
        initSession();
    }
});

function initSession() {
    authSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    if (username) {
        profileIcon.textContent = username.charAt(0).toUpperCase();
        // Prefill settings
        const userEmail = localStorage.getItem('email') || '';
        document.getElementById('settings-username').value = username;
        document.getElementById('settings-email').value = userEmail;
    }
    fetchTasks();
    fetchStats();
    fetchHistory();
    updateGreeting();
}

function updateGreeting() {
    const hours = new Date().getHours();
    const greetingEl = document.getElementById('greeting');
    let greeting = 'Good Morning';
    if (hours >= 12) greeting = 'Good Afternoon';
    if (hours >= 17) greeting = 'Good Evening';
    greetingEl.textContent = `${greeting}, ${username || 'User'}`;
}

// Navigation & Views
function switchView(viewName) {
    Object.values(views).forEach(el => el.classList.add('hidden'));
    views[viewName].classList.remove('hidden');

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    // Simple match for now
    if (viewName === 'dashboard') document.querySelector('.nav-item').classList.add('active'); // 1st match

    if (viewName === 'trash') fetchTrash();
    // if (viewName === 'dashboard') { fetchTasks(); fetchStats(); } // Already handled in Init/Switch
    if (viewName === 'dashboard') {
        fetchTasks();
        fetchStats();
        fetchHistory();
    }
}

function toggleSidebar() {
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
}

function toggleTheme(isDark) {
    if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    }
}

// Chart Instance
let historyChartInstance = null;

// Stats API
async function fetchStats() {
    try {
        const res = await fetch(`${API_URL}/stats/counts`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        document.getElementById('count-pending').textContent = data.pending;
        document.getElementById('count-started').textContent = data.started;
        document.getElementById('count-inprogress').textContent = data.in_progress;
        document.getElementById('count-completed').textContent = data.completed;
    } catch (err) { console.error('Stats fetch failed', err); }
}

async function fetchHistory() {
    try {
        const res = await fetch(`${API_URL}/stats/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const historyData = await res.json();
        renderChart(historyData);
    } catch (err) { showToast('Failed to load history', 'error'); }
}

function renderChart(data) {
    const ctx = document.getElementById('historyChart').getContext('2d');

    // Sort by date just in case
    data.sort((a, b) => new Date(a.date) - new Date(b.date));

    const labels = data.map(d => new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const percentages = data.map(d => d.percentage);

    if (historyChartInstance) {
        historyChartInstance.destroy();
    }

    // Detect theme color
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
    const textColor = isDark ? '#f5f5f7' : '#1d1d1f';

    historyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Task Completion %',
                data: percentages,
                borderColor: '#007aff',
                backgroundColor: 'rgba(0, 122, 255, 0.1)',
                borderWidth: 3,
                tension: 0.3,
                fill: true,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#007aff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: gridColor,
                        borderDash: [5, 5]
                    },
                    ticks: {
                        color: textColor,
                        callback: function (value) { return value + '%' }
                    },
                    title: {
                        display: true,
                        text: 'Percentage Completed',
                        color: textColor
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const d = data[context.dataIndex];
                            return `${d.percentage}% (${d.completed}/${d.total} tasks)`;
                        }
                    }
                }
            }
        }
    });
}

function downloadGraph() {
    const link = document.createElement('a');
    link.download = 'atlas-history.png';
    link.href = document.getElementById('historyChart').toDataURL();
    link.click();
}

// History form removed


// Task API
async function fetchTasks() {
    try {
        const res = await fetch(`${API_URL}/tasks/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401) return logout();
        const tasks = await res.json();
        localTasks = tasks;
        renderTasks(tasks, taskList, false);
    } catch (err) {
        showToast('Failed to load tasks', 'error');
    }
}
// ... rest of fetchTrash and renderTasks

async function fetchTrash() {
    try {
        const res = await fetch(`${API_URL}/tasks/trash`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const tasks = await res.json();
        renderTasks(tasks, trashList, true);
    } catch (err) {
        showToast('Failed to load trash', 'error');
    }
}

function renderTasks(tasks, container, isTrash) {
    container.innerHTML = '';
    if (tasks.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; grid-column:1/-1;">No tasks found.</p>';
        return;
    }

    tasks.forEach(task => {
        const div = document.createElement('div');
        div.className = 'task-card';
        const status = task.status || 'Pending';
        const statusClass = getStatusClass(status);

        let footerContent = '';
        if (isTrash) {
            footerContent = `
                <button onclick="restoreTask(${task.id}, event)" class="restore-btn" title="Restore">
                     ♻ Restore
                </button>
                <button onclick="deleteTaskPermanent(${task.id}, event)" class="permanent-delete-btn" title="Delete Forever">
                     ✕ Delete Forever
                </button>
            `;
        } else {
            footerContent = `
                <select class="status-select ${statusClass}" onchange="updateTaskStatus(${task.id}, this, event)" onclick="event.stopPropagation()">
                    <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Started" ${status === 'Started' ? 'selected' : ''}>Started</option>
                    <option value="In Progress" ${status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Completed" ${status === 'Completed' ? 'selected' : ''}>Completed</option>
                </select>
            `;
        }

        // Click to Open Modal for Description/Edit
        div.onclick = () => openModal(task);

        div.innerHTML = `
            <div class="task-header">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <h3>${task.title}</h3>
                    <span class="priority-badge ${task.priority}">${task.priority}</span>
                </div>
                ${!isTrash ? `<button class="delete-btn" onclick="deleteTask(${task.id}, event)">&times;</button>` : ''}
            </div>
            <!-- Body hidden, shown in modal -->
            <div class="task-footer" style="justify-content: ${isTrash ? 'flex-end' : 'flex-end'}; margin-top: auto; padding-top: 1rem;">
                ${footerContent}
            </div>
        `;
        container.appendChild(div);
    });
}

function getStatusClass(status) {
    if (!status) return 'status-pending';
    switch (status.toLowerCase()) {
        case 'started': return 'status-started';
        case 'in progress': return 'status-inprogress';
        case 'completed': return 'status-completed';
        default: return 'status-pending';
    }
}

// Task Actions
async function updateTaskStatus(id, selectElement, e) {
    if (e) e.stopPropagation();
    const newStatus = selectElement.value;
    const task = localTasks.find(t => t.id === id);
    if (!task) return;

    selectElement.className = `status-select ${getStatusClass(newStatus)}`;

    try {
        await fetch(`${API_URL}/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title: task.title, description: task.description, status: newStatus })
        });
        task.status = newStatus;
        showToast('Status updated', 'success');
        fetchStats(); /* Refresh stats */
    } catch (err) {
        showToast('Update failed', 'error');
        fetchTasks();
    }
}

async function deleteTask(id, e) {
    if (e) e.stopPropagation();
    try {
        await fetch(`${API_URL}/tasks/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchTasks();
        showToast('Moved to Trash', 'success');
    } catch (err) { showToast('Delete failed', 'error'); }
}

async function restoreTask(id, e) {
    if (e) e.stopPropagation();
    try {
        await fetch(`${API_URL}/tasks/${id}/restore`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchTrash();
        showToast('Task restored', 'success');
    } catch (err) { showToast('Restore failed', 'error'); }
}

async function deleteTaskPermanent(id, e) {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to permanently delete this task?')) return;

    try {
        await fetch(`${API_URL}/tasks/${id}/permanent`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchTrash();
        showToast('Task permanently deleted', 'success');
    } catch (err) { showToast('Delete failed', 'error'); }
}

document.getElementById('create-task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('task-title').value;
    const description = document.getElementById('task-desc').value;

    try {
        let res;
        if (editingTaskId) {
            // Update
            res = await fetch(`${API_URL}/tasks/${editingTaskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ title, description, status: localTasks.find(t => t.id === editingTaskId).status })
            });
        } else {
            // Create
            res = await fetch(`${API_URL}/tasks/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ title, description, status: 'Pending' })
            });
        }

        if (!res.ok) throw new Error;

        closeModal();
        e.target.reset();
        fetchTasks();
        showToast(editingTaskId ? 'Task updated' : 'Task created', 'success');
    } catch { showToast('Operation failed', 'error'); }
});

// Profile Update
document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    // Remove password if empty
    if (!data.password) delete data.password;

    try {
        const res = await fetch(`${API_URL}/auth/me`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });

        if (!res.ok) throw new Error(await res.text());
        const user = await res.json();

        username = user.username;
        localStorage.setItem('username', username);
        profileIcon.textContent = username.charAt(0).toUpperCase();
        showToast('Profile updated', 'success');
    } catch (err) {
        showToast('Update failed: ' + err.message, 'error');
    }
});


// Auth Logic
function switchTab(tab) {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`${tab}-form`).classList.add('active');
    document.querySelector(`button[onclick="switchTab('${tab}')"]`).classList.add('active');
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
        const res = await fetch(`${API_URL}/login`, { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Login failed');
        const data = await res.json();

        token = data.access_token;
        username = formData.get('username');
        localStorage.setItem('token', token);
        localStorage.setItem('username', username);

        initSession();
        showToast(`Welcome back, ${username}!`, 'success');
    } catch (err) { showToast(err.message, 'error'); }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Registration failed');
        showToast('Account created! Please login.', 'success');
        switchTab('login');
    } catch (err) { showToast(err.message, 'error'); }
});

function logout() {
    token = null; username = null;
    localStorage.clear();
    location.reload();
}

// Utils
function openModal(task = null) {
    modal.classList.add('open');
    if (task) {
        editingTaskId = task.id;
        modalTitle.textContent = 'Task Details';
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-desc').value = task.description || '';
        document.getElementById('task-priority').value = task.priority || 'Medium';
        modalBtn.textContent = 'Save Changes';
    } else {
        editingTaskId = null;
        modalTitle.textContent = 'New Task';
        document.getElementById('create-task-form').reset();
        modalBtn.textContent = 'Create Task';
    }
}
function closeModal() { modal.classList.remove('open'); }
window.onclick = (e) => { if (e.target === modal) closeModal(); }

function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
