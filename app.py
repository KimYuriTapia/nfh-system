import os
import random
import string
import json
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash
from flask_mail import Mail, Message
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import pymysql
import pymysql.cursors
from whitenoise import WhiteNoise

# Load local environment variables if available
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'default_secret_key_nfh')

# Wrap Flask WSGI application with WhiteNoise for serving static assets in production
app.wsgi_app = WhiteNoise(app.wsgi_app, root='static/', prefix='static/')

# Custom Jinja2 Filter for Request Form Details Formatting
@app.template_filter('format_details')
def format_details(details):
    if not details:
        return 'None'
    try:
        parsed = json.loads(details) if isinstance(details, str) else details
        if isinstance(parsed, dict):
            items = []
            for k, v in parsed.items():
                if k == 'vehicles' and isinstance(v, list):
                    items.append(f"Vehicles: {len(v)}")
                else:
                    items.append(f"{k.replace('_', ' ').title()}: {v}")
            return ', '.join(items)
    except Exception:
        pass
    return str(details)

# Database configuration dynamically fetched from environment variables
DB_HOST = os.getenv('MYSQL_HOST', 'localhost')
DB_USER = os.getenv('MYSQL_USER', 'root')
DB_PASSWORD = os.getenv('MYSQL_PASSWORD', '')
DB_NAME = os.getenv('MYSQL_DB', 'nfh-system')
DB_PORT = int(os.getenv('MYSQL_PORT', 3306))

# Mail configuration dynamically fetched from environment variables
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'True').lower() in ['true', '1', 't']
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_USERNAME')

mail = Mail(app)

def get_db_connection():
    return pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        port=DB_PORT,
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True
    )

VERIFICATION_CODES = {}
RESET_CODES = {}

def generate_code(length=6):
    return ''.join(random.choices(string.digits, k=length))

def log_audit_action(username, role, action, item, prev_val=None, new_val=None):
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO audit_logs (username, role, action, item, prev_val, new_val)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (username, role, action, item, str(prev_val) if prev_val else None, str(new_val) if new_val else None))
        conn.close()
    except Exception as e:
        print(f"Audit log error: {e}")

# ============================================================================
# PAGE ROUTES
# ============================================================================

@app.route('/')
def index():
    if 'user_id' in session:
        role = session.get('role', 'Homeowner')
        if role == 'Homeowner':
            return redirect(url_for('homeowner'))
        elif role in ['Secretary', 'Treasurer', 'President']:
            return redirect(url_for('officer'))
        elif role == 'Admin':
            return redirect(url_for('admin'))
    return render_template('index.html')

@app.route('/home')
def homeowner():
    if 'user_id' not in session:
        return redirect(url_for('index'))
    return render_template('homeowner.html')

@app.route('/officer')
def officer():
    if 'user_id' not in session or session.get('role') not in ['Secretary', 'Treasurer', 'President', 'Admin']:
        return redirect(url_for('index'))

    role = session.get('role', 'Secretary')
    username = session.get('username')

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # All Requests
            cursor.execute("""
                SELECT r.id, CONCAT(u.first_name, ' ', u.last_name) AS homeowner, r.request_type, 
                       r.assigned_officer, r.status, r.payment_status, r.fee, r.details, r.attachment, r.remarks,
                       DATE_FORMAT(r.date_submitted, '%%Y-%%m-%%d %%H:%%i') AS date_submitted,
                       DATE_FORMAT(r.last_updated, '%%Y-%%m-%%d %%H:%%i') AS last_updated
                FROM requests r
                JOIN users u ON r.user_id = u.id
                ORDER BY r.date_submitted DESC
            """)
            all_requests = cursor.fetchall()

            # Assigned Requests filtered by Officer Role
            if role == 'Secretary':
                assigned_requests = [r for r in all_requests if r['status'] in ['Submitted', 'Under Review', 'For Correction']]
            elif role == 'Treasurer':
                assigned_requests = [r for r in all_requests if r['status'] == 'Checked' or r['payment_status'] == 'Unpaid']
            elif role == 'President':
                assigned_requests = [r for r in all_requests if r['status'] == 'Pending President Approval']
            else:
                assigned_requests = all_requests

            # Fees Configuration Dictionary
            cursor.execute("SELECT item_name, amount, proposed_amount, status FROM fees ORDER BY item_name ASC")
            fees_rows = cursor.fetchall()
            fees = {
                row['item_name']: {
                    'amount': float(row['amount']),
                    'proposed_amount': float(row['proposed_amount']) if row.get('proposed_amount') is not None else None,
                    'status': row['status']
                } for row in fees_rows
            }

            # Role Activity Log
            cursor.execute("SELECT * FROM audit_logs WHERE role = %s OR username = %s ORDER BY timestamp ASC", (role, username))
            audits_rows = cursor.fetchall()

        conn.close()

        if 'full_name' not in session:
            session['full_name'] = username

        return render_template(
            'officer.html',
            role=role,
            requests=all_requests,
            assigned_requests=assigned_requests,
            fees=fees,
            audits=audits_rows
        )

    except Exception as e:
        print(f"Officer Route Error: {e}")
        return render_template(
            'officer.html',
            role=role,
            requests=[],
            assigned_requests=[],
            fees={},
            audits=[]
        )

