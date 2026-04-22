use calamine::Data;

use crate::SheetCache;

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
pub fn infer_column_types(
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
