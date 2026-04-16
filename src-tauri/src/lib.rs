use calamine::{open_workbook_auto, Data, Reader};

fn cell_to_string(cell: &Data) -> String {
    match cell {
        Data::Empty => String::new(),
        Data::String(s) => s.clone(),
        Data::Float(f) => f.to_string(),
        Data::Int(i) => i.to_string(),
        Data::Bool(b) => b.to_string(),
        Data::DateTime(dt) => dt.to_string(),
        Data::Error(e) => format!("{e:?}"),
        _ => String::new(),
    }
}

#[tauri::command]
fn get_sheets(path: &str) -> Result<Vec<String>, String> {
    let workbook = open_workbook_auto(path).map_err(|e| e.to_string())?;
    Ok(workbook.sheet_names().to_vec())
}

#[derive(serde::Serialize)]
struct PagedRows {
    rows: Vec<Vec<String>>,
    total_rows: usize,
}

#[tauri::command]
fn get_sheet_rows_paged(
    path: &str,
    sheet: &str,
    page: usize,
    page_size: usize,
) -> Result<PagedRows, String> {
    let mut workbook = open_workbook_auto(path).map_err(|e| e.to_string())?;
    let range = workbook.worksheet_range(sheet).map_err(|e| e.to_string())?;

    let mut all_rows = range.rows();

    // First row is the header
    let header: Vec<String> = all_rows
        .next()
        .map(|r| r.iter().map(cell_to_string).collect())
        .unwrap_or_default();

    let data_rows: Vec<Vec<String>> = all_rows
        .map(|row| row.iter().map(cell_to_string).collect())
        .collect();

    let total_rows = data_rows.len();
    let start = page * page_size;
    let page_data: Vec<Vec<String>> = data_rows.into_iter().skip(start).take(page_size).collect();

    let mut rows = Vec::with_capacity(page_data.len() + 1);
    rows.push(header);
    rows.extend(page_data);

    Ok(PagedRows { rows, total_rows })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![get_sheets, get_sheet_rows_paged])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
