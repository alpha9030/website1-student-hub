import os
import sqlite3
import hashlib
from flask import Flask, request, jsonify, send_from_directory

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
    conn.commit()
    conn.close()

def hash_password(password):
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

# API Endpoints

@app.route('/api/register', methods=['POST', 'OPTIONS'])
def api_register():
    if request.method == 'OPTIONS':
        return '', 204
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No data provided'}), 400
        
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    grade = data.get('grade')
    dept = data.get('dept')
    
    if not all([username, email, password, grade, dept]):
        return jsonify({'success': False, 'message': 'All fields are required'}), 400
        
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
        
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'success': False, 'message': 'Email and password are required'}), 400
        
    hashed = hash_password(password)
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT username, email, grade, dept FROM users WHERE email = ? AND password = ?', (email, hashed))
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
        email = request.args.get('email')
        if not email:
            return jsonify({'success': False, 'message': 'Email required'}), 400
            
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT checkpoint_id FROM progress WHERE email = ?', (email,))
        rows = cursor.fetchall()
        conn.close()
        
        checkpoints = [row['checkpoint_id'] for row in rows]
        return jsonify({'success': True, 'progress': checkpoints})
        
    elif request.method == 'POST':
        data = request.get_json()
        email = data.get('email')
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
                cursor.execute('DELETE FROM progress WHERE email = ? AND checkpoint_id = ?', (email, checkpoint_id))
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
        email = request.args.get('email')
        if not email:
            return jsonify({'success': False, 'message': 'Email required'}), 400
            
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT aura_mode, aura_api_key, aura_user_name FROM chatbot_settings WHERE email = ?', (email,))
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
        email = data.get('email')
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
    email = data.get('email')
    if not email:
        return jsonify({'success': False, 'message': 'Email required'}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    # Delete user (foreign key cascades will delete progress and chatbot settings)
    cursor.execute('DELETE FROM users WHERE email = ?', (email,))
    cursor.execute('DELETE FROM progress WHERE email = ?', (email,))
    cursor.execute('DELETE FROM chatbot_settings WHERE email = ?', (email,))
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
    if admin_key != 'admin123':
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT username, email, grade, dept FROM users')
    users = cursor.fetchall()
    
    user_list = []
    for u in users:
        cursor.execute('SELECT COUNT(*) FROM progress WHERE email = ?', (u['email'],))
        prog_count = cursor.fetchone()[0]
        user_list.append({
            'username': u['username'],
            'email': u['email'],
            'grade': u['grade'],
            'dept': u['dept'],
            'progress_count': prog_count
        })
    conn.close()
    return jsonify({'success': True, 'users': user_list})

# Catch-all to serve any static asset (js, css, images)
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

if __name__ == '__main__':
    init_db()
    print("Database initialized.")
    app.run(host='0.0.0.0', port=443, ssl_context='adhoc', debug=True)
