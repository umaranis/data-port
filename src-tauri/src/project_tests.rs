use super::{inject_password, strip_password};

// ─── strip_password ───────────────────────────────────────────────────────────

#[test]
fn strip_password_removes_password_from_url() {
  let conn = "postgresql://alice:s3cr3t@localhost:5432/mydb";
  let (stripped, _) = strip_password(conn);
  assert!(!stripped.contains("s3cr3t"), "password must not appear in saved URL");
}

#[test]
fn strip_password_returns_the_extracted_password() {
  let conn = "postgresql://alice:s3cr3t@localhost:5432/mydb";
  let (_, password) = strip_password(conn);
  assert_eq!(password.as_deref(), Some("s3cr3t"));
}

#[test]
fn strip_password_preserves_host_port_database() {
  let conn = "postgresql://alice:s3cr3t@db.example.com:5433/warehouse";
  let (stripped, _) = strip_password(conn);
  assert!(stripped.contains("db.example.com"));
  assert!(stripped.contains("5433"));
  assert!(stripped.contains("warehouse"));
}

#[test]
fn strip_password_preserves_schema_search_path_in_query() {
  let conn = "postgresql://alice:s3cr3t@localhost:5432/mydb?options=-c%20search_path%3Dreporting";
  let (stripped, _) = strip_password(conn);
  assert!(stripped.contains("search_path"), "query string must be preserved");
  assert!(!stripped.contains("s3cr3t"));
}

#[test]
fn strip_password_with_no_password_returns_none() {
  let conn = "postgresql://alice@localhost:5432/mydb";
  let (_, password) = strip_password(conn);
  assert!(password.is_none());
}

#[test]
fn strip_password_with_no_credentials_returns_none() {
  let conn = "postgresql://localhost:5432/mydb";
  let (_, password) = strip_password(conn);
  assert!(password.is_none());
}

#[test]
fn strip_password_with_special_chars_in_password() {
  let conn = "postgresql://alice:p%40ss%21@localhost:5432/mydb";
  let (stripped, password) = strip_password(conn);
  assert!(!stripped.contains("p%40ss%21"));
  assert!(password.is_some());
}

// ─── inject_password / round-trip ────────────────────────────────────────────

#[test]
fn inject_password_round_trips_url() {
  let original = "postgresql://alice:s3cr3t@localhost:5432/mydb";
  let (stripped, password) = strip_password(original);
  let restored = inject_password(&stripped, password.as_deref().unwrap());
  let (_, recovered) = strip_password(&restored);
  assert_eq!(recovered.as_deref(), Some("s3cr3t"));
}

#[test]
fn inject_password_round_trips_url_with_schema() {
  let original =
    "postgresql://alice:s3cr3t@localhost:5432/mydb?options=-c%20search_path%3Dreporting";
  let (stripped, password) = strip_password(original);
  let restored = inject_password(&stripped, password.as_deref().unwrap());
  assert!(restored.contains("search_path"));
  let (_, recovered) = strip_password(&restored);
  assert_eq!(recovered.as_deref(), Some("s3cr3t"));
}
