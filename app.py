import os
import time
import sqlite3
import hashlib
import re
import random
import smtplib
import json
import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash

def get_config():
    config = {}
    try:
        if os.path.exists('config.json'):
            with open('config.json', 'r') as f:
                config = json.load(f)
    except Exception as e:
        print(f"Error loading config.json: {e}")
    return config

config_data = get_config()

def is_supabase_enabled():
    config = get_config()
    url = os.environ.get('SUPABASE_URL') or config.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_KEY') or config.get('SUPABASE_KEY')
    return bool(url and key)

def supabase_request(method, table, query=None, body=None, single=False):
    import urllib.request
    import json
    import ssl
    
    config = get_config()
    url = os.environ.get('SUPABASE_URL') or config.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_KEY') or config.get('SUPABASE_KEY')
    if not url or not key:
        return None
        
    url = url.rstrip('/')
    endpoint = f"{url}/rest/v1/{table}"
    if query:
        endpoint = f"{endpoint}?{query}"
        
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }
    if single:
        headers["Accept"] = "application/vnd.pgrst.object+json"
        
    req_data = None
    if body is not None:
        req_data = json.dumps(body).encode('utf-8')
        
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    try:
        req = urllib.request.Request(endpoint, data=req_data, headers=headers, method=method)
        with urllib.request.urlopen(req, context=ctx) as response:
            res_body = response.read().decode('utf-8')
            if res_body:
                return json.loads(res_body)
            return True
    except Exception as e:
        print(f"Supabase request error ({method} {table}): {e}")
        if hasattr(e, 'code') and e.code == 406 and single:
            return None
        return None

EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

pending_otps = {}

def get_smtp_config():
    smtp_server = os.environ.get('SMTP_SERVER')
    smtp_port = os.environ.get('SMTP_PORT')
    smtp_user = os.environ.get('SMTP_USER')
    smtp_pwd = os.environ.get('SMTP_PASSWORD')
    
    # Try reading from config.json if not fully set in environment
    if not (smtp_user and smtp_pwd):
        import json
        try:
            if os.path.exists('config.json'):
                with open('config.json', 'r') as f:
                    config = json.load(f)
                    if not smtp_user:
                        smtp_user = config.get('SMTP_USER')
                    if not smtp_pwd:
                        smtp_pwd = config.get('SMTP_PASSWORD')
                    if not smtp_server:
                        smtp_server = config.get('SMTP_SERVER')
                    if not smtp_port:
                        smtp_port = config.get('SMTP_PORT')
        except Exception as e:
            print(f"Error loading config.json: {e}")
            
    # Set default values if still missing
    if not smtp_server:
        smtp_server = 'smtp.gmail.com'
    if not smtp_port:
        smtp_port = '587'
        
    return smtp_server, smtp_port, smtp_user, smtp_pwd

def send_otp_email(to_email, otp):
    smtp_server, smtp_port, smtp_user, smtp_pwd = get_smtp_config()
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

app = Flask(__name__, static_folder=None)

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

