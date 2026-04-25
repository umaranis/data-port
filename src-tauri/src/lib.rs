mod infer;

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
pub struct SheetCache(Mutex<HashMap<(String, String), Arc<Range<Data>>>>);

impl SheetCache {
    fn new() -> Self {
        SheetCache(Mutex::new(HashMap::new()))
    }

    pub fn get_range(&self, path: &str, sheet: &str) -> Result<Arc<Range<Data>>, String> {
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
async fn pg_insert_rows(
    conn_string: String,
    path: String,
    sheet: String,
    table_name: String,
    column_types: Vec<String>,
    column_names: Vec<String>,
    header_row: usize,
    skip_rows: Vec<usize>,
    cache: tauri::State<'_, SheetCache>,
) -> Result<usize, String> {
    let range = cache.get_range(&path, &sheet)?;

    let mut all_rows = range.rows();
    for _ in 0..header_row {
        all_rows.next();
    }

    let headers: Vec<String> = all_rows
        .next()
        .map(|r| r.iter().map(cell_to_string).collect())
        .unwrap_or_default();

    if headers.is_empty() {
        return Ok(0);
    }

    let skip_set: std::collections::HashSet<usize> = skip_rows.into_iter().collect();
    let data_rows: Vec<Vec<String>> = all_rows
        .enumerate()
        .filter(|(i, _)| !skip_set.contains(&(i + 1)))
        .map(|(_, row)| row.iter().map(cell_to_string).collect())
        .collect();

    if data_rows.is_empty() {
        return Ok(0);
    }

    let (mut client, connection) = tokio_postgres::connect(&conn_string, NoTls)
        .await
        .map_err(|e| full_error(&e))?;
    tokio::spawn(async move {
        let _ = connection.await;
    });

    let quoted_table = if let Some(dot) = table_name.find('.') {
        format!("\"{}\".\"{}\"", &table_name[..dot], &table_name[dot + 1..])
    } else {
        format!("\"{}\"", table_name)
    };

    // Use custom column names if provided and matching; fall back to sheet headers.
    let db_columns: Vec<&str> = (0..headers.len())
        .map(|i| {
            let custom = column_names.get(i).map(|s| s.as_str()).unwrap_or("");
            if custom.is_empty() {
                headers[i].as_str()
            } else {
                custom
            }
        })
        .collect();

    let col_list = db_columns
        .iter()
        .map(|h| format!("\"{}\"", h))
        .collect::<Vec<_>>()
        .join(", ");

    let is_text = |t: &str| matches!(t, "text" | "varchar");

    let placeholders = (0..headers.len())
        .map(|i| {
            let pg_type = column_types.get(i).map(|s| s.as_str()).unwrap_or("text");
            if is_text(pg_type) {
                format!("${}", i + 1)
            } else {
                format!("${}::{}", i + 1, pg_type)
            }
        })
        .collect::<Vec<_>>()
        .join(", ");

    let insert_sql = format!("INSERT INTO {quoted_table} ({col_list}) VALUES ({placeholders})");

    let tx = client
        .build_transaction()
        .start()
        .await
        .map_err(|e| full_error(&e))?;

    let text_types = vec![tokio_postgres::types::Type::TEXT; headers.len()];
    let stmt = tx
        .prepare_typed(&insert_sql, &text_types)
        .await
        .map_err(|e| full_error(&e))?;

    for row in &data_rows {
        let params: Vec<Option<String>> = (0..headers.len())
            .map(|i| {
                let val = row.get(i).cloned().unwrap_or_default();
                let pg_type = column_types.get(i).map(|s| s.as_str()).unwrap_or("text");
                if val.is_empty() && !is_text(pg_type) {
                    None
                } else {
                    Some(val)
                }
            })
            .collect();
        let params_ref: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> =
            params.iter().map(|s| s as _).collect();
        tx.execute(&stmt, &params_ref)
            .await
            .map_err(|e| full_error(&e))?;
    }

    tx.commit().await.map_err(|e| full_error(&e))?;

    Ok(data_rows.len())
}

#[tauri::command]
async fn pg_execute(conn_string: String, sql: String) -> Result<(), String> {
    let (client, connection) = tokio_postgres::connect(&conn_string, NoTls)
        .await
        .map_err(|e| full_error(&e))?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    client
        .batch_execute(&sql)
        .await
        .map_err(|e| full_error(&e))?;
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
            infer::infer_column_types,
            clear_cache,
            pg_connect,
            pg_get_tables,
            pg_execute,
            pg_insert_rows
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
