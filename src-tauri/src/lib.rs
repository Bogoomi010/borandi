// Tauri 데스크탑 쉘: SQLite 저장/불러오기, 결과 기록, 리포트 쓰기 등
// 낮은 빈도 I/O만 담당한다. 게임 판정 로직은 절대 두지 않는다 (시스템 기획 결정).

use rusqlite::Connection;
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

const SCHEMA_VERSION: i64 = 1;

pub struct Db(pub Mutex<Connection>);
pub struct AppPaths {
    pub data_dir: PathBuf,
}

/// UI가 복구 문구를 보여줄 수 있도록 구조화된 에러로 반환한다.
#[derive(Serialize)]
pub struct CmdError {
    pub code: String,
    pub message: String,
    pub recoverable: bool,
}

impl CmdError {
    fn new(code: &str, message: impl ToString, recoverable: bool) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            recoverable,
        }
    }
}

impl From<rusqlite::Error> for CmdError {
    fn from(e: rusqlite::Error) -> Self {
        CmdError::new("sqlite_error", e, true)
    }
}

impl From<std::io::Error> for CmdError {
    fn from(e: std::io::Error) -> Self {
        CmdError::new("io_error", e, true)
    }
}

type CmdResult<T> = Result<T, CmdError>;

fn init_db(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS save_slots (
            slot_id TEXT PRIMARY KEY,
            record TEXT NOT NULL,
            saved_at TEXT NOT NULL,
            seed TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            round INTEGER NOT NULL,
            life INTEGER NOT NULL,
            max_grade TEXT NOT NULL,
            data_version TEXT NOT NULL,
            checksum TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS save_slot_backups (
            slot_id TEXT PRIMARY KEY,
            record TEXT NOT NULL,
            saved_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS run_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            summary TEXT NOT NULL,
            played_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        ",
    )?;
    conn.execute(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?1)",
        [SCHEMA_VERSION.to_string()],
    )?;
    Ok(())
}

fn record_str(record: &Value, key: &str) -> String {
    record
        .get(key)
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string()
}

fn record_i64(record: &Value, key: &str) -> i64 {
    record.get(key).and_then(|v| v.as_i64()).unwrap_or(0)
}

#[tauri::command]
fn save_run_snapshot(
    db: tauri::State<'_, Db>,
    slot_id: String,
    record: Value,
) -> CmdResult<()> {
    let mut conn = db.0.lock().map_err(|e| CmdError::new("lock", e, true))?;
    let tx = conn.transaction()?;

    // 자동 저장은 갱신 전 마지막 정상본을 백업 row로 1개 유지한다.
    if slot_id == "autosave" {
        tx.execute(
            "INSERT OR REPLACE INTO save_slot_backups (slot_id, record, saved_at)
             SELECT slot_id, record, saved_at FROM save_slots WHERE slot_id = ?1",
            [&slot_id],
        )?;
    }

    tx.execute(
        "INSERT OR REPLACE INTO save_slots
         (slot_id, record, saved_at, seed, difficulty, round, life, max_grade, data_version, checksum)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            slot_id,
            record.to_string(),
            record_str(&record, "savedAt"),
            record_str(&record, "seed"),
            record_str(&record, "difficulty"),
            record_i64(&record, "round"),
            record_i64(&record, "life"),
            record_str(&record, "maxGrade"),
            record_str(&record, "dataVersion"),
            record_str(&record, "stateChecksum"),
        ],
    )?;
    tx.commit()?;
    Ok(())
}

