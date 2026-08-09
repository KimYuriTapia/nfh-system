document.addEventListener('DOMContentLoaded', () => {
    // Mobile Sidebar Toggle
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    // Tab Navigation
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');
    const pageTitle = document.getElementById('pageTitle');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = item.getAttribute('data-tab');

            navItems.forEach(i => i.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            item.classList.add('active');
            const targetContent = document.getElementById(targetTab);
            if (targetContent) targetContent.classList.add('active');

            if (pageTitle) {
                pageTitle.textContent = item.querySelector('span').textContent;
            }

            if (window.innerWidth <= 992 && sidebar) {
                sidebar.classList.remove('open');
            }
        });
    });

    // Custom Logout Modal Trigger
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            openModal('logoutModal');
        });
    }
});

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('show');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('show');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatKeyName(key) {
    return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, str => str.toUpperCase());
}

function formatDetailsHTML(details) {
    if (!details) return '<em style="color:#888;">No details provided</em>';
    try {
        const parsed = typeof details === 'string' ? JSON.parse(details) : details;
        if (typeof parsed === 'object' && parsed !== null) {
            let html = '<ul style="list-style:none; padding:0; margin:0; font-size:0.85rem;">';
            for (const [key, value] of Object.entries(parsed)) {
                if (key === 'vehicles' && Array.isArray(value)) {
                    html += `<li style="margin-bottom:4px;"><strong>Vehicles Registered:</strong><ul style="padding-left:15px; margin-top:4px;">`;
                    value.forEach((v, idx) => {
                        html += `<li>Vehicle #${idx + 1}: ${escapeHtml(v.type || '')} | Plate: ${escapeHtml(v.plate || '')} | Model: ${escapeHtml(v.model || '')} | Color: ${escapeHtml(v.color || '')}</li>`;
                    });
                    html += `</ul></li>`;
                } else if (typeof value === 'object' && value !== null) {
                    html += `<li style="margin-bottom:4px;"><strong>${escapeHtml(formatKeyName(key))}:</strong> ${escapeHtml(JSON.stringify(value))}</li>`;
                } else {
                    html += `<li style="margin-bottom:4px;"><strong>${escapeHtml(formatKeyName(key))}:</strong> ${escapeHtml(String(value))}</li>`;
                }
            }
            html += '</ul>';
            return html;
        }
    } catch (e) {
        // Fallback for plain strings
    }
    return escapeHtml(String(details));
}

function openCheckModal(reqId) {
    const modalReqId = document.getElementById('modalReqId');
    const checkForm = document.getElementById('checkForm');
    const modalReqDetails = document.getElementById('modalReqDetails');

    if (modalReqId && checkForm) {
        modalReqId.textContent = reqId;
        checkForm.action = `/officer/check_request/${reqId}`;

        if (modalReqDetails && typeof ALL_REQUESTS !== 'undefined') {
            const req = ALL_REQUESTS.find(r => r.id === reqId);
            if (req) {
                let attachmentHtml = '<span style="color:#888;">None</span>';
                if (req.attachment) {
                    attachmentHtml = `<a href="/static/uploads/${escapeHtml(req.attachment)}" target="_blank" style="color:#2D6A4F; font-weight:600; text-decoration:underline;">View Uploaded File</a>`;
                }

                const feeFormatted = parseFloat(req.fee || 0).toFixed(2);
                const payStatus = req.payment_status || 'Unpaid';
                const statusClass = (payStatus === 'Paid') ? 'pay-paid' : 'pay-unpaid';

                modalReqDetails.innerHTML = `
                    <div style="font-size:0.88rem; line-height:1.6; color:#2D312E;">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
                            <div><strong>Homeowner:</strong> ${escapeHtml(req.homeowner)}</div>
                            <div><strong>Request Type:</strong> ${escapeHtml(req.request_type)}</div>
                            <div><strong>Fee:</strong> ₱${feeFormatted}</div>
                            <div><strong>Payment Status:</strong> <span class="pay-pill ${statusClass}">${escapeHtml(payStatus)}</span></div>
                            <div><strong>Submitted Date:</strong> ${escapeHtml(req.date_submitted)}</div>
                            <div><strong>Attachment:</strong> ${attachmentHtml}</div>
                        </div>
                        <div style="margin-top:10px; border-top:1px dashed #CBD5CB; padding-top:10px;">
                            <strong style="display:block; margin-bottom:6px; color:#1B4332;">Submitted Form Details:</strong>
                            ${formatDetailsHTML(req.details)}
                        </div>
                    </div>
                `;
            } else {
                modalReqDetails.innerHTML = '<p class="text-muted">Request details unavailable.</p>';
            }
        }
        openModal('checkModal');
    }
}