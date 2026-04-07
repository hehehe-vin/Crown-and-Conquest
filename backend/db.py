# ─────────────────────────────────────────────────────────────────────────────
# db.py  ·  Crown & Conquest – DAA-IV-T241
# SQLite database: user accounts + game saves
# ─────────────────────────────────────────────────────────────────────────────

import os
import json
import sqlite3
import bcrypt
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), "crown_conquest.db")


def _conn():
    """Return a connection with row_factory set."""
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA foreign_keys=ON")
    return c


def init_db():
    """Create tables if they don't exist. Safe to call on every startup."""
    c = _conn()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            username    TEXT    NOT NULL UNIQUE COLLATE NOCASE,
            pw_hash     TEXT    NOT NULL,
            created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS saves (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            save_data   TEXT    NOT NULL,
            updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
            UNIQUE(user_id)
        );
    """)
    c.commit()
    c.close()
    print(f"  Database ready: {DB_PATH}")


# ── User Management ─────────────────────────────────────────────

def create_user(username: str, password: str) -> dict:
    """
    Create a new user account.
    Returns {"ok": True, "user_id": int} or {"ok": False, "error": str}.
    """
    username = username.strip()
    if not username or len(username) < 2:
        return {"ok": False, "error": "Username must be at least 2 characters."}
    if len(username) > 24:
        return {"ok": False, "error": "Username must be 24 characters or fewer."}
    if not password or len(password) < 4:
        return {"ok": False, "error": "Password must be at least 4 characters."}

    pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    try:
        c = _conn()
        cur = c.execute(
            "INSERT INTO users (username, pw_hash) VALUES (?, ?)",
            (username, pw_hash),
        )
        c.commit()
        uid = cur.lastrowid
        c.close()
        return {"ok": True, "user_id": uid}
    except sqlite3.IntegrityError:
        return {"ok": False, "error": "Username already taken."}


def verify_user(username: str, password: str) -> dict:
    """
    Verify login credentials.
    Returns {"ok": True, "user_id": int, "username": str} or {"ok": False, "error": str}.
    """
    c = _conn()
    row = c.execute(
        "SELECT id, username, pw_hash FROM users WHERE username = ?",
        (username.strip(),),
    ).fetchone()
    c.close()

    if not row:
        return {"ok": False, "error": "Invalid username or password."}

    if not bcrypt.checkpw(password.encode("utf-8"), row["pw_hash"].encode("utf-8")):
        return {"ok": False, "error": "Invalid username or password."}

    return {"ok": True, "user_id": row["id"], "username": row["username"]}


# ── Save/Load ───────────────────────────────────────────────────

def save_game(user_id: int, data: dict) -> dict:
    """
    Save (upsert) the player's game state. Single auto-save slot per user.
    """
    now = datetime.now(timezone.utc).isoformat()
    blob = json.dumps(data, ensure_ascii=False)
    c = _conn()
    c.execute("""
        INSERT INTO saves (user_id, save_data, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            save_data  = excluded.save_data,
            updated_at = excluded.updated_at
    """, (user_id, blob, now))
    c.commit()
    c.close()
    return {"ok": True, "saved_at": now}


def load_game(user_id: int) -> dict:
    """
    Load the player's saved game state.
    Returns {"ok": True, "data": {...}, "saved_at": str} or {"ok": False}.
    """
    c = _conn()
    row = c.execute(
        "SELECT save_data, updated_at FROM saves WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    c.close()

    if not row:
        return {"ok": False, "error": "No save found."}

    return {
        "ok": True,
        "data": json.loads(row["save_data"]),
        "saved_at": row["updated_at"],
    }


def delete_save(user_id: int) -> dict:
    """Delete the player's save."""
    c = _conn()
    c.execute("DELETE FROM saves WHERE user_id = ?", (user_id,))
    c.commit()
    c.close()
    return {"ok": True}


def has_save(user_id: int) -> bool:
    """Quick check if a save exists."""
    c = _conn()
    row = c.execute(
        "SELECT 1 FROM saves WHERE user_id = ?", (user_id,),
    ).fetchone()
    c.close()
    return row is not None