#[tauri::command]
fn load_run_snapshot(db: tauri::State<'_, Db>, slot_id: String) -> CmdResult<Option<Value>> {
    let conn = db.0.lock().map_err(|e| CmdError::new("lock", e, true))?;
    let mut stmt = conn.prepare("SELECT record FROM save_slots WHERE slot_id = ?1")?;
    let mut rows = stmt.query([&slot_id])?;
    if let Some(row) = rows.next()? {
        let raw: String = row.get(0)?;
        let value: Value = serde_json::from_str(&raw)
            .map_err(|e| CmdError::new("corrupt_save", e, false))?;
        Ok(Some(value))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn list_save_slots(db: tauri::State<'_, Db>) -> CmdResult<Vec<Value>> {
    let conn = db.0.lock().map_err(|e| CmdError::new("lock", e, true))?;
    let mut stmt = conn.prepare(
        "SELECT slot_id, saved_at, seed, difficulty, round, life, max_grade, data_version, record
         FROM save_slots ORDER BY slot_id",
    )?;
    let rows = stmt.query_map([], |row| {
        let record_raw: String = row.get(8)?;
        let stage_id = serde_json::from_str::<Value>(&record_raw)
            .ok()
            .and_then(|v| v.get("stageId").and_then(|x| x.as_i64()))
            .unwrap_or(1);
        Ok(serde_json::json!({
            "slotId": row.get::<_, String>(0)?,
            "savedAt": row.get::<_, String>(1)?,
            "seed": row.get::<_, String>(2)?,
            "difficulty": row.get::<_, String>(3)?,
            "stageId": stage_id,
            "round": row.get::<_, i64>(4)?,
            "life": row.get::<_, i64>(5)?,
            "maxGrade": row.get::<_, String>(6)?,
            "dataVersion": row.get::<_, String>(7)?,
        }))
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

#[tauri::command]
fn delete_save_slot(db: tauri::State<'_, Db>, slot_id: String) -> CmdResult<()> {
    let conn = db.0.lock().map_err(|e| CmdError::new("lock", e, true))?;
    conn.execute("DELETE FROM save_slots WHERE slot_id = ?1", [&slot_id])?;
    Ok(())
}

#[tauri::command]
fn record_run_result(db: tauri::State<'_, Db>, summary: Value) -> CmdResult<()> {
    let conn = db.0.lock().map_err(|e| CmdError::new("lock", e, true))?;
    let played_at = record_str(&summary, "playedAt");
    conn.execute(
        "INSERT INTO run_results (summary, played_at) VALUES (?1, ?2)",
        rusqlite::params![summary.to_string(), played_at],
    )?;
    // 보존 상한: 최근 50개
    conn.execute(
        "DELETE FROM run_results WHERE id NOT IN
         (SELECT id FROM run_results ORDER BY id DESC LIMIT 50)",
        [],
    )?;
    Ok(())
}

#[tauri::command]
fn list_run_results(db: tauri::State<'_, Db>) -> CmdResult<Vec<Value>> {
    let conn = db.0.lock().map_err(|e| CmdError::new("lock", e, true))?;
    let mut stmt =
        conn.prepare("SELECT summary FROM run_results ORDER BY id DESC LIMIT 20")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    let mut out = Vec::new();
    for r in rows {
        let raw = r?;
        if let Ok(v) = serde_json::from_str::<Value>(&raw) {
            out.push(v);
        }
    }
    Ok(out)
}

#[tauri::command]
fn write_run_report(
    paths: tauri::State<'_, AppPaths>,
    filename: String,
    content: String,
) -> CmdResult<String> {
    // 경로 탈출 방지: 파일명만 허용
    let safe_name = filename.replace(['/', '\\', ':'], "_");
    let reports_dir = paths.data_dir.join("reports");
    fs::create_dir_all(&reports_dir)?;
    let path = reports_dir.join(safe_name);
    fs::write(&path, content)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn open_app_data_dir(paths: tauri::State<'_, AppPaths>) -> CmdResult<()> {
    let dir = paths.data_dir.clone();
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer").arg(&dir).spawn()?;
    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(&dir).spawn()?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open").arg(&dir).spawn()?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&data_dir)?;
            let db_path = data_dir.join("random-defense.db");
            let conn = Connection::open(&db_path)?;
            init_db(&conn)?;
            app.manage(Db(Mutex::new(conn)));
            app.manage(AppPaths { data_dir });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_run_snapshot,
            load_run_snapshot,
            list_save_slots,
            delete_save_slot,
            record_run_result,
            list_run_results,
            write_run_report,
            open_app_data_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mem_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        conn
    }

    #[test]
    fn schema_creates_tables() {
        let conn = mem_conn();
        let n: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN
                 ('save_slots','save_slot_backups','run_results','settings','meta')",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(n, 5);
    }

    #[test]
    fn save_and_load_roundtrip() {
        let conn = mem_conn();
        let record = serde_json::json!({
            "savedAt": "2026-06-12T00:00:00Z",
            "seed": "TEST",
            "difficulty": "novice",
            "stageId": 3,
            "round": 7,
            "life": 18,
            "maxGrade": "rare",
            "dataVersion": "0.1.0",
            "stateChecksum": "abcd1234",
            "inputHistory": []
        });
        conn.execute(
            "INSERT OR REPLACE INTO save_slots
             (slot_id, record, saved_at, seed, difficulty, round, life, max_grade, data_version, checksum)
             VALUES ('autosave', ?1, ?2, 'TEST', 'novice', 7, 18, 'rare', '0.1.0', 'abcd1234')",
            rusqlite::params![record.to_string(), "2026-06-12T00:00:00Z"],
        )
        .unwrap();
        let raw: String = conn
            .query_row(
                "SELECT record FROM save_slots WHERE slot_id='autosave'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let loaded: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(loaded["seed"], "TEST");
        assert_eq!(loaded["round"], 7);
    }
}
