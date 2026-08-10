let pendingCancelRequestId = null;

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

document.addEventListener('DOMContentLoaded', () => {
    const btnConfirmCancel = document.getElementById('btnConfirmCancelRequest');
    if (btnConfirmCancel) {
        btnConfirmCancel.addEventListener('click', handleConfirmCancelRequest);
    }
});

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
                    ? `<button class="btn btn-sm" style="background-color: var(--error-color); color: white; padding: 4px 10px; font-size: 11px;" onclick="openCancelConfirmModal('${escapeHtml(r.id)}')">Cancel Request</button>`
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
