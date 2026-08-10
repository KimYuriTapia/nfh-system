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

# Jinja Filter to format JSON request details into readable text
@app.template_filter('format_details')
def format_details_filter(details):
    if not details:
        return 'None'
    try:
        parsed = json.loads(details) if isinstance(details, str) else details
        if isinstance(parsed, dict):
            items = []
            for k, v in parsed.items():
                if k == 'vehicles' and isinstance(v, list):
                    v_str = ", ".join([f"{item.get('type')}: {item.get('plate')}" for item in v if isinstance(item, dict)])
                    items.append(f"Vehicles: [{v_str}]")
                else:
                    readable_key = k.replace('_', ' ').title()
                    items.append(f"{readable_key}: {v}")
            return "; ".join(items)
    except Exception:
        pass
    return str(details)

INITIAL_USERS = [
    {
        "id": 1,
        "username": "admin",
        "password": "adminpassword",
        "full_name": "System Administrator",
        "first_name": "System",
        "last_name": "Administrator",
        "role": "Admin",
        "status": "Active"
    },
    {
        "id": 2,
        "username": "juday_secretary",
        "password": "password",
        "full_name": "Juday Martinez",
        "first_name": "Juday",
        "last_name": "Martinez",
        "role": "Secretary",
        "status": "Active"
    },
    {
        "id": 3,
        "username": "juan_treasurer",
        "password": "password",
        "full_name": "Juan Dela Cruz",
        "first_name": "Juan",
        "last_name": "Dela Cruz",
        "role": "Treasurer",
        "status": "Active"
    },
    {
        "id": 4,
        "username": "maria_president",
        "password": "password",
        "full_name": "Maria Clara",
        "first_name": "Maria",
        "last_name": "Clara",
        "role": "President",
        "status": "Active"
    },
    {
        "id": 5,
        "username": "homeowner1",
        "password": "homeownerpassword",
        "full_name": "Jose Rizal",
        "first_name": "Jose",
        "last_name": "Rizal",
        "role": "Homeowner",
        "status": "Active",
        "address": "Block 1 Lot 2 NFH Subdivision",
        "block": "Block 1",
        "lot": "Lot 2",
        "email": "jose.rizal@example.com",
        "mobile": "+639123456789"
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
    if any(tt.lower() in request_type.lower() for tt in treasurer_types):
        return "Treasurer"
    return "Secretary"

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_role_redirect_url(role):
    if role == 'Admin':
        return url_for('admin_dashboard')
    elif role in ['Secretary', 'Treasurer', 'President']:
        return url_for('officer_dashboard')
    elif role == 'Homeowner':
        return url_for('home')
    return url_for('index')

# Auth Decorators
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            if request.path.startswith('/api/'):
                return jsonify({"status": "error", "message": "Authentication required."}), 401
            flash('Please log in to access this page.', 'danger')
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function

def role_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'role' not in session or session['role'] not in roles:
                if request.path.startswith('/api/'):
                    return jsonify({"status": "error", "message": "Unauthorized access."}), 403
                flash('Unauthorized access.', 'danger')
                return redirect(url_for('index'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@app.route('/static/<path:filename>')
def serve_static(filename):
    static_folder = os.path.join(app.root_path, 'static')
    response = send_from_directory(static_folder, filename)
    if filename.endswith('.css'):
        response.headers['Content-Type'] = 'text/css; charset=utf-8'
    elif filename.endswith('.js'):
        response.headers['Content-Type'] = 'application/javascript; charset=utf-8'
    return response

# --- AUTH ROUTES ---

@app.route('/')
def index():
    if 'username' in session:
        return redirect(get_role_redirect_url(session.get('role')))
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
        session['full_name'] = user.get('full_name', f"{user.get('first_name', '')} {user.get('last_name', '')}".strip())
        session['role'] = user['role']
        
        return redirect(get_role_redirect_url(user['role']))
    else:
        flash('Invalid username or password.', 'danger')
        return redirect(url_for('index'))

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    users = load_json(USERS_FILE, INITIAL_USERS)
    user = next((u for u in users if u['username'] == username and u['password'] == password), None)

    if user:
        if user.get('status') != 'Active':
            return jsonify({"status": "error", "message": "Account inactive. Contact admin."}), 403

        session['user_id'] = user['id']
        session['username'] = user['username']
        session['full_name'] = user.get('full_name', f"{user.get('first_name', '')} {user.get('last_name', '')}".strip())
        session['role'] = user['role']

        redirect_url = get_role_redirect_url(user['role'])
        return jsonify({
            "status": "success",
            "message": "Login successful",
            "redirect": redirect_url
        })
    else:
        return jsonify({"status": "error", "message": "Invalid username or password."}), 401

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json() or {}
    first_name = data.get('first_name', '').strip()
    last_name = data.get('last_name', '').strip()
    email = data.get('email', '').strip()
    username = data.get('username', '').strip()
    phone = data.get('phone', '').strip()
    password = data.get('password', '')
    password_confirm = data.get('password_confirm', '')

    if not all([first_name, last_name, email, username, phone, password]):
        return jsonify({"status": "error", "message": "All required fields must be filled."}), 400

    if password != password_confirm:
        return jsonify({"status": "error", "message": "Passwords do not match."}), 400

    users = load_json(USERS_FILE, INITIAL_USERS)

    if any(u['username'].lower() == username.lower() for u in users):
        return jsonify({"status": "error", "message": "Username is already taken."}), 400

    if any(u.get('email', '').lower() == email.lower() for u in users):
        return jsonify({"status": "error", "message": "Email address is already registered."}), 400

    new_user = {
        "id": len(users) + 1,
        "username": username,
        "password": password,
        "first_name": first_name,
        "last_name": last_name,
        "full_name": f"{first_name} {last_name}".strip(),
        "email": email,
        "mobile": phone,
        "role": "Homeowner",
        "status": "Active",
        "date_joined": datetime.now().strftime("%Y-%m-%d"),
        "household": 1,
        "block": "",
        "lot": ""
    }

    users.append(new_user)
    save_json(USERS_FILE, users)
    log_audit(username, "Homeowner", "Self Registration", username, "-", "Account Created")

    return jsonify({"status": "success", "message": "Registration successful! You can now log in."})

@app.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out successfully.', 'info')
    return redirect(url_for('index'))

@app.route('/api/logout', methods=['POST', 'GET'])
def api_logout():
    session.clear()
    return jsonify({"status": "success", "message": "Logged out successfully."})

# --- HOMEOWNER ROUTES ---

@app.route('/home')
@login_required
@role_required('Homeowner')
def home():
    user_requests = [r for r in requests_data if r.get('homeowner') == session['full_name'] or r.get('homeowner_username') == session['username']]
    return render_template('home.html', user_requests=user_requests, fees=fees_data)

@app.route('/api/user-data', methods=['GET'])
@login_required
@role_required('Homeowner')
def api_user_data():
    users = load_json(USERS_FILE, INITIAL_USERS)
    user = next((u for u in users if u['id'] == session.get('user_id')), None)
    
    if not user:
        return jsonify({"status": "error", "message": "User not found."}), 404

    reqs = load_json(REQUESTS_FILE, [])
    user_reqs = [r for r in reqs if r.get('homeowner_username') == session['username'] or r.get('homeowner') == session['full_name']]

    active_reqs = len([r for r in user_reqs if r.get('status') not in ['Approved', 'Rejected']])
    unpaid_reqs = [r for r in user_reqs if r.get('payment_status') == 'Unpaid' and r.get('status') != 'Rejected']
    outstanding_dues = sum(float(r.get('fee', 0)) for r in unpaid_reqs)

    formatted_reqs = []
    for r in user_reqs:
        formatted_reqs.append({
            "id": r.get("id"),
            "type": r.get("request_type"),
            "date": r.get("date_submitted"),
            "fee": f"₱{float(r.get('fee', 0)):.2f}",
            "payment_status": r.get("payment_status", "Unpaid"),
            "status": r.get("status", "Pending")
        })

    dashboard = {
        "active_requests": active_reqs,
        "unread_alerts": 0,
        "outstanding_dues": outstanding_dues,
        "requests": formatted_reqs,
        "alerts": []
    }

    return jsonify({"status": "success", "user": user, "dashboard": dashboard})

@app.route('/api/profile/update', methods=['POST'])
@login_required
@role_required('Homeowner')
def api_profile_update():
    data = request.get_json() or {}
    users = load_json(USERS_FILE, INITIAL_USERS)
    
    for u in users:
        if u['id'] == session['user_id']:
            u['first_name'] = data.get('first_name', u.get('first_name'))
            u['middle_name'] = data.get('middle_name', u.get('middle_name'))
            u['last_name'] = data.get('last_name', u.get('last_name'))
            u['suffix'] = data.get('suffix', u.get('suffix'))
            u['gender'] = data.get('gender', u.get('gender'))
            u['dob'] = data.get('dob', u.get('dob'))
            u['civil_status'] = data.get('civil_status', u.get('civil_status'))
            u['block'] = data.get('block', u.get('block'))
            u['lot'] = data.get('lot', u.get('lot'))
            u['email'] = data.get('email', u.get('email'))
            u['mobile'] = data.get('mobile', u.get('mobile'))
            u['household'] = data.get('household', u.get('household'))
            u['full_name'] = f"{u['first_name']} {u['last_name']}".strip()
            session['full_name'] = u['full_name']
            break
            
    save_json(USERS_FILE, users)
    log_audit(session['username'], session['role'], 'Updated Profile', session['username'], 'Profile Details', 'Updated')
    return jsonify({"status": "success", "message": "Profile updated successfully."})

@app.route('/api/profile/photo', methods=['POST'])
@login_required
@role_required('Homeowner')
def api_profile_photo():
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No file uploaded."}), 400
    file = request.files['file']
    if file and allowed_file(file.filename):
        fname = secure_filename(file.filename)
        filename = f"avatar_{session['user_id']}_{int(datetime.now().timestamp())}_{fname}"
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        
        image_url = url_for('static', filename=f'uploads/{filename}')
        users = load_json(USERS_FILE, INITIAL_USERS)
        for u in users:
            if u['id'] == session['user_id']:
                u['profile_image'] = image_url
                break
        save_json(USERS_FILE, users)
        return jsonify({"status": "success", "message": "Photo uploaded successfully.", "image_url": image_url})
    return jsonify({"status": "error", "message": "Invalid file format."}), 400

@app.route('/api/settings/update', methods=['POST'])
@login_required
@role_required('Homeowner')
def api_settings_update():
    data = request.get_json() or {}
    users = load_json(USERS_FILE, INITIAL_USERS)
    for u in users:
        if u['id'] == session['user_id']:
            if 'emergency' in data:
                u['emergency'] = data['emergency']
            if 'preferences' in data:
                u['preferences'] = data['preferences']
            break
    save_json(USERS_FILE, users)
    return jsonify({"status": "success", "message": "Settings updated."})

@app.route('/api/settings/password', methods=['POST'])
@login_required
def api_settings_password():
    data = request.get_json() or {}
    curr_pass = data.get('current_password')
    new_pass = data.get('new_password')
    conf_pass = data.get('confirm_password')

    if not curr_pass or not new_pass or not conf_pass:
        return jsonify({"status": "error", "message": "All password fields are required."}), 400
    if new_pass != conf_pass:
        return jsonify({"status": "error", "message": "New passwords do not match."}), 400

    users = load_json(USERS_FILE, INITIAL_USERS)
    for u in users:
        if u['id'] == session['user_id']:
            if u['password'] != curr_pass:
                return jsonify({"status": "error", "message": "Incorrect current password."}), 400
            u['password'] = new_pass
            save_json(USERS_FILE, users)
            log_audit(session['username'], session['role'], 'Password Change', session['username'], 'Password', 'Changed')
            return jsonify({"status": "success", "message": "Password changed successfully."})

    return jsonify({"status": "error", "message": "User not found."}), 404

@app.route('/api/requests/submit', methods=['POST'])
@login_required
@role_required('Homeowner')
def api_request_submit():
    data = request.get_json() or {}
    req_title = data.get('title', 'Document Request')
    form_data = data.get('formData', {})

    reqs = load_json(REQUESTS_FILE, [])
    fees = load_json(FEES_FILE, INITIAL_FEES)

    fee_amount = 50.0
    for fee_key, fee_val in fees.items():
        if req_title.lower() in fee_key.lower():
            fee_amount = fee_val.get('amount', 50.0)
            break

    if 'vehicles' in form_data and isinstance(form_data['vehicles'], list):
        calc_fee = 0.0
        v_prices = {'4 Wheels': 100.0, '2 Wheels': 50.0, '3 Wheels': 50.0}
        for v in form_data['vehicles']:
            v_type = v.get('type', '4 Wheels')
            calc_fee += v_prices.get(v_type, 100.0)
        if calc_fee > 0:
            fee_amount = calc_fee

    req_id = f"REQ-{len(reqs) + 1:05d}"
    assigned_role = get_assigned_officer_role(req_title)
    now_str = datetime.now().strftime("%d/%m/%Y - %H:%M")

    new_req = {
        "id": req_id,
        "homeowner": session['full_name'],
        "homeowner_username": session['username'],
        "request_type": req_title,
        "details": json.dumps(form_data),
        "attachment": None,
        "assigned_officer": assigned_role,
        "status": "Submitted",
        "payment_status": "Unpaid",
        "fee": fee_amount,
        "remarks": "",
        "date_submitted": now_str,
        "last_updated": now_str
    }

    reqs.append(new_req)
    save_json(REQUESTS_FILE, reqs)

    global requests_data
    requests_data = reqs

    log_audit(session['username'], session['role'], 'Submitted Request', req_id, '-', 'Submitted')
    return jsonify({"status": "success", "message": f"Request {req_id} submitted successfully!"})

@app.route('/api/alerts/read', methods=['POST'])
@login_required
def api_alerts_read():
    return jsonify({"status": "success", "message": "Alerts marked as read."})

# --- ADMIN ROUTES ---

@app.route('/admin')
@login_required
@role_required('Admin')
def admin_dashboard():
    users = load_json(USERS_FILE, INITIAL_USERS)
    officers = [u for u in users if u['role'] in ['Secretary', 'Treasurer', 'President']]
    audits = load_json(AUDIT_FILE, [])
    reqs = load_json(REQUESTS_FILE, [])
    fees = load_json(FEES_FILE, INITIAL_FEES)
    
    pending_fee_changes = [k for k, v in fees.items() if v.get('status') == 'Pending President Approval']
    
    metrics = {
        "total_homeowners": len([u for u in users if u['role'] == 'Homeowner']),
        "total_requests": len(reqs),
        "pending_requests": len([r for r in reqs if r['status'] in ['Submitted', 'Under Review']]),
        "pending_president": len([r for r in reqs if r['status'] == 'Pending President Approval']),
        "active_officers": len([u for u in officers if u['status'] == 'Active']),
        "pending_fee_changes": len(pending_fee_changes)
    }
    
    return render_template(
        'admin.html', 
        metrics=metrics, 
        officers=officers, 
        requests=reqs, 
        audits=audits, 
        fees=fees
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

# --- OFFICER ROUTES ---

@app.route('/officer')
@login_required
@role_required('Secretary', 'Treasurer', 'President')
def officer_dashboard():
    role = session['role']
    reqs = load_json(REQUESTS_FILE, [])
    fees = load_json(FEES_FILE, INITIAL_FEES)
    
    if role in ['Secretary', 'Treasurer']:
        assigned_reqs = [r for r in reqs if r.get('assigned_officer') == role]
    else:
        assigned_reqs = [r for r in reqs if r.get('status') == 'Pending President Approval']
        
    audits = load_json(AUDIT_FILE, [])
    relevant_audits = [a for a in audits if a.get('role') == role or role == 'President']
    
    return render_template(
        'officer.html', 
        role=role, 
        requests=reqs, 
        assigned_requests=assigned_reqs, 
        fees=fees, 
        audits=relevant_audits
    )

@app.route('/officer/check_request/<req_id>', methods=['POST'])
@login_required
@role_required('Secretary', 'Treasurer')
def check_request(req_id):
    reqs = load_json(REQUESTS_FILE, [])
    req = next((r for r in reqs if r['id'] == req_id), None)
    if req:
        if req['assigned_officer'] != session['role']:
            flash('This request is not assigned to your role.', 'danger')
            return redirect(url_for('officer_dashboard'))
            
        action = request.form.get('action')
        remarks = request.form.get('remarks', '')
        prev_status = req['status']
        
        req['remarks'] = remarks
        req['last_updated'] = datetime.now().strftime("%d/%m/%Y - %H:%M")
        
        if action == 'check':
            req['status'] = 'Checked'
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
            
        save_json(REQUESTS_FILE, reqs)
    return redirect(url_for('officer_dashboard'))

@app.route('/officer/update_payment/<req_id>', methods=['POST'])
@login_required
@role_required('Treasurer')
def update_payment(req_id):
    reqs = load_json(REQUESTS_FILE, [])
    req = next((r for r in reqs if r['id'] == req_id), None)
    if req:
        prev_pay = req['payment_status']
        req['payment_status'] = 'Paid'
        req['last_updated'] = datetime.now().strftime("%d/%m/%Y - %H:%M")
        
        if req['status'] == 'Checked':
            req['status'] = 'Pending President Approval'
            
        save_json(REQUESTS_FILE, reqs)
        log_audit(session['username'], session['role'], 'Updated Payment Status', req_id, f"Payment: {prev_pay}", "Payment: Paid")
        flash(f'Payment for {req_id} marked as Paid.', 'success')
    return redirect(url_for('officer_dashboard'))

@app.route('/officer/propose_fee', methods=['POST'])
@login_required
@role_required('Treasurer')
def propose_fee():
    fees = load_json(FEES_FILE, INITIAL_FEES)
    fee_name = request.form.get('fee_name')
    new_amount = float(request.form.get('amount', 0))
    
    if fee_name in fees:
        prev_amount = fees[fee_name]['amount']
        fees[fee_name]['proposed_amount'] = new_amount
        fees[fee_name]['status'] = 'Pending President Approval'
        save_json(FEES_FILE, fees)
        
        log_audit(session['username'], session['role'], 'Updated Fixed Fee Proposal', fee_name, f"₱{prev_amount:.2f}", f"Proposed: ₱{new_amount:.2f}")
        flash(f'Fee change proposed for {fee_name}. Pending President approval.', 'info')
    return redirect(url_for('officer_dashboard'))

@app.route('/officer/president_action/<req_id>', methods=['POST'])
@login_required
@role_required('President')
def president_action(req_id):
    reqs = load_json(REQUESTS_FILE, [])
    req = next((r for r in reqs if r['id'] == req_id), None)
    if req:
        action = request.form.get('action')
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
            
        save_json(REQUESTS_FILE, reqs)
    return redirect(url_for('officer_dashboard'))

@app.route('/officer/president_fee_action', methods=['POST'])
@login_required
@role_required('President')
def president_fee_action():
    fees = load_json(FEES_FILE, INITIAL_FEES)
    fee_name = request.form.get('fee_name')
    action = request.form.get('action')
    
    if fee_name in fees:
        fee = fees[fee_name]
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
            
        save_json(FEES_FILE, fees)
    return redirect(url_for('officer_dashboard'))

if __name__ == '__main__':
    app.run(debug=True)
