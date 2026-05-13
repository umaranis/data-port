use crate::{cell_to_string, infer::ColumnMeta, SheetCache};
use odbc_api::{buffers::TextRowSet, ConnectionOptions, Cursor, Environment};

fn quote_table(name: &str) -> String {
  if let Some(dot) = name.find('.') {
    format!("\"{}\".\"{}\"", &name[..dot], &name[dot + 1..])
  } else {
    format!("\"{}\"", name)
  }
}

fn map_db2_type(type_name: &str) -> &'static str {
  match type_name.to_uppercase().as_str() {
    "CHARACTER" | "VARCHAR" | "LONG VARCHAR" | "CLOB" | "DBCLOB" => "varchar",
    "SMALLINT" | "INTEGER" => "integer",
    "BIGINT" => "bigint",
    "DECIMAL" | "NUMERIC" => "numeric",
    "REAL" | "FLOAT" | "DOUBLE" => "double precision",
    "DATE" => "date",
    "TIMESTAMP" => "timestamp",
    "BOOLEAN" => "boolean",
    _ => "text",
  }
}

fn col_str(batch: &TextRowSet, col: usize, row: usize) -> String {
  batch
    .at(col, row)
    .and_then(|b| std::str::from_utf8(b).ok())
    .unwrap_or("")
    .trim_end_matches('\0')
    .trim()
    .to_string()
}

#[tauri::command]
pub async fn db2_connect(conn_string: String) -> Result<(), String> {
  tokio::task::spawn_blocking(move || {
    let env = Environment::new().map_err(|e: odbc_api::Error| e.to_string())?;
    env
      .connect_with_connection_string(&conn_string, ConnectionOptions::default())
      .map_err(|e: odbc_api::Error| e.to_string())?;
    Ok(())
  })
  .await
  .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn db2_get_tables(conn_string: String) -> Result<Vec<String>, String> {
  tokio::task::spawn_blocking(move || {
    let env = Environment::new().map_err(|e: odbc_api::Error| e.to_string())?;
    let conn = env
      .connect_with_connection_string(&conn_string, ConnectionOptions::default())
      .map_err(|e: odbc_api::Error| e.to_string())?;

    let sql = "SELECT RTRIM(TABSCHEMA), TABNAME \
               FROM syscat.tables \
               WHERE TYPE = 'T' AND TABSCHEMA NOT LIKE 'SYS%' \
               ORDER BY TABSCHEMA, TABNAME";

    let mut cursor = conn
      .execute(sql, ())
      .map_err(|e: odbc_api::Error| e.to_string())?
      .ok_or("Expected a result set")?;

    let buffers =
      TextRowSet::for_cursor(200, &mut cursor, Some(512)).map_err(|e: odbc_api::Error| e.to_string())?;
    let mut block = cursor.bind_buffer(buffers).map_err(|e: odbc_api::Error| e.to_string())?;

    let mut tables = Vec::new();
    while let Some(batch) = block.fetch().map_err(|e: odbc_api::Error| e.to_string())? {
      for row in 0..batch.num_rows() as usize {
        let schema = col_str(batch, 0, row);
        let table = col_str(batch, 1, row);
        tables.push(format!("{schema}.{table}"));
      }
    }
    Ok(tables)
  })
  .await
  .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn db2_get_columns(
  conn_string: String,
  table_name: String,
) -> Result<Vec<ColumnMeta>, String> {
  let (schema, table) = if let Some(dot) = table_name.find('.') {
    (table_name[..dot].to_string(), table_name[dot + 1..].to_string())
  } else {
    return Err("Table name must be schema-qualified (schema.table)".to_string());
  };

  tokio::task::spawn_blocking(move || {
    let env = Environment::new().map_err(|e: odbc_api::Error| e.to_string())?;
    let conn = env
      .connect_with_connection_string(&conn_string, ConnectionOptions::default())
      .map_err(|e: odbc_api::Error| e.to_string())?;

    let sql = format!(
      "SELECT COLNAME, TYPENAME, LENGTH, SCALE \
       FROM syscat.columns \
       WHERE TABSCHEMA = '{}' AND TABNAME = '{}' \
       ORDER BY COLNO",
      schema.to_uppercase(),
      table.to_uppercase()
    );

    let mut cursor = conn
      .execute(&sql, ())
      .map_err(|e: odbc_api::Error| e.to_string())?
      .ok_or("Expected a result set")?;

    let buffers =
      TextRowSet::for_cursor(200, &mut cursor, Some(512)).map_err(|e: odbc_api::Error| e.to_string())?;
    let mut block = cursor.bind_buffer(buffers).map_err(|e: odbc_api::Error| e.to_string())?;

    let mut columns = Vec::new();
    while let Some(batch) = block.fetch().map_err(|e: odbc_api::Error| e.to_string())? {
      for row in 0..batch.num_rows() as usize {
        let name = col_str(batch, 0, row);
        let type_name = col_str(batch, 1, row);
        let length: Option<u32> = col_str(batch, 2, row).parse().ok();
        let scale: Option<u32> = col_str(batch, 3, row).parse().ok();
        columns.push(ColumnMeta {
          pg_type: map_db2_type(&type_name),
          name,
          length,
          precision: None,
          scale,
        });
      }
    }
    Ok(columns)
  })
  .await
  .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn db2_execute(conn_string: String, sql: String) -> Result<(), String> {
  tokio::task::spawn_blocking(move || {
    let env = Environment::new().map_err(|e: odbc_api::Error| e.to_string())?;
    let conn = env
      .connect_with_connection_string(&conn_string, ConnectionOptions::default())
      .map_err(|e: odbc_api::Error| e.to_string())?;

    for stmt in sql.split(';') {
      let stmt = stmt.trim();
      if !stmt.is_empty() {
        conn
          .execute(stmt, ())
          .map_err(|e: odbc_api::Error| e.to_string())?;
      }
    }
    Ok(())
  })
  .await
  .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn db2_insert_rows(
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

  let db_columns: Vec<String> = (0..headers.len())
    .map(|i| {
      let custom = column_names.get(i).map(|s| s.as_str()).unwrap_or("");
      if custom.is_empty() {
        headers[i].clone()
      } else {
        custom.to_string()
      }
    })
    .collect();

  let col_list = db_columns
    .iter()
    .map(|h| format!("\"{}\"", h))
    .collect::<Vec<_>>()
    .join(", ");

  let quoted_table = quote_table(&table_name);

  tokio::task::spawn_blocking(move || {
    let env = Environment::new().map_err(|e: odbc_api::Error| e.to_string())?;
    let conn = env
      .connect_with_connection_string(&conn_string, ConnectionOptions::default())
      .map_err(|e: odbc_api::Error| e.to_string())?;

    let is_text = |t: &str| matches!(t, "text" | "varchar");

    for row in &data_rows {
      let values: Vec<String> = (0..headers.len())
        .map(|i| {
          let val = row.get(i).cloned().unwrap_or_default();
          let col_type = column_types.get(i).map(|s| s.as_str()).unwrap_or("text");
          if val.is_empty() && !is_text(col_type) {
            "NULL".to_string()
          } else {
            format!("'{}'", val.replace('\'', "''"))
          }
        })
        .collect();

      let row_sql = format!(
        "INSERT INTO {quoted_table} ({col_list}) VALUES ({})",
        values.join(", ")
      );
      conn
        .execute(&row_sql, ())
        .map_err(|e: odbc_api::Error| e.to_string())?;
    }

    Ok(data_rows.len())
  })
  .await
  .map_err(|e| e.to_string())?
}
