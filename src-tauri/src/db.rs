use crate::{cell_to_string, SheetCache};
use tokio_postgres::NoTls;

pub fn full_error(e: &dyn std::error::Error) -> String {
  let mut msg = e.to_string();
  let mut src = e.source();
  while let Some(s) = src {
    msg.push_str(": ");
    msg.push_str(&s.to_string());
    src = s.source();
  }
  msg
}

fn quote_table(name: &str) -> String {
  if let Some(dot) = name.find('.') {
    format!("\"{}\".\"{}\"", &name[..dot], &name[dot + 1..])
  } else {
    format!("\"{}\"", name)
  }
}

async fn execute_insert(
  client: &mut tokio_postgres::Client,
  table_name: &str,
  column_names: &[String],
  column_types: &[String],
  headers: &[String],
  data_rows: &[Vec<String>],
) -> Result<usize, String> {
  if data_rows.is_empty() {
    return Ok(0);
  }

  let quoted_table = quote_table(table_name);

  let db_columns: Vec<&str> = (0..headers.len())
    .map(|i| {
      let custom = column_names.get(i).map(|s| s.as_str()).unwrap_or("");
      if custom.is_empty() { headers[i].as_str() } else { custom }
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

  for row in data_rows {
    let params: Vec<Option<String>> = (0..headers.len())
      .map(|i| {
        let val = row.get(i).cloned().unwrap_or_default();
        let pg_type = column_types.get(i).map(|s| s.as_str()).unwrap_or("text");
        if val.is_empty() && !is_text(pg_type) { None } else { Some(val) }
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
pub async fn pg_get_tables(conn_string: String) -> Result<Vec<String>, String> {
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

#[tauri::command]
pub async fn pg_connect(conn_string: String) -> Result<(), String> {
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
pub async fn pg_insert_rows(
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

  let (mut client, connection) = tokio_postgres::connect(&conn_string, NoTls)
    .await
    .map_err(|e| full_error(&e))?;
  tokio::spawn(async move {
    let _ = connection.await;
  });

  execute_insert(&mut client, &table_name, &column_names, &column_types, &headers, &data_rows).await
}

#[tauri::command]
pub async fn pg_execute(conn_string: String, sql: String) -> Result<(), String> {
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
pub async fn pg_get_columns(conn_string: String, table_name: String) -> Result<Vec<String>, String> {
  let (schema, table) = if let Some(dot) = table_name.find('.') {
    (
      table_name[..dot].to_string(),
      table_name[dot + 1..].to_string(),
    )
  } else {
    ("public".to_string(), table_name)
  };
  let (client, connection) = tokio_postgres::connect(&conn_string, NoTls)
    .await
    .map_err(|e| full_error(&e))?;
  tokio::spawn(async move {
    let _ = connection.await;
  });
  let rows = client
    .query(
      "SELECT column_name FROM information_schema.columns \
             WHERE table_schema = $1 AND table_name = $2 \
             ORDER BY ordinal_position",
      &[&schema, &table],
    )
    .await
    .map_err(|e| full_error(&e))?;
  Ok(rows.iter().map(|r| r.get::<_, String>(0)).collect())
}

#[cfg(test)]
#[path = "db_tests.rs"]
mod tests;
