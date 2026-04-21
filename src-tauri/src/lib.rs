use calamine::{open_workbook_auto, Data, Range, Reader};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio_postgres::NoTls;

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

/**
 * A simple in-memory cache for sheet data, keyed by (file path, sheet name).
 * Stores the entire sheet range in memory for quick access.
 *
 * This cache is required because calamine does not support streaming access to sheet data, and reading large sheets repeatedly from disk would be inefficient.
 *
 * The cache is thread-safe using a Mutex, and the range data is shared using Arc to avoid unnecessary cloning.
 *
 * Note: This cache does not implement any eviction policy.
 * But on file selection from UI, clear_cache is called, so it should not grow indefinitely in typical usage.
 * There is a clear_cache command to manually clear it through the UI as well.
 */
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
        self.0.lock().unwrap().insert(key, Arc::clone(&arc_range));
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
    header_row: usize,
    cache: tauri::State<SheetCache>,
) -> Result<PagedRows, String> {
    let range = cache.get_range(path, sheet)?;

    let total_rows = range.height().saturating_sub(header_row + 1);

    let mut all_rows = range.rows();

    for _ in 0..header_row {
        all_rows.next();
    }

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
    header_row: usize,
    skip_rows: Vec<usize>,
    cache: tauri::State<SheetCache>,
) -> Result<PagedRows, String> {
    let range = cache.get_range(path, sheet)?;

    let mut all_rows = range.rows();

    for _ in 0..header_row {
        all_rows.next();
    }

    let header: Vec<String> = all_rows
        .next()
        .map(|r| r.iter().map(cell_to_string).collect())
        .unwrap_or_default();

    let skip_set: std::collections::HashSet<usize> = skip_rows.into_iter().collect();

    let data_row_count = range.height().saturating_sub(header_row + 1);
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
fn get_blank_rows(
    path: &str,
    sheet: &str,
    header_row: usize,
    cache: tauri::State<SheetCache>,
) -> Result<Vec<usize>, String> {
    let range = cache.get_range(path, sheet)?;
    let mut all_rows = range.rows();

    for _ in 0..=header_row {
        all_rows.next();
    }

    let blank: Vec<usize> = all_rows
        .enumerate()
        .filter(|(_, row)| row.iter().all(|cell| matches!(cell, Data::Empty)))
        .map(|(i, _)| i + 1)
        .collect();

    Ok(blank)
}

#[tauri::command]
async fn pg_get_tables(conn_string: String) -> Result<Vec<String>, String> {
    let (client, connection) = tokio_postgres::connect(&conn_string, NoTls)
        .await
        .map_err(|e| full_error(&e))?;
    tokio::spawn(async move {
        let _ = connection.await;
    });

    let rows = client
        .query(
            "SELECT table_schema, table_name \
             FROM information_schema.tables \
             WHERE table_type = 'BASE TABLE' \
               AND table_schema NOT IN ('pg_catalog', 'information_schema') \
             ORDER BY table_schema, table_name",
            &[],
        )
        .await
        .map_err(|e| full_error(&e))?;

    let tables = rows
        .iter()
        .map(|r| {
            let schema: &str = r.get(0);
            let table: &str = r.get(1);
            format!("{schema}.{table}")
        })
        .collect();

    Ok(tables)
}

fn full_error(e: &dyn std::error::Error) -> String {
    let mut msg = e.to_string();
    let mut src = e.source();
    while let Some(s) = src {
        msg.push_str(": ");
        msg.push_str(&s.to_string());
        src = s.source();
    }
    msg
}

#[tauri::command]
async fn pg_connect(conn_string: String) -> Result<(), String> {
    let (client, connection) = tokio_postgres::connect(&conn_string, NoTls)
        .await
        .map_err(|e| full_error(&e))?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    drop(client);
    Ok(())
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
            get_blank_rows,
            clear_cache,
            pg_connect,
            pg_get_tables
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
