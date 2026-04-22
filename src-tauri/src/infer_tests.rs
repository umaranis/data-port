use super::*;
use calamine::{Data, ExcelDateTime};

fn s(v: &str) -> Data {
    Data::String(v.to_string())
}

// --- infer_col_type ---

#[test]
fn empty_column_is_text() {
    assert_eq!(infer_col_type(&[]), "text");
    assert_eq!(infer_col_type(&[Data::Empty, Data::Empty]), "text");
}

#[test]
fn native_bool_is_boolean() {
    assert_eq!(
        infer_col_type(&[Data::Bool(true), Data::Bool(false)]),
        "boolean"
    );
}

#[test]
fn native_datetime_is_timestamp() {
    assert_eq!(
        infer_col_type(&[Data::DateTime(ExcelDateTime::default())]),
        "timestamp"
    );
}

#[test]
fn native_int_fits_i32_is_integer() {
    assert_eq!(infer_col_type(&[Data::Int(1), Data::Int(100)]), "integer");
}

#[test]
fn native_int_exceeds_i32_is_bigint() {
    assert_eq!(infer_col_type(&[Data::Int(i32::MAX as i64 + 1)]), "bigint");
}

#[test]
fn native_int_and_float_is_double_precision() {
    assert_eq!(
        infer_col_type(&[Data::Int(1), Data::Float(1.5)]),
        "double precision"
    );
}

#[test]
fn string_uuids_are_uuid() {
    let cells = vec![
        s("550e8400-e29b-41d4-a716-446655440000"),
        s("6ba7b810-9dad-11d1-80b4-00c04fd430c8"),
    ];
    assert_eq!(infer_col_type(&cells), "uuid");
}

#[test]
fn string_booleans_are_boolean() {
    assert_eq!(infer_col_type(&[s("true"), s("false")]), "boolean");
    assert_eq!(infer_col_type(&[s("yes"), s("no")]), "boolean");
    assert_eq!(infer_col_type(&[s("TRUE"), s("FALSE")]), "boolean");
}

#[test]
fn string_integers_are_integer() {
    assert_eq!(infer_col_type(&[s("1"), s("42"), s("-7")]), "integer");
}

#[test]
fn string_integers_are_integer_with_blanks() {
    assert_eq!(
        infer_col_type(&[s("1"), s("42"), s("-7"), s("")]),
        "integer"
    );
}

#[test]
fn string_large_integers_are_bigint() {
    let big = (i32::MAX as i64 + 1).to_string();
    assert_eq!(infer_col_type(&[s(&big)]), "bigint");
}

#[test]
fn string_floats_are_double_precision() {
    assert_eq!(infer_col_type(&[s("1.5"), s("3.14")]), "double precision");
}

#[test]
fn string_timestamptz_is_timestamptz() {
    assert_eq!(infer_col_type(&[s("2024-01-15T10:30:00Z")]), "timestamptz");
    assert_eq!(
        infer_col_type(&[s("2024-01-15T10:30:00+05:00")]),
        "timestamptz"
    );
}

#[test]
fn string_timestamp_is_timestamp() {
    assert_eq!(infer_col_type(&[s("2024-01-15T10:30:00")]), "timestamp");
    assert_eq!(infer_col_type(&[s("2024-01-15 10:30:00")]), "timestamp");
}

#[test]
fn string_dates_are_date() {
    assert_eq!(infer_col_type(&[s("2024-01-15"), s("1999-12-31")]), "date");
}

#[test]
fn string_json_objects_are_jsonb() {
    assert_eq!(infer_col_type(&[s(r#"{"key": "val"}"#)]), "jsonb");
    assert_eq!(infer_col_type(&[s(r#"[1, 2, 3]"#)]), "jsonb");
}

#[test]
fn mixed_strings_fall_back_to_text() {
    assert_eq!(infer_col_type(&[s("hello"), s("world")]), "text");
    assert_eq!(infer_col_type(&[s("42"), s("not a number")]), "text");
}

#[test]
fn mixed_native_types_fall_back_to_text() {
    assert_eq!(infer_col_type(&[Data::Int(1), s("hello")]), "text");
}

#[test]
fn empty_cells_are_ignored_in_type_inference() {
    assert_eq!(
        infer_col_type(&[Data::Empty, Data::Int(1), Data::Empty, Data::Int(2)]),
        "integer"
    );
}

// --- infer_types_from_rows ---

#[test]
fn empty_rows_returns_empty_vec() {
    assert_eq!(infer_types_from_rows(&[]), vec![] as Vec<String>);
}

#[test]
fn infers_types_for_each_column() {
    let data = vec![
        vec![Data::Int(1), s("hello"), Data::Bool(true)],
        vec![Data::Int(2), s("world"), Data::Bool(false)],
    ];
    assert_eq!(
        infer_types_from_rows(&data),
        vec!["integer", "text", "boolean"]
    );
}

#[test]
fn handles_ragged_rows() {
    let data = vec![
        vec![Data::Int(1), s("hello"), Data::Bool(true)],
        vec![Data::Int(2)],
    ];
    assert_eq!(
        infer_types_from_rows(&data),
        vec!["integer", "text", "boolean"]
    );
}

#[test]
fn skip_rows_excludes_data_from_inference() {
    // Without skipping, the mixed int+string col would be "text".
    // With row 2 skipped (1-indexed), only the int row remains → "integer".
    let range_rows = vec![vec![Data::Int(42)], vec![s("not a number")]];
    let skip_set: std::collections::HashSet<usize> = [2].into_iter().collect();
    let data_rows: Vec<Vec<Data>> = range_rows
        .into_iter()
        .enumerate()
        .filter(|(i, _)| !skip_set.contains(&(i + 1)))
        .map(|(_, r)| r)
        .collect();
    assert_eq!(infer_types_from_rows(&data_rows), vec!["integer"]);
}
