import os
import json
from datetime import datetime
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify, send_from_directory
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = 'nfh_hoa_secret_key_super_secure'

UPLOAD_FOLDER = os.path.join(app.root_path, 'static', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf'}

DATA_DIR = os.path.join(app.root_path, 'data')
os.makedirs(DATA_DIR, exist_ok=True)

USERS_FILE = os.path.join(DATA_DIR, 'users.json')
REQUESTS_FILE = os.path.join(DATA_DIR, 'requests.json')
FEES_FILE = os.path.join(DATA_DIR, 'fees.json')
AUDIT_FILE = os.path.join(DATA_DIR, 'audit.json')

# Helper functions for persistence
def load_json(filepath, default):
    if not os.path.exists(filepath):
        with open(filepath, 'w') as f:
            json.dump(default, f, indent=4)
        return default
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except Exception:
        return default

def save_json(filepath, data):
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=4)

# Initialize Storage Data
INITIAL_USERS = [
    {
        "id": 1,
        "username": "admin",
        "password": "adminpassword",
        "full_name": "System Administrator",
        "role": "Admin",
        "status": "Active"
    },
    {
        "id": 2,
        "username": "sec1",
        "password": "secpassword",
        "full_name": "Maria Clara",
        "role": "Secretary",
        "status": "Active"
    },
    {
        "id": 3,
        "username": "juantreasurer",
        "password": "treasurerpassword",
        "full_name": "Juan Dela Cruz",
        "role": "Treasurer",
        "status": "Active"
    },
    {
        "id": 4,
        "username": "pres1",
        "password": "prespassword",
        "full_name": "Emilio Aguinaldo",
        "role": "President",
        "status": "Active"
    },
    {
        "id": 5,
        "username": "homeowner1",
        "password": "homeownerpassword",
        "full_name": "Jose Rizal",
        "role": "Homeowner",
        "status": "Active",
        "address": "Block 1 Lot 2 NFH Subdivision"
    }
]

INITIAL_FEES = {
    "Vehicle Sticker Application - Car/SUV": {"amount": 200.0, "status": "Active"},
    "Vehicle Sticker Application - Motorcycle/Tricycle/E-bike": {"amount": 100.0, "status": "Active"},
    "Renters/Tenants Information Form": {"amount": 50.0, "status": "Active"},
    "Move-out Gate Pass": {"amount": 50.0, "status": "Active"},
    "Move-In Gate Pass": {"amount": 50.0, "status": "Active"},
    "Certificate of Improvement": {"amount": 50.0, "status": "Active"},
    "Gate Pass": {"amount": 50.0, "status": "Active"},
    "Proof of Residency": {"amount": 50.0, "status": "Active"},
    "Promissory Note": {"amount": 50.0, "status": "Active"},
    "Lifetime Membership": {"amount": 100.0, "status": "Active"}
}

users_data = load_json(USERS_FILE, INITIAL_USERS)
requests_data = load_json(REQUESTS_FILE, [])
fees_data = load_json(FEES_FILE, INITIAL_FEES)
audit_data = load_json(AUDIT_FILE, [])

def log_audit(username, role, action, item, prev_val, new_val):
    timestamp = datetime.now().strftime("%d/%m/%Y - %H:%M")
    entry = {
        "timestamp": timestamp,
        "username": username,
        "role": role,
        "action": action,
        "item": item,
        "prev_val": prev_val,
        "new_val": new_val
    }
    audit_data.append(entry)
    save_json(AUDIT_FILE, audit_data)

def get_assigned_officer_role(request_type):
    treasurer_types = [
        "Gate Pass", 
        "Vehicle Sticker Application", 
        "Renters/Tenants Information Form", 
        "Promissory Note"
    ]
    if request_type in treasurer_types:
        return "Treasurer"
    return "Secretary"

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Auth Decorators
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            flash('Please log in to access this page.', 'danger')
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function

