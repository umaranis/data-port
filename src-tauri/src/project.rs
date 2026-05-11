use std::fs;
use tauri::Manager;

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

#[tauri::command]
pub async fn save_project(
  app: tauri::AppHandle,
  name: String,
  payload: serde_json::Value,
) -> Result<(), String> {
  let dir = projects_dir(&app)?;
  let filename = format!("{}.json", sanitize_name(&name));
  let path = dir.join(filename);
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
  serde_json::from_str(&content).map_err(|e| e.to_string())
}
