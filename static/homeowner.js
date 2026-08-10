let currentUserData = null;
let pendingCancelRequestId = null;

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToastNotification(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.style.padding = '12px 20px';
    toast.style.marginBottom = '10px';
    toast.style.borderRadius = '6px';
    toast.style.color = '#fff';
    toast.style.fontWeight = '500';
    toast.style.fontSize = '0.9rem';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.transition = 'all 0.3s ease';
    toast.style.backgroundColor = type === 'success' ? '#2e7d32' : (type === 'error' ? '#c62828' : '#0288d1');

    toast.textContent = msg;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.add('active');

    const targetNav = document.getElementById(`nav-${tabId}`);
    if (targetNav) targetNav.classList.add('active');

    closeMobileNavigation();
}

function openMobileNavigation() {
    const sidebar = document.getElementById('globalSidebar');
    const overlay = document.querySelector('.mobile-nav-overlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('active');
}

function closeMobileNavigation() {
    const sidebar = document.getElementById('globalSidebar');
    const overlay = document.querySelector('.mobile-nav-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
}

function handleSignOut() {
    fetch('/api/logout', { method: 'POST' })
        .then(() => {
            window.location.href = '/';
        })
        .catch(() => {
            window.location.href = '/';
        });
}

function openSectionModal(title) {
    const modal = document.getElementById('generalModal');
    const titleEl = document.getElementById('generalModalTitle');
    const bodyEl = document.getElementById('generalModalBody');

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) {
        if (!currentUserData || !currentUserData.dashboard) {
            bodyEl.innerHTML = '<p>No details available.</p>';
        } else {
            const reqs = currentUserData.dashboard.requests || [];
            if (reqs.length === 0) {
                bodyEl.innerHTML = '<p>No records found.</p>';
            } else {
                let html = '<ul style="list-style: none; padding: 0;">';
                reqs.forEach(r => {
                    html += `<li style="padding: 10px 0; border-bottom: 1px solid #eee;">
                        <strong>${escapeHtml(r.id)}</strong> - ${escapeHtml(r.type)} (${escapeHtml(r.status)})
                    </li>`;
                });
                html += '</ul>';
                bodyEl.innerHTML = html;
            }
        }
    }
    if (modal) modal.classList.add('active');
}

function closeGeneralModal() {
    const modal = document.getElementById('generalModal');
    if (modal) modal.classList.remove('active');
}

function openCancelConfirmModal(reqId) {
    pendingCancelRequestId = reqId;
    const modal = document.getElementById('cancelConfirmModal');
    if (modal) modal.classList.add('active');
}

function closeCancelConfirmModal() {
    pendingCancelRequestId = null;
    const modal = document.getElementById('cancelConfirmModal');
    if (modal) modal.classList.remove('active');
}

async function handleConfirmCancelRequest() {
    if (!pendingCancelRequestId) return;

    try {
        const response = await fetch('/api/requests/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ req_id: pendingCancelRequestId })
        });
        const result = await response.json();

        if (result.status === 'success') {
            showToastNotification(result.message, 'success');
            closeCancelConfirmModal();
            fetchUserData();
        } else {
            showToastNotification(result.message || 'Failed to cancel request.', 'error');
        }
    } catch (err) {
        console.error('Error cancelling request:', err);
        showToastNotification('Connection error while cancelling request.', 'error');
    }
}

