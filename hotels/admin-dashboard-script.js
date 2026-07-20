// ==========================================
// LIVE DATA (loaded from MongoDB API)
// ==========================================

let ordersData = [];
let kitchenData = [];
let paymentsData = [];
let bookingsData = [];
let topItems = [];
let statsData = null;

// ==========================================
// CHART CONFIGURATIONS
// ==========================================

const chartColors = {
    primary: '#c9a962',
    primaryLight: 'rgba(201, 169, 98, 0.15)',
    secondary: '#5dade2',
    success: '#5dbe8a',
    danger: '#ec7063',
    warning: '#f5b041',
    info: '#bb8fce',
    grid: 'rgba(255, 255, 255, 0.06)',
    text: 'rgba(232, 230, 227, 0.6)'
};

Chart.defaults.color = chartColors.text;
Chart.defaults.borderColor = chartColors.grid;
Chart.defaults.font.family = "'Inter', sans-serif";

// ==========================================
// DASHBOARD MANAGER
// ==========================================

class DashboardManager {
    constructor() {
        this.currentTab = 'overview';
        this.charts = {};
        this.init();
    }

    init() {
        this.updateTime();
        this.loadFromAPI();
        this.initCharts();
        this.initReveal();
        setInterval(() => this.updateTime(), 60000);
        setInterval(() => this.loadFromAPI(true), 10000);
    }

    initReveal() {
        document.querySelectorAll('.reveal').forEach((el) => {
            const obs = new IntersectionObserver(([e]) => {
                if (e.isIntersecting) { el.classList.add('visible'); obs.unobserve(el); }
            }, { threshold: 0.1 });
            obs.observe(el);
        });
    }

