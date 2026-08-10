document.addEventListener('DOMContentLoaded', () => {
    fetchUserData();
    setupTabNavigation();
    setupProfileForm();
    setupModalListeners();
    setupRequestButtons();
});

let currentUserProfile = {};
let currentRequestFee = "₱50.00";
let currentRequestTitle = "";
let currentRequestCategory = "";

function showToastNotification(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    const iconClass = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info');

    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <div class="toast-content">${escapeHtml(message)}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-show'), 10);
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

window.showToastNotification = showToastNotification;

// Template Generator Using Built-in CSS Selectors
function getTemplateHTML(formId, profile) {
    const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    const phone = profile.mobile || '';
    const block = profile.block || '';
    const lot = profile.lot || '';
    const blockLot = (block || lot) ? `${block} ${lot}`.trim() : '';
    const todayISO = new Date().toISOString().split('T')[0];

    const templates = {
        'gate-pass': `
            <div class="form-group full-width">
                <label>Full Name <span>*</span></label>
                <div class="input-wrapper"><i class="fa-regular fa-user"></i><input type="text" name="fullName" value="${escapeHtml(fullName)}" required placeholder="Full Name"></div>
            </div>
            <div class="form-group">
                <label>Block Number <span>*</span></label>
                <div class="input-wrapper"><i class="fa-solid fa-layer-group"></i><input type="text" name="blockNum" value="${escapeHtml(block)}" required placeholder="e.g. Blk 1"></div>
            </div>
            <div class="form-group">
                <label>Lot Number <span>*</span></label>
                <div class="input-wrapper"><i class="fa-solid fa-house-user"></i><input type="text" name="lotNum" value="${escapeHtml(lot)}" required placeholder="e.g. Lot 12"></div>
            </div>
            <div class="form-group full-width">
                <label>Major/Minor Construction Permit Number (If Applicable)</label>
                <div class="input-wrapper"><i class="fa-solid fa-id-card"></i><input type="text" name="permitNum" placeholder="Permit reference index tag"></div>
            </div>
            <div class="form-section-title">List of Materials</div>
            <div class="form-group full-width">
                <textarea name="materialsList" placeholder="Enter descriptive list of materials items matching load delivery records..."></textarea>
            </div>
        `,
        'proof-residency': `
            <div class="form-group full-width">
                <label>Full Name <span>*</span></label>
                <div class="input-wrapper"><i class="fa-regular fa-user"></i><input type="text" name="fullName" value="${escapeHtml(fullName)}" required placeholder="Full Name"></div>
            </div>
            <div class="form-group">
                <label>Block Number <span>*</span></label>
                <div class="input-wrapper"><i class="fa-solid fa-layer-group"></i><input type="text" name="blockNum" value="${escapeHtml(block)}" required placeholder="Blk"></div>
            </div>
            <div class="form-group">
                <label>Lot Number <span>*</span></label>
                <div class="input-wrapper"><i class="fa-solid fa-house-user"></i><input type="text" name="lotNum" value="${escapeHtml(lot)}" required placeholder="Lot"></div>
            </div>
            <div class="form-group full-width">
                <label>Verified Owner <span>*</span></label>
                <div class="input-wrapper"><i class="fa-solid fa-user-shield"></i><input type="text" name="verifiedOwner" value="${escapeHtml(fullName)}" required placeholder="Verified Owner Name"></div>
            </div>
            <div class="form-group full-width">
                <label>Date of Issuance Request <span>*</span></label>
                <div class="input-wrapper"><i class="fa-regular fa-calendar"></i><input type="date" name="issuanceDate" value="${todayISO}" required></div>
            </div>
        `,
        'promissory': `
            <div class="form-group full-width">
                <label>Full Name <span>*</span></label>
                <div class="input-wrapper"><i class="fa-regular fa-user"></i><input type="text" name="fullName" value="${escapeHtml(fullName)}" required></div>
            </div>
            <div class="form-group">
                <label>Block Number <span>*</span></label>
                <div class="input-wrapper"><i class="fa-solid fa-layer-group"></i><input type="text" name="blockNum" value="${escapeHtml(block)}" required></div>
            </div>
            <div class="form-group">
                <label>Lot Number <span>*</span></label>
                <div class="input-wrapper"><i class="fa-solid fa-house-user"></i><input type="text" name="lotNum" value="${escapeHtml(lot)}" required></div>
            </div>
            <div class="form-group full-width">
                <label>Total Outstanding Balance <span>*</span></label>
                <div class="input-wrapper"><i class="fa-solid fa-peso-sign"></i><input type="number" step="0.01" name="totalBalance" required placeholder="0.00"></div>
            </div>
            <div class="form-group">
                <label>Start Period <span>*</span></label>
                <div class="input-wrapper"><i class="fa-regular fa-calendar-minus"></i><input type="date" name="startPeriod" required></div>
            </div>
            <div class="form-group">
                <label>End Period <span>*</span></label>
                <div class="input-wrapper"><i class="fa-regular fa-calendar-plus"></i><input type="date" name="endPeriod" required></div>
            </div>
            <div class="form-section-title">Commitment Details</div>
            <div class="form-group full-width">
                <label>Payment Schedule (Calendar Date) <span>*</span></label>
                <div class="input-wrapper"><i class="fa-regular fa-calendar"></i><input type="date" name="paymentSchedule" min="${todayISO}" required></div>
            </div>
        `,
        'cert-improvement': `
            <div class="form-group full-width">
                <label>Full Name <span>*</span></label>
                <div class="input-wrapper"><i class="fa-regular fa-user"></i><input type="text" name="fullName" value="${escapeHtml(fullName)}" required></div>
            </div>
            <div class="form-group">
                <label>Block Number <span>*</span></label>
                <div class="input-wrapper"><i class="fa-solid fa-layer-group"></i><input type="text" name="blockNum" value="${escapeHtml(block)}" required></div>
            </div>
            <div class="form-group">
                <label>Lot Number <span>*</span></label>
                <div class="input-wrapper"><i class="fa-solid fa-house-user"></i><input type="text" name="lotNum" value="${escapeHtml(lot)}" required></div>
            </div>
            <div class="form-group full-width">
                <label>Date <span>*</span></label>
                <div class="input-wrapper"><i class="fa-regular fa-calendar"></i><input type="date" name="requestDate" value="${todayISO}" required></div>
            </div>
        `,
        'cert-membership': `
            <div class="form-group full-width">
                <label>Full Name <span>*</span></label>
                <div class="input-wrapper"><i class="fa-regular fa-user"></i><input type="text" name="fullName" value="${escapeHtml(fullName)}" required></div>
            </div>
            <div class="form-group">
                <label>Block Number <span>*</span></label>
                <div class="input-wrapper"><i class="fa-solid fa-layer-group"></i><input type="text" name="blockNum" value="${escapeHtml(block)}" required placeholder="Blk"></div>
            </div>
            <div class="form-group">
                <label>Lot Number <span>*</span></label>
                <div class="input-wrapper"><i class="fa-solid fa-house-user"></i><input type="text" name="lotNum" value="${escapeHtml(lot)}" required placeholder="Lot"></div>
            </div>
            <div class="form-group full-width">
                <label>Application Date (Auto-Generated)</label>
                <div class="input-wrapper"><i class="fa-regular fa-calendar"></i><input type="date" name="applicationDate" value="${todayISO}" readonly style="background-color: #e2e8f0; cursor: not-allowed;"></div>
            </div>
        `,
        'move-in': `
            <div class="form-group full-width">
                <label>Full Name <span>*</span></label>
                <div class="input-wrapper"><i class="fa-regular fa-user"></i><input type="text" name="fullName" value="${escapeHtml(fullName)}" required></div>
            </div>
            <div class="form-group">
                <label>Block Number <span>*</span></label>
                <div class="input-wrapper"><i class="fa-solid fa-layer-group"></i><input type="text" name="blockNum" value="${escapeHtml(block)}" required></div>
            </div>
            <div class="form-group">
                <label>Lot Number <span>*</span></label>
                <div class="input-wrapper"><i class="fa-solid fa-house-user"></i><input type="text" name="lotNum" value="${escapeHtml(lot)}" required></div>
            </div>
            <div class="form-group full-width">
                <label>Move-in Date <span>*</span></label>
                <div class="input-wrapper"><i class="fa-regular fa-calendar-check"></i><input type="date" name="moveInDate" required></div>
            </div>
        `,
        'move-out': `
            <div class="form-group full-width">
                <label>Full Name <span>*</span></label>
                <div class="input-wrapper"><i class="fa-regular fa-user"></i><input type="text" name="fullName" value="${escapeHtml(fullName)}" required></div>
            </div>
            <div class="form-group">
                <label>Block Number <span>*</span></label>
                <div class="input-wrapper"><i class="fa-solid fa-layer-group"></i><input type="text" name="blockNum" value="${escapeHtml(block)}" required></div>
            </div>
            <div class="form-group">
                <label>Lot Number <span>*</span></label>
                <div class="input-wrapper"><i class="fa-solid fa-house-user"></i><input type="text" name="lotNum" value="${escapeHtml(lot)}" required></div>
            </div>
            <div class="form-group full-width">
                <label>Move-out Date <span>*</span></label>
                <div class="input-wrapper"><i class="fa-regular fa-calendar-minus"></i><input type="date" name="moveOutDate" required></div>
            </div>
        `,
        'vehicle-sticker': `
            <div class="form-section-title">Applicant Profile</div>
            <div class="form-group">
                <label>Applicant's Name <span>*</span></label>
                <div class="input-wrapper"><i class="fa-regular fa-user"></i><input type="text" name="applicantName" value="${escapeHtml(fullName)}" required></div>
            </div>
            <div class="form-group">
                <label>Block and Lot <span>*</span></label>
                <div class="input-wrapper"><i class="fa-solid fa-map-pin"></i><input type="text" name="blockLot" value="${escapeHtml(blockLot)}" required></div>
            </div>
            <div class="form-group">
                <label>Cellphone No. <span>*</span></label>
                <div class="input-wrapper"><i class="fa-solid fa-mobile-screen"></i><input type="tel" name="phoneNum" value="${escapeHtml(phone)}" required></div>
            </div>
            <div class="form-group">
                <label>Email Address <span>*</span></label>
                <div class="input-wrapper"><i class="fa-regular fa-envelope"></i><input type="email" name="emailAddr" value="${escapeHtml(profile.email || '')}" required></div>
            </div>

            <div class="form-section-title" style="display:flex; justify-content:space-between; align-items:center;">
                <span>Registered Vehicles</span>
                <button type="button" class="btn-save" style="padding: 4px 12px; font-size: 0.75rem;" onclick="addVehicleRow()"><i class="fa-solid fa-plus"></i> Add Vehicle</button>
            </div>

            <div id="vehicleContainer">
                <div class="due-item" style="flex-direction: column; align-items: stretch; gap: 10px; margin-bottom: 12px; background: var(--input-bg);" data-vehicle-index="0">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px;">
                        <strong>Vehicle #1</strong>
                    </div>
                    <div class="modal-form">
                        <div class="form-group">
                            <label>Vehicle Type <span>*</span></label>
                            <div class="input-wrapper">
                                <select name="vType_0" onchange="recalculateVehiclePricing()" required>
                                    <option value="4 Wheels">4 Wheels (₱200.00)</option>
                                    <option value="2/3 Wheels">2 Wheels (₱100.00)</option>
                                    <option value="E-Bike">3 Wheels (₱100.00)</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Plate Number <span>*</span></label>
                            <div class="input-wrapper"><input type="text" name="vPlate_0" placeholder="e.g. ABC 1234" required></div>
                        </div>
                        <div class="form-group">
                            <label>Vehicle Model / Year <span>*</span></label>
                            <div class="input-wrapper"><input type="text" name="vModel_0" placeholder="e.g. Vios 2022" required></div>
                        </div>
                        <div class="form-group">
                            <label>Vehicle Color <span>*</span></label>
                            <div class="input-wrapper"><input type="text" name="vColor_0" placeholder="e.g. Black" required></div>
                        </div>
                    </div>
                </div>
            </div>
        `,
        'tenant-form': `
            <div class="form-group">
                <label>Full Name (Head of Tenant) <span>*</span></label>
                <div class="input-wrapper"><i class="fa-regular fa-user"></i><input type="text" name="tenantName" value="${escapeHtml(fullName)}" required></div>
            </div>
            <div class="form-group">
                <label>Cellphone Number <span>*</span></label>
                <div class="input-wrapper"><i class="fa-solid fa-phone"></i><input type="tel" name="tenantPhone" value="${escapeHtml(phone)}" required></div>
            </div>
            <div class="form-group full-width">
                <label>Address of Unit to be Rented <span>*</span></label>
                <div class="input-wrapper"><i class="fa-solid fa-map-marker-alt"></i><input type="text" name="unitAddress" value="${escapeHtml(blockLot)}" required></div>
            </div>
            <div class="form-group full-width checkbox-group" style="margin-top:15px;">
                <input type="checkbox" id="oathAgreement" name="oathAgreed" required>
                <label for="oathAgreement"><strong>I solemnly accept the terms of the Tenant Oath.</strong> <span>*</span></label>
            </div>
        `
    };

    return templates[formId] || templates['gate-pass'];
}

// Fetch User Data
async function fetchUserData() {
    try {
        const response = await fetch('/api/user-data');
        if (!response.ok) {
            window.location.href = '/';
            return;
        }

        const data = await response.json();
        if (data.status === 'success') {
            currentUserProfile = data.user || {};
            populateUserData(data.user);
            populateDashboardData(data.dashboard);
        }
    } catch (err) {
        console.error('Failed to load user data:', err);
    }
}

function populateUserData(user) {
    if (!user) return;

    const suffixText = (user.suffix && user.suffix !== 'N/A') ? ` ${user.suffix}` : '';
    const fullName = `${user.first_name || ''} ${user.last_name || ''}${suffixText}`.trim() || 'User';

    document.querySelectorAll('.shared-user-name').forEach(el => el.textContent = fullName);
    document.querySelectorAll('.shared-first-name').forEach(el => el.textContent = user.first_name || 'User');

    setSpanText('firstName', user.first_name);
    setSpanText('middleName', user.middle_name || 'N/A');
    setSpanText('lastName', user.last_name);
    setSpanText('suffix', user.suffix || 'N/A');
    setSpanText('gender', user.gender || 'NA');
    setSpanText('dob', user.dob || 'N/A');
    setSpanText('civilStatus', user.civil_status || 'Single');
    setSpanText('subdivision', 'North Fairway Homes');
    setSpanText('block', user.block || 'Not Specified');
    setSpanText('lot', user.lot || 'Not Specified');
    setSpanText('email', user.email);
    setSpanText('mobile', user.mobile);
    setSpanText('household', user.household || '1');
    setSpanText('dateJoined', user.date_joined || '2018-06-14');

    setInputValue('firstName', user.first_name);
    setInputValue('middleName', user.middle_name);
    setInputValue('lastName', user.last_name);
    setInputValue('suffix', user.suffix);
    setInputValue('gender', user.gender || 'NA');
    setInputValue('dob', user.dob);
    setInputValue('civilStatus', user.civil_status || 'Single');
    setInputValue('block', user.block);
    setInputValue('lot', user.lot);
    setInputValue('email', user.email);
    setInputValue('mobile', user.mobile);
    setInputValue('household', user.household);

    const sidebarName = document.getElementById('sidebar-display-name');
    if (sidebarName) sidebarName.textContent = fullName;

    const sidebarId = document.getElementById('sidebar-homeowner-id');
    if (sidebarId) sidebarId.textContent = `Homeowner ID: ${user.id || '-'}`;

    const settingsAvatar = document.getElementById('settingsAvatarLetter');
    if (settingsAvatar && user.first_name) {
        settingsAvatar.textContent = user.first_name.charAt(0).toUpperCase();
    }

    if (user.emergency) {
        setInputElementVal('em-name', user.emergency.name);
        setInputElementVal('em-number', user.emergency.number);
        setSelectVal('em-relationship', user.emergency.relationship);
    }

    if (user.preferences) {
        setToggleChecked('toggle-email', user.preferences.email);
        setToggleChecked('toggle-sms', user.preferences.sms);
    }

    if (user.profile_image) {
        updateAvatarDisplay(user.profile_image);
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
            tbody.innerHTML = '<tr><td colspan="6" class="empty-placeholder">No recent requests found</td></tr>';
        } else {
            tbody.innerHTML = dash.requests.map(r => `
                <tr>
                    <td><strong>${escapeHtml(r.id)}</strong></td>
                    <td>${escapeHtml(r.type || r.title)}</td>
                    <td>${escapeHtml(r.date)}</td>
                    <td><strong>${escapeHtml(r.fee)}</strong></td>
                    <td><span class="status-badge ${r.payment_status === 'Paid' ? 'status-completed' : 'status-pending'}">${escapeHtml(r.payment_status || 'Unpaid')}</span></td>
                    <td><span class="status-badge ${r.status === 'Pending' ? 'status-pending' : 'status-completed'}">${escapeHtml(r.status)}</span></td>
                </tr>
            `).join('');
        }
    }
}