def role_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'role' not in session or session['role'] not in roles:
                flash('Unauthorized access.', 'danger')
                return redirect(url_for('index'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# --- ROUTES ---

@app.route('/')
def index():
    if 'username' in session:
        role = session.get('role')
        if role == 'Admin':
            return redirect(url_for('admin_dashboard'))
        elif role in ['Secretary', 'Treasurer', 'President']:
            return redirect(url_for('officer_dashboard'))
        elif role == 'Homeowner':
            return redirect(url_for('home'))
    return render_template('index.html')

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')
    
    users = load_json(USERS_FILE, INITIAL_USERS)
    user = next((u for u in users if u['username'] == username and u['password'] == password), None)
    
    if user:
        if user.get('status') != 'Active':
            flash('Your account is currently inactive. Please contact system admin.', 'danger')
            return redirect(url_for('index'))
            
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['full_name'] = user['full_name']
        session['role'] = user['role']
        
        if user['role'] == 'Admin':
            return redirect(url_for('admin_dashboard'))
        elif user['role'] in ['Secretary', 'Treasurer', 'President']:
            return redirect(url_for('officer_dashboard'))
        else:
            return redirect(url_for('home'))
    else:
        flash('Invalid username or password.', 'danger')
        return redirect(url_for('index'))

@app.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out successfully.', 'info')
    return redirect(url_for('index'))

# --- HOMEOWNER ROUTES ---

@app.route('/home')
@login_required
@role_required('Homeowner')
def home():
    user_requests = [r for r in requests_data if r.get('homeowner') == session['full_name'] or r.get('homeowner_username') == session['username']]
    return render_template('home.html', user_requests=user_requests, fees=fees_data)

@app.route('/submit_request', methods=['POST'])
@login_required
@role_required('Homeowner')
def submit_request():
    req_type = request.form.get('request_type')
    details = request.form.get('details', '')
    
    filename = None
    if 'attachment' in request.files:
        file = request.files['attachment']
        if file and allowed_file(file.filename):
            fname = secure_filename(file.filename)
            filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{fname}"
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            
    req_id = f"REQ-{len(requests_data) + 1:05d}"
    assigned_role = get_assigned_officer_role(req_type)
    
    fee_amount = 0.0
    for fee_key, fee_val in fees_data.items():
        if req_type in fee_key:
            fee_amount = fee_val.get('amount', 50.0)
            break
    if fee_amount == 0.0:
        fee_amount = 50.0
        
    now_str = datetime.now().strftime("%d/%m/%Y - %H:%M")
    
    new_req = {
        "id": req_id,
        "homeowner": session['full_name'],
        "homeowner_username": session['username'],
        "request_type": req_type,
        "details": details,
        "attachment": filename,
        "assigned_officer": assigned_role,
        "status": "Submitted",
        "payment_status": "Unpaid",
        "fee": fee_amount,
        "remarks": "",
        "date_submitted": now_str,
        "last_updated": now_str
    }
    
    requests_data.append(new_req)
    save_json(REQUESTS_FILE, requests_data)
    log_audit(session['username'], session['role'], 'Submitted Request', req_id, '-', 'Submitted')
    
    flash(f'Request {req_id} submitted successfully!', 'success')
    return redirect(url_for('home'))

@app.route('/resubmit_request/<req_id>', methods=['POST'])
@login_required
@role_required('Homeowner')
def resubmit_request(req_id):
    req = next((r for r in requests_data if r['id'] == req_id), None)
    if req and req['status'] == 'For Correction':
        details = request.form.get('details', req['details'])
        req['details'] = details
        
        if 'attachment' in request.files:
            file = request.files['attachment']
            if file and allowed_file(file.filename):
                fname = secure_filename(file.filename)
                filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{fname}"
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                req['attachment'] = filename
                
        prev_status = req['status']
        req['status'] = 'Under Review'
        req['last_updated'] = datetime.now().strftime("%d/%m/%Y - %H:%M")
        save_json(REQUESTS_FILE, requests_data)
        
        log_audit(session['username'], session['role'], 'Resubmitted Request', req_id, prev_status, 'Under Review')
        flash(f'Request {req_id} resubmitted for review.', 'success')
    return redirect(url_for('home'))

# --- ADMIN ROUTES ---

@app.route('/admin')
@login_required
@role_required('Admin')
def admin_dashboard():
    users = load_json(USERS_FILE, INITIAL_USERS)
    officers = [u for u in users if u['role'] in ['Secretary', 'Treasurer', 'President']]
    audits = load_json(AUDIT_FILE, [])
    
    pending_fee_changes = [k for k, v in fees_data.items() if v.get('status') == 'Pending President Approval']
    
    metrics = {
        "total_homeowners": len([u for u in users if u['role'] == 'Homeowner']),
        "total_requests": len(requests_data),
        "pending_requests": len([r for r in requests_data if r['status'] in ['Submitted', 'Under Review']]),
        "pending_president": len([r for r in requests_data if r['status'] == 'Pending President Approval']),
        "active_officers": len([u for u in officers if u['status'] == 'Active']),
        "pending_fee_changes": len(pending_fee_changes)
    }
    
    return render_template(
        'admin.html', 
        metrics=metrics, 
        officers=officers, 
        requests=requests_data, 
        audits=audits, 
        fees=fees_data
    )

@app.route('/admin/create_officer', methods=['POST'])
@login_required
@role_required('Admin')
def create_officer():
    full_name = request.form.get('full_name')
    username = request.form.get('username')
    password = request.form.get('password')
    role = request.form.get('role')
    
    users = load_json(USERS_FILE, INITIAL_USERS)
    if any(u['username'] == username for u in users):
        flash('Username already exists.', 'danger')
        return redirect(url_for('admin_dashboard'))
        
    new_officer = {
        "id": len(users) + 1,
        "username": username,
        "password": password,
        "full_name": full_name,
        "role": role,
        "status": "Active"
    }
    users.append(new_officer)
    save_json(USERS_FILE, users)
    log_audit(session['username'], session['role'], 'Created Officer Account', username, '-', f"Role: {role}")
    flash(f'Officer {full_name} ({role}) created successfully.', 'success')
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/toggle_officer_status/<int:officer_id>', methods=['POST'])
@login_required
@role_required('Admin')
def toggle_officer_status(officer_id):
    users = load_json(USERS_FILE, INITIAL_USERS)
    user = next((u for u in users if u['id'] == officer_id), None)
    if user:
        prev_status = user['status']
        user['status'] = 'Inactive' if prev_status == 'Active' else 'Active'
        save_json(USERS_FILE, users)
        log_audit(session['username'], session['role'], 'Updated Officer Status', user['username'], prev_status, user['status'])
        flash(f'Officer {user["full_name"]} status updated to {user["status"]}.', 'info')
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/edit_officer/<int:officer_id>', methods=['POST'])
@login_required
@role_required('Admin')
def edit_officer(officer_id):
    users = load_json(USERS_FILE, INITIAL_USERS)
    user = next((u for u in users if u['id'] == officer_id), None)
    if user:
        prev_role = user['role']
        user['full_name'] = request.form.get('full_name', user['full_name'])
        user['role'] = request.form.get('role', user['role'])
        if request.form.get('password'):
            user['password'] = request.form.get('password')
        save_json(USERS_FILE, users)
        log_audit(session['username'], session['role'], 'Edited Officer Details', user['username'], prev_role, user['role'])
        flash(f'Officer {user["username"]} updated.', 'success')
    return redirect(url_for('admin_dashboard'))

# --- OFFICER ROUTES ---

@app.route('/officer')
@login_required
@role_required('Secretary', 'Treasurer', 'President')
def officer_dashboard():
    role = session['role']
    
    # Filter assigned requests
    if role in ['Secretary', 'Treasurer']:
        assigned_reqs = [r for r in requests_data if r['assigned_officer'] == role]
    else:
        # President views requests pending final approval
        assigned_reqs = [r for r in requests_data if r['status'] == 'Pending President Approval']
        
    audits = load_json(AUDIT_FILE, [])
    relevant_audits = [a for a in audits if a['role'] == role or role == 'President']
    
    return render_template(
        'officer.html', 
        role=role, 
        requests=requests_data, 
        assigned_requests=assigned_reqs, 
        fees=fees_data, 
        audits=relevant_audits
    )

@app.route('/officer/check_request/<req_id>', methods=['POST'])
@login_required
@role_required('Secretary', 'Treasurer')
def check_request(req_id):
    req = next((r for r in requests_data if r['id'] == req_id), None)
    if req:
        if req['assigned_officer'] != session['role']:
            flash('This request is not assigned to your role.', 'danger')
            return redirect(url_for('officer_dashboard'))
            
        action = request.form.get('action') # 'check' or 'correction'
        remarks = request.form.get('remarks', '')
        prev_status = req['status']
        
        req['remarks'] = remarks
        req['last_updated'] = datetime.now().strftime("%d/%m/%Y - %H:%M")
        
        if action == 'check':
            req['status'] = 'Checked'
            # Auto-advance to Pending President Approval if payment is already paid
            if req['payment_status'] == 'Paid':
                req['status'] = 'Pending President Approval'
            log_audit(session['username'], session['role'], 'Checked Request Requirements', req_id, prev_status, req['status'])
            flash(f'Request {req_id} marked as Checked.', 'success')
        elif action == 'correction':
            if not remarks:
                flash('Remarks are required when returning for correction.', 'warning')
                return redirect(url_for('officer_dashboard'))
            req['status'] = 'For Correction'
            log_audit(session['username'], session['role'], 'Returned Request for Correction', req_id, prev_status, 'For Correction')
            flash(f'Request {req_id} returned for correction.', 'info')
            
        save_json(REQUESTS_FILE, requests_data)
    return redirect(url_for('officer_dashboard'))

@app.route('/officer/update_payment/<req_id>', methods=['POST'])
@login_required
@role_required('Treasurer')
def update_payment(req_id):
    req = next((r for r in requests_data if r['id'] == req_id), None)
    if req:
        prev_pay = req['payment_status']
        req['payment_status'] = 'Paid'
        req['last_updated'] = datetime.now().strftime("%d/%m/%Y - %H:%M")
        
        # If already checked by officer, auto-advance to Pending President Approval
        if req['status'] == 'Checked':
            req['status'] = 'Pending President Approval'
            
        save_json(REQUESTS_FILE, requests_data)
        log_audit(session['username'], session['role'], 'Updated Payment Status', req_id, f"Payment: {prev_pay}", "Payment: Paid")
        flash(f'Payment for {req_id} marked as Paid.', 'success')
    return redirect(url_for('officer_dashboard'))

@app.route('/officer/propose_fee', methods=['POST'])
@login_required
@role_required('Treasurer')
def propose_fee():
    fee_name = request.form.get('fee_name')
    new_amount = float(request.form.get('amount', 0))
    
    if fee_name in fees_data:
        prev_amount = fees_data[fee_name]['amount']
        fees_data[fee_name]['proposed_amount'] = new_amount
        fees_data[fee_name]['status'] = 'Pending President Approval'
        save_json(FEES_FILE, fees_data)
        
        log_audit(session['username'], session['role'], 'Updated Fixed Fee Proposal', fee_name, f"₱{prev_amount:.2f}", f"Proposed: ₱{new_amount:.2f}")
        flash(f'Fee change proposed for {fee_name}. Pending President approval.', 'info')
    return redirect(url_for('officer_dashboard'))

@app.route('/officer/president_action/<req_id>', methods=['POST'])
@login_required
@role_required('President')
def president_action(req_id):
    req = next((r for r in requests_data if r['id'] == req_id), None)
    if req:
        action = request.form.get('action') # 'approve' or 'reject'
        remarks = request.form.get('remarks', '')
        prev_status = req['status']
        
        req['remarks'] = remarks
        req['last_updated'] = datetime.now().strftime("%d/%m/%Y - %H:%M")
        
        if action == 'approve':
            req['status'] = 'Approved'
            log_audit(session['username'], session['role'], 'Final Approved Request', req_id, prev_status, 'Approved')
            flash(f'Request {req_id} HAS BEEN APPROVED.', 'success')
        elif action == 'reject':
            req['status'] = 'Rejected'
            log_audit(session['username'], session['role'], 'Final Rejected Request', req_id, prev_status, 'Rejected')
            flash(f'Request {req_id} HAS BEEN REJECTED.', 'danger')
            
        save_json(REQUESTS_FILE, requests_data)
    return redirect(url_for('officer_dashboard'))

@app.route('/officer/president_fee_action', methods=['POST'])
@login_required
@role_required('President')
def president_fee_action():
    fee_name = request.form.get('fee_name')
    action = request.form.get('action') # 'approve' or 'reject'
    
    if fee_name in fees_data:
        fee = fees_data[fee_name]
        prev_amount = fee['amount']
        proposed = fee.get('proposed_amount', prev_amount)
        
        if action == 'approve':
            fee['amount'] = proposed
            fee['status'] = 'Active'
            fee.pop('proposed_amount', None)
            log_audit(session['username'], session['role'], 'Approved Fixed Fee Update', fee_name, f"₱{prev_amount:.2f}", f"₱{proposed:.2f}")
            flash(f'Approved new fee for {fee_name}: ₱{proposed:.2f}', 'success')
        else:
            fee['status'] = 'Active'
            fee.pop('proposed_amount', None)
            log_audit(session['username'], session['role'], 'Rejected Fixed Fee Update', fee_name, f"Proposed: ₱{proposed:.2f}", "Kept Original")
            flash(f'Rejected proposed fee change for {fee_name}.', 'warning')
            
        save_json(FEES_FILE, fees_data)
    return redirect(url_for('officer_dashboard'))

if __name__ == '__main__':
    app.run(debug=True)