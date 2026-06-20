import os
import sqlite3
import hashlib
import re
import random
import smtplib
import requests
import json
import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Flask, request, jsonify, send_from_directory

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
ORDS_BASE_URL = config_data.get('ORDS_BASE_URL', '').strip()
SUPABASE_URL = config_data.get('SUPABASE_URL', '').strip()
SUPABASE_KEY = config_data.get('SUPABASE_KEY', '').strip()

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

app = Flask(__name__, static_folder='.', static_url_path='')

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

def init_db():
    if SUPABASE_URL and SUPABASE_KEY:
        print("Using Supabase cloud database. Local SQLite initialization skipped.")
        return
    if ORDS_BASE_URL:
        print("Using Oracle APEX/ORDS database endpoints. Local SQLite initialization skipped.")
        return
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
            login_count INTEGER DEFAULT 0
        )
    ''')
    
    # Safely alter table to add columns in case the table already existed in database file
    for col_def in [
        ("created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
        ("last_login_at", "DATETIME"),
        ("login_count", "INTEGER DEFAULT 0")
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
            deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def hash_password(password):
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

# Cloud Database & Local Fallback Integration Helpers
def get_user_by_email(email):
    email = email.strip().lower()
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/users"
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json"
            }
            params = {"email": f"eq.{email}"}
            response = requests.get(url, headers=headers, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    user = data[0]
                    return {
                        'email': user.get('email'),
                        'username': user.get('username'),
                        'password': user.get('password'),
                        'grade': user.get('grade'),
                        'dept': user.get('dept'),
                        'created_at': user.get('created_at'),
                        'last_login_at': user.get('last_login_at'),
                        'login_count': user.get('login_count', 0)
                    }
        except Exception as e:
            print(f"Supabase get_user_by_email error: {e}")
        return None
    elif ORDS_BASE_URL:
        try:
            url = f"{ORDS_BASE_URL.rstrip('/')}/users/{email}"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data:
                    return {
                        'email': data.get('email') or data.get('EMAIL'),
                        'username': data.get('username') or data.get('USERNAME'),
                        'password': data.get('password') or data.get('PASSWORD'),
                        'grade': data.get('grade') or data.get('GRADE'),
                        'dept': data.get('dept') or data.get('DEPT')
                    }
        except Exception as e:
            print(f"ORDS get_user_by_email error: {e}")
        return None
    else:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT username, email, password, grade, dept, created_at, last_login_at, login_count FROM users WHERE LOWER(email) = ?', (email,))
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
                'login_count': row['login_count']
            }
        return None

def get_user_by_email_or_username(identifier):
    identifier = identifier.strip().lower()
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/users"
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json"
            }
            params = {"or": f"(email.eq.{identifier},username.eq.{identifier})"}
            response = requests.get(url, headers=headers, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    user = data[0]
                    return {
                        'email': user.get('email'),
                        'username': user.get('username'),
                        'password': user.get('password'),
                        'grade': user.get('grade'),
                        'dept': user.get('dept'),
                        'created_at': user.get('created_at'),
                        'last_login_at': user.get('last_login_at'),
                        'login_count': user.get('login_count', 0)
                    }
        except Exception as e:
            print(f"Supabase get_user_by_email_or_username error: {e}")
        return None
    elif ORDS_BASE_URL:
        try:
            if '@' in identifier:
                u = get_user_by_email(identifier)
                if u:
                    return u
            url = f"{ORDS_BASE_URL.rstrip('/')}/users/"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                items = response.json().get('items', [])
                for item in items:
                    email_val = (item.get('email') or item.get('EMAIL') or '').strip().lower()
                    username_val = (item.get('username') or item.get('USERNAME') or '').strip().lower()
                    if email_val == identifier or username_val == identifier:
                        return get_user_by_email(email_val)
        except Exception as e:
            print(f"ORDS get_user_by_email_or_username error: {e}")
        return None
    else:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT username, email, password, grade, dept, created_at, last_login_at, login_count FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?', (identifier, identifier))
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
                'login_count': row['login_count']
            }
        return None

def register_user(email, username, password_hash, grade, dept):
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            }
            # 1. Insert user
            url_users = f"{SUPABASE_URL.rstrip('/')}/rest/v1/users"
            payload_user = {
                'email': email,
                'username': username,
                'password': password_hash,
                'grade': grade,
                'dept': dept
            }
            res_user = requests.post(url_users, headers=headers, json=payload_user, timeout=10)
            if res_user.status_code not in (200, 201):
                return False
                
            # 2. Insert default chatbot settings
            url_chatbot = f"{SUPABASE_URL.rstrip('/')}/rest/v1/chatbot_settings"
            payload_chatbot = {
                'email': email,
                'aura_mode': 'offline',
                'aura_api_key': '',
                'aura_user_name': username
            }
            requests.post(url_chatbot, headers=headers, json=payload_chatbot, timeout=10)
            return True
        except Exception as e:
            print(f"Supabase register_user error: {e}")
            return False
    elif ORDS_BASE_URL:
        try:
            url = f"{ORDS_BASE_URL.rstrip('/')}/users/"
            payload = {
                'email': email,
                'username': username,
                'password': password_hash,
                'grade': grade,
                'dept': dept
            }
            response = requests.post(url, json=payload, timeout=10)
            return response.status_code in (200, 201)
        except Exception as e:
            print(f"ORDS register_user error: {e}")
            return False
    else:
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
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/progress"
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json"
            }
            params = {"email": f"eq.{email}"}
            response = requests.get(url, headers=headers, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                return [item.get('checkpoint_id') for item in data]
        except Exception as e:
            print(f"Supabase get_user_progress error: {e}")
        return []
    elif ORDS_BASE_URL:
        try:
            url = f"{ORDS_BASE_URL.rstrip('/')}/progress/"
            params = {'email': email}
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                items = response.json().get('items', [])
                return [item.get('checkpoint_id') or item.get('CHECKPOINT_ID') for item in items]
        except Exception as e:
            print(f"ORDS get_user_progress error: {e}")
        return []
    else:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT checkpoint_id FROM progress WHERE LOWER(email) = ?', (email,))
        rows = cursor.fetchall()
        conn.close()
        return [row['checkpoint_id'] for row in rows]

def update_user_progress(email, checkpoint_id, checked):
    email = email.strip().lower()
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json"
            }
            if checked:
                url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/progress"
                payload = {
                    'email': email,
                    'checkpoint_id': checkpoint_id
                }
                headers["Prefer"] = "resolution=merge-duplicates"
                response = requests.post(url, headers=headers, json=payload, timeout=10)
                return response.status_code in (200, 201)
            else:
                url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/progress"
                params = {
                    "email": f"eq.{email}",
                    "checkpoint_id": f"eq.{checkpoint_id}"
                }
                response = requests.delete(url, headers=headers, params=params, timeout=10)
                return response.status_code in (200, 204)
        except Exception as e:
            print(f"Supabase update_user_progress error: {e}")
            return False
    elif ORDS_BASE_URL:
        try:
            url = f"{ORDS_BASE_URL.rstrip('/')}/progress/"
            payload = {
                'email': email,
                'checkpoint_id': checkpoint_id,
                'checked': 'true' if checked else 'false'
            }
            response = requests.post(url, json=payload, timeout=10)
            return response.status_code == 200
        except Exception as e:
            print(f"ORDS update_user_progress error: {e}")
            return False
    else:
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
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/chatbot_settings"
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json"
            }
            params = {"email": f"eq.{email}"}
            response = requests.get(url, headers=headers, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    item = data[0]
                    return {
                        'aura_mode': item.get('aura_mode') or 'offline',
                        'aura_api_key': item.get('aura_api_key') or '',
                        'aura_user_name': item.get('aura_user_name') or ''
                    }
        except Exception as e:
            print(f"Supabase get_chatbot_settings error: {e}")
        return None
    elif ORDS_BASE_URL:
        try:
            url = f"{ORDS_BASE_URL.rstrip('/')}/chatbot-settings/"
            params = {'email': email}
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data:
                    return {
                        'aura_mode': data.get('aura_mode') or data.get('AURA_MODE') or 'offline',
                        'aura_api_key': data.get('aura_api_key') or data.get('AURA_API_KEY') or '',
                        'aura_user_name': data.get('aura_user_name') or data.get('AURA_USER_NAME') or ''
                    }
        except Exception as e:
            print(f"ORDS get_chatbot_settings error: {e}")
        return None
    else:
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
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/chatbot_settings"
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates"
            }
            payload = {
                'email': email,
                'aura_mode': aura_mode,
                'aura_api_key': aura_api_key,
                'aura_user_name': aura_user_name
            }
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            return response.status_code in (200, 201)
        except Exception as e:
            print(f"Supabase save_chatbot_settings error: {e}")
            return False
    elif ORDS_BASE_URL:
        try:
            url = f"{ORDS_BASE_URL.rstrip('/')}/chatbot-settings/"
            payload = {
                'email': email,
                'aura_mode': aura_mode,
                'aura_api_key': aura_api_key,
                'aura_user_name': aura_user_name
            }
            response = requests.post(url, json=payload, timeout=10)
            return response.status_code == 200
        except Exception as e:
            print(f"ORDS save_chatbot_settings error: {e}")
            return False
    else:
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

def delete_user_account(email):
    email = email.strip().lower()
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            user = get_user_by_email(email)
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json"
            }
            if user:
                url_archive = f"{SUPABASE_URL.rstrip('/')}/rest/v1/deleted_users"
                requests.post(url_archive, headers=headers, json={
                    'email': user['email'],
                    'username': user['username'],
                    'grade': user['grade'],
                    'dept': user['dept']
                }, timeout=10)
            url_delete = f"{SUPABASE_URL.rstrip('/')}/rest/v1/users"
            params = {"email": f"eq.{email}"}
            response = requests.delete(url_delete, headers=headers, params=params, timeout=10)
            return response.status_code in (200, 204)
        except Exception as e:
            print(f"Supabase delete_user_account error: {e}")
            return False
    elif ORDS_BASE_URL:
        try:
            user = get_user_by_email(email)
            if user:
                url_archive = f"{ORDS_BASE_URL.rstrip('/')}/deleted-users/"
                requests.post(url_archive, json={
                    'email': user['email'],
                    'username': user['username'],
                    'grade': user['grade'],
                    'dept': user['dept']
                }, timeout=10)
            url_delete = f"{ORDS_BASE_URL.rstrip('/')}/users/{email}"
            response = requests.delete(url_delete, timeout=10)
            return response.status_code == 200
        except Exception as e:
            print(f"ORDS delete_user_account error: {e}")
            return False
    else:
        conn = get_db()
        cursor = conn.cursor()
        try:
            cursor.execute('SELECT username, grade, dept FROM users WHERE LOWER(email) = ?', (email,))
            user = cursor.fetchone()
            if user:
                cursor.execute(
                    'INSERT OR REPLACE INTO deleted_users (email, username, grade, dept) VALUES (?, ?, ?, ?)',
                    (email, user['username'], user['grade'], user['dept'])
                )
            cursor.execute('DELETE FROM users WHERE LOWER(email) = ?', (email,))
            cursor.execute('DELETE FROM progress WHERE LOWER(email) = ?', (email,))
            cursor.execute('DELETE FROM chatbot_settings WHERE LOWER(email) = ?', (email,))
            conn.commit()
            return True
        except sqlite3.Error as e:
            print(f"SQLite delete_user_account error: {e}")
            return False
        finally:
            conn.close()

def get_all_users_for_admin():
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json"
            }
            url_users = f"{SUPABASE_URL.rstrip('/')}/rest/v1/users"
            res_users = requests.get(url_users, headers=headers, timeout=10)
            active_users = []
            if res_users.status_code == 200:
                active_users = res_users.json()
                
            url_deleted = f"{SUPABASE_URL.rstrip('/')}/rest/v1/deleted_users"
            res_deleted = requests.get(url_deleted, headers=headers, timeout=10)
            deleted_users = []
            if res_deleted.status_code == 200:
                deleted_users = res_deleted.json()
                
            user_list = []
            for u in active_users:
                email = u.get('email')
                progress = get_user_progress(email)
                user_list.append({
                    'username': u.get('username'),
                    'email': email,
                    'grade': u.get('grade'),
                    'dept': u.get('dept'),
                    'progress_count': len(progress),
                    'status': 'active',
                    'last_login_at': u.get('last_login_at'),
                    'login_count': u.get('login_count', 0)
                })
                
            for d in deleted_users:
                user_list.append({
                    'username': d.get('username'),
                    'email': d.get('email'),
                    'grade': d.get('grade'),
                    'dept': d.get('dept'),
                    'progress_count': 0,
                    'status': 'deleted'
                })
            return user_list
        except Exception as e:
            print(f"Supabase get_all_users_for_admin error: {e}")
            return []
    elif ORDS_BASE_URL:
        try:
            url_users = f"{ORDS_BASE_URL.rstrip('/')}/users/"
            response_users = requests.get(url_users, timeout=10)
            active_users = []
            if response_users.status_code == 200:
                active_users = response_users.json().get('items', [])
            
            url_deleted = f"{ORDS_BASE_URL.rstrip('/')}/deleted-users/"
            response_deleted = requests.get(url_deleted, timeout=10)
            deleted_users = []
            if response_deleted.status_code == 200:
                deleted_users = response_deleted.json().get('items', [])
                
            user_list = []
            for u in active_users:
                email = u.get('email') or u.get('EMAIL')
                progress = get_user_progress(email)
                user_list.append({
                    'username': u.get('username') or u.get('USERNAME'),
                    'email': email,
                    'grade': u.get('grade') or u.get('GRADE'),
                    'dept': u.get('dept') or u.get('DEPT'),
                    'progress_count': len(progress),
                    'status': 'active'
                })
                
            for d in deleted_users:
                user_list.append({
                    'username': d.get('username') or d.get('USERNAME'),
                    'email': d.get('email') or d.get('EMAIL'),
                    'grade': d.get('grade') or d.get('GRADE'),
                    'dept': d.get('dept') or d.get('DEPT'),
                    'progress_count': 0,
                    'status': 'deleted'
                })
            return user_list
        except Exception as e:
            print(f"ORDS get_all_users_for_admin error: {e}")
            return []
    else:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT username, email, grade, dept, last_login_at, login_count FROM users')
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
                'status': 'active',
                'last_login_at': u['last_login_at'],
                'login_count': u['login_count'] if u['login_count'] is not None else 0
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
        return user_list

def update_user_profile(email, dept, grade):
    email = email.strip().lower()
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/users"
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json"
            }
            params = {"email": f"eq.{email}"}
            payload = {
                "dept": dept,
                "grade": grade
            }
            response = requests.patch(url, headers=headers, params=params, json=payload, timeout=10)
            return response.status_code in (200, 204)
        except Exception as e:
            print(f"Supabase update_user_profile error: {e}")
            return False
    else:
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

def track_user_login(email):
    email = email.strip().lower()
    current_time = datetime.datetime.utcnow().isoformat()
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            # 1. Fetch current login count
            user = get_user_by_email(email)
            current_count = user.get('login_count', 0) if user else 0
            if current_count is None:
                current_count = 0
            
            # 2. Update last_login_at and increment login_count
            url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/users"
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json"
            }
            params = {"email": f"eq.{email}"}
            payload = {
                "last_login_at": current_time,
                "login_count": current_count + 1
            }
            requests.patch(url, headers=headers, params=params, json=payload, timeout=10)
        except Exception as e:
            print(f"Supabase track_user_login error: {e}")
    else:
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
        
    email = data.get('email', '').strip().lower()
    username = data.get('username', '').strip()
    
    if not email or not username:
        return jsonify({'success': False, 'message': 'Email and username are required'}), 400
        
    # Check if user already exists
    user = get_user_by_email(email)
    
    if user:
        # User exists, log them in!
        track_user_login(email)
        return jsonify({
            'success': True,
            'message': 'Logged in successfully via Google',
            'user': {
                'username': user['username'],
                'email': user['email'],
                'grade': user['grade'],
                'dept': user['dept']
            }
        })
    else:
        # User does not exist, register them!
        dept = data.get('dept', '').strip()
        grade = data.get('grade', '').strip()
        if not dept or not grade:
            return jsonify({'success': False, 'message': 'Academic Department and Year are required for registration'}), 400
            
        # Use a random password string since they authenticate via Google
        placeholder_pwd = hash_password(os.urandom(24).hex())
        success = register_user(email, username, placeholder_pwd, grade, dept)
        if success:
            track_user_login(email)
            return jsonify({
                'success': True,
                'message': 'Account created successfully via Google',
                'user': {
                    'username': username,
                    'email': email,
                    'grade': grade,
                    'dept': dept
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
        
    hashed = hash_password(password)
    user = get_user_by_email_or_username(email)
    
    if user and user['password'] == hashed:
        track_user_login(user['email'])
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
    return send_from_directory('.', path)

init_db()

if __name__ == '__main__':
    print("Database initialized.")
    app.run(host='0.0.0.0', port=443, ssl_context='adhoc', debug=True)