// Tab Navigation Controls
function setupTabNavigation() {
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            const tabTarget = link.id.replace('nav-', '');
            switchTab(tabTarget);
        });
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.add('active');
        targetTab.scrollTop = 0;
    }

    const activeNav = document.getElementById(`nav-${tabId}`);
    if (activeNav) activeNav.classList.add('active');

    closeMobileNavigation();

    if (tabId === 'dashboard-view') {
        fetchUserData();
    }
}

function openMobileNavigation() { document.body.classList.add('mobile-nav-open'); }
function closeMobileNavigation() { document.body.classList.remove('mobile-nav-open'); }

// Profile Form Management
function setupProfileForm() {
    const btnEdit = document.getElementById('btnEditProfile');
    const btnCancel = document.getElementById('btnCancel');
    const profileForm = document.getElementById('profileForm');

    if (btnEdit) btnEdit.addEventListener('click', () => document.body.classList.add('is-editing'));
    if (btnCancel) btnCancel.addEventListener('click', () => document.body.classList.remove('is-editing'));

    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const saveBtn = document.getElementById('btn-save-profile');
            if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

            const payload = {
                first_name: getInputValue('firstName'),
                middle_name: getInputValue('middleName'),
                last_name: getInputValue('lastName'),
                suffix: getInputValue('suffix'),
                gender: getInputValue('gender'),
                dob: getInputValue('dob'),
                civil_status: getInputValue('civilStatus'),
                block: getInputValue('block'),
                lot: getInputValue('lot'),
                email: getInputValue('email'),
                mobile: getInputValue('mobile'),
                household: getInputValue('household')
            };

            try {
                const response = await fetch('/api/profile/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                if (result.status === 'success') {
                    showToastNotification('Profile updated successfully.', 'success');
                    document.body.classList.remove('is-editing');
                    await fetchUserData();
                } else {
                    showToastNotification(result.message || 'Profile update failed.', 'error');
                }
            } catch (err) {
                console.error('Error updating profile:', err);
                showToastNotification('An error occurred while saving profile.', 'error');
            } finally {
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
            }
        });
    }
}