function populateDashboardData(dash) {
    if (!dash) return;

    const reqCountEl = document.getElementById('activeRequestsCount');
    if (reqCountEl) reqCountEl.textContent = dash.active_requests ?? 0;

    const badgeEl = document.getElementById('bellBadge');
    if (badgeEl) badgeEl.textContent = dash.unread_alerts ?? 0;

    const duesEl = document.getElementById('outstandingDuesCount');
    if (duesEl) duesEl.textContent = (dash.outstanding_dues || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const tbody = document.getElementById('requestTableBody');
    if (tbody) {
        if (!dash.requests || dash.requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-placeholder">No recent requests found</td></tr>';
        } else {
            tbody.innerHTML = dash.requests.map(r => {
                const canCancel = !['Approved', 'Rejected', 'Cancelled'].includes(r.status);
                const cancelBtn = canCancel 
                    ? `<button class="btn btn-sm" style="background-color: #d9534f; color: white; padding: 4px 10px; font-size: 11px; border:none; border-radius:4px; cursor:pointer;" onclick="openCancelConfirmModal('${escapeHtml(r.id)}')">Cancel Request</button>`
                    : `-`;

                return `
                <tr>
                    <td><strong>${escapeHtml(r.id)}</strong></td>
                    <td>${escapeHtml(r.type || r.title)}</td>
                    <td>${escapeHtml(r.date)}</td>
                    <td><strong>${escapeHtml(r.fee)}</strong></td>
                    <td><span class="status-badge ${r.payment_status === 'Paid' ? 'status-completed' : 'status-pending'}">${escapeHtml(r.payment_status || 'Unpaid')}</span></td>
                    <td><span class="status-badge ${r.status === 'Cancelled' ? 'status-pending' : (r.status === 'Approved' ? 'status-completed' : 'status-pending')}">${escapeHtml(r.status)}</span></td>
                    <td>${cancelBtn}</td>
                </tr>
                `;
            }).join('');
        }
    }
}

function populateUserProfile(user) {
    if (!user) return;

    document.querySelectorAll('.shared-user-name').forEach(el => el.textContent = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.strip());
    document.querySelectorAll('.shared-first-name').forEach(el => el.textContent = user.first_name || 'Homeowner');

    const nameDisplay = document.getElementById('sidebar-display-name');
    if (nameDisplay) nameDisplay.textContent = user.full_name || user.username;

    const idDisplay = document.getElementById('sidebar-homeowner-id');
    if (idDisplay) idDisplay.textContent = `Homeowner ID: ${user.id || '-'}`;

    const avatarLetter = document.getElementById('settingsAvatarLetter');
    if (avatarLetter) avatarLetter.textContent = (user.first_name || 'U')[0].toUpperCase();

    const staticTexts = document.querySelectorAll('.static-text');
    staticTexts.forEach(el => {
        const field = el.getAttribute('data-field');
        if (field && user[field] !== undefined) {
            el.textContent = user[field] || '-';
        }
    });

    const inputs = document.querySelectorAll('#profileForm .edit-input');
    inputs.forEach(input => {
        const name = input.name;
        if (name && user[name] !== undefined) {
            input.value = user[name] || '';
        }
    });

    if (user.profile_image) {
        const imgPreview = document.getElementById('profileImagePreview');
        const defaultIcon = document.getElementById('defaultAvatarIcon');
        if (imgPreview) {
            imgPreview.src = user.profile_image;
            imgPreview.style.display = 'block';
        }
        if (defaultIcon) defaultIcon.style.display = 'none';

        const topAvatar = document.getElementById('topBarAvatar');
        if (topAvatar) {
            topAvatar.style.backgroundImage = `url('${user.profile_image}')`;
            topAvatar.style.backgroundSize = 'cover';
            topAvatar.style.backgroundPosition = 'center';
        }
    }
}

async function fetchUserData() {
    try {
        const res = await fetch('/api/user-data');
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'success') {
            currentUserData = data;
            populateUserProfile(data.user);
            populateDashboardData(data.dashboard);
        }
    } catch (err) {
        console.error('Error fetching user data:', err);
    }
}

// Request Modal Logic
function openRequestModal(btn) {
    const modal = document.getElementById('requestModal');
    const title = btn.getAttribute('data-title');
    const fee = btn.getAttribute('data-fee');
    const category = btn.getAttribute('data-category');
    const desc = btn.getAttribute('data-desc');
    const formId = btn.getAttribute('data-form-id');

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalDesc').textContent = desc;
    document.getElementById('metaService').textContent = `${category} - ${title}`;
    document.getElementById('modalFeeText').textContent = fee;

    const container = document.getElementById('dynamicFormFieldsContainer');
    container.innerHTML = generateFormFields(formId);

    if (modal) modal.classList.add('active');
}

function closeRequestModal() {
    const modal = document.getElementById('requestModal');
    if (modal) modal.classList.remove('active');
}

