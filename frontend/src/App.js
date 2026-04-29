import React, { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

// ── Session helpers ───────────────────────────────────────────────────────
const SK = "shubhi_v2";
const getSession = () => { try { return JSON.parse(sessionStorage.getItem(SK)); } catch { return null; } };
const saveSession = (d) => sessionStorage.setItem(SK, JSON.stringify(d));
const clearSession = () => sessionStorage.removeItem(SK);

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [shake, setShake]       = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) { setError("Please fill in both fields."); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (data.success) {
        saveSession({ username: data.username, role: data.role, userId: data.userId });
        onLogin(data);
      } else {
        setError(data.error || "Invalid credentials.");
        setShake(true); setTimeout(() => setShake(false), 500);
      }
    } catch { setError("Server unreachable. Is Flask running?"); }
    setLoading(false);
  }

  return (
    <div className="login-root">
      <div className="login-blob b1" /><div className="login-blob b2" /><div className="login-blob b3" />
      <div className={`login-card ${shake ? "shake" : ""}`}>
        <div className="login-brand">
          <div className="brand-icon">✦</div>
          <div>
            <h1 className="brand-name">Shubhi</h1>
            <p className="brand-sub">AI Assistant by Rishabh</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="field">
            <label>Username</label>
            <input type="text" placeholder="Enter username" value={username}
              onChange={e => setUsername(e.target.value)} disabled={loading} autoComplete="username" />
          </div>
          <div className="field">
            <label>Password</label>
            <div className="pass-wrap">
              <input type={showPass ? "text" : "password"} placeholder="Enter password" value={password}
                onChange={e => setPassword(e.target.value)} disabled={loading} autoComplete="current-password" />
              <button type="button" className="eye-btn" onClick={() => setShowPass(v => !v)}>
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>
          {error && <div className="login-error">{error}</div>}
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : "Sign in →"}
          </button>
        </form>
        <p className="login-footer">Built by Rishabh · Powered by Groq</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
