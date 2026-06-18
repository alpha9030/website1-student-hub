import os
import sqlite3
import hashlib
import re
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Flask, request, jsonify, send_from_directory

EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

pending_otps = {}

def send_otp_email(to_email, otp):
    smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
    smtp_port = os.environ.get('SMTP_PORT', '587')
    smtp_user = os.environ.get('SMTP_USER')
    smtp_pwd = os.environ.get('SMTP_PASSWORD')
    
    if not smtp_user or not smtp_pwd:
        return False
        
    try:
        smtp_port = int(smtp_port)
    except ValueError:
        smtp_port = 587
        
    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = to_email
        msg['Subject'] = "Student Hub - Enrollment Verification Code"
        
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
                <h2 style="color: #2b6cb0; text-align: center;">Enrollment Verification Code</h2>
                <p>Hello,</p>
                <p>Thank you for registering on <strong>Student Hub</strong>. Please use the following 6-digit verification code to complete your registration:</p>
                <div style="font-size: 32px; font-weight: bold; text-align: center; margin: 30px 0; color: #2b6cb0; letter-spacing: 5px;">
                    {otp}
                </div>
                <p style="font-size: 14px; color: #718096;">This code is valid. If you did not request this, please ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                <p style="font-size: 12px; color: #a0aec0; text-align: center;">&copy; 2026 Student Hub. All Rights Reserved.</p>
            </div>
        </body>
        </html>
        """
        msg.attach(MIMEText(body, 'html'))
        
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=10)
        else:
            server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
            server.starttls()
            
        server.login(smtp_user, smtp_pwd)
        server.sendmail(smtp_user, to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

app = Flask(__name__, static_folder='.', static_url_path='')

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return response

DATABASE = 'students.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    # Create users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            grade TEXT NOT NULL,
            dept TEXT NOT NULL
        )
    ''')
    # Create syllabus progress table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS progress (
            email TEXT NOT NULL,
            checkpoint_id TEXT NOT NULL,
            PRIMARY KEY (email, checkpoint_id),
            FOREIGN KEY (email) REFERENCES users (email) ON DELETE CASCADE
        )
    ''')
    # Create chatbot settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chatbot_settings (
            email TEXT PRIMARY KEY,
            aura_mode TEXT NOT NULL,
            aura_api_key TEXT,
            aura_user_name TEXT,
            FOREIGN KEY (email) REFERENCES users (email) ON DELETE CASCADE
        )
    ''')
    # Create deleted users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS deleted_users (
            email TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            grade TEXT NOT NULL,
            dept TEXT NOT NULL,
            deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def hash_password(password):
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

# API Endpoints

@app.route('/api/send-otp', methods=['POST', 'OPTIONS'])
def api_send_otp():
    if request.method == 'OPTIONS':
        return '', 204
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No data provided'}), 400
        
    email = data.get('email', '').strip().lower()
    if not email:
        return jsonify({'success': False, 'message': 'Email is required'}), 400
        
    if not EMAIL_REGEX.match(email):
        return jsonify({'success': False, 'message': 'Invalid email address format'}), 400

    # Check if user already exists
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT email FROM users WHERE LOWER(email) = ?', (email,))
    user = cursor.fetchone()
    conn.close()
    if user:
        return jsonify({'success': False, 'message': 'An account with this email already exists'}), 400

    otp = f"{random.randint(100000, 999999)}"
    pending_otps[email] = otp
    
    smtp_user = os.environ.get('SMTP_USER')
    smtp_pwd = os.environ.get('SMTP_PASSWORD')
    
    if smtp_user and smtp_pwd:
        sent = send_otp_email(email, otp)
        if sent:
            return jsonify({'success': True, 'simulated': False})
        else:
            print(f"SMTP sending failed to {email}. Falling back to simulated OTP mode.")
            return jsonify({'success': True, 'simulated': True, 'otp': otp, 'fallback': True})
    else:
        # SMTP not configured - simulated mode
        return jsonify({'success': True, 'simulated': True, 'otp': otp})

@app.route('/api/register', methods=['POST', 'OPTIONS'])
def api_register():
    if request.method == 'OPTIONS':
        return '', 204
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No data provided'}), 400
        
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()
    grade = data.get('grade', '').strip()
    dept = data.get('dept', '').strip()
    otp_provided = data.get('otp', '').strip()
    
    if not all([username, email, password, grade, dept, otp_provided]):
        return jsonify({'success': False, 'message': 'All fields and verification code are required'}), 400
        
    if not EMAIL_REGEX.match(email):
        return jsonify({'success': False, 'message': 'Invalid email address format'}), 400
        
    # Verify OTP
    if email not in pending_otps or pending_otps[email] != otp_provided:
        return jsonify({'success': False, 'message': 'Invalid or expired verification code'}), 400
        
    # Clear the OTP
    pending_otps.pop(email, None)
        
    hashed = hash_password(password)
    
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'INSERT INTO users (email, username, password, grade, dept) VALUES (?, ?, ?, ?, ?)',
            (email, username, hashed, grade, dept)
        )
        # Initialize default chatbot settings
        cursor.execute(
            'INSERT INTO chatbot_settings (email, aura_mode, aura_api_key, aura_user_name) VALUES (?, ?, ?, ?)',
            (email, 'offline', '', username)
        )
        conn.commit()
        return jsonify({'success': True, 'message': 'Scholar enrolled successfully'})
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'message': 'An account with this email already exists'}), 400
    finally:
        conn.close()

@app.route('/api/login', methods=['POST', 'OPTIONS'])
def api_login():
    if request.method == 'OPTIONS':
        return '', 204
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No credentials provided'}), 400
        
    email = data.get('email', '').strip()
    password = data.get('password', '').strip()
    
    if not email or not password:
        return jsonify({'success': False, 'message': 'Email and password are required'}), 400
        
    hashed = hash_password(password)
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT username, email, grade, dept FROM users WHERE (LOWER(email) = ? OR LOWER(username) = ?) AND password = ?', (email.lower(), email.lower(), hashed))
    user = cursor.fetchone()
    conn.close()
    
    if user:
        return jsonify({
            'success': True,
            'user': {
                'username': user['username'],
                'email': user['email'],
                'grade': user['grade'],
                'dept': user['dept']
            }
        })
    else:
        return jsonify({'success': False, 'message': 'Invalid credentials or account does not exist'}), 401

@app.route('/api/progress', methods=['GET', 'POST', 'OPTIONS'])
def api_progress():
    if request.method == 'OPTIONS':
        return '', 204
    if request.method == 'GET':
        email = request.args.get('email', '').strip().lower()
        if not email:
            return jsonify({'success': False, 'message': 'Email required'}), 400
            
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT checkpoint_id FROM progress WHERE LOWER(email) = ?', (email,))
        rows = cursor.fetchall()
        conn.close()
        
        checkpoints = [row['checkpoint_id'] for row in rows]
        return jsonify({'success': True, 'progress': checkpoints})
        
    elif request.method == 'POST':
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        email = data.get('email', '').strip().lower()
        checkpoint_id = data.get('checkpoint_id')
        checked = data.get('checked') # boolean
        
        if not email or not checkpoint_id:
            return jsonify({'success': False, 'message': 'Email and checkpoint_id required'}), 400
            
        conn = get_db()
        cursor = conn.cursor()
        if checked:
            try:
                cursor.execute('INSERT OR IGNORE INTO progress (email, checkpoint_id) VALUES (?, ?)', (email, checkpoint_id))
                conn.commit()
            except sqlite3.Error as e:
                return jsonify({'success': False, 'message': str(e)}), 500
        else:
            try:
                cursor.execute('DELETE FROM progress WHERE LOWER(email) = ? AND checkpoint_id = ?', (email, checkpoint_id))
                conn.commit()
            except sqlite3.Error as e:
                return jsonify({'success': False, 'message': str(e)}), 500
        conn.close()
        return jsonify({'success': True})

@app.route('/api/chatbot', methods=['GET', 'POST', 'OPTIONS'])
def api_chatbot():
    if request.method == 'OPTIONS':
        return '', 204
    if request.method == 'GET':
        email = request.args.get('email', '').strip().lower()
        if not email:
            return jsonify({'success': False, 'message': 'Email required'}), 400
            
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT aura_mode, aura_api_key, aura_user_name FROM chatbot_settings WHERE LOWER(email) = ?', (email,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return jsonify({
                'success': True,
                'settings': {
                    'aura_mode': row['aura_mode'],
                    'aura_api_key': row['aura_api_key'],
                    'aura_user_name': row['aura_user_name']
                }
            })
        return jsonify({'success': False, 'message': 'Settings not found'}), 404
        
    elif request.method == 'POST':
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        email = data.get('email', '').strip().lower()
        aura_mode = data.get('aura_mode')
        aura_api_key = data.get('aura_api_key')
        aura_user_name = data.get('aura_user_name')
        
        if not email or not aura_mode:
            return jsonify({'success': False, 'message': 'Email and aura_mode required'}), 400
            
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO chatbot_settings (email, aura_mode, aura_api_key, aura_user_name)
            VALUES (?, ?, ?, ?)
        ''', (email, aura_mode, aura_api_key, aura_user_name))
        conn.commit()
        conn.close()
        return jsonify({'success': True})

@app.route('/api/delete-account', methods=['POST', 'OPTIONS'])
def api_delete_account():
    if request.method == 'OPTIONS':
        return '', 204
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No data provided'}), 400
    email = data.get('email', '').strip().lower()
    if not email:
        return jsonify({'success': False, 'message': 'Email required'}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    # Archive user details first
    cursor.execute('SELECT username, grade, dept FROM users WHERE LOWER(email) = ?', (email,))
    user = cursor.fetchone()
    if user:
        cursor.execute(
            'INSERT OR REPLACE INTO deleted_users (email, username, grade, dept) VALUES (?, ?, ?, ?)',
            (email, user['username'], user['grade'], user['dept'])
        )
    # Delete user (foreign key cascades will delete progress and chatbot settings)
    cursor.execute('DELETE FROM users WHERE LOWER(email) = ?', (email,))
    cursor.execute('DELETE FROM progress WHERE LOWER(email) = ?', (email,))
    cursor.execute('DELETE FROM chatbot_settings WHERE LOWER(email) = ?', (email,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Account and all data permanently deleted'})

# Admin Views and APIs

@app.route('/admin')
def serve_admin():
    return send_from_directory('.', 'admin.html')

@app.route('/api/admin/users')
def api_admin_users():
    admin_key = request.headers.get('X-Admin-Key')
    expected_key = os.environ.get('ADMIN_KEY') or 'admin'
    if admin_key != expected_key:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT username, email, grade, dept FROM users')
    users = cursor.fetchall()
    
    cursor.execute('SELECT username, email, grade, dept FROM deleted_users')
    deleted_users = cursor.fetchall()
    
    user_list = []
    for u in users:
        cursor.execute('SELECT COUNT(*) FROM progress WHERE email = ?', (u['email'],))
        prog_count = cursor.fetchone()[0]
        user_list.append({
            'username': u['username'],
            'email': u['email'],
            'grade': u['grade'],
            'dept': u['dept'],
            'progress_count': prog_count,
            'status': 'active'
        })
        
    for d in deleted_users:
        user_list.append({
            'username': d['username'],
            'email': d['email'],
            'grade': d['grade'],
            'dept': d['dept'],
            'progress_count': 0,
            'status': 'deleted'
        })
    conn.close()
    return jsonify({'success': True, 'users': user_list})

# Catch-all to serve any static asset (js, css, images)
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

init_db()

if __name__ == '__main__':
    print("Database initialized.")
    app.run(host='0.0.0.0', port=443, ssl_context='adhoc', debug=True)
