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

fn is_uuid(s: &str) -> bool {
    let b = s.as_bytes();
    if b.len() != 36 {
        return false;
    }
    for (i, &c) in b.iter().enumerate() {
        match i {
            8 | 13 | 18 | 23 => {
                if c != b'-' {
                    return false;
                }
            }
            _ => {
                if !c.is_ascii_hexdigit() {
                    return false;
                }
            }
        }
    }
    true
}

fn is_boolean_str(s: &str) -> bool {
    matches!(
        s.to_ascii_lowercase().as_str(),
        "true" | "false" | "yes" | "no" | "t" | "f" | "1" | "0"
    )
}

fn is_date_str(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && b[0..4].iter().all(|c| c.is_ascii_digit())
        && b[5..7].iter().all(|c| c.is_ascii_digit())
        && b[8..10].iter().all(|c| c.is_ascii_digit())
}

fn is_timestamp_str(s: &str) -> bool {
    s.len() >= 19 && is_date_str(&s[..10]) && matches!(s.as_bytes()[10], b' ' | b'T')
}

fn is_timestamptz_str(s: &str) -> bool {
    is_timestamp_str(s) && (s.ends_with('Z') || s.contains('+') || s.contains("UTC"))
}

fn is_jsonb_str(s: &str) -> bool {
    let t = s.trim();
    (t.starts_with('{') && t.ends_with('}')) || (t.starts_with('[') && t.ends_with(']'))
}

fn infer_col_type(cells: &[Data]) -> &'static str {
    let non_empty: Vec<&Data> = cells
        .iter()
        .filter(|c| !matches!(c, Data::Empty))
        .collect();

    if non_empty.is_empty() {
        return "text";
    }

    if non_empty.iter().all(|c| matches!(c, Data::Bool(_))) {
        return "boolean";
    }

    if non_empty.iter().all(|c| matches!(c, Data::DateTime(_))) {
        return "timestamp";
    }

    if non_empty.iter().all(|c| matches!(c, Data::Int(_))) {
        let fits_i32 = non_empty.iter().all(|c| {
            matches!(c, Data::Int(i) if *i >= i32::MIN as i64 && *i <= i32::MAX as i64)
        });
        return if fits_i32 { "integer" } else { "bigint" };
    }

    if non_empty
        .iter()
        .all(|c| matches!(c, Data::Int(_) | Data::Float(_)))
    {
        return "double precision";
    }

    // String inference — only when all non-empty cells are strings
    let strings: Option<Vec<&str>> = non_empty
        .iter()
        .map(|c| {
            if let Data::String(s) = c {
                Some(s.as_str())
            } else {
                None
            }
        })
        .collect();

    let Some(strings) = strings else {
        return "text";
    };

    if strings.iter().all(|s| is_uuid(s)) {
        return "uuid";
    }
    if strings.iter().all(|s| is_boolean_str(s)) {
        return "boolean";
    }
    if strings.iter().all(|s| s.parse::<i32>().is_ok()) {
        return "integer";
    }
    if strings.iter().all(|s| s.parse::<i64>().is_ok()) {
        return "bigint";
    }
    if strings.iter().all(|s| s.parse::<f64>().is_ok()) {
        return "double precision";
    }
    if strings.iter().all(|s| is_timestamptz_str(s)) {
        return "timestamptz";
    }
    if strings.iter().all(|s| is_timestamp_str(s)) {
        return "timestamp";
    }
    if strings.iter().all(|s| is_date_str(s)) {
        return "date";
    }
    if strings.iter().all(|s| is_jsonb_str(s)) {
        return "jsonb";
    }

    "text"
}

#[tauri::command]
fn infer_column_types(
    path: &str,
    sheet: &str,
    header_row: usize,
    skip_rows: Vec<usize>,
    cache: tauri::State<SheetCache>,
) -> Result<Vec<String>, String> {
    let range = cache.get_range(path, sheet)?;
    let mut all_rows = range.rows();

    for _ in 0..=header_row {
        all_rows.next();
    }

    let skip_set: std::collections::HashSet<usize> = skip_rows.into_iter().collect();

    let data_rows: Vec<Vec<Data>> = all_rows
        .enumerate()
        .filter(|(i, _)| !skip_set.contains(&(i + 1)))
        .map(|(_, row)| row.to_vec())
        .collect();

    if data_rows.is_empty() {
        return Ok(vec![]);
    }

    let col_count = data_rows.iter().map(|r| r.len()).max().unwrap_or(0);

    let types = (0..col_count)
        .map(|col| {
            let cells: Vec<Data> = data_rows
                .iter()
                .filter_map(|row| row.get(col).cloned())
                .collect();
            infer_col_type(&cells).to_string()
        })
        .collect();

    Ok(types)
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
            infer_column_types,
            clear_cache,
            pg_connect,
            pg_get_tables
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