function AdminDashboard({ session, onLogout }) {
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [newUsername, setNewUser]   = useState("");
  const [newPassword, setNewPass]   = useState("");
  const [createMsg, setCreateMsg]   = useState("");
  const [creating, setCreating]     = useState(false);
  const [viewUser, setViewUser]     = useState(null);
  const [viewMsgs, setViewMsgs]     = useState([]);
  const [viewLoading, setViewLoad]  = useState(false);
  const [activeTab, setActiveTab]   = useState("users");

  const creds = { adminUsername: session.username, adminPassword: sessionStorage.getItem("__ap") || "" };

  // We store admin password separately for API calls
  useEffect(() => {
    // Prompt admin password once for API calls if not stored
    const stored = sessionStorage.getItem("__ap");
    if (!stored) {
      const p = prompt("Re-enter your admin password to unlock dashboard:");
      if (p) sessionStorage.setItem("__ap", p);
    }
    fetchUsers();
  }, []); // eslint-disable-line

  async function fetchUsers() {
    setLoading(true);
    const ap = sessionStorage.getItem("__ap") || "";
    try {
      const res  = await fetch(`/api/admin/users?adminUsername=${session.username}&adminPassword=${encodeURIComponent(ap)}`);
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch { }
    setLoading(false);
  }

  async function createUser(e) {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) { setCreateMsg("Fill in both fields."); return; }
    setCreating(true); setCreateMsg("");
    const ap = sessionStorage.getItem("__ap") || "";
    try {
      const res  = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminUsername: session.username, adminPassword: ap, username: newUsername.trim(), password: newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setCreateMsg(`✅ User "${newUsername}" created!`);
        setNewUser(""); setNewPass("");
        fetchUsers();
      } else {
        setCreateMsg(`❌ ${data.error}`);
      }
    } catch { setCreateMsg("❌ Server error."); }
    setCreating(false);
  }

  async function deleteUser(userId, username) {
    if (!window.confirm(`Delete user "${username}" and all their messages?`)) return;
    const ap = sessionStorage.getItem("__ap") || "";
    await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminUsername: session.username, adminPassword: ap }),
    });
    fetchUsers();
  }

  async function toggleUser(userId) {
    const ap = sessionStorage.getItem("__ap") || "";
    await fetch(`/api/admin/users/${userId}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminUsername: session.username, adminPassword: ap }),
    });
    fetchUsers();
  }

  async function viewMessages(user) {
    setViewUser(user); setViewLoad(true); setActiveTab("chat");
    const ap = sessionStorage.getItem("__ap") || "";
    try {
      const res  = await fetch(`/api/admin/users/${user.id}/messages?adminUsername=${session.username}&adminPassword=${encodeURIComponent(ap)}`);
      const data = await res.json();
      setViewMsgs(data.messages || []);
    } catch { }
    setViewLoad(false);
  }

  const totalMessages = users.reduce((s, u) => s + u.message_count, 0);

  return (
    <div className="admin-root">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-logo">✦ Shubhi Admin</div>
        <nav className="admin-nav">
          <button className={`nav-item ${activeTab === "users" ? "nav-item--active" : ""}`} onClick={() => setActiveTab("users")}>
            👥 Users
          </button>
          <button className={`nav-item ${activeTab === "create" ? "nav-item--active" : ""}`} onClick={() => setActiveTab("create")}>
            ➕ Create User
          </button>
          {viewUser && (
            <button className={`nav-item ${activeTab === "chat" ? "nav-item--active" : ""}`} onClick={() => setActiveTab("chat")}>
              💬 {viewUser.username}'s Chats
            </button>
          )}
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-stats">
            <div className="stat"><span className="stat-val">{users.length}</span><span className="stat-label">Users</span></div>
            <div className="stat"><span className="stat-val">{totalMessages}</span><span className="stat-label">Messages</span></div>
          </div>
          <button className="logout-btn" onClick={onLogout}>Sign out</button>
        </div>
      </aside>

      {/* Main content */}
      <main className="admin-main">
        {/* USERS TAB */}
        {activeTab === "users" && (
          <div className="admin-panel">
            <div className="panel-header">
              <h2>All Users</h2>
              <button className="refresh-btn" onClick={fetchUsers}>↻ Refresh</button>
            </div>
            {loading ? (
              <div className="admin-loading">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="admin-empty">No users yet. Create one from the sidebar!</div>
            ) : (
              <div className="users-table-wrap">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Created</th>
                      <th>Messages</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td><span className="user-name-cell">@{u.username}</span></td>
                        <td><span className="date-cell">{u.created_at.slice(0, 10)}</span></td>
                        <td><span className="count-badge">{u.message_count}</span></td>
                        <td>
                          <span className={`status-badge ${u.is_active ? "status-active" : "status-disabled"}`}>
                            {u.is_active ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td className="actions-cell">
                          <button className="action-btn action-view" onClick={() => viewMessages(u)}>View Chats</button>
                          <button className="action-btn action-toggle" onClick={() => toggleUser(u.id)}>
                            {u.is_active ? "Disable" : "Enable"}
                          </button>
                          <button className="action-btn action-delete" onClick={() => deleteUser(u.id, u.username)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* CREATE USER TAB */}
        {activeTab === "create" && (
          <div className="admin-panel">
            <div className="panel-header"><h2>Create New User</h2></div>
            <form className="create-form" onSubmit={createUser}>
              <div className="field">
                <label>Username</label>
                <input type="text" placeholder="e.g. shubhi" value={newUsername}
                  onChange={e => setNewUser(e.target.value)} disabled={creating} />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="text" placeholder="Min 4 characters" value={newPassword}
                  onChange={e => setNewPass(e.target.value)} disabled={creating} />
              </div>
              {createMsg && <div className={`create-msg ${createMsg.startsWith("✅") ? "create-msg--ok" : "create-msg--err"}`}>{createMsg}</div>}
              <button className="create-btn" type="submit" disabled={creating}>
                {creating ? <span className="spinner" /> : "Create User"}
              </button>
            </form>
            <div className="create-hint">
              <p>💡 After creating a user, share their username and password with them. They can log in at the same page as you.</p>
            </div>
          </div>
        )}

        {/* CHAT HISTORY TAB */}
        {activeTab === "chat" && viewUser && (
          <div className="admin-panel">
            <div className="panel-header">
              <h2>💬 {viewUser.username}'s Chat History</h2>
              <span className="msg-count-label">{viewMsgs.length} messages</span>
            </div>
            {viewLoading ? (
              <div className="admin-loading">Loading messages...</div>
            ) : viewMsgs.length === 0 ? (
              <div className="admin-empty">This user hasn't sent any messages yet.</div>
            ) : (
              <div className="chat-history-list">
                {viewMsgs.map((m, i) => (
                  <div key={i} className={`history-msg ${m.role === "user" ? "history-msg--user" : "history-msg--ai"}`}>
                    <div className="history-meta">
                      <span className="history-role">{m.role === "user" ? `@${viewUser.username}` : "Shubhi"}</span>
                      <span className="history-time">{m.created_at}</span>
                    </div>
                    <div className="history-content">{m.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAT PAGE
// ═══════════════════════════════════════════════════════════════════════════
function renderText(text) {
  const lines = text.split("\n");
  const out = []; let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith("```")) {
      const code = []; i++;
      while (i < lines.length && !lines[i].startsWith("```")) { code.push(lines[i]); i++; }
      out.push(<pre key={i} className="msg-code"><code>{code.join("\n")}</code></pre>);
      i++; continue;
    }
    if (l.startsWith("- ") || l.startsWith("* ")) {
      const items = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(<li key={i}>{lines[i].slice(2)}</li>); i++;
      }
      out.push(<ul key={`ul${i}`} className="msg-ul">{items}</ul>); continue;
    }
    if (l.trim()) out.push(<p key={i} className="msg-p">{l}</p>);
    i++;
  }
  return out;
}

