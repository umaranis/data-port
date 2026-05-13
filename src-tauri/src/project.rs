use std::fs;
use keyring::Entry;
use tauri::Manager;
use url::Url;

#[cfg(test)]
#[path = "project_tests.rs"]
mod tests;

const KEYCHAIN_SERVICE: &str = "data-port";

fn sanitize_name(name: &str) -> String {
  name.to_lowercase()
    .chars()
    .map(|c| if c.is_alphanumeric() || c == '-' { c } else { '_' })
    .collect()
}

fn projects_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
  let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  let projects = dir.join("projects");
  fs::create_dir_all(&projects).map_err(|e| e.to_string())?;
  Ok(projects)
}

/// Removes the password from a PostgreSQL URL. Returns (stripped_url, password).
fn strip_password(conn_str: &str) -> (String, Option<String>) {
  let Ok(mut url) = Url::parse(conn_str) else {
    return (conn_str.to_string(), None);
  };
  let password = url.password().filter(|p| !p.is_empty()).map(|p| p.to_string());
  let _ = url.set_password(None);
  (url.to_string(), password)
}

/// Injects a password into a PostgreSQL URL that has none.
fn inject_password(conn_str: &str, password: &str) -> String {
  let Ok(mut url) = Url::parse(conn_str) else {
    return conn_str.to_string();
  };
  let _ = url.set_password(Some(password));
  url.to_string()
}

/// Removes `Pwd=` from an ODBC DSN-less connection string. Returns (stripped, password).
fn strip_odbc_password(conn_str: &str) -> (String, Option<String>) {
  let mut password: Option<String> = None;
  let stripped = conn_str
    .split(';')
    .filter_map(|token| {
      let eq = token.find('=')?;
      let key = token[..eq].trim().to_lowercase();
      if key == "pwd" || key == "password" {
        password = Some(token[eq + 1..].trim().to_string());
        None
      } else {
        Some(token)
      }
    })
    .collect::<Vec<_>>()
    .join(";");
  // Preserve trailing semicolon if the original had one.
  let stripped = if conn_str.trim_end().ends_with(';') && !stripped.ends_with(';') {
    format!("{stripped};")
  } else {
    stripped
  };
  (stripped, password.filter(|p| !p.is_empty()))
}

/// Injects a password into an ODBC DSN-less connection string that has none.
fn inject_odbc_password(conn_str: &str, password: &str) -> String {
  // Append Pwd= before the final semicolon (or at the end).
  if conn_str.trim_end().ends_with(';') {
    format!("{conn_str}Pwd={password};")
  } else {
    format!("{conn_str};Pwd={password};")
  }
}

#[tauri::command]
pub async fn save_project(
  app: tauri::AppHandle,
  name: String,
  payload: serde_json::Value,
) -> Result<(), String> {
  let dir = projects_dir(&app)?;
  let filename = format!("{}.json", sanitize_name(&name));
  let path = dir.join(filename);

  let mut payload = payload;
  if let Some(conn_str) = payload.get("connectionString").and_then(|v| v.as_str()) {
    let is_db2 = payload.get("dbType").and_then(|v| v.as_str()) == Some("db2");
    let (stripped, password) = if is_db2 {
      strip_odbc_password(conn_str)
    } else {
      strip_password(conn_str)
    };
    payload["connectionString"] = serde_json::Value::String(stripped);
    match password {
      Some(pwd) => {
        Entry::new(KEYCHAIN_SERVICE, &name)
          .and_then(|e| e.set_password(&pwd))
          .map_err(|e| e.to_string())?;
      }
      None => {
        if let Ok(entry) = Entry::new(KEYCHAIN_SERVICE, &name) {
          let _ = entry.delete_credential();
        }
      }
    }
  }

  let content = serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?;
  fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_projects(app: tauri::AppHandle) -> Result<Vec<String>, String> {
  let dir = projects_dir(&app)?;
  let mut names: Vec<String> = fs::read_dir(&dir)
    .map_err(|e| e.to_string())?
    .filter_map(|entry| {
      let entry = entry.ok()?;
      let fname = entry.file_name().into_string().ok()?;
      fname.strip_suffix(".json").map(|s| s.to_string())
    })
    .collect();
  names.sort();
  Ok(names)
}

#[tauri::command]
pub async fn load_project(
  app: tauri::AppHandle,
  name: String,
) -> Result<serde_json::Value, String> {
  let dir = projects_dir(&app)?;
  let path = dir.join(format!("{}.json", sanitize_name(&name)));
  let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
  let mut project: serde_json::Value =
    serde_json::from_str(&content).map_err(|e| e.to_string())?;

  if let Some(conn_str) = project.get("connectionString").and_then(|v| v.as_str()) {
    if let Ok(entry) = Entry::new(KEYCHAIN_SERVICE, &name) {
      if let Ok(password) = entry.get_password() {
        let is_db2 = project.get("dbType").and_then(|v| v.as_str()) == Some("db2");
        let restored = if is_db2 {
          inject_odbc_password(conn_str, &password)
        } else {
          inject_password(conn_str, &password)
        };
        project["connectionString"] = serde_json::Value::String(restored);
      }
    }
  }

  Ok(project)
}
