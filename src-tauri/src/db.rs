use crate::{cell_to_string, infer::ColumnMeta, SheetCache};
use serde::Deserialize;
use tokio_postgres::NoTls;

/// Where a Target Column's values come from. Mirrors the frontend `Source` union.
/// Sheet sources reference their column by index (position). Only `sheet` and
/// `static` are resolved server-side today; the rest are modelled but omitted
/// from the INSERT.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Source {
  Sheet {
    #[serde(rename = "sheetColIndex")]
    sheet_col_index: usize,
  },
  Static {
    value: Option<String>,
  },
  Expression {},
  DbSerial {},
  CustomSequence {},
  None,
}

impl Source {
  /// Resolve the value this Source supplies for a given data row, or `None` if
  /// the Source is not materialized (and therefore omitted from the INSERT).
  pub fn resolve(&self, row: &[String]) -> Option<String> {
    match self {
      Source::Sheet { sheet_col_index } => {
        Some(row.get(*sheet_col_index).cloned().unwrap_or_default())
      }
      Source::Static { value } => Some(value.clone().unwrap_or_default()),
      _ => None,
    }
  }

  pub fn is_materialized(&self) -> bool {
    matches!(self, Source::Sheet { .. } | Source::Static { .. })
  }
}

/// One Target Column of a Mapping: its DB column name, its data type, and the
/// Source that fills it.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetSpec {
  pub db_col_name: String,
  pub data_type: String,
  pub source: Source,
}

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
  targets: &[TargetSpec],
  data_rows: &[Vec<String>],
) -> Result<usize, String> {
  if data_rows.is_empty() {
    return Ok(0);
  }

  // Only materialized (sheet/static) targets take part in the INSERT; unmapped
  // targets are omitted so the database supplies their defaults. Target order is
  // preserved.
  let cols: Vec<&TargetSpec> = targets
    .iter()
    .filter(|t| t.source.is_materialized())
    .collect();
  if cols.is_empty() {
    return Ok(0);
  }

  let quoted_table = quote_table(table_name);

  let col_list = cols
    .iter()
    .map(|t| format!("\"{}\"", t.db_col_name))
    .collect::<Vec<_>>()
    .join(", ");

  let is_text = |t: &str| matches!(t, "text" | "varchar");

  let placeholders = cols
    .iter()
    .enumerate()
    .map(|(i, t)| {
      if is_text(&t.data_type) {
        format!("${}", i + 1)
      } else {
        format!("${}::{}", i + 1, t.data_type)
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

  let text_types = vec![tokio_postgres::types::Type::TEXT; cols.len()];
  let stmt = tx
    .prepare_typed(&insert_sql, &text_types)
    .await
    .map_err(|e| full_error(&e))?;

  for row in data_rows {
    let params: Vec<Option<String>> = cols
      .iter()
      .map(|t| {
        let val = t.source.resolve(row).unwrap_or_default();
        if val.is_empty() && !is_text(&t.data_type) { None } else { Some(val) }
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
  targets: Vec<TargetSpec>,
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

  execute_insert(&mut client, &table_name, &targets, &data_rows).await
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
pub async fn pg_get_columns(conn_string: String, table_name: String) -> Result<Vec<ColumnMeta>, String> {
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
      "SELECT column_name, data_type, character_maximum_length, numeric_precision, numeric_scale \
       FROM information_schema.columns \
       WHERE table_schema = $1 AND table_name = $2 \
       ORDER BY ordinal_position",
      &[&schema, &table],
    )
    .await
    .map_err(|e| full_error(&e))?;
  Ok(rows.iter().map(|r| {
    let name: String = r.get(0);
    let data_type: String = r.get(1);
    let char_max_len: Option<i32> = r.get(2);
    let numeric_precision: Option<i32> = r.get(3);
    let numeric_scale: Option<i32> = r.get(4);
    let pg_type: &'static str = match data_type.as_str() {
      "character varying" => "varchar",
      "boolean" => "boolean",
      "date" => "date",
      "integer" => "integer",
      "bigint" => "bigint",
      "double precision" => "double precision",
      "uuid" => "uuid",
      "timestamp with time zone" => "timestamptz",
      "timestamp without time zone" => "timestamp",
      "jsonb" => "jsonb",
      "numeric" => "numeric",
      _ => "text",
    };
    ColumnMeta {
      pg_type,
      name,
      length: char_max_len.map(|v| v as u32),
      precision: numeric_precision.map(|v| v as u32),
      scale: numeric_scale.map(|v| v as u32),
    }
  }).collect())
}

#[cfg(test)]
#[path = "db_tests.rs"]
mod tests;