function updateAvatarDisplay(imageUrl) {
    const imgPreview = document.getElementById('profileImagePreview');
    const defaultIcon = document.getElementById('defaultAvatarIcon');
    const topAvatar = document.getElementById('topBarAvatar');

    if (imgPreview) {
        imgPreview.src = imageUrl;
        imgPreview.style.display = 'block';
    }
    if (defaultIcon) defaultIcon.style.display = 'none';

    if (topAvatar) {
        topAvatar.style.backgroundImage = `url('${imageUrl}')`;
        topAvatar.style.backgroundSize = 'cover';
        topAvatar.style.backgroundPosition = 'center';
    }
}

// Settings Actions
function toggleEdit(section) {
    if (section === 'emergency') {
        const emName = document.getElementById('em-name');
        const emNum = document.getElementById('em-number');
        const emRel = document.getElementById('em-relationship');
        const actionsDiv = document.getElementById('emergency-actions');

        const isDisabled = emName.disabled;
        emName.disabled = !isDisabled;
        emNum.disabled = !isDisabled;
        emRel.disabled = !isDisabled;

        if (isDisabled) {
            emName.focus();
            actionsDiv.innerHTML = `
                <button class="save-btn" onclick="saveEmergencySettings()">Save</button>
                <button class="cancel-btn" onclick="toggleEdit('emergency')">Cancel</button>
            `;
        } else {
            actionsDiv.innerHTML = `<button class="edit-link" onclick="toggleEdit('emergency')">Edit</button>`;
        }
    } else if (section === 'security') {
        const secCurrent = document.getElementById('sec-current');
        const secNew = document.getElementById('sec-new');
        const secConfirm = document.getElementById('sec-confirm');
        const actionsDiv = document.getElementById('security-actions');

        const isDisabled = secCurrent.disabled;
        secCurrent.disabled = !isDisabled;
        secNew.disabled = !isDisabled;
        secConfirm.disabled = !isDisabled;

        if (isDisabled) {
            secCurrent.focus();
            actionsDiv.innerHTML = `
                <button class="save-btn" onclick="saveSecuritySettings()">Save</button>
                <button class="cancel-btn" onclick="toggleEdit('security')">Cancel</button>
            `;
        } else {
            secCurrent.value = '';
            secNew.value = '';
            secConfirm.value = '';
            actionsDiv.innerHTML = `<button class="edit-link" onclick="toggleEdit('security')">Edit</button>`;
        }
    }
}

