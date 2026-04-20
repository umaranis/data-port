use calamine::{open_workbook_auto, Data, Range, Reader};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

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

struct SheetCache(Mutex<HashMap<(String, String), Arc<Range<Data>>>>);

impl SheetCache {
    fn new() -> Self {
        SheetCache(Mutex::new(HashMap::new()))
    }

    fn get_range(&self, path: &str, sheet: &str) -> Result<Arc<Range<Data>>, String> {
        let key = (path.to_string(), sheet.to_string());
        {
            let cache = self.0.lock().unwrap();
            if let Some(range) = cache.get(&key) {
                return Ok(Arc::clone(range));
            }
        }
        let mut workbook = open_workbook_auto(path).map_err(|e| e.to_string())?;
        let range = workbook.worksheet_range(sheet).map_err(|e| e.to_string())?;
        let arc_range = Arc::new(range);
        self.0
            .lock()
            .unwrap()
            .insert(key, Arc::clone(&arc_range));
        Ok(arc_range)
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
    cache: tauri::State<SheetCache>,
) -> Result<PagedRows, String> {
    let range = cache.get_range(path, sheet)?;

    let total_rows = range.height().saturating_sub(1);

    let mut all_rows = range.rows();

    let header: Vec<String> = all_rows
        .next()
        .map(|r| r.iter().map(cell_to_string).collect())
        .unwrap_or_default();

    let start = page * page_size;
    let page_data: Vec<Vec<String>> = all_rows
        .skip(start)
        .take(page_size)
        .map(|row| row.iter().map(cell_to_string).collect())
        .collect();

    let mut rows = Vec::with_capacity(page_data.len() + 1);
    rows.push(header);
    rows.extend(page_data);

    Ok(PagedRows { rows, total_rows })
}

#[tauri::command]
fn get_sheet_rows_paged_filtered(
    path: &str,
    sheet: &str,
    page: usize,
    page_size: usize,
    skip_rows: Vec<usize>,
    cache: tauri::State<SheetCache>,
) -> Result<PagedRows, String> {
    let range = cache.get_range(path, sheet)?;

    let mut all_rows = range.rows();

    let header: Vec<String> = all_rows
        .next()
        .map(|r| r.iter().map(cell_to_string).collect())
        .unwrap_or_default();

    let skip_set: std::collections::HashSet<usize> = skip_rows.into_iter().collect();

    let data_row_count = range.height().saturating_sub(1);
    let skipped_in_bounds = skip_set
        .iter()
        .filter(|&&r| r >= 1 && r <= data_row_count)
        .count();
    let total_rows = data_row_count - skipped_in_bounds;

    let start = page * page_size;
    let page_data: Vec<Vec<String>> = all_rows
        .enumerate()
        .filter(|(i, _)| !skip_set.contains(&(i + 1)))
        .skip(start)
        .take(page_size)
        .map(|(_, row)| row.iter().map(cell_to_string).collect())
        .collect();

    let mut rows = Vec::with_capacity(page_data.len() + 1);
    rows.push(header);
    rows.extend(page_data);

    Ok(PagedRows { rows, total_rows })
}

#[tauri::command]
fn clear_cache(cache: tauri::State<SheetCache>) {
    cache.0.lock().unwrap().clear();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(SheetCache::new())
        .invoke_handler(tauri::generate_handler![
            get_sheets,
            get_sheet_rows_paged,
            get_sheet_rows_paged_filtered,
            clear_cache
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