@app.route('/admin')
def admin():
    if 'user_id' not in session or session.get('role') != 'Admin':
        return redirect(url_for('index'))

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) AS total FROM users WHERE role = 'Homeowner'")
            total_homeowners = cursor.fetchone()['total']

            cursor.execute("SELECT COUNT(*) AS total FROM requests")
            total_requests = cursor.fetchone()['total']

            cursor.execute("SELECT COUNT(*) AS total FROM requests WHERE status IN ('Submitted', 'Under Review', 'Checked', 'For Correction')")
            pending_requests = cursor.fetchone()['total']

            cursor.execute("SELECT COUNT(*) AS total FROM requests WHERE status = 'Pending President Approval'")
            pending_president = cursor.fetchone()['total']

            cursor.execute("SELECT COUNT(*) AS total FROM users WHERE role IN ('Secretary', 'Treasurer', 'President') AND status = 'Active'")
            active_officers = cursor.fetchone()['total']

            cursor.execute("SELECT COUNT(*) AS total FROM fees WHERE status = 'Pending President Approval'")
            pending_fee_changes = cursor.fetchone()['total']

            cursor.execute("SELECT * FROM audit_logs ORDER BY timestamp ASC")
            audits_rows = cursor.fetchall()

            cursor.execute("""
                SELECT id, CONCAT(first_name, ' ', last_name) AS full_name, username, role, status 
                FROM users 
                WHERE role IN ('Secretary', 'Treasurer', 'President') 
                ORDER BY created_at DESC
            """)
            officers = cursor.fetchall()

            cursor.execute("""
                SELECT r.id, CONCAT(u.first_name, ' ', u.last_name) AS homeowner, r.request_type, 
                       r.assigned_officer, r.status, r.payment_status, 
                       DATE_FORMAT(r.date_submitted, '%%Y-%%m-%%d %%H:%%i') AS date_submitted,
                       DATE_FORMAT(r.last_updated, '%%Y-%%m-%%d %%H:%%i') AS last_updated
                FROM requests r
                JOIN users u ON r.user_id = u.id
                ORDER BY r.date_submitted DESC
            """)
            requests_list = cursor.fetchall()

            cursor.execute("SELECT item_name, amount, proposed_amount, status FROM fees ORDER BY item_name ASC")
            fees_rows = cursor.fetchall()
            fees = {
                row['item_name']: {
                    'amount': float(row['amount']),
                    'proposed_amount': float(row['proposed_amount']) if row.get('proposed_amount') is not None else None,
                    'status': row['status']
                } for row in fees_rows
            }

        conn.close()

        if 'full_name' not in session:
            session['full_name'] = session.get('username', 'System Admin')

        metrics = {
            'total_homeowners': total_homeowners,
            'total_requests': total_requests,
            'pending_requests': pending_requests,
            'pending_president': pending_president,
            'active_officers': active_officers,
            'pending_fee_changes': pending_fee_changes
        }

        return render_template(
            'admin.html',
            metrics=metrics,
            audits=audits_rows,
            officers=officers,
            requests=requests_list,
            fees=fees
        )

    except Exception as e:
        print(f"Admin Route Error: {e}")
        return render_template(
            'admin.html',
            metrics={'total_homeowners': 0, 'total_requests': 0, 'pending_requests': 0, 'pending_president': 0, 'active_officers': 0, 'pending_fee_changes': 0},
            audits=[], officers=[], requests=[], fees={}
        )

# ============================================================================
# OFFICER SPECIFIC ENDPOINTS & WORKFLOW ACTIONS
# ============================================================================

