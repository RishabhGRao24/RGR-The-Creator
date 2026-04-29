from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
import os
import sqlite3
import hashlib
import uuid
from datetime import datetime
from dotenv import load_dotenv

# ✅ FIX 1: Explicit .env path (CRITICAL for on-prem)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

app = Flask(__name__, static_folder="../frontend/build", static_url_path="/")
CORS(app)

# ✅ FIX 2: Strip API key (removes hidden spaces/newlines)
GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "").strip()
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "rishabh")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
GROQ_URL       = "https://api.groq.com/openai/v1/chat/completions"
DB_PATH        = os.path.join(os.path.dirname(__file__), "shubhi.db")

print("🚀 GROQ_API_KEY Loaded:", bool(GROQ_API_KEY))  # ✅ DEBUG

# ── Database setup ─────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_active INTEGER DEFAULT 1
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    conn.commit()
    conn.close()
    print("✅ Database ready.")

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password, hashed):
    return hash_password(password) == hashed

init_db()

# ── Helpers ────────────────────────────────────────────────────────────────
def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")  # ✅ safer

def is_admin(username, password):
    return username == ADMIN_USERNAME and password == ADMIN_PASSWORD

# ── Serve React ────────────────────────────────────────────────────────────
@app.route("/")
def serve():
    return send_from_directory(app.static_folder, "index.html")

@app.errorhandler(404)
def not_found(e):
    return send_from_directory(app.static_folder, "index.html")

# ── User: Chat ─────────────────────────────────────────────────────────────
@app.route("/api/chat", methods=["POST"])
def chat():

    # ✅ FIX 3: Debug key inside API call
    print("🔑 DEBUG KEY VALUE:", GROQ_API_KEY)

    if not GROQ_API_KEY:
        return jsonify({"error": "GROQ_API_KEY not set on server."}), 500

    data    = request.get_json()
    message = data.get("message", "").strip()
    user_id = data.get("userId", "")
    history = data.get("history", [])

    if not message:
        return jsonify({"error": "Empty message."}), 400

    messages = [{
        "role": "system",
        "content": (
            "You are Shubhi, a warm, clever, friendly AI assistant created by Rishabh. "
            "Reply naturally — not too formal, not robotic."
        )
    }]

    for msg in history[-10:]:
        messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": message})

    try:
        print("🚀 Calling Groq API...")

        resp = requests.post(
            GROQ_URL,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {GROQ_API_KEY}"
            },
            json={
                "model": "llama-3.1-8b-instant",
                "messages": messages,
                "temperature": 0.8,
                "max_tokens": 512
            },
            timeout=60  # ✅ FIX 4: Increased timeout
        )

        # ✅ FIX 5: Full debug logs
        print("📡 Status:", resp.status_code)
        print("📡 Response:", resp.text)

        resp.raise_for_status()
        data = resp.json()

        reply = data["choices"][0]["message"]["content"]

        return jsonify({"reply": reply})

    except requests.exceptions.Timeout:
        print("❌ Timeout error")
        return jsonify({"error": "Request timed out."}), 504

    except requests.exceptions.RequestException as e:
        print("❌ FULL ERROR:", str(e))
        if e.response:
            print("❌ RESPONSE:", e.response.text)
        return jsonify({"error": "Groq API failed. Check server logs."}), 500

    except Exception as e:
        print("❌ UNKNOWN ERROR:", str(e))
        return jsonify({"error": "Unexpected error."}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)

#  Chat gpt suggestion
# from flask import Flask, request, jsonify, send_from_directory
# from flask_cors import CORS
# import requests
# import os
# import sqlite3
# import hashlib
# import uuid
# from datetime import datetime
# from dotenv import load_dotenv

# load_dotenv()
# app = Flask(__name__, static_folder="../frontend/build", static_url_path="/")
# CORS(app)

# GROQ_API_KEY   = os.getenv("GROQ_API_KEY")
# ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "rishabh")
# ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
# GROQ_URL       = "https://api.groq.com/openai/v1/chat/completions"
# DB_PATH        = os.path.join(os.path.dirname(__file__), "shubhi.db")

# # ── Database setup ─────────────────────────────────────────────────────────
# def get_db():
#     conn = sqlite3.connect(DB_PATH)
#     conn.row_factory = sqlite3.Row
#     return conn