async function saveEmergencySettings() {
    const name = document.getElementById('em-name').value.trim();
    const number = document.getElementById('em-number').value.trim();
    const relationship = document.getElementById('em-relationship').value;

    if (!name || !number || !relationship) {
        showToastNotification('All emergency contact fields are required.', 'error');
        return;
    }

    try {
        const response = await fetch('/api/settings/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                emergency: { name, number, relationship }
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            showToastNotification('Emergency contact saved successfully.', 'success');
            toggleEdit('emergency');
            await fetchUserData();
        } else {
            showToastNotification(result.message || 'Failed to save emergency contact.', 'error');
        }
    } catch (err) {
        console.error('Error saving emergency contact:', err);
        showToastNotification('Server connection error.', 'error');
    }
}

async function saveSecuritySettings() {
    const currentPassword = document.getElementById('sec-current').value;
    const newPassword = document.getElementById('sec-new').value;
    const confirmPassword = document.getElementById('sec-confirm').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        showToastNotification('All password fields are required.', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showToastNotification('New password and confirmation do not match.', 'error');
        return;
    }

    try {
        const response = await fetch('/api/settings/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword,
                confirm_password: confirmPassword
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            showToastNotification('Password changed successfully.', 'success');
            toggleEdit('security');
        } else {
            showToastNotification(result.message || 'Failed to change password.', 'error');
        }
    } catch (err) {
        console.error('Error changing password:', err);
        showToastNotification('Server connection error.', 'error');
    }
}