@app.route('/officer/check_request/<req_id>', methods=['POST'])
def check_request(req_id):
    if 'user_id' not in session or session.get('role') not in ['Secretary', 'Treasurer', 'President', 'Admin']:
        return redirect(url_for('index'))

    action = request.form.get('action')
    remarks = request.form.get('remarks', '').strip()

    new_status = 'Checked' if action == 'check' else 'For Correction'

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT status FROM requests WHERE id = %s", (req_id,))
            prev_req = cursor.fetchone()
            prev_status = prev_req['status'] if prev_req else 'Unknown'

            # Advance to President Approval if checked
            if action == 'check':
                new_status = 'Pending President Approval'

            cursor.execute("""
                UPDATE requests 
                SET status = %s, remarks = %s 
                WHERE id = %s
            """, (new_status, remarks, req_id))

        conn.close()
        log_audit_action(session.get('username'), session.get('role'), f'Request {action.title()}', req_id, prev_status, new_status)
        flash(f'Request {req_id} updated to {new_status}.', 'success')
    except Exception as e:
        flash(f'Error updating request: {str(e)}', 'error')

    return redirect(url_for('officer'))

@app.route('/officer/update_payment/<req_id>', methods=['POST'])
def update_payment(req_id):
    if 'user_id' not in session or session.get('role') not in ['Treasurer', 'Admin']:
        return redirect(url_for('index'))

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("UPDATE requests SET payment_status = 'Paid' WHERE id = %s", (req_id,))
        conn.close()

        log_audit_action(session.get('username'), session.get('role'), 'Verify Payment', req_id, 'Unpaid', 'Paid')
        flash(f'Payment for request {req_id} marked as Paid.', 'success')
    except Exception as e:
        flash(f'Error updating payment status: {str(e)}', 'error')

    return redirect(url_for('officer'))

@app.route('/officer/propose_fee', methods=['POST'])
def propose_fee():
    if 'user_id' not in session or session.get('role') not in ['Treasurer', 'Admin']:
        return redirect(url_for('index'))

    fee_name = request.form.get('fee_name')
    amount = request.form.get('amount')

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                UPDATE fees 
                SET proposed_amount = %s, status = 'Pending President Approval' 
                WHERE item_name = %s
            """, (amount, fee_name))
        conn.close()

        log_audit_action(session.get('username'), session.get('role'), 'Propose Fee Update', fee_name, None, amount)
        flash(f'Proposed updated fee for {fee_name} submitted for President approval.', 'success')
    except Exception as e:
        flash(f'Error proposing fee update: {str(e)}', 'error')

    return redirect(url_for('officer'))

@app.route('/officer/president_action/<req_id>', methods=['POST'])
def president_action(req_id):
    if 'user_id' not in session or session.get('role') not in ['President', 'Admin']:
        return redirect(url_for('index'))

    action = request.form.get('action')
    remarks = request.form.get('remarks', '').strip()
    new_status = 'Approved' if action == 'approve' else 'Rejected'

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("UPDATE requests SET status = %s, remarks = %s WHERE id = %s", (new_status, remarks, req_id))
        conn.close()

        log_audit_action(session.get('username'), session.get('role'), f'Executive Decision ({action.title()})', req_id, 'Pending President Approval', new_status)
        flash(f'Request {req_id} decision recorded as {new_status}.', 'success')
    except Exception as e:
        flash(f'Error recording executive decision: {str(e)}', 'error')

    return redirect(url_for('officer'))

@app.route('/officer/president_fee_action', methods=['POST'])
def president_fee_action():
    if 'user_id' not in session or session.get('role') not in ['President', 'Admin']:
        return redirect(url_for('index'))

    fee_name = request.form.get('fee_name')
    action = request.form.get('action')

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT amount, proposed_amount FROM fees WHERE item_name = %s", (fee_name,))
            fee = cursor.fetchone()

            if action == 'approve' and fee and fee['proposed_amount']:
                cursor.execute("""
                    UPDATE fees 
                    SET amount = proposed_amount, proposed_amount = NULL, status = 'Active' 
                    WHERE item_name = %s
                """, (fee_name,))
                log_audit_action(session.get('username'), session.get('role'), 'Approve Fee Update', fee_name, fee['amount'], fee['proposed_amount'])
                flash(f'Fee update for {fee_name} approved and activated.', 'success')
            else:
                cursor.execute("UPDATE fees SET proposed_amount = NULL, status = 'Active' WHERE item_name = %s", (fee_name,))
                log_audit_action(session.get('username'), session.get('role'), 'Reject Fee Update', fee_name, fee['proposed_amount'], 'Rejected')
                flash(f'Fee proposal for {fee_name} rejected.', 'info')
        conn.close()
    except Exception as e:
        flash(f'Error processing fee approval: {str(e)}', 'error')

    return redirect(url_for('officer'))

# ============================================================================
# ADMIN OFFICERS & ACCOUNT MANAGEMENT ENDPOINTS
# ============================================================================

@app.route('/create-officer', methods=['POST'])
def create_officer():
    if 'user_id' not in session or session.get('role') != 'Admin':
        return redirect(url_for('index'))

    full_name = request.form.get('full_name', '').strip()
    username = request.form.get('username', '').strip()
    password = request.form.get('password', '')
    role = request.form.get('role', 'Secretary')

    if not full_name or not username or not password:
        flash('All fields are required.', 'error')
        return redirect(url_for('admin'))

    name_parts = full_name.split(' ', 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else 'Officer'

    pwd_hash = generate_password_hash(password)

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO users (first_name, last_name, username, email, mobile, password_hash, role, status)
                VALUES (%s, %s, %s, %s, '0000000000', %s, %s, 'Active')
            """, (first_name, last_name, username, f"{username}@northfairway.com", pwd_hash, role))
        conn.close()

        log_audit_action(session.get('username'), session.get('role'), 'Create Officer Account', username, None, role)
        flash(f'Officer account {username} created successfully.', 'success')
    except pymysql.IntegrityError:
        flash('Username already exists.', 'error')
    except Exception as e:
        flash(f'Error creating officer: {str(e)}', 'error')

    return redirect(url_for('admin'))