DATABASE = 'students.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def initialize_csv_from_db():
    import csv
    csv_file = "student_logins.csv"
    if os.path.exists(csv_file):
        return
        
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT username, email, grade, dept, last_login_at, login_count 
            FROM users 
            WHERE last_login_at IS NOT NULL AND status = 'active'
            ORDER BY last_login_at ASC
        """)
        rows = cursor.fetchall()
        
        with open(csv_file, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(["Timestamp (UTC)", "Username", "Email", "Department", "Grade", "Login Count"])
            for row in rows:
                writer.writerow([
                    row['last_login_at'],
                    row['username'],
                    row['email'],
                    row['dept'],
                    row['grade'],
                    row['login_count']
                ])
        print("Initialized student_logins.csv with historical logins from database.")
    except sqlite3.Error as e:
        print(f"SQLite error initializing CSV: {e}")
    finally:
        conn.close()

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
            dept TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login_at DATETIME,
            login_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active'
        )
    ''')
    
    # Safely alter table to add columns in case the table already existed in database file
    for col_def in [
        ("created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
        ("last_login_at", "DATETIME"),
        ("login_count", "INTEGER DEFAULT 0"),
        ("status", "TEXT DEFAULT 'active'")
    ]:
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col_def[0]} {col_def[1]}")
        except sqlite3.OperationalError:
            pass
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
            deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login_at DATETIME,
            login_count INTEGER DEFAULT 0,
            progress_count INTEGER DEFAULT 0
        )
    ''')
    
    # Safely alter table to add columns in case the table already existed in database file
    for col_def in [
        ("last_login_at", "DATETIME"),
        ("login_count", "INTEGER DEFAULT 0"),
        ("progress_count", "INTEGER DEFAULT 0")
    ]:
        try:
            cursor.execute(f"ALTER TABLE deleted_users ADD COLUMN {col_def[0]} {col_def[1]}")
        except sqlite3.OperationalError:
            pass

    # Create mentor_chats table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS mentor_chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            sender TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (email) REFERENCES users (email) ON DELETE CASCADE
        )
    ''')

    # Create mentor_study_plans table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS mentor_study_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            title TEXT NOT NULL,
            plan_data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (email) REFERENCES users (email) ON DELETE CASCADE
        )
    ''')

    # Create mentor_profiles table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS mentor_profiles (
            email TEXT PRIMARY KEY,
            dept TEXT,
            grade TEXT,
            interests TEXT,
            marks TEXT,
            goals TEXT,
            weak_subjects TEXT,
            target_goals TEXT,
            exam_rank INTEGER,
            state TEXT,
            category TEXT,
            exam_date TEXT,
            exam_subjects TEXT,
            study_hours INTEGER,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (email) REFERENCES users (email) ON DELETE CASCADE
        )
    ''')

    conn.commit()
    conn.close()
    
    # Pre-populate CSV with existing users who have logged in
    initialize_csv_from_db()

def hash_password(password):
    return generate_password_hash(password)

def verify_password(stored_hash, input_password):
    # Legacy SHA-256 hashes are exactly 64 hex characters
    if len(stored_hash) == 64 and all(c in '0123456789abcdefABCDEF' for c in stored_hash):
        legacy_hash = hashlib.sha256(input_password.encode('utf-8')).hexdigest()
        if legacy_hash.lower() == stored_hash.lower():
            return True, True  # Valid, needs upgrade
        return False, False
        
    try:
        if check_password_hash(stored_hash, input_password):
            return True, False  # Valid, no upgrade needed
    except Exception as e:
        print(f"Password verification error: {e}")
    return False, False

def upgrade_user_password(email, new_hash):
    email = email.strip().lower()
    if is_supabase_enabled():
        supabase_request("PATCH", "users", f"email=ilike.{email}", body={"password": new_hash})
        return
        
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE users SET password = ? WHERE LOWER(email) = ?", (new_hash, email))
        conn.commit()
    except sqlite3.Error as e:
        print(f"SQLite password upgrade error: {e}")
    finally:
        conn.close()

# Database Helper Functions (Supabase + SQLite fallback)
def get_user_by_email(email):
    email = email.strip().lower()
    if is_supabase_enabled():
        user = supabase_request("GET", "users", f"email=ilike.{email}", single=True)
        if user:
            return {
                'email': user['email'],
                'username': user['username'],
                'password': user['password'],
                'grade': user['grade'],
                'dept': user['dept'],
                'created_at': user.get('created_at'),
                'last_login_at': user.get('last_login_at'),
                'login_count': user.get('login_count', 0) or 0,
                'status': user.get('status', 'active') or 'active'
            }
        return None

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT username, email, password, grade, dept, created_at, last_login_at, login_count, status FROM users WHERE LOWER(email) = ?', (email,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            'email': row['email'],
            'username': row['username'],
            'password': row['password'],
            'grade': row['grade'],
            'dept': row['dept'],
            'created_at': row['created_at'],
            'last_login_at': row['last_login_at'],
            'login_count': row['login_count'],
            'status': row['status'] if row['status'] is not None else 'active'
        }
    return None

def get_user_by_email_or_username(identifier):
    identifier = identifier.strip().lower()
    if is_supabase_enabled():
        user = supabase_request("GET", "users", f"or=(email.ilike.{identifier},username.ilike.{identifier})", single=True)
        if user:
            return {
                'email': user['email'],
                'username': user['username'],
                'password': user['password'],
                'grade': user['grade'],
                'dept': user['dept'],
                'created_at': user.get('created_at'),
                'last_login_at': user.get('last_login_at'),
                'login_count': user.get('login_count', 0) or 0,
                'status': user.get('status', 'active') or 'active'
            }
        return None

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT username, email, password, grade, dept, created_at, last_login_at, login_count, status FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?', (identifier, identifier))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            'email': row['email'],
            'username': row['username'],
            'password': row['password'],
            'grade': row['grade'],
            'dept': row['dept'],
            'created_at': row['created_at'],
            'last_login_at': row['last_login_at'],
            'login_count': row['login_count'],
            'status': row['status'] if row['status'] is not None else 'active'
        }
    return None

def register_user(email, username, password_hash, grade, dept):
    email = email.strip().lower()
    if is_supabase_enabled():
        exist = get_user_by_email(email)
        if exist:
            return False
            
        user_body = {
            "email": email,
            "username": username,
            "password": password_hash,
            "grade": grade,
            "dept": dept,
            "status": "active",
            "login_count": 0
        }
        res = supabase_request("POST", "users", body=user_body)
        if res:
            settings_body = {
                "email": email,
                "aura_mode": "offline",
                "aura_api_key": "",
                "aura_user_name": username
            }
            supabase_request("POST", "chatbot_settings", body=settings_body)
            return True
        return False

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'INSERT INTO users (email, username, password, grade, dept) VALUES (?, ?, ?, ?, ?)',
            (email, username, password_hash, grade, dept)
        )
        cursor.execute(
            'INSERT INTO chatbot_settings (email, aura_mode, aura_api_key, aura_user_name) VALUES (?, ?, ?, ?)',
            (email, 'offline', '', username)
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def get_user_progress(email):
    email = email.strip().lower()
    if is_supabase_enabled():
        res = supabase_request("GET", "progress", f"email=ilike.{email}")
        if isinstance(res, list):
            return [item['checkpoint_id'] for item in res]
        return []

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT checkpoint_id FROM progress WHERE LOWER(email) = ?', (email,))
    rows = cursor.fetchall()
    conn.close()
    return [row['checkpoint_id'] for row in rows]

def update_user_progress(email, checkpoint_id, checked):
    email = email.strip().lower()
    if is_supabase_enabled():
        if checked:
            progress_body = {
                "email": email,
                "checkpoint_id": checkpoint_id
            }
            supabase_request("POST", "progress", body=progress_body)
            return True
        else:
            supabase_request("DELETE", "progress", f"email=ilike.{email}&checkpoint_id=eq.{checkpoint_id}")
            return True

    conn = get_db()
    cursor = conn.cursor()
    try:
        if checked:
            cursor.execute('INSERT OR IGNORE INTO progress (email, checkpoint_id) VALUES (?, ?)', (email, checkpoint_id))
        else:
            cursor.execute('DELETE FROM progress WHERE LOWER(email) = ? AND checkpoint_id = ?', (email, checkpoint_id))
        conn.commit()
        return True
    except sqlite3.Error as e:
        print(f"SQLite progress error: {e}")
        return False
    finally:
        conn.close()

def get_chatbot_settings(email):
    email = email.strip().lower()
    if is_supabase_enabled():
        res = supabase_request("GET", "chatbot_settings", f"email=ilike.{email}", single=True)
        if res:
            return {
                'aura_mode': res['aura_mode'],
                'aura_api_key': res.get('aura_api_key', ''),
                'aura_user_name': res.get('aura_user_name', '')
            }
        return None

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT aura_mode, aura_api_key, aura_user_name FROM chatbot_settings WHERE LOWER(email) = ?', (email,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            'aura_mode': row['aura_mode'],
            'aura_api_key': row['aura_api_key'],
            'aura_user_name': row['aura_user_name']
        }
    return None

def save_chatbot_settings(email, aura_mode, aura_api_key, aura_user_name):
    email = email.strip().lower()
    if is_supabase_enabled():
        settings_body = {
            "email": email,
            "aura_mode": aura_mode,
            "aura_api_key": aura_api_key,
            "aura_user_name": aura_user_name
        }
        exists = supabase_request("GET", "chatbot_settings", f"email=ilike.{email}", single=True)
        if exists:
            supabase_request("PATCH", "chatbot_settings", f"email=ilike.{email}", body=settings_body)
        else:
            supabase_request("POST", "chatbot_settings", body=settings_body)
        return True

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT OR REPLACE INTO chatbot_settings (email, aura_mode, aura_api_key, aura_user_name)
            VALUES (?, ?, ?, ?)
        ''', (email, aura_mode, aura_api_key, aura_user_name))
        conn.commit()
        return True
    except sqlite3.Error as e:
        print(f"SQLite save_chatbot_settings error: {e}")
        return False
    finally:
        conn.close()

def reactivate_user(email, username, password_hash, grade, dept):
    email = email.strip().lower()
    if is_supabase_enabled():
        update_body = {
            "username": username,
            "password": password_hash,
            "grade": grade,
            "dept": dept,
            "status": "active",
            "login_count": 0,
            "last_login_at": None
        }
        res = supabase_request("PATCH", "users", f"email=ilike.{email}", body=update_body)
        supabase_request("DELETE", "progress", f"email=ilike.{email}")
        return bool(res)

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            UPDATE users 
            SET username = ?, password = ?, grade = ?, dept = ?, status = 'active', login_count = 0, last_login_at = NULL
            WHERE LOWER(email) = ?
        ''', (username, password_hash, grade, dept, email))
        # Clear their old progress so they start fresh
        cursor.execute('DELETE FROM progress WHERE LOWER(email) = ?', (email,))
        conn.commit()
        return True
    except sqlite3.Error as e:
        print(f"SQLite reactivate_user error: {e}")
        return False
    finally:
        conn.close()

def delete_user_account(email):
    email = email.strip().lower()
    if is_supabase_enabled():
        res = supabase_request("PATCH", "users", f"email=ilike.{email}", body={"status": "deleted"})
        return bool(res)

    conn = get_db()
    cursor = conn.cursor()
    try:
        # Soft delete: toggle status to 'deleted'
        cursor.execute("UPDATE users SET status = 'deleted' WHERE LOWER(email) = ?", (email,))
        conn.commit()
        return True
    except sqlite3.Error as e:
        print(f"SQLite delete_user_account error: {e}")
        return False
    finally:
        conn.close()

def get_all_users_for_admin():
    if is_supabase_enabled():
        users = supabase_request("GET", "users")
        progress = supabase_request("GET", "progress")
        prog_counts = {}
        if isinstance(progress, list):
            for p in progress:
                email = p['email'].lower()
                prog_counts[email] = prog_counts.get(email, 0) + 1
                
        user_list = []
        if isinstance(users, list):
            for u in users:
                user_list.append({
                    'username': u['username'],
                    'email': u['email'],
                    'grade': u['grade'],
                    'dept': u['dept'],
                    'progress_count': prog_counts.get(u['email'].lower(), 0),
                    'status': u.get('status', 'active') or 'active',
                    'last_login_at': u.get('last_login_at'),
                    'login_count': u.get('login_count', 0) or 0
                })
        return user_list

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT username, email, grade, dept, last_login_at, login_count, status FROM users')
    users = cursor.fetchall()
    
    cursor.execute('SELECT username, email, grade, dept, last_login_at, login_count, progress_count FROM deleted_users')
    legacy_deleted = cursor.fetchall()
    
    user_list = []
    seen_emails = set()
    
    for u in users:
        email = u['email'].lower()
        seen_emails.add(email)
        cursor.execute('SELECT COUNT(*) FROM progress WHERE LOWER(email) = ?', (email,))
        prog_count = cursor.fetchone()[0]
        user_list.append({
            'username': u['username'],
            'email': u['email'],
            'grade': u['grade'],
            'dept': u['dept'],
            'progress_count': prog_count,
            'status': u['status'] if u['status'] is not None else 'active',
            'last_login_at': u['last_login_at'],
            'login_count': u['login_count'] if u['login_count'] is not None else 0
        })
        
    for d in legacy_deleted:
        email = d['email'].lower()
        if email in seen_emails:
            continue
        user_list.append({
            'username': d['username'],
            'email': d['email'],
            'grade': d['grade'],
            'dept': d['dept'],
            'progress_count': d['progress_count'] if d['progress_count'] is not None else 0,
            'status': 'deleted',
            'last_login_at': d['last_login_at'],
            'login_count': d['login_count'] if d['login_count'] is not None else 0
        })
    conn.close()
    return user_list

def update_user_profile(email, dept, grade):
    email = email.strip().lower()
    if is_supabase_enabled():
        res = supabase_request("PATCH", "users", f"email=ilike.{email}", body={"dept": dept, "grade": grade})
        return bool(res)

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'UPDATE users SET dept = ?, grade = ? WHERE LOWER(email) = ?',
            (dept, grade, email)
        )
        conn.commit()
        return True
    except sqlite3.Error as e:
        print(f"SQLite update_user_profile error: {e}")
        return False
    finally:
        conn.close()

def log_user_login_to_csv(email):
    import csv
    csv_file = "student_logins.csv"
    
    username, email_val, grade, dept, last_login_at, login_count = None, None, None, None, None, None
    
    if is_supabase_enabled():
        row = get_user_by_email(email)
        if not row:
            return
        username = row['username']
        email_val = row['email']
        grade = row['grade']
        dept = row['dept']
        last_login_at = row['last_login_at']
        login_count = row['login_count']
    else:
        conn = get_db()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT username, email, grade, dept, last_login_at, login_count FROM users WHERE LOWER(email) = ?", (email,))
            row = cursor.fetchone()
            if not row:
                return
            username = row['username']
            email_val = row['email']
            grade = row['grade']
            dept = row['dept']
            last_login_at = row['last_login_at']
            login_count = row['login_count']
        except sqlite3.Error as e:
            print(f"SQLite retrieve for csv error: {e}")
            return
        finally:
            conn.close()

    try:
        file_exists = os.path.exists(csv_file)
        with open(csv_file, mode='a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(["Timestamp (UTC)", "Username", "Email", "Department", "Grade", "Login Count"])
            writer.writerow([last_login_at, username, email_val, dept, grade, login_count])
    except PermissionError:
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [WARNING] Cannot write to '{csv_file}' because it is open in Excel or another program. Please close it to resume syncing.")
    except Exception as e:
        print(f"Error updating CSV sheet: {e}")

def track_user_login(email):
    email = email.strip().lower()
    current_time = datetime.datetime.utcnow().isoformat()
    
    if is_supabase_enabled():
        user = get_user_by_email(email)
        if user:
            current_count = user.get('login_count', 0) or 0
            supabase_request("PATCH", "users", f"email=ilike.{email}", body={
                "last_login_at": current_time,
                "login_count": current_count + 1
            })
        log_user_login_to_csv(email)
        return

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT login_count FROM users WHERE LOWER(email) = ?", (email,))
        row = cursor.fetchone()
        current_count = row[0] if row and row[0] is not None else 0
        
        cursor.execute(
            'UPDATE users SET last_login_at = ?, login_count = ? WHERE LOWER(email) = ?',
            (current_time, current_count + 1, email)
        )
        conn.commit()
    except sqlite3.Error as e:
        print(f"SQLite track_user_login error: {e}")
    finally:
        conn.close()
    
    # Update CSV log after database connection is closed
    log_user_login_to_csv(email)

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/signup')
@app.route('/signup.html')
def serve_signup():
    return send_from_directory('.', 'account.html')

@app.route('/account')
@app.route('/account.html')
@app.route('/auth')
def serve_account():
    return send_from_directory('.', 'account.html')

# API Endpoints

@app.route('/api/config')
def api_get_config():
    config = get_config()
    return jsonify({
        'success': True,
        'google_client_id': os.environ.get('GOOGLE_CLIENT_ID') or config.get('GOOGLE_CLIENT_ID') or 'your-google-client-id.apps.googleusercontent.com'
    })

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
    user = get_user_by_email(email)
    if user:
        return jsonify({'success': False, 'message': 'An account with this email already exists'}), 400

    otp = f"{random.randint(100000, 999999)}"
    pending_otps[email] = otp
    
    smtp_server, smtp_port, smtp_user, smtp_pwd = get_smtp_config()
    
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
    
    print(f"DEBUG api_register: username={repr(username)}, email={repr(email)}, password={repr(password)}, grade={repr(grade)}, dept={repr(dept)}")
    
    if not all([username, email, password, grade, dept]):
        return jsonify({'success': False, 'message': 'All fields are required'}), 400
        
    if not EMAIL_REGEX.match(email):
        return jsonify({'success': False, 'message': 'Invalid email address format'}), 400
        
    # Clear the OTP if any existed
    pending_otps.pop(email, None)
        
    hashed = hash_password(password)
    
    # Check if user already exists
    user = get_user_by_email(email)
    if user:
        if user.get('status', 'active') == 'deleted':
            success = reactivate_user(email, username, hashed, grade, dept)
            if success:
                return jsonify({'success': True, 'message': 'Scholar enrolled successfully (account reactivated)'})
            else:
                return jsonify({'success': False, 'message': 'Failed to reactivate account'}), 500
        else:
            return jsonify({'success': False, 'message': 'An account with this email already exists'}), 400
            
    success = register_user(email, username, hashed, grade, dept)
    if success:
        return jsonify({'success': True, 'message': 'Scholar enrolled successfully'})
    else:
        return jsonify({'success': False, 'message': 'An account with this email already exists'}), 400

@app.route('/api/google-login', methods=['POST', 'OPTIONS'])
def api_google_login():
    if request.method == 'OPTIONS':
        return '', 204
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No data provided'}), 400
        
    credential = data.get('credential')
    if not credential:
        return jsonify({'success': False, 'message': 'Google credential token is required'}), 400
        
    # Verify Google token (handle simulated tokens and real tokens)
    import urllib.request
    import ssl
    import json
    import base64
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    if credential.startswith("simulated_token_"):
        try:
            payload_str = credential[len("simulated_token_"):]
            # Ensure correct padding for base64 decoding
            padding = len(payload_str) % 4
            if padding:
                payload_str += "=" * (4 - padding)
            decoded_bytes = base64.b64decode(payload_str)
            tokeninfo = json.loads(decoded_bytes.decode('utf-8'))
        except Exception as e:
            print(f"Failed to parse simulated token: {e}")
            return jsonify({'success': False, 'message': 'Invalid simulated token'}), 400
    else:
        tokeninfo_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}"
        try:
            req = urllib.request.Request(tokeninfo_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, context=ctx) as response:
                tokeninfo = json.loads(response.read().decode('utf-8'))
        except Exception as e:
            print(f"Google token verification failed: {e}")
            return jsonify({'success': False, 'message': 'Invalid Google credential token'}), 401
        
    # Validate audience client_id
    config = get_config()
    expected_client_id = os.environ.get('GOOGLE_CLIENT_ID') or config.get('GOOGLE_CLIENT_ID')
    if expected_client_id and expected_client_id != 'your-google-client-id.apps.googleusercontent.com':
        if tokeninfo.get('aud') != expected_client_id:
            print(f"Google token client_id mismatch: {tokeninfo.get('aud')} vs {expected_client_id}")
            return jsonify({'success': False, 'message': 'Google client ID mismatch'}), 401
            
    email = tokeninfo.get('email', '').strip().lower()
    username = tokeninfo.get('name', '').strip()
    
    if not email:
        return jsonify({'success': False, 'message': 'Email not provided by Google account'}), 400
        
    user = get_user_by_email(email)
    
    if user:
        if user.get('status', 'active') == 'deleted':
            # Reactivate
            reactivate_user(email, username, user['password'], user['grade'], user['dept'])
        # User exists, log them in!
        track_user_login(email)
        updated_user = get_user_by_email(email)
        return jsonify({
            'success': True,
            'message': 'Logged in successfully via Google',
            'user': {
                'username': updated_user['username'],
                'email': updated_user['email'],
                'grade': updated_user['grade'],
                'dept': updated_user['dept'],
                'last_login_at': updated_user['last_login_at'],
                'login_count': updated_user['login_count']
            }
        })
    else:
        # User does not exist, register them!
        dept = data.get('dept', '').strip()
        grade = data.get('grade', '').strip()
        if not dept or not grade:
            # Return needs_registration = True so the frontend triggers the modal
            return jsonify({
                'success': False,
                'needs_registration': True,
                'message': 'Academic Department and Year are required for registration'
            }), 400
            
        # Use a random password string since they authenticate via Google
        placeholder_pwd = hash_password(os.urandom(24).hex())
        success = register_user(email, username, placeholder_pwd, grade, dept)
        if success:
            track_user_login(email)
            updated_user = get_user_by_email(email)
            return jsonify({
                'success': True,
                'message': 'Account created successfully via Google',
                'user': {
                    'username': updated_user['username'],
                    'email': updated_user['email'],
                    'grade': updated_user['grade'],
                    'dept': updated_user['dept'],
                    'last_login_at': updated_user['last_login_at'],
                    'login_count': updated_user['login_count']
                }
            })
        else:
            return jsonify({'success': False, 'message': 'Failed to create account'}), 400

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
        
    user = get_user_by_email_or_username(email)
    if not user or user.get('status', 'active') != 'active':
        return jsonify({'success': False, 'message': 'Invalid credentials or account does not exist'}), 401
        
    is_valid, needs_upgrade = verify_password(user['password'], password)
    
    if is_valid:
        if needs_upgrade:
            # Upgrade password to secure salted hash
            new_hash = hash_password(password)
            upgrade_user_password(user['email'], new_hash)
            
        track_user_login(user['email'])
        updated_user = get_user_by_email(user['email'])
        return jsonify({
            'success': True,
            'user': {
                'username': updated_user['username'],
                'email': updated_user['email'],
                'grade': updated_user['grade'],
                'dept': updated_user['dept'],
                'last_login_at': updated_user['last_login_at'],
                'login_count': updated_user['login_count']
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
            
        checkpoints = get_user_progress(email)
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
            
        success = update_user_progress(email, checkpoint_id, checked)
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'message': 'Failed to update progress'}), 500

@app.route('/api/chatbot', methods=['GET', 'POST', 'OPTIONS'])
def api_chatbot():
    if request.method == 'OPTIONS':
        return '', 204
    if request.method == 'GET':
        email = request.args.get('email', '').strip().lower()
        if not email:
            return jsonify({'success': False, 'message': 'Email required'}), 400
            
        settings = get_chatbot_settings(email)
        if settings:
            return jsonify({
                'success': True,
                'settings': settings
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
            
        success = save_chatbot_settings(email, aura_mode, aura_api_key, aura_user_name)
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'message': 'Failed to save settings'}), 500

# ==========================================
# AI MENTOR API ENDPOINTS
# ==========================================

@app.route('/api/mentor/chats', methods=['GET', 'POST', 'DELETE', 'OPTIONS'])
def api_mentor_chats():
    if request.method == 'OPTIONS':
        return '', 204
        
    if request.method == 'GET':
        email = request.args.get('email', '').strip().lower()
        if not email:
            return jsonify({'success': False, 'message': 'Email required'}), 400
            
        conn = get_db()
        cursor = conn.cursor()
        try:
            cursor.execute('SELECT sender, message, timestamp FROM mentor_chats WHERE LOWER(email) = ? ORDER BY timestamp ASC', (email,))
            rows = cursor.fetchall()
            chats = [{'sender': r['sender'], 'message': r['message'], 'timestamp': r['timestamp']} for r in rows]
            return jsonify({'success': True, 'chats': chats})
        except sqlite3.Error as e:
            print(f"SQLite mentor chats GET error: {e}")
            return jsonify({'success': False, 'message': 'Database error'}), 500
        finally:
            conn.close()
            
    elif request.method == 'POST':
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        email = data.get('email', '').strip().lower()
        sender = data.get('sender', '').strip()
        message = data.get('message', '').strip()
        
        if not all([email, sender, message]):
            return jsonify({'success': False, 'message': 'Email, sender, and message are required'}), 400
            
        conn = get_db()
        cursor = conn.cursor()
        try:
            cursor.execute('INSERT INTO mentor_chats (email, sender, message) VALUES (?, ?, ?)', (email, sender, message))
            conn.commit()
            return jsonify({'success': True})
        except sqlite3.Error as e:
            print(f"SQLite mentor chats POST error: {e}")
            return jsonify({'success': False, 'message': 'Database error'}), 500
        finally:
            conn.close()
            
    elif request.method == 'DELETE':
        email = request.args.get('email', '').strip().lower()
        if not email:
            return jsonify({'success': False, 'message': 'Email required'}), 400
            
        conn = get_db()
        cursor = conn.cursor()
        try:
            cursor.execute('DELETE FROM mentor_chats WHERE LOWER(email) = ?', (email,))
            conn.commit()
            return jsonify({'success': True, 'message': 'Chat history cleared'})
        except sqlite3.Error as e:
            print(f"SQLite mentor chats DELETE error: {e}")
            return jsonify({'success': False, 'message': 'Database error'}), 500
        finally:
            conn.close()

@app.route('/api/mentor/plans', methods=['GET', 'POST', 'DELETE', 'OPTIONS'])
def api_mentor_plans():
    if request.method == 'OPTIONS':
        return '', 204
        
    if request.method == 'GET':
        email = request.args.get('email', '').strip().lower()
        if not email:
            return jsonify({'success': False, 'message': 'Email required'}), 400
            
        conn = get_db()
        cursor = conn.cursor()
        try:
            cursor.execute('SELECT id, title, plan_data, created_at FROM mentor_study_plans WHERE LOWER(email) = ? ORDER BY created_at DESC', (email,))
            rows = cursor.fetchall()
            plans = [{
                'id': r['id'],
                'title': r['title'],
                'plan_data': r['plan_data'],
                'created_at': r['created_at']
            } for r in rows]
            return jsonify({'success': True, 'plans': plans})
        except sqlite3.Error as e:
            print(f"SQLite mentor plans GET error: {e}")
            return jsonify({'success': False, 'message': 'Database error'}), 500
        finally:
            conn.close()
            
    elif request.method == 'POST':
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        email = data.get('email', '').strip().lower()
        title = data.get('title', '').strip()
        plan_data = data.get('plan_data', '').strip()
        
        if not all([email, title, plan_data]):
            return jsonify({'success': False, 'message': 'Email, title, and plan_data are required'}), 400
            
        conn = get_db()
        cursor = conn.cursor()
        try:
            cursor.execute('INSERT INTO mentor_study_plans (email, title, plan_data) VALUES (?, ?, ?)', (email, title, plan_data))
            conn.commit()
            new_id = cursor.lastrowid
            return jsonify({'success': True, 'id': new_id})
        except sqlite3.Error as e:
            print(f"SQLite mentor plans POST error: {e}")
            return jsonify({'success': False, 'message': 'Database error'}), 500
        finally:
            conn.close()
            
    elif request.method == 'DELETE':
        email = request.args.get('email', '').strip().lower()
        plan_id = request.args.get('id')
        
        if not email or not plan_id:
            return jsonify({'success': False, 'message': 'Email and plan ID required'}), 400
            
        conn = get_db()
        cursor = conn.cursor()
        try:
            cursor.execute('DELETE FROM mentor_study_plans WHERE LOWER(email) = ? AND id = ?', (email, plan_id))
            conn.commit()
            return jsonify({'success': True, 'message': 'Study plan deleted'})
        except sqlite3.Error as e:
            print(f"SQLite mentor plans DELETE error: {e}")
            return jsonify({'success': False, 'message': 'Database error'}), 500
        finally:
            conn.close()

@app.route('/api/mentor/profile', methods=['GET', 'POST', 'OPTIONS'])
def api_mentor_profile():
    if request.method == 'OPTIONS':
        return '', 204
        
    if request.method == 'GET':
        email = request.args.get('email', '').strip().lower()
        if not email:
            return jsonify({'success': False, 'message': 'Email required'}), 400
            
        conn = get_db()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                SELECT dept, grade, interests, marks, goals, weak_subjects, target_goals, 
                       exam_rank, state, category, exam_date, exam_subjects, study_hours 
                FROM mentor_profiles WHERE LOWER(email) = ?
            ''', (email,))
            row = cursor.fetchone()
            if row:
                profile = {
                    'dept': row['dept'],
                    'grade': row['grade'],
                    'interests': row['interests'],
                    'marks': row['marks'],
                    'goals': row['goals'],
                    'weak_subjects': row['weak_subjects'],
                    'target_goals': row['target_goals'],
                    'exam_rank': row['exam_rank'],
                    'state': row['state'],
                    'category': row['category'],
                    'exam_date': row['exam_date'],
                    'exam_subjects': row['exam_subjects'],
                    'study_hours': row['study_hours']
                }
                return jsonify({'success': True, 'profile': profile})
            else:
                cursor.execute('SELECT username, grade, dept FROM users WHERE LOWER(email) = ?', (email,))
                user_row = cursor.fetchone()
                if user_row:
                    grade_map = {'freshman': '1', 'sophomore': '2', 'junior': '3', 'senior': '4'}
                    return jsonify({
                        'success': True,
                        'profile': {
                            'dept': user_row['dept'],
                            'grade': grade_map.get(user_row['grade'].lower(), '1'),
                            'interests': '',
                            'marks': '',
                            'goals': '',
                            'weak_subjects': '',
                            'target_goals': '',
                            'exam_rank': '',
                            'state': '',
                            'category': 'General',
                            'exam_date': '',
                            'exam_subjects': '',
                            'study_hours': ''
                        }
                    })
                return jsonify({'success': False, 'message': 'User profile not found'}), 404
        except sqlite3.Error as e:
            print(f"SQLite mentor profile GET error: {e}")
            return jsonify({'success': False, 'message': 'Database error'}), 500
        finally:
            conn.close()
            
    elif request.method == 'POST':
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        email = data.get('email', '').strip().lower()
        if not email:
            return jsonify({'success': False, 'message': 'Email is required'}), 400
            
        dept = data.get('dept', '').strip()
        grade = data.get('grade', '').strip()
        interests = data.get('interests', '').strip()
        marks = data.get('marks', '').strip()
        goals = data.get('goals', '').strip()
        weak_subjects = data.get('weak_subjects', '').strip()
        target_goals = data.get('target_goals', '').strip()
        
        exam_rank = data.get('exam_rank')
        try:
            exam_rank = int(exam_rank) if exam_rank is not None and str(exam_rank).strip() != '' else None
        except ValueError:
            exam_rank = None
            
        state = data.get('state', '').strip()
        category = data.get('category', '').strip()
        exam_date = data.get('exam_date', '').strip()
        exam_subjects = data.get('exam_subjects', '').strip()
        
        study_hours = data.get('study_hours')
        try:
            study_hours = int(study_hours) if study_hours is not None and str(study_hours).strip() != '' else None
        except ValueError:
            study_hours = None
            
        conn = get_db()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO mentor_profiles (email, dept, grade, interests, marks, goals, weak_subjects, target_goals, 
                                            exam_rank, state, category, exam_date, exam_subjects, study_hours, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(email) DO UPDATE SET
                    dept = excluded.dept,
                    grade = excluded.grade,
                    interests = excluded.interests,
                    marks = excluded.marks,
                    goals = excluded.goals,
                    weak_subjects = excluded.weak_subjects,
                    target_goals = excluded.target_goals,
                    exam_rank = excluded.exam_rank,
                    state = excluded.state,
                    category = excluded.category,
                    exam_date = excluded.exam_date,
                    exam_subjects = excluded.exam_subjects,
                    study_hours = excluded.study_hours,
                    last_updated = CURRENT_TIMESTAMP
            ''', (email, dept, grade, interests, marks, goals, weak_subjects, target_goals, 
                  exam_rank, state, category, exam_date, exam_subjects, study_hours))
            conn.commit()
            return jsonify({'success': True})
        except sqlite3.Error as e:
            print(f"SQLite mentor profile POST error: {e}")
            return jsonify({'success': False, 'message': 'Database error'}), 500
        finally:
            conn.close()

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
        
    success = delete_user_account(email)
    if success:
        return jsonify({'success': True, 'message': 'Account and all data permanently deleted'})
    else:
        return jsonify({'success': False, 'message': 'Failed to delete account'}), 500

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
    
    user_list = get_all_users_for_admin()
    return jsonify({'success': True, 'users': user_list})

@app.route('/api/admin/download-csv')
def api_admin_download_csv():
    admin_key = request.args.get('key')
    expected_key = os.environ.get('ADMIN_KEY') or 'admin'
    if admin_key != expected_key:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    csv_file = "student_logins.csv"
    if not os.path.exists(csv_file):
        return jsonify({'success': False, 'message': 'Log file not found'}), 404
        
    return send_from_directory('.', csv_file, as_attachment=True)

@app.route('/api/update-profile', methods=['POST', 'OPTIONS'])
def api_update_profile():
    if request.method == 'OPTIONS':
        return '', 204
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No data provided'}), 400
    email = data.get('email', '').strip().lower()
    dept = data.get('dept', '').strip()
    grade = data.get('grade', '').strip()
    
    if not all([email, dept, grade]):
        return jsonify({'success': False, 'message': 'Email, department, and year are required'}), 400
        
    success = update_user_profile(email, dept, grade)
    if success:
        return jsonify({'success': True, 'message': 'Profile updated successfully'})
    else:
        return jsonify({'success': False, 'message': 'Failed to update profile'}), 500

# Catch-all to serve any static asset (js, css, images)
@app.route('/<path:path>')
def serve_static(path):
    # Block access to databases, Excel sheets, CSV logs, and scripts for security and to prevent Excel sync credential prompts
    blocked_extensions = ('.db', '.xlsx', '.xls', '.csv', '.bat', '.git')
    if any(path.lower().endswith(ext) for ext in blocked_extensions) or '..' in path:
        return jsonify({'success': False, 'message': 'Access Denied'}), 403
    return send_from_directory('.', path)

init_db()

if __name__ == '__main__':
    print("Database initialized.")
    port = int(os.environ.get('PORT', 443))
    if 'PORT' in os.environ:
        app.run(host='0.0.0.0', port=port, debug=False)
    else:
        app.run(host='0.0.0.0', port=port, ssl_context='adhoc', debug=True)