    async loadFromAPI(silent = false) {
        try {
            const [ordersRes, reservationsRes, statsRes] = await Promise.all([
                api.getOrders(),
                api.getReservations(),
                api.getStats()
            ]);

            const orders = ordersRes.data || [];
            const reservations = reservationsRes.data || [];
            statsData = statsRes.data;

            ordersData = orders.map((o) => ({
                id: o.orderId,
                _raw: o,
                customer: o.customerName,
                items: o.items.map((i) => `${i.name} x${i.quantity}`).join(', '),
                amount: `€${o.total.toFixed(2)}`,
                status: o.orderStatus,
                paymentStatus: o.paymentStatus,
                paymentMethod: o.paymentMethod,
                time: new Date(o.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            }));

            paymentsData = orders.map((o) => ({
                id: o.orderId,
                amount: `€${o.total.toFixed(2)}`,
                method: o.paymentMethod,
                status: o.paymentStatus,
                date: new Date(o.createdAt).toLocaleDateString()
            }));

            bookingsData = reservations.map((r) => ({
                confirmation: r.reservationId,
                customer: r.customerName,
                date: r.bookingDate,
                time: r.bookingTime,
                guests: r.guestCount,
                status: r.status
            }));

            kitchenData = orders
                .filter((o) => !['served', 'completed', 'cancelled'].includes(o.orderStatus))
                .map((o) => ({
                    id: o.orderId,
                    items: o.items.map((i) => `${i.name} x${i.quantity}`).join('\n'),
                    time: this.getElapsedTime(o.createdAt),
                    status: this.mapKitchenStatus(o.orderStatus)
                }));

            topItems = (statsData.topItems || []).map((item) => ({
                name: item.name,
                quantity: item.quantity,
                revenue: `$${item.revenue.toFixed(2)}`,
                rating: '4.8 ⭐'
            }));

            this.updateStatCards();
            this.populateTables();
            this.populateKitchenBoard();
            this.populateAnalytics();
            this.updateCharts();
            this.updateBadges();

            if (!silent) showToast('Dashboard updated', 'success');
        } catch (error) {
            console.error('API load failed:', error);
            if (!silent) showToast('Connect server: cd server && npm start', 'error');
        }
    }

    mapKitchenStatus(orderStatus) {
        const map = { received: 'new', pending: 'new', accepted: 'new', preparing: 'preparing', ready: 'ready' };
        return map[orderStatus] || 'new';
    }

    getElapsedTime(createdAt) {
        const mins = Math.floor((Date.now() - new Date(createdAt)) / 60000);
        return mins < 1 ? 'Just now' : `${mins} min`;
    }

    updateStatCards() {
        if (!statsData) return;
        const setVal = (selector, value) => {
            const el = document.querySelector(selector);
            if (el) el.textContent = value;
        };
        setVal('[data-stat="today-orders"]', statsData.todayOrders);
        setVal('[data-stat="today-revenue"]', `€${statsData.todayRevenue.toFixed(2)}`);
        setVal('[data-stat="total-customers"]', statsData.totalCustomers);
        setVal('[data-stat="pending-orders"]', statsData.pendingOrders);

        const paymentStats = document.querySelectorAll('.payment-stat h3');
        if (paymentStats.length >= 3 && statsData.paymentCounts) {
            const completed = ordersData.filter((o) => o.paymentStatus === 'paid' || o.paymentStatus === 'completed')
                .reduce((s, o) => s + parseFloat(o.amount.replace('€', '').replace('$', '')), 0);
            const pending = ordersData.filter((o) => o.paymentStatus === 'pending')
                .reduce((s, o) => s + parseFloat(o.amount.replace('€', '').replace('$', '')), 0);
            const failed = ordersData.filter((o) => o.paymentStatus === 'failed')
                .reduce((s, o) => s + parseFloat(o.amount.replace('€', '').replace('$', '')), 0);
            paymentStats[0].textContent = `€${completed.toFixed(2)}`;
            paymentStats[1].textContent = `€${pending.toFixed(2)}`;
            paymentStats[2].textContent = `€${failed.toFixed(2)}`;
        }
    }

    updateBadges() {
        const pending = ordersData.filter((o) => ['pending', 'accepted'].includes(o.status)).length;
        const kitchen = kitchenData.length;
        document.querySelectorAll('.nav-item .badge').forEach((badge, i) => {
            badge.textContent = i === 0 ? pending : kitchen;
        });
    }

    updateCharts() {
        if (!statsData) return;
        if (this.charts.revenue && statsData.last7Days) {
            this.charts.revenue.data.labels = statsData.last7Days.map((d) => d.label);
            this.charts.revenue.data.datasets[0].data = statsData.last7Days.map((d) => d.revenue);
            this.charts.revenue.update();
        }
        if (this.charts.status && statsData.statusCounts) {
            const labels = Object.keys(statsData.statusCounts);
            const values = Object.values(statsData.statusCounts);
            this.charts.status.data.labels = labels;
            this.charts.status.data.datasets[0].data = values;
            this.charts.status.update();
        }
        if (this.charts.topDishes && statsData.topItems?.length) {
            this.charts.topDishes.data.labels = statsData.topItems.map((i) => i.name);
            this.charts.topDishes.data.datasets[0].data = statsData.topItems.map((i) => i.quantity);
            this.charts.topDishes.update();
        }
    }

    // ==========================================
    // TIME UPDATE
    // ==========================================

    updateTime() {
        const now = new Date();
        const timeString = now.toLocaleString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const currentTimeElement = document.getElementById('currentTime');
        if (currentTimeElement) {
            currentTimeElement.textContent = timeString;
        }
    }

    // ==========================================
    // POPULATE ORDERS TABLE
    // ==========================================

    populateTables() {
        const ordersTableBody = document.getElementById('ordersTableBody');
        if (!ordersTableBody) return;

        ordersTableBody.innerHTML = ordersData.map(order => `
            <tr>
                <td><strong>${order.id}</strong></td>
                <td>${order.customer}</td>
                <td>${order.items}</td>
                <td>${order.amount}</td>
                <td>
                    <span class="status-badge ${order.status}">
                        ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                </td>
                <td>${order.time}</td>
                <td>
                    <button class="action-btn" onclick="viewOrderDetails('${order.id}')">
                        View
                    </button>
                </td>
            </tr>
        `).join('');

        // Populate payments table
        const paymentsTableBody = document.getElementById('paymentsTableBody');
        if (paymentsTableBody) {
            paymentsTableBody.innerHTML = paymentsData.map(payment => `
                <tr>
                    <td><strong>${payment.id}</strong></td>
                    <td>${payment.amount}</td>
                    <td>${payment.method}</td>
                    <td>
                        <span class="status-badge ${payment.status}">
                            ${payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        </span>
                    </td>
                    <td>${payment.date}</td>
                    <td>
                        <button class="action-btn">Details</button>
                    </td>
                </tr>
            `).join('');
        }

        // Populate bookings table
        const bookingsTableBody = document.getElementById('bookingsTableBody');
        if (bookingsTableBody) {
            bookingsTableBody.innerHTML = bookingsData.map(booking => `
                <tr>
                    <td><strong>${booking.confirmation}</strong></td>
                    <td>${booking.customer}</td>
                    <td>${booking.date}</td>
                    <td>${booking.time}</td>
                    <td>${booking.guests}</td>
                    <td>
                        <span class="status-badge ${booking.status.toLowerCase()}">
                            ${booking.status}
                        </span>
                    </td>
                    <td>
                        <button class="action-btn">Manage</button>
                    </td>
                </tr>
            `).join('');
        }
    }

    // ==========================================
    // KITCHEN BOARD
    // ==========================================

    populateKitchenBoard() {
        const newOrders = kitchenData.filter(item => item.status === 'new');
        const preparingOrders = kitchenData.filter(item => item.status === 'preparing');
        const readyOrders = kitchenData.filter(item => item.status === 'ready');

        this.renderKitchenColumn('kitchenNew', newOrders);
        this.renderKitchenColumn('kitchenPreparing', preparingOrders);
        this.renderKitchenColumn('kitchenReady', readyOrders);
    }

    renderKitchenColumn(elementId, items) {
        const element = document.getElementById(elementId);
        if (!element) return;

        element.innerHTML = items.map(item => `
            <div class="kitchen-card">
                <div class="kitchen-card-header">
                    <span class="kitchen-card-id">${item.id}</span>
                    <span class="kitchen-card-time">${item.time}</span>
                </div>
                <div class="kitchen-items">
                    ${item.items.replace(/\n/g, '<br>')}
                </div>
                <div class="kitchen-actions">
                    <button class="kitchen-btn ready" onclick="markKitchenReady('${item.id}')">
                        Ready
                    </button>
                </div>
            </div>
        `).join('');
    }

    // ==========================================
    // ANALYTICS
    // ==========================================

    populateAnalytics() {
        const topItemsBody = document.getElementById('topItemsBody');
        if (topItemsBody) {
            if (!topItems.length) {
                topItemsBody.innerHTML = '<tr><td colspan="4" style="text-align:center">No sales data yet — place orders to see analytics</td></tr>';
                return;
            }
            topItemsBody.innerHTML = topItems.map(item => `
                <tr>
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>${item.revenue}</td>
                    <td><span class="rating">${item.rating}</span></td>
                </tr>
            `).join('');
        }
    }

    // ==========================================
    // CHART INITIALIZATION
    // ==========================================

    initCharts() {
        setTimeout(() => {
            this.createRevenueChart();
            this.createStatusChart();
            this.createTopDishesChart();
            this.createPeakHoursChart();
            this.createMonthlyRevenueChart();
            this.createOrderVolumeChart();
        }, 100);
    }

    createRevenueChart() {
        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;

        this.charts.revenue = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Revenue ($)',
                    data: [1200, 1900, 1500, 2000, 2500, 3000, 2800],
                    borderColor: chartColors.primary,
                    backgroundColor: chartColors.primaryLight,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 6,
                    pointBackgroundColor: chartColors.primary,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value;
                            }
                        }
                    }
                }
            }
        });
    }

    createStatusChart() {
        const ctx = document.getElementById('statusChart');
        if (!ctx) return;

        this.charts.status = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'In Progress', 'Pending', 'Cancelled'],
                datasets: [{
                    data: [45, 25, 20, 10],
                    backgroundColor: [
                        '#27ae60',
                        '#3498db',
                        '#f39c12',
                        '#e74c3c'
                    ],
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    createTopDishesChart() {
        const ctx = document.getElementById('topDishesChart');
        if (!ctx) return;

        this.charts.topDishes = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Pasta\nCarbonara', 'Grilled\nSalmon', 'Pizza', 'Beef\nSteak'],
                datasets: [{
                    label: 'Orders',
                    data: [145, 128, 156, 98],
                    backgroundColor: [
                        'rgba(212, 175, 55, 0.8)',
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(39, 174, 96, 0.8)',
                        'rgba(52, 152, 219, 0.8)'
                    ],
                    borderColor: [
                        chartColors.primary,
                        '#667eea',
                        chartColors.success,
                        chartColors.info
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    createPeakHoursChart() {
        const ctx = document.getElementById('peakHoursChart');
        if (!ctx) return;

        this.charts.peakHours = new Chart(ctx, {
            type: 'area',
            data: {
                labels: ['11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm', '9pm'],
                datasets: [{
                    label: 'Orders',
                    data: [8, 15, 28, 32, 26, 18, 12, 35, 42, 38, 20],
                    borderColor: chartColors.info,
                    backgroundColor: 'rgba(52, 152, 219, 0.2)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointBackgroundColor: chartColors.info
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    createMonthlyRevenueChart() {
        const ctx = document.getElementById('monthlyRevenueChart');
        if (!ctx) return;

        this.charts.monthlyRevenue = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: 'Revenue ($)',
                    data: [28000, 31000, 29500, 35000, 42000, 38000, 41000, 45000, 39000, 44000, 42000, 48000],
                    backgroundColor: chartColors.primary,
                    borderColor: '#c99c2a',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value / 1000 + 'k';
                            }
                        }
                    }
                }
            }
        });
    }

    createOrderVolumeChart() {
        const ctx = document.getElementById('orderVolumeChart');
        if (!ctx) return;

        this.charts.orderVolume = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Lunch', 'Dinner', 'Breakfast', 'Dessert', 'Beverages', 'Appetizers'],
                datasets: [{
                    label: 'Orders',
                    data: [85, 92, 45, 65, 75, 88],
                    borderColor: chartColors.secondary,
                    backgroundColor: 'rgba(102, 126, 234, 0.2)',
                    pointBackgroundColor: chartColors.secondary,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

// ==========================================
// GLOBAL FUNCTIONS
// ==========================================

let dashboardManager;

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName).classList.add('active');

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    const activeNav = document.querySelector(`.nav-item[href="#${tabName}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }

    dashboardManager.currentTab = tabName;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function viewOrderDetails(orderId) {
    const order = ordersData.find(o => o.id === orderId);
    if (!order) return;

    const modal = document.getElementById('orderModal');
    const paymentInfo = order.paymentStatus
        ? `<div class="modal-detail"><label>Payment:</label><span class="status-badge ${order.paymentStatus}">${order.paymentStatus}</span></div>`
        : '';
    const content = `
        <div class="modal-detail">
            <label>Order ID:</label>
            <span>${order.id}</span>
        </div>
        <div class="modal-detail">
            <label>Customer:</label>
            <span>${order.customer}</span>
        </div>
        <div class="modal-detail">
            <label>Items:</label>
            <span>${order.items}</span>
        </div>
        <div class="modal-detail">
            <label>Amount:</label>
            <span>${order.amount}</span>
        </div>
        <div class="modal-detail">
            <label>Status:</label>
            <span><span class="status-badge ${order.status}">${order.status}</span></span>
        </div>
        ${paymentInfo}
        <div class="modal-detail">
            <label>Time:</label>
            <span>${order.time}</span>
        </div>
    `;

    document.getElementById('orderModalContent').innerHTML = content;
    modal.classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

function markKitchenReady(kitchenId) {
    showToast(`Order ${kitchenId} marked as ready!`, 'success');
    dashboardManager.populateKitchenBoard();
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    dashboardManager = new DashboardManager();
    
    // Close modal when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });

    console.log('Admin Dashboard initialized');
});