@app.route('/toggle-officer-status/<int:officer_id>', methods=['POST'])
def toggle_officer_status(officer_id):
    if 'user_id' not in session or session.get('role') != 'Admin':
        return redirect(url_for('index'))

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT username, status FROM users WHERE id = %s", (officer_id,))
            off = cursor.fetchone()

            if off:
                new_status = 'Inactive' if off['status'] == 'Active' else 'Active'
                cursor.execute("UPDATE users SET status = %s WHERE id = %s", (new_status, officer_id))
                log_audit_action(session.get('username'), session.get('role'), 'Toggle Officer Status', off['username'], off['status'], new_status)
                flash(f'Status for {off["username"]} updated to {new_status}.', 'success')
        conn.close()
    except Exception as e:
        flash(f'Error updating officer status: {str(e)}', 'error')

    return redirect(url_for('admin'))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

# ============================================================================
# AUTHENTICATION APIs
# ============================================================================

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'status': 'error', 'message': 'Username and password required.'}), 400

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE username = %s OR email = %s", (username, username))
            user = cursor.fetchone()
        conn.close()

        if not user or not check_password_hash(user['password_hash'], password):
            return jsonify({'status': 'error', 'message': 'Invalid username or password.'}), 401

        if user['status'] != 'Active':
            return jsonify({'status': 'error', 'message': 'Your account is suspended or inactive.'}), 403

        session['user_id'] = user['id']
        session['username'] = user['username']
        session['full_name'] = f"{user['first_name']} {user['last_name']}"
        session['role'] = user['role']

        redirect_url = '/home'
        if user['role'] in ['Secretary', 'Treasurer', 'President']:
            redirect_url = '/officer'
        elif user['role'] == 'Admin':
            redirect_url = '/admin'

        return jsonify({'status': 'success', 'redirect': redirect_url})

    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Database error: {str(e)}'}), 500

@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'status': 'success', 'message': 'Logged out successfully.'})

@app.route('/api/send-registration-code', methods=['POST'])
def send_reg_code():
    data = request.get_json() or {}
    email = data.get('email', '').strip()

    if not email:
        return jsonify({'status': 'error', 'message': 'Email address required.'}), 400

    code = generate_code()
    VERIFICATION_CODES[email] = code

    try:
        if app.config['MAIL_USERNAME']:
            msg = Message('Northfairway HOA - Email Verification Code', recipients=[email])
            msg.body = f"Your verification code is: {code}\n\nThis code will expire shortly."
            mail.send(msg)
        print(f"[DEBUG] Verification code for {email}: {code}")
        return jsonify({'status': 'success', 'message': 'Verification code sent successfully.'})
    except Exception as e:
        print(f"[DEBUG CODE fallback] Code for {email}: {code}")
        return jsonify({'status': 'success', 'message': f'Verification code generated (fallback: {code}).'})