function TypingDots() {
  return (
    <div className="msg-row msg-row--ai">
      <div className="msg-av">S</div>
      <div className="msg-bubble msg-bubble--ai typing-dots">
        <span /><span /><span />
      </div>
    </div>
  );
}

function ChatPage({ session, onLogout }) {
  const init = `Hey ${session.username}! I'm Shubhi 👋 How can I help you today?`;
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [sidebar, setSidebar]   = useState(false);
  const [histLoading, setHistLoad] = useState(true);
  const bottomRef  = useRef(null);
  const textaRef   = useRef(null);

  // Load saved history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const res  = await fetch(`/api/messages/${session.userId}`);
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        } else {
          setMessages([{ role: "assistant", content: init }]);
        }
      } catch {
        setMessages([{ role: "assistant", content: init }]);
      }
      setHistLoad(false);
    }
    loadHistory();
  }, []); // eslint-disable-line

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const el = textaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg = { role: "user", content: text };
    const newHist = [...messages, userMsg];
    setMessages(newHist);
    setInput(""); setLoading(true);
    try {
      const res  = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, userId: session.userId, history: messages }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply || data.error || "Something went wrong." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Network error. Please try again." }]);
    }
    setLoading(false);
    textaRef.current?.focus();
  }, [input, loading, messages, session.userId]);

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const PROMPTS = ["Tell me a fun fact", "Write a short poem", "Help me study", "Explain AI simply", "Give me productivity tips", "Tell me a joke"];

  if (histLoading) return <div className="loading-screen"><span className="spinner" /> Loading your chat...</div>;

  return (
    <div className="chat-root">
      {sidebar && <div className="sidebar-overlay" onClick={() => setSidebar(false)} />}
      <aside className={`sidebar ${sidebar ? "sidebar--open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">✦ Shubhi</div>
          <button className="close-btn" onClick={() => setSidebar(false)}>✕</button>
        </div>
        <div className="sidebar-section">
          <p className="section-label">Quick Prompts</p>
          {PROMPTS.map(p => (
            <button key={p} className="prompt-chip" onClick={() => { setInput(p); setSidebar(false); textaRef.current?.focus(); }}>{p}</button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="user-av">{session.username[0].toUpperCase()}</div>
            <div>
              <p className="user-name">{session.username}</p>
              <p className="user-role">User account</p>
            </div>
          </div>
          <button className="logout-btn" onClick={onLogout}>Sign out</button>
        </div>
      </aside>

      <div className="chat-main">
        <header className="chat-header">
          <button className="menu-btn" onClick={() => setSidebar(v => !v)}>☰</button>
          <div className="header-center">
            <span className="header-dot" />
            <span className="header-title">Shubhi</span>
          </div>
          <div className="header-right">
            <span className="groq-badge">Groq</span>
            <div className="header-av">{session.username[0].toUpperCase()}</div>
          </div>
        </header>

        <div className="chat-messages">
          {messages.map((m, i) => (
            <div key={i} className={`msg-row ${m.role === "user" ? "msg-row--user" : "msg-row--ai"}`}>
              {m.role === "assistant" && <div className="msg-av">S</div>}
              <div className={`msg-bubble ${m.role === "user" ? "msg-bubble--user" : "msg-bubble--ai"}`}>
                {m.role === "user" ? <p className="msg-p">{m.content}</p> : renderText(m.content)}
              </div>
              {m.role === "user" && <div className="msg-av msg-av--user">{session.username[0].toUpperCase()}</div>}
            </div>
          ))}
          {loading && <TypingDots />}
          <div ref={bottomRef} />
        </div>

        <div className="input-wrap">
          <div className="input-box">
            <textarea ref={textaRef} className="chat-ta" placeholder="Message Shubhi…"
              value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} rows={1} disabled={loading} />
            <button className={`send-btn ${!input.trim() || loading ? "send-btn--off" : ""}`}
              onClick={send} disabled={!input.trim() || loading}>↑</button>
          </div>
          <p className="input-hint">Enter to send · Shift+Enter for new line · Chats are saved</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [session, setSession] = useState(() => getSession());

  function handleLogin(data) {
    saveSession(data); setSession(data);
  }
  function handleLogout() {
    clearSession(); sessionStorage.removeItem("__ap"); setSession(null);
  }

  if (!session) return <LoginPage onLogin={handleLogin} />;
  if (session.role === "admin") return <AdminDashboard session={session} onLogout={handleLogout} />;
  return <ChatPage session={session} onLogout={handleLogout} />;
}
