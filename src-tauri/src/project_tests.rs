use super::{inject_odbc_password, inject_password, strip_odbc_password, strip_password};

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

// ─── strip_odbc_password ──────────────────────────────────────────────────────

#[test]
fn strip_odbc_password_removes_pwd_from_string() {
  let conn = "Driver={IBM DB2 ODBC DRIVER};Database=MYDB;Hostname=localhost;Port=50000;Protocol=TCPIP;Uid=alice;Pwd=s3cr3t;";
  let (stripped, _) = strip_odbc_password(conn);
  assert!(!stripped.contains("s3cr3t"), "password must not appear in saved string");
}

#[test]
fn strip_odbc_password_returns_extracted_password() {
  let conn = "Driver={IBM DB2 ODBC DRIVER};Database=MYDB;Hostname=localhost;Port=50000;Protocol=TCPIP;Uid=alice;Pwd=s3cr3t;";
  let (_, password) = strip_odbc_password(conn);
  assert_eq!(password.as_deref(), Some("s3cr3t"));
}

#[test]
fn strip_odbc_password_preserves_other_keys() {
  let conn = "Driver={IBM DB2 ODBC DRIVER};Database=WAREHOUSE;Hostname=db.example.com;Port=50001;Protocol=TCPIP;Uid=alice;Pwd=s3cr3t;";
  let (stripped, _) = strip_odbc_password(conn);
  assert!(stripped.contains("WAREHOUSE"));
  assert!(stripped.contains("db.example.com"));
  assert!(stripped.contains("50001"));
  assert!(stripped.contains("alice"));
}

#[test]
fn strip_odbc_password_no_password_returns_none() {
  let conn = "Driver={IBM DB2 ODBC DRIVER};Database=MYDB;Hostname=localhost;Port=50000;Uid=alice;";
  let (_, password) = strip_odbc_password(conn);
  assert!(password.is_none());
}

// ─── inject_odbc_password / round-trip ───────────────────────────────────────

#[test]
fn inject_odbc_password_round_trips() {
  let original = "Driver={IBM DB2 ODBC DRIVER};Database=MYDB;Hostname=localhost;Port=50000;Protocol=TCPIP;Uid=alice;Pwd=s3cr3t;";
  let (stripped, password) = strip_odbc_password(original);
  let restored = inject_odbc_password(&stripped, password.as_deref().unwrap());
  let (_, recovered) = strip_odbc_password(&restored);
  assert_eq!(recovered.as_deref(), Some("s3cr3t"));
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