@app.route('/api/verify-registration-code', methods=['POST'])
def verify_reg_code():
    data = request.get_json() or {}
    email = data.get('email', '').strip()
    code = data.get('code', '').strip()

    if VERIFICATION_CODES.get(email) == code:
        return jsonify({'status': 'success', 'message': 'Email verified.'})
    return jsonify({'status': 'error', 'message': 'Invalid verification code.'}), 400

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json() or {}
    first_name = data.get('first_name', '').strip()
    last_name = data.get('last_name', '').strip()
    email = data.get('email', '').strip()
    username = data.get('username', '').strip()
    mobile = data.get('phone', '').strip()
    password = data.get('password', '')

    if not all([first_name, last_name, email, username, mobile, password]):
        return jsonify({'status': 'error', 'message': 'All fields are required.'}), 400

    pwd_hash = generate_password_hash(password)

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO users (first_name, last_name, email, username, mobile, password_hash, role)
                VALUES (%s, %s, %s, %s, %s, %s, 'Homeowner')
            """, (first_name, last_name, email, username, mobile, pwd_hash))
        conn.close()

        VERIFICATION_CODES.pop(email, None)
        return jsonify({'status': 'success', 'message': 'Account created successfully! Please sign in.'})
    except pymysql.IntegrityError:
        return jsonify({'status': 'error', 'message': 'Username or email already exists.'}), 400
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Server error: {str(e)}'}), 500

@app.route('/api/forgot-password/send-code', methods=['POST'])
def forgot_send_code():
    data = request.get_json() or {}
    email = data.get('email', '').strip()

    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
    conn.close()

    if not user:
        return jsonify({'status': 'error', 'message': 'Email address not found.'}), 404

    code = generate_code()
    RESET_CODES[email] = code

    try:
        if app.config['MAIL_USERNAME']:
            msg = Message('Northfairway HOA - Password Reset Code', recipients=[email])
            msg.body = f"Your password reset code is: {code}"
            mail.send(msg)
        print(f"[DEBUG] Password reset code for {email}: {code}")
        return jsonify({'status': 'success', 'message': 'Reset code sent to email.'})
    except Exception as e:
        return jsonify({'status': 'success', 'message': f'Code generated (fallback: {code}).'})

@app.route('/api/forgot-password/reset', methods=['POST'])
def forgot_reset_password():
    data = request.get_json() or {}
    email = data.get('email', '').strip()
    code = data.get('code', '').strip()
    new_password = data.get('new_password', '')

    if RESET_CODES.get(email) != code:
        return jsonify({'status': 'error', 'message': 'Invalid or expired reset code.'}), 400

    pwd_hash = generate_password_hash(new_password)

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("UPDATE users SET password_hash = %s WHERE email = %s", (pwd_hash, email))
        conn.close()

        RESET_CODES.pop(email, None)
        return jsonify({'status': 'success', 'message': 'Password reset successful. You can now log in.'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Database error: {str(e)}'}), 500

# ============================================================================
# USER DATA & REQUEST APIS
# ============================================================================

@app.route('/api/user-data', methods=['GET'])
def get_user_data():
    if 'user_id' not in session:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401

    user_id = session['user_id']
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            user = cursor.fetchone()

            cursor.execute("SELECT item_name, amount FROM fees WHERE status = 'Active'")
            fees_rows = cursor.fetchall()
            fees_dict = {f['item_name']: float(f['amount']) for f in fees_rows}

            cursor.execute("SELECT * FROM requests WHERE user_id = %s ORDER BY date_submitted DESC", (user_id,))
            requests_rows = cursor.fetchall()

            cursor.execute("SELECT * FROM alerts WHERE user_id = %s ORDER BY time DESC", (user_id,))
            alerts_rows = cursor.fetchall()
        conn.close()

        if user:
            user.pop('password_hash', None)
            if user.get('dob'):
                user['dob'] = user['dob'].strftime('%Y-%m-%d')
            if user.get('date_joined'):
                user['date_joined'] = user['date_joined'].strftime('%Y-%m-%d')

        req_list = []
        active_count = 0
        outstanding_dues = 0.0

        for r in requests_rows:
            status = r['status']
            payment_status = r['payment_status']
            fee_val = float(r['fee'])

            if status in ['Submitted', 'Under Review', 'Checked', 'Pending President Approval']:
                active_count += 1

            if payment_status == 'Unpaid' and status not in ['Rejected', 'Cancelled']:
                outstanding_dues += fee_val

            req_list.append({
                'id': r['id'],
                'type': r['request_type'],
                'title': r['request_type'],
                'date': r['date_submitted'].strftime('%Y-%m-%d %H:%M') if r.get('date_submitted') else '',
                'fee': f"₱{fee_val:.2f}",
                'payment_status': payment_status,
                'status': status
            })

        alert_list = [{
            'id': a['id'],
            'text': a['text'],
            'time': a['time'].strftime('%Y-%m-%d %H:%M') if a.get('time') else '',
            'unread': bool(a['unread'])
        } for a in alerts_rows]

        unread_alerts_count = sum(1 for a in alert_list if a['unread'])

        return jsonify({
            'status': 'success',
            'user': user,
            'fees': fees_dict,
            'dashboard': {
                'active_requests': active_count,
                'outstanding_dues': outstanding_dues,
                'unread_alerts': unread_alerts_count,
                'requests': req_list,
                'alerts': alert_list
            }
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/profile/update', methods=['POST'])
def update_profile():
    if 'user_id' not in session:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401

    data = request.get_json() or {}
    user_id = session['user_id']

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                UPDATE users SET
                    first_name = %s, middle_name = %s, last_name = %s, suffix = %s,
                    gender = %s, dob = %s, civil_status = %s, block = %s, lot = %s,
                    email = %s, mobile = %s, household = %s
                WHERE id = %s
            """, (
                data.get('first_name'), data.get('middle_name'), data.get('last_name'),
                data.get('suffix'), data.get('gender'), data.get('dob') or None,
                data.get('civil_status'), data.get('block'), data.get('lot'),
                data.get('email'), data.get('mobile'), data.get('household', 1), user_id
            ))
        conn.close()
        return jsonify({'status': 'success', 'message': 'Profile updated successfully.'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/requests/submit', methods=['POST'])
def submit_request():
    if 'user_id' not in session:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401

    data = request.get_json() or {}
    title = data.get('title', 'Document Request')
    form_data = data.get('formData', {})
    user_id = session['user_id']

    req_id = f"REQ-{datetime.now().strftime('%Y%m%d')}-{random.randint(1000, 9999)}"

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT amount FROM fees WHERE item_name = %s AND status = 'Active'", (title,))
            fee_row = cursor.fetchone()
            fee_amount = float(fee_row['amount']) if fee_row else 50.00

            if 'Vehicle' in title and 'vehicles' in form_data:
                cursor.execute("SELECT item_name, amount FROM fees WHERE status = 'Active'")
                all_fees = {f['item_name']: float(f['amount']) for f in cursor.fetchall()}
                p4 = all_fees.get('Vehicle Sticker (4 Wheels)', 200.0)
                p2 = all_fees.get('Vehicle Sticker (2/3 Wheels)', 100.0)

                total_vehicle_fee = 0.0
                for v in form_data.get('vehicles', []):
                    total_vehicle_fee += p4 if v.get('type') == '4 Wheels' else p2
                fee_amount = total_vehicle_fee

            cursor.execute("""
                INSERT INTO requests (id, user_id, request_type, fee, details, status, payment_status)
                VALUES (%s, %s, %s, %s, %s, 'Submitted', 'Unpaid')
            """, (req_id, user_id, title, fee_amount, json.dumps(form_data)))

        conn.close()

        log_audit_action(session.get('username'), session.get('role'), 'Submit Request', title, None, req_id)
        return jsonify({'status': 'success', 'message': f'Request {req_id} submitted successfully!'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/requests/cancel', methods=['POST'])
def cancel_request():
    if 'user_id' not in session:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401

    data = request.get_json() or {}
    request_id = data.get('request_id')
    user_id = session['user_id']

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT status FROM requests WHERE id = %s AND user_id = %s", (request_id, user_id))
            req = cursor.fetchone()

            if not req:
                conn.close()
                return jsonify({'status': 'error', 'message': 'Request not found.'}), 404

            if req['status'] not in ['Pending', 'Submitted']:
                conn.close()
                return jsonify({'status': 'error', 'message': 'Only pending/submitted requests can be cancelled.'}), 400

            cursor.execute("UPDATE requests SET status = 'Cancelled' WHERE id = %s", (request_id,))
        conn.close()

        log_audit_action(session.get('username'), session.get('role'), 'Cancel Request', request_id, req['status'], 'Cancelled')
        return jsonify({'status': 'success', 'message': 'Request cancelled successfully.'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

# ============================================================================
# START SERVER (Production Binding for Render)
# ============================================================================

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug_mode = os.getenv('FLASK_ENV', 'production') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