async function handleToggleChange(prefType) {
    const preferencesPayload = {
        email: document.getElementById('toggle-email').checked,
        sms: document.getElementById('toggle-sms').checked
    };

    try {
        await fetch('/api/settings/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preferences: preferencesPayload })
        });
        showToastNotification(`${prefType} preference updated.`, 'success');
    } catch (err) {
        console.error('Preference update error:', err);
        showToastNotification('Failed to update preference.', 'error');
    }
}

// Vehicle Dynamic Pricing Calculation
function addVehicleRow() {
    const container = document.getElementById('vehicleContainer');
    if (!container) return;

    const currentCount = container.children.length;
    const newIndex = currentCount;

    const rowDiv = document.createElement('div');
    rowDiv.className = 'due-item';
    rowDiv.style.cssText = 'flex-direction: column; align-items: stretch; gap: 10px; margin-bottom: 12px; background: var(--input-bg);';
    rowDiv.setAttribute('data-vehicle-index', newIndex);

    rowDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px;">
            <strong>Vehicle #${newIndex + 1}</strong>
            <button type="button" class="btn-cancel" style="padding: 2px 8px; font-size: 0.75rem; color: var(--error-color); border-color: var(--error-color);" onclick="removeVehicleRow(this)"><i class="fa-solid fa-trash"></i> Remove</button>
        </div>
        <div class="modal-form">
            <div class="form-group">
                <label>Vehicle Type <span>*</span></label>
                <div class="input-wrapper">
                    <select name="vType_${newIndex}" onchange="recalculateVehiclePricing()" required>
                        <option value="4 Wheels">4 Wheels (₱100.00)</option>
                        <option value="2 Wheels">2 Wheels (₱50.00)</option>
                        <option value="3 Wheels">3 Wheels (₱50.00)</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Plate Number <span>*</span></label>
                <div class="input-wrapper"><input type="text" name="vPlate_${newIndex}" placeholder="e.g. ABC 1234" required></div>
            </div>
            <div class="form-group">
                <label>Vehicle Model / Year <span>*</span></label>
                <div class="input-wrapper"><input type="text" name="vModel_${newIndex}" placeholder="e.g. Vios 2022" required></div>
            </div>
            <div class="form-group">
                <label>Vehicle Color <span>*</span></label>
                <div class="input-wrapper"><input type="text" name="vColor_${newIndex}" placeholder="e.g. Black" required></div>
            </div>
        </div>
    `;

    container.appendChild(rowDiv);
    recalculateVehiclePricing();
}

function removeVehicleRow(buttonEl) {
    const rowBox = buttonEl.closest('.due-item');
    if (rowBox) {
        rowBox.remove();
        recalculateVehiclePricing();
    }
}

function recalculateVehiclePricing() {
    const feeEl = document.getElementById('modalFeeText');
    if (!feeEl) return;

    const prices = {
        '4 Wheels': 100.0,
        '2 Wheels': 50.0,
        '3 Wheels': 50.0
    };

    let total = 0.0;
    const selects = document.querySelectorAll('#vehicleContainer select');
    selects.forEach(sel => {
        const val = sel.value;
        total += prices[val] || 100.0;
    });

    currentRequestFee = `₱${total.toFixed(2)}`;
    feeEl.textContent = currentRequestFee;
}

// Overlay Setup
function setupRequestButtons() {
    document.querySelectorAll('.btn-request').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const title = btn.getAttribute('data-title') || 'Document Request';
            const category = btn.getAttribute('data-category') || 'Document Request';
            const desc = btn.getAttribute('data-desc') || '';
            const formId = btn.getAttribute('data-form-id') || 'gate-pass';
            const fee = btn.getAttribute('data-fee') || "₱50.00";

            currentRequestFee = fee;
            currentRequestTitle = title;
            currentRequestCategory = category;

            openRequestModal(title, category, desc, formId, fee);
        });
    });
}

function openRequestModal(title, category, desc, formId, fee) {
    const titleEl = document.getElementById('modalTitle');
    const descEl = document.getElementById('modalDesc');
    const metaServiceEl = document.getElementById('metaService');
    const feeEl = document.getElementById('modalFeeText');

    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = desc;
    if (metaServiceEl) metaServiceEl.textContent = title;
    if (feeEl) feeEl.textContent = fee;

    const container = document.getElementById('dynamicFormFieldsContainer');
    if (container) {
        container.innerHTML = getTemplateHTML(formId, currentUserProfile);
    }

    if (formId === 'vehicle-sticker') {
        recalculateVehiclePricing();
    }

    const modal = document.getElementById('requestModal');
    if (modal) modal.classList.add('active');
}

function closeRequestModal() {
    const modal = document.getElementById('requestModal');
    if (modal) modal.classList.remove('active');
    const form = document.getElementById('submissionForm');
    if (form) form.reset();
}

function setupModalListeners() {
    const closeBtn = document.getElementById('closeRequestModalBtn');
    const cancelBtn = document.getElementById('cancelRequestModalBtn');
    const requestModal = document.getElementById('requestModal');
    const generalModal = document.getElementById('generalModal');

    if (closeBtn) closeBtn.addEventListener('click', closeRequestModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeRequestModal);

    window.addEventListener('click', (e) => {
        if (e.target === requestModal) closeRequestModal();
        if (e.target === generalModal) closeGeneralModal();
    });
}

// Request Processing
async function handleRequestSubmit(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('btn-submit-request');
    const originalBtnText = submitBtn ? submitBtn.textContent : 'Submit Document Request';

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
    }

    const form = e.target;
    const formDataObj = {};
    const formData = new FormData(form);

    if (currentRequestTitle.includes('Vehicle')) {
        const vehicles = [];
        const rows = document.querySelectorAll('#vehicleContainer .due-item');
        rows.forEach((row) => {
            vehicles.push({
                type: row.querySelector(`select[name^="vType_"]`)?.value || '4 Wheels',
                plate: row.querySelector(`input[name^="vPlate_"]`)?.value || '',
                model: row.querySelector(`input[name^="vModel_"]`)?.value || '',
                color: row.querySelector(`input[name^="vColor_"]`)?.value || ''
            });
        });
        formDataObj.vehicles = vehicles;
    }

    formData.forEach((value, key) => {
        if (!key.startsWith('vType_') && !key.startsWith('vPlate_') && !key.startsWith('vModel_') && !key.startsWith('vColor_')) {
            formDataObj[key] = value;
        }
    });

    try {
        const response = await fetch('/api/requests/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: currentRequestTitle,
                formData: formDataObj
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            closeRequestModal();
            showToastNotification(result.message || 'Request submitted successfully!', 'success');
            await fetchUserData();
            switchTab('dashboard-view');
        } else {
            showToastNotification(result.message || 'Submission failed.', 'error');
        }
    } catch (err) {
        console.error('Error submitting request:', err);
        showToastNotification('An error occurred while connecting to the server.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    }
}

// Helper Functions
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function setSpanText(fieldName, val) {
    const span = document.querySelector(`span[data-field="${fieldName}"]`);
    if (span) span.textContent = val || '-';
}

function setInputValue(fieldName, val) {
    const input = document.querySelector(`[name="${fieldName}"]`);
    if (input) input.value = val || '';
}

function getInputValue(fieldName) {
    const input = document.querySelector(`[name="${fieldName}"]`);
    return input ? input.value : '';
}

function setInputElementVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
}

function setSelectVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val || 'Spouse';
}

function setToggleChecked(id, isChecked) {
    const toggle = document.getElementById(id);
    if (toggle) toggle.checked = Boolean(isChecked);
}

async function openSectionModal(title) {
    const titleEl = document.getElementById('generalModalTitle');
    const bodyEl = document.getElementById('generalModalBody');

    if (titleEl) titleEl.textContent = title;

    try {
        const response = await fetch('/api/user-data');
        const data = await response.json();
        const userRequests = data.dashboard.requests || [];
        const userAlerts = data.dashboard.alerts || [];

        if (title.includes('Request')) {
            if (userRequests.length === 0) {
                bodyEl.innerHTML = `<div class="empty-placeholder">No request records available.</div>`;
            } else {
                let html = `<table><thead><tr><th>ID</th><th>Type</th><th>Submitted</th><th>Fee</th><th>Payment Status</th><th>Status</th></tr></thead><tbody>`;
                userRequests.forEach(r => {
                    html += `<tr>
                        <td><strong>${escapeHtml(r.id)}</strong></td>
                        <td>${escapeHtml(r.type || r.title)}</td>
                        <td>${escapeHtml(r.date)}</td>
                        <td>${escapeHtml(r.fee)}</td>
                        <td><span class="status-badge ${r.payment_status === 'Paid' ? 'status-completed' : 'status-pending'}">${escapeHtml(r.payment_status || 'Unpaid')}</span></td>
                        <td><span class="status-badge ${r.status === 'Pending' ? 'status-pending' : 'status-completed'}">${escapeHtml(r.status)}</span></td>
                    </tr>`;
                });
                html += `</tbody></table>`;
                bodyEl.innerHTML = html;
            }
        } else if (title.includes('Due') || title.includes('Outstanding')) {
            const unpaidRequests = userRequests.filter(r => r.payment_status === 'Unpaid' && r.status !== 'Rejected');
            if (unpaidRequests.length === 0) {
                bodyEl.innerHTML = `<div class="empty-placeholder">No outstanding dues pending payment.</div>`;
            } else {
                let html = `<div style="display:flex; flex-direction:column; gap:10px;">`;
                unpaidRequests.forEach(d => {
                    html += `<div class="due-item"><div><strong>${escapeHtml(d.type || d.title)} (${escapeHtml(d.id)})</strong><br><small>Submitted on ${escapeHtml(d.date)}</small></div><div class="due-amount">${escapeHtml(d.fee)}</div></div>`;
                });
                html += `</div>`;
                bodyEl.innerHTML = html;
            }
        } else if (title.includes('Notification') || title.includes('Alert')) {
            if (userAlerts.length === 0) {
                bodyEl.innerHTML = `<div class="empty-placeholder">No alerts to display.</div>`;
            } else {
                let html = `<div class="notif-list">`;
                userAlerts.forEach(a => {
                    html += `<div class="notif-item ${a.unread ? 'unread' : ''}" style="padding:12px 0;"><span>${escapeHtml(a.text)}</span><span class="notif-time">${escapeHtml(a.time)}</span></div>`;
                });
                html += `</div>`;
                bodyEl.innerHTML = html;

                await fetch('/api/alerts/read', { method: 'POST' });
                fetchUserData();
            }
        }
    } catch (err) {
        console.error('Error fetching modal details:', err);
    }

    const modal = document.getElementById('generalModal');
    if (modal) modal.classList.add('active');
}

function closeGeneralModal() {
    const modal = document.getElementById('generalModal');
    if (modal) modal.classList.remove('active');
}

async function handleSignOut() {
    if (confirm("Are you sure you want to sign out?")) {
        try {
            const response = await fetch('/api/logout', { method: 'POST' });
            const result = await response.json();
            showToastNotification(result.message || 'Logged out successfully.', 'info');
            setTimeout(() => {
                window.location.href = '/';
            }, 600);
        } catch (err) {
            console.error('Signout error:', err);
            window.location.href = '/';
        }
    }
}