# def init_db():
#     conn = get_db()
#     c = conn.cursor()
#     c.execute("""
#         CREATE TABLE IF NOT EXISTS users (
#             id       TEXT PRIMARY KEY,
#             username TEXT UNIQUE NOT NULL,
#             password TEXT NOT NULL,
#             created_at TEXT NOT NULL,
#             is_active  INTEGER DEFAULT 1
#         )
#     """)
#     c.execute("""
#         CREATE TABLE IF NOT EXISTS messages (
#             id         TEXT PRIMARY KEY,
#             user_id    TEXT NOT NULL,
#             role       TEXT NOT NULL,
#             content    TEXT NOT NULL,
#             created_at TEXT NOT NULL,
#             FOREIGN KEY (user_id) REFERENCES users(id)
#         )
#     """)
#     conn.commit()
#     conn.close()
#     print("✅ Database ready.")

# def hash_password(password):
#     return hashlib.sha256(password.encode()).hexdigest()

# def verify_password(password, hashed):
#     return hash_password(password) == hashed

# init_db()

# # ── Helpers ────────────────────────────────────────────────────────────────
# def now():
#     return datetime.strftime("%Y-%m-%d %H:%M:%S")
#     # return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

# def is_admin(username, password):
#     return username == ADMIN_USERNAME and password == ADMIN_PASSWORD

# # ── Serve React ────────────────────────────────────────────────────────────
# @app.route("/")
# def serve():
#     return send_from_directory(app.static_folder, "index.html")

# @app.errorhandler(404)
# def not_found(e):
#     return send_from_directory(app.static_folder, "index.html")

# # ── Auth: Login ────────────────────────────────────────────────────────────
# @app.route("/api/login", methods=["POST"])
# def login():
#     data     = request.get_json()
#     username = data.get("username", "").strip().lower()
#     password = data.get("password", "")

#     # Admin login
#     if is_admin(username, password):
#         return jsonify({"success": True, "role": "admin", "username": ADMIN_USERNAME, "userId": "admin"})

#     # User login
#     conn = get_db()
#     user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
#     conn.close()

#     if not user:
#         return jsonify({"success": False, "error": "User not found."}), 401
#     if not user["is_active"]:
#         return jsonify({"success": False, "error": "Account is disabled."}), 403
#     if not verify_password(password, user["password"]):
#         return jsonify({"success": False, "error": "Wrong password."}), 401

#     return jsonify({"success": True, "role": "user", "username": user["username"], "userId": user["id"]})

# # ── Admin: Create user ─────────────────────────────────────────────────────
# @app.route("/api/admin/users", methods=["POST"])
# def create_user():
#     data     = request.get_json()
#     admin_u  = data.get("adminUsername", "").strip().lower()
#     admin_p  = data.get("adminPassword", "")
#     username = data.get("username", "").strip().lower()
#     password = data.get("password", "")

#     if not is_admin(admin_u, admin_p):
#         return jsonify({"error": "Unauthorized."}), 403
#     if not username or not password:
#         return jsonify({"error": "Username and password are required."}), 400
#     if len(password) < 4:
#         return jsonify({"error": "Password must be at least 4 characters."}), 400

#     conn = get_db()
#     existing = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
#     if existing:
#         conn.close()
#         return jsonify({"error": f"Username '{username}' already exists."}), 409

#     user_id = str(uuid.uuid4())
#     conn.execute(
#         "INSERT INTO users (id, username, password, created_at) VALUES (?, ?, ?, ?)",
#         (user_id, username, hash_password(password), now())
#     )
#     conn.commit()
#     conn.close()
#     return jsonify({"success": True, "message": f"User '{username}' created.", "userId": user_id})

# # ── Admin: Get all users ───────────────────────────────────────────────────
# @app.route("/api/admin/users", methods=["GET"])
# def get_users():
#     admin_u = request.args.get("adminUsername", "").strip().lower()
#     admin_p = request.args.get("adminPassword", "")

#     if not is_admin(admin_u, admin_p):
#         return jsonify({"error": "Unauthorized."}), 403

#     conn  = get_db()
#     users = conn.execute("""
#         SELECT u.id, u.username, u.created_at, u.is_active,
#                COUNT(m.id) as message_count
#         FROM users u
#         LEFT JOIN messages m ON m.user_id = u.id
#         GROUP BY u.id
#         ORDER BY u.created_at DESC
#     """).fetchall()
#     conn.close()

#     return jsonify({"users": [dict(u) for u in users]})

# # ── Admin: Delete / disable user ───────────────────────────────────────────
# @app.route("/api/admin/users/<user_id>", methods=["DELETE"])
# def delete_user(user_id):
#     data    = request.get_json()
#     admin_u = data.get("adminUsername", "").strip().lower()
#     admin_p = data.get("adminPassword", "")

#     if not is_admin(admin_u, admin_p):
#         return jsonify({"error": "Unauthorized."}), 403

#     conn = get_db()
#     conn.execute("DELETE FROM messages WHERE user_id = ?", (user_id,))
#     conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
#     conn.commit()
#     conn.close()
#     return jsonify({"success": True, "message": "User deleted."})