function generateFormFields(formId) {
    if (formId === 'vehicle-sticker') {
        return `
        <div id="vehicleContainer">
            <div class="form-group" data-vehicle-index="0" style="margin-bottom: 15px;">
                <label>Vehicle Type & Plate Number</label>
                <div style="display: flex; gap: 10px;">
                    <select class="form-control" name="v_type_0" onchange="recalculateVehiclePricing()" style="flex: 1; padding: 8px;">
                        <option value="4 Wheels">4 Wheels (₱200)</option>
                        <option value="2 Wheels">2 Wheels (₱100)</option>
                        <option value="3 Wheels">3 Wheels (₱100)</option>
                        <option value="E-bike">E-bike (₱100)</option>
                    </select>
                    <input type="text" class="form-control" name="v_plate_0" placeholder="Plate Number" required style="flex: 1; padding: 8px;">
                </div>
            </div>
        </div>
        <button type="button" class="btn btn-sm" onclick="addVehicleRow()" style="background:#0288d1; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">+ Add Another Vehicle</button>
        `;
    }
    return `
    <div class="form-group" style="margin-bottom: 15px;">
        <label>Purpose / Additional Remarks</label>
        <textarea class="form-control" name="remarks" rows="3" placeholder="Specify your request details or reason..." required style="width:100%; padding: 8px; border:1px solid #ccc; border-radius:4px;"></textarea>
    </div>
    `;
}

function addVehicleRow() {
    const container = document.getElementById('vehicleContainer');
    const rows = container.querySelectorAll('[data-vehicle-index]');
    const index = rows.length;

    const div = document.createElement('div');
    div.className = 'form-group';
    div.setAttribute('data-vehicle-index', index);
    div.style.marginBottom = '15px';
    div.innerHTML = `
        <div style="display: flex; gap: 10px; align-items: center;">
            <select class="form-control" name="v_type_${index}" onchange="recalculateVehiclePricing()" style="flex: 1; padding: 8px;">
                <option value="4 Wheels">4 Wheels (₱200)</option>
                <option value="2 Wheels">2 Wheels (₱100)</option>
                <option value="3 Wheels">3 Wheels (₱100)</option>
                <option value="E-bike">E-bike (₱100)</option>
            </select>
            <input type="text" class="form-control" name="v_plate_${index}" placeholder="Plate Number" required style="flex: 1; padding: 8px;">
            <button type="button" onclick="this.parentElement.parentElement.remove(); recalculateVehiclePricing();" style="background:#d9534f; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;">&times;</button>
        </div>
    `;
    container.appendChild(div);
    recalculateVehiclePricing();
}

function recalculateVehiclePricing() {
    let total = 0;
    const vehicleRows = document.querySelectorAll('#vehicleContainer [data-vehicle-index]');
    vehicleRows.forEach(row => {
        const select = row.querySelector('select');
        if (select) {
            const val = select.value;
            if (val === '4 Wheels') total += 200;
            else total += 100;
        }
    });

    const feeText = document.getElementById('modalFeeText');
    if (feeText) {
        feeText.textContent = `₱${total.toFixed(2)}`;
    }
}

async function handleRequestSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('modalTitle').textContent;
    const form = document.getElementById('submissionForm');
    const formData = new FormData(form);

    const dataObj = {};
    const vehicles = [];

    const vehicleRows = document.querySelectorAll('#vehicleContainer [data-vehicle-index]');
    if (vehicleRows.length > 0) {
        vehicleRows.forEach((row, i) => {
            const type = formData.get(`v_type_${i}`);
            const plate = formData.get(`v_plate_${i}`);
            if (type && plate) vehicles.push({ type, plate });
        });
        dataObj.vehicles = vehicles;
    } else {
        formData.forEach((val, key) => dataObj[key] = val);
    }

    try {
        const response = await fetch('/api/requests/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, formData: dataObj })
        });
        const result = await response.json();

        if (result.status === 'success') {
            showToastNotification(result.message, 'success');
            closeRequestModal();
            fetchUserData();
        } else {
            showToastNotification(result.message || 'Submission failed.', 'error');
        }
    } catch (err) {
        console.error('Request submission error:', err);
        showToastNotification('Error submitting request.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchUserData();

    const btnConfirmCancel = document.getElementById('btnConfirmCancelRequest');
    if (btnConfirmCancel) {
        btnConfirmCancel.addEventListener('click', handleConfirmCancelRequest);
    }

    document.querySelectorAll('.btn-request').forEach(btn => {
        btn.addEventListener('click', () => openRequestModal(btn));
    });

    const closeBtn = document.getElementById('closeRequestModalBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeRequestModal);

    const cancelBtn = document.getElementById('cancelRequestModalBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', closeRequestModal);

    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(profileForm);
            const payload = {};
            formData.forEach((val, key) => payload[key] = val);

            try {
                const res = await fetch('/api/profile/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();
                if (result.status === 'success') {
                    showToastNotification(result.message, 'success');
                    fetchUserData();
                } else {
                    showToastNotification(result.message || 'Update failed', 'error');
                }
            } catch (err) {
                showToastNotification('Error updating profile', 'error');
            }
        });
    }
});
