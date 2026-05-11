use calamine::Data;

use crate::SheetCache;

#[derive(serde::Serialize, Debug, PartialEq)]
pub struct ColumnMeta {
  #[serde(rename = "type")]
  pub pg_type: &'static str,
  #[serde(rename = "dbColName")]
  pub name: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub length: Option<u32>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub precision: Option<u32>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub scale: Option<u32>,
}

impl ColumnMeta {
  fn of(pg_type: &'static str) -> Self {
    ColumnMeta {
      pg_type,
      name: String::new(),
      length: None,
      precision: None,
      scale: None,
    }
  }

  fn varchar(length: u32) -> Self {
    ColumnMeta {
      pg_type: "varchar",
      name: String::new(),
      length: Some(length),
      precision: None,
      scale: None,
    }
  }
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

fn infer_col_type(cells: &[Data]) -> ColumnMeta {
  let mut count = 0usize;
  let mut max_len = 0usize;

  let mut all_bool = true;
  let mut all_datetime = true;
  let mut all_int_i32 = true;
  let mut all_int_big = true;
  let mut all_numeric = true;
  let mut all_string = true;

  let mut str_uuid = true;
  let mut str_timestamptz = true;
  let mut str_timestamp = true;
  let mut str_jsonb = true;

  for cell in cells {
    match cell {
      Data::Empty => continue,
      Data::String(s) if s.is_empty() => continue,
      Data::Bool(_) => {
        all_datetime = false;
        all_int_i32 = false;
        all_int_big = false;
        all_numeric = false;
        all_string = false;
        count += 1;
        continue;
      }
      Data::DateTime(_) => {
        all_bool = false;
        all_int_i32 = false;
        all_int_big = false;
        all_numeric = false;
        all_string = false;
        count += 1;
        continue;
      }
      Data::Int(i) => {
        all_bool = false;
        all_datetime = false;
        all_string = false;
        if *i < i32::MIN as i64 || *i > i32::MAX as i64 {
          all_int_i32 = false;
        }
        count += 1;
        continue;
      }
      Data::Float(f) => {
        all_bool = false;
        all_datetime = false;
        if (*f).fract() == 0.0 {
          if *f <= i32::MIN as f64 || *f >= i32::MAX as f64 {
            all_int_i32 = false;
          }
          if *f <= i64::MIN as f64 || *f >= i64::MAX as f64 {
            all_int_big = false;
          }
        } else {
          all_int_i32 = false;
          all_int_big = false;
        }
        all_string = false;
        count += 1;
        continue;
      }
      Data::String(s) => {
        if str_uuid && !is_uuid(s) {
          str_uuid = false;
        }
        if all_bool && !is_boolean_str(s) {
          all_bool = false;
        }
        if all_int_i32 && s.parse::<i32>().is_err() {
          all_int_i32 = false;
        }
        if all_int_big && s.parse::<i64>().is_err() {
          all_int_big = false;
        }
        if all_numeric && s.parse::<f64>().is_err() {
          all_numeric = false;
        }
        if str_timestamptz && !is_timestamptz_str(s) {
          str_timestamptz = false;
        }
        if str_timestamp && !is_timestamp_str(s) {
          str_timestamp = false;
        }
        if all_datetime && !is_date_str(s) {
          all_datetime = false;
        }
        if str_jsonb && !is_jsonb_str(s) {
          str_jsonb = false;
        }

        max_len = max_len.max(s.len());
        count += 1;
        s.as_str()
      }
      _ => {
        all_bool = false;
        all_datetime = false;
        all_int_i32 = false;
        all_int_big = false;
        all_numeric = false;
        all_string = false;
        count += 1;
        continue;
      }
    };
  }

  if count == 0 {
    return ColumnMeta::of("text");
  }

  if all_bool {
    return ColumnMeta::of("boolean");
  }
  if all_datetime {
    return ColumnMeta::of("date");
  }
  if all_int_i32 {
    return ColumnMeta::of("integer");
  }
  if all_int_big {
    return ColumnMeta::of("bigint");
  }
  if all_numeric {
    return ColumnMeta::of("double precision");
  }

  if all_string {
    if str_uuid {
      return ColumnMeta::of("uuid");
    }
    if str_timestamptz {
      return ColumnMeta::of("timestamptz");
    }
    if str_timestamp {
      return ColumnMeta::of("timestamp");
    }
    if str_jsonb {
      return ColumnMeta::of("jsonb");
    }
  }

  ColumnMeta::varchar(max_len as u32)
}

fn infer_types_from_rows(data_rows: &[Vec<Data>]) -> Vec<ColumnMeta> {
  if data_rows.is_empty() {
    return vec![];
  }
  let col_count = data_rows.iter().map(|r| r.len()).max().unwrap_or(0);
  (0..col_count)
    .map(|col| {
      let cells: Vec<Data> = data_rows
        .iter()
        .filter_map(|row| row.get(col).cloned())
        .collect();
      infer_col_type(&cells)
    })
    .collect()
}

#[tauri::command]
pub fn infer_column_types(
  path: &str,
  sheet: &str,
  header_row: usize,
  skip_rows: Vec<usize>,
  cache: tauri::State<SheetCache>,
) -> Result<Vec<ColumnMeta>, String> {
  let range = cache.get_range(path, sheet)?;
  let mut all_rows = range.rows();

  for _ in 0..header_row {
    all_rows.next();
  }

  let headers: Vec<String> = all_rows
    .next()
    .map(|r| r.iter().map(crate::cell_to_string).collect())
    .unwrap_or_default();

  let skip_set: std::collections::HashSet<usize> = skip_rows.into_iter().collect();

  let data_rows: Vec<Vec<Data>> = all_rows
    .enumerate()
    .filter(|(i, _)| !skip_set.contains(&(i + 1)))
    .map(|(_, row)| row.to_vec())
    .collect();

  let mut metas = infer_types_from_rows(&data_rows);
  for (i, meta) in metas.iter_mut().enumerate() {
    let header = headers.get(i).map(|s| s.as_str()).unwrap_or("");
    meta.name = header.to_lowercase().replace(' ', "_");
    if meta.name.is_empty() {
      meta.name = format!("column_{}", i + 1);
    }
  }
  Ok(metas)
}

#[cfg(test)]
#[path = "infer_tests.rs"]
mod tests;