# # ── Admin: Toggle user active/disabled ────────────────────────────────────
# @app.route("/api/admin/users/<user_id>/toggle", methods=["POST"])
# def toggle_user(user_id):
#     data    = request.get_json()
#     admin_u = data.get("adminUsername", "").strip().lower()
#     admin_p = data.get("adminPassword", "")

#     if not is_admin(admin_u, admin_p):
#         return jsonify({"error": "Unauthorized."}), 403

#     conn = get_db()
#     user = conn.execute("SELECT is_active FROM users WHERE id = ?", (user_id,)).fetchone()
#     if not user:
#         conn.close()
#         return jsonify({"error": "User not found."}), 404
#     new_status = 0 if user["is_active"] else 1
#     conn.execute("UPDATE users SET is_active = ? WHERE id = ?", (new_status, user_id))
#     conn.commit()
#     conn.close()
#     return jsonify({"success": True, "is_active": new_status})

# # ── Admin: View user chat history ──────────────────────────────────────────
# @app.route("/api/admin/users/<user_id>/messages", methods=["GET"])
# def get_user_messages(user_id):
#     admin_u = request.args.get("adminUsername", "").strip().lower()
#     admin_p = request.args.get("adminPassword", "")

#     if not is_admin(admin_u, admin_p):
#         return jsonify({"error": "Unauthorized."}), 403

#     conn     = get_db()
#     user     = conn.execute("SELECT username FROM users WHERE id = ?", (user_id,)).fetchone()
#     messages = conn.execute(
#         "SELECT role, content, created_at FROM messages WHERE user_id = ? ORDER BY created_at ASC",
#         (user_id,)
#     ).fetchall()
#     conn.close()

#     return jsonify({
#         "username": user["username"] if user else "Unknown",
#         "messages": [dict(m) for m in messages]
#     })

# # ── User: Load chat history ────────────────────────────────────────────────
# @app.route("/api/messages/<user_id>", methods=["GET"])
# def load_messages(user_id):
#     conn     = get_db()
#     messages = conn.execute(
#         "SELECT role, content FROM messages WHERE user_id = ? ORDER BY created_at ASC",
#         (user_id,)
#     ).fetchall()
#     conn.close()
#     return jsonify({"messages": [dict(m) for m in messages]})

# # ── User: Chat ─────────────────────────────────────────────────────────────
# @app.route("/api/chat", methods=["POST"])
# def chat():
#     if not GROQ_API_KEY:
#         return jsonify({"error": "GROQ_API_KEY not set."}), 500

#     data    = request.get_json()
#     message = data.get("message", "").strip()
#     user_id = data.get("userId", "")
#     history = data.get("history", [])

#     if not message:
#         return jsonify({"error": "Empty message."}), 400

#     # Build messages for Groq
#     messages = [{
#         "role": "system",
#         "content": (
#             "You are Shubhi, a warm, clever, friendly AI assistant created by Rishabh. "
#             "Reply naturally — not too formal, not robotic. "
#             "When asked who made you, say Rishabh built you. "
#             "Be concise unless the user asks for more detail."
#         )
#     }]
#     for msg in history[-10:]:
#         messages.append({"role": msg["role"], "content": msg["content"]})
#     messages.append({"role": "user", "content": message})

#     try:
#         resp = requests.post(
#             GROQ_URL,
#             headers={"Content-Type": "application/json", "Authorization": f"Bearer {GROQ_API_KEY}"},
#             json={"model": "llama-3.1-8b-instant", "messages": messages, "temperature": 0.8, "max_tokens": 512},
#             timeout=30
#         )
#         resp.raise_for_status()
#         reply = resp.json()["choices"][0]["message"]["content"]

#         # Save messages to DB (only for real users, not admin)
#         if user_id and user_id != "admin":
#             conn = get_db()
#             conn.execute("INSERT INTO messages (id,user_id,role,content,created_at) VALUES (?,?,?,?,?)",
#                          (str(uuid.uuid4()), user_id, "user", message, now()))
#             conn.execute("INSERT INTO messages (id,user_id,role,content,created_at) VALUES (?,?,?,?,?)",
#                          (str(uuid.uuid4()), user_id, "assistant", reply, now()))
#             conn.commit()
#             conn.close()

#         return jsonify({"reply": reply})

#     except requests.exceptions.Timeout:
#         return jsonify({"error": "Request timed out."}), 504
#     except requests.exceptions.RequestException as e:
#         err_text = e.response.text if e.response else str(e)
#         return jsonify({"error": f"API error: {err_text}"}), 500
#     except (KeyError, IndexError):
#         return jsonify({"error": "Unexpected API response."}), 500


# if __name__ == "__main__":
#     app.run(debug=True, port=5000)
