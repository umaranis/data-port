use calamine::{open_workbook_auto, Data, Reader};

#[tauri::command]
fn get_sheets(path: &str) -> Result<Vec<String>, String> {
    let workbook = open_workbook_auto(path).map_err(|e| e.to_string())?;
    Ok(workbook.sheet_names().to_vec())
}

#[tauri::command]
fn get_sheet_rows(path: &str, sheet: &str) -> Result<Vec<Vec<String>>, String> {
    let mut workbook = open_workbook_auto(path).map_err(|e| e.to_string())?;
    let range = workbook
        .worksheet_range(sheet)
        .map_err(|e| e.to_string())?;

    let rows = range
        .rows()
        .take(5)
        .map(|row| {
            row.iter()
                .map(|cell| match cell {
                    Data::Empty => String::new(),
                    Data::String(s) => s.clone(),
                    Data::Float(f) => f.to_string(),
                    Data::Int(i) => i.to_string(),
                    Data::Bool(b) => b.to_string(),
                    Data::DateTime(dt) => dt.to_string(),
                    Data::Error(e) => format!("{e:?}"),
                    _ => String::new(),
                })
                .collect()
        })
        .collect();

    Ok(rows)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![get_sheets, get_sheet_rows])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
