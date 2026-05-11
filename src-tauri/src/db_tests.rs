use super::*;
use tokio_postgres::NoTls;

fn conn() -> String {
  std::env::var("TEST_DATABASE_URL")
    .unwrap_or_else(|_| "postgresql://postgres:postgres@localhost/postgres".to_string())
}

async fn make_client() -> tokio_postgres::Client {
  let (client, connection) = tokio_postgres::connect(&conn(), NoTls).await.unwrap();
  tokio::spawn(async move { let _ = connection.await; });
  client
}

fn unique_table() -> String {
  use std::sync::atomic::{AtomicU64, Ordering};
  static N: AtomicU64 = AtomicU64::new(0);
  let ts = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap()
    .as_secs();
  format!("dp_test_{}_{}", ts, N.fetch_add(1, Ordering::Relaxed))
}

async fn setup_table(client: &tokio_postgres::Client, table: &str, columns: &str) {
  client
    .execute(&format!("CREATE TABLE {table} ({columns})"), &[])
    .await
    .unwrap();
}

async fn row_count(client: &tokio_postgres::Client, table: &str) -> i64 {
  client
    .query_one(&format!("SELECT COUNT(*) FROM {table}"), &[])
    .await
    .unwrap()
    .get(0)
}

// ─── full_error ───────────────────────────────────────────────────────────────

#[derive(Debug)]
struct Leaf(&'static str);
impl std::fmt::Display for Leaf {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(f, "{}", self.0)
  }
}
impl std::error::Error for Leaf {}

#[derive(Debug)]
struct Wrapper {
  msg: &'static str,
  cause: Leaf,
}
impl std::fmt::Display for Wrapper {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(f, "{}", self.msg)
  }
}
impl std::error::Error for Wrapper {
  fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
    Some(&self.cause)
  }
}

#[test]
fn full_error_no_source_returns_message() {
  assert_eq!(full_error(&Leaf("boom")), "boom");
}

#[test]
fn full_error_chains_source_messages() {
  let e = Wrapper { msg: "outer", cause: Leaf("inner") };
  assert_eq!(full_error(&e), "outer: inner");
}

// ─── quote_table ─────────────────────────────────────────────────────────────

#[test]
fn quote_table_unqualified() {
  assert_eq!(quote_table("employees"), "\"employees\"");
}

#[test]
fn quote_table_schema_qualified() {
  assert_eq!(quote_table("public.employees"), "\"public\".\"employees\"");
}

// ─── pg_connect ───────────────────────────────────────────────────────────────

#[tokio::test]
async fn connect_succeeds_with_valid_connection_string() {
  assert!(pg_connect(conn()).await.is_ok());
}

#[tokio::test]
async fn connect_fails_with_unreachable_host() {
  let result = pg_connect("postgresql://postgres:postgres@127.0.0.1:9999/postgres".to_string()).await;
  assert!(result.is_err());
}

#[tokio::test]
async fn connect_fails_with_nonexistent_database() {
  let result = pg_connect("postgresql://postgres:postgres@localhost/dp_nonexistent_xyz".to_string()).await;
  assert!(result.is_err());
}

// ─── pg_get_tables ────────────────────────────────────────────────────────────

#[tokio::test]
async fn get_tables_includes_newly_created_table() {
  let client = make_client().await;
  let table = unique_table();
  setup_table(&client, &table, "id INT").await;

  let tables = pg_get_tables(conn()).await.unwrap();

  client.execute(&format!("DROP TABLE {table}"), &[]).await.unwrap();
  // Check schema-agnostically — the active search_path determines which schema the table lands in.
  assert!(tables.iter().any(|t| t.ends_with(&format!(".{table}"))));
}

#[tokio::test]
async fn get_tables_format_is_schema_dot_table() {
  let client = make_client().await;
  let table = unique_table();
  setup_table(&client, &table, "id INT").await;

  let tables = pg_get_tables(conn()).await.unwrap();

  client.execute(&format!("DROP TABLE {table}"), &[]).await.unwrap();
  for t in &tables {
    assert!(t.contains('.'), "table '{t}' is not schema-qualified");
  }
}

#[tokio::test]
async fn get_tables_excludes_system_schemas() {
  let tables = pg_get_tables(conn()).await.unwrap();
  for t in &tables {
    assert!(!t.starts_with("pg_catalog."), "system table leaked: {t}");
    assert!(!t.starts_with("information_schema."), "system table leaked: {t}");
  }
}

#[tokio::test]
async fn get_tables_does_not_include_dropped_table() {
  let client = make_client().await;
  let table = unique_table();
  setup_table(&client, &table, "id INT").await;
  client.execute(&format!("DROP TABLE {table}"), &[]).await.unwrap();

  let tables = pg_get_tables(conn()).await.unwrap();
  assert!(!tables.contains(&format!("public.{table}")));
}

// ─── pg_execute ───────────────────────────────────────────────────────────────

#[tokio::test]
async fn execute_creates_table_successfully() {
  let table = unique_table();
  let result = pg_execute(conn(), format!("CREATE TABLE {table} (id INT)")).await;

  let client = make_client().await;
  client.execute(&format!("DROP TABLE IF EXISTS {table}"), &[]).await.unwrap();
  assert!(result.is_ok());
}

#[tokio::test]
async fn execute_runs_multiple_statements_in_batch() {
  let table = unique_table();
  let result = pg_execute(
    conn(),
    format!("CREATE TABLE {table} (id INT); DROP TABLE {table}"),
  ).await;
  assert!(result.is_ok());
}

#[tokio::test]
async fn execute_returns_err_on_invalid_sql() {
  let result = pg_execute(conn(), "THIS IS NOT SQL".to_string()).await;
  assert!(result.is_err());
}

#[tokio::test]
async fn execute_error_message_is_non_empty() {
  let result = pg_execute(conn(), "SELECT * FROM nonexistent_table_xyz".to_string()).await;
  let err = result.unwrap_err();
  assert!(!err.is_empty());
}

// ─── pg_get_columns ───────────────────────────────────────────────────────────

#[tokio::test]
async fn get_columns_returns_names_in_definition_order() {
  let client = make_client().await;
  let table = unique_table();
  // Create in public explicitly — pg_get_columns defaults to public for unqualified names.
  client.execute(&format!("CREATE TABLE public.{table} (alpha TEXT, beta INT, gamma BOOL)"), &[]).await.unwrap();

  let cols = pg_get_columns(conn(), table.clone()).await.unwrap();

  client.execute(&format!("DROP TABLE public.{table}"), &[]).await.unwrap();
  assert_eq!(cols.iter().map(|c| c.name.as_str()).collect::<Vec<_>>(), vec!["alpha", "beta", "gamma"]);
  assert_eq!(cols[0].pg_type, "text");
  assert_eq!(cols[1].pg_type, "integer");
  assert_eq!(cols[2].pg_type, "boolean");
}

#[tokio::test]
async fn get_columns_accepts_unqualified_table_name() {
  let client = make_client().await;
  let table = unique_table();
  client.execute(&format!("CREATE TABLE public.{table} (x TEXT)"), &[]).await.unwrap();

  let cols = pg_get_columns(conn(), table.clone()).await.unwrap();

  client.execute(&format!("DROP TABLE public.{table}"), &[]).await.unwrap();
  assert_eq!(cols.len(), 1);
  assert_eq!(cols[0].name, "x");
}

#[tokio::test]
async fn get_columns_accepts_schema_qualified_table_name() {
  let client = make_client().await;
  let table = unique_table();
  client.execute(&format!("CREATE TABLE public.{table} (x TEXT)"), &[]).await.unwrap();

  let cols = pg_get_columns(conn(), format!("public.{table}")).await.unwrap();

  client.execute(&format!("DROP TABLE public.{table}"), &[]).await.unwrap();
  assert_eq!(cols.len(), 1);
  assert_eq!(cols[0].name, "x");
}

#[tokio::test]
async fn get_columns_returns_empty_for_nonexistent_table() {
  let cols = pg_get_columns(conn(), "dp_no_such_table_xyz".to_string())
    .await
    .unwrap();
  assert!(cols.is_empty());
}

// ─── execute_insert ───────────────────────────────────────────────────────────

#[tokio::test]
async fn insert_text_rows_returns_correct_count() {
  let client = make_client().await;
  let table = unique_table();
  setup_table(&client, &table, "name TEXT, city TEXT").await;

  let mut c = make_client().await;
  let headers = vec!["name".to_string(), "city".to_string()];
  let rows = vec![
    vec!["Alice".to_string(), "London".to_string()],
    vec!["Bob".to_string(), "Paris".to_string()],
  ];
  let count = execute_insert(&mut c, &table, &[], &[], &headers, &rows).await.unwrap();

  client.execute(&format!("DROP TABLE {table}"), &[]).await.unwrap();
  assert_eq!(count, 2);
}

#[tokio::test]
async fn insert_rows_are_written_to_the_table() {
  let client = make_client().await;
  let table = unique_table();
  setup_table(&client, &table, "name TEXT").await;

  let mut c = make_client().await;
  let headers = vec!["name".to_string()];
  let rows = vec![vec!["Alice".to_string()], vec!["Bob".to_string()]];
  execute_insert(&mut c, &table, &[], &[], &headers, &rows).await.unwrap();

  let n = row_count(&client, &table).await;
  client.execute(&format!("DROP TABLE {table}"), &[]).await.unwrap();
  assert_eq!(n, 2);
}

#[tokio::test]
async fn insert_empty_data_rows_returns_zero_without_touching_db() {
  let client = make_client().await;
  let table = unique_table();
  setup_table(&client, &table, "name TEXT").await;

  let mut c = make_client().await;
  let headers = vec!["name".to_string()];
  let count = execute_insert(&mut c, &table, &[], &[], &headers, &[]).await.unwrap();

  let n = row_count(&client, &table).await;
  client.execute(&format!("DROP TABLE {table}"), &[]).await.unwrap();
  assert_eq!(count, 0);
  assert_eq!(n, 0);
}

#[tokio::test]
async fn insert_with_integer_type_cast() {
  let client = make_client().await;
  let table = unique_table();
  setup_table(&client, &table, "n INTEGER").await;

  let mut c = make_client().await;
  let headers = vec!["n".to_string()];
  let col_types = vec!["integer".to_string()];
  let rows = vec![vec!["42".to_string()], vec!["7".to_string()]];
  execute_insert(&mut c, &table, &[], &col_types, &headers, &rows).await.unwrap();

  let n = row_count(&client, &table).await;
  client.execute(&format!("DROP TABLE {table}"), &[]).await.unwrap();
  assert_eq!(n, 2);
}

#[tokio::test]
async fn insert_with_boolean_type_cast() {
  let client = make_client().await;
  let table = unique_table();
  setup_table(&client, &table, "flag BOOLEAN").await;

  let mut c = make_client().await;
  let headers = vec!["flag".to_string()];
  let col_types = vec!["boolean".to_string()];
  let rows = vec![vec!["true".to_string()], vec!["false".to_string()]];
  execute_insert(&mut c, &table, &[], &col_types, &headers, &rows).await.unwrap();

  let n = row_count(&client, &table).await;
  client.execute(&format!("DROP TABLE {table}"), &[]).await.unwrap();
  assert_eq!(n, 2);
}

#[tokio::test]
async fn insert_empty_string_becomes_null_for_non_text_type() {
  let client = make_client().await;
  let table = unique_table();
  setup_table(&client, &table, "n INTEGER").await;

  let mut c = make_client().await;
  let headers = vec!["n".to_string()];
  let col_types = vec!["integer".to_string()];
  let rows = vec![vec!["".to_string()]];
  execute_insert(&mut c, &table, &[], &col_types, &headers, &rows).await.unwrap();

  let row = client
    .query_one(&format!("SELECT n FROM {table}"), &[])
    .await
    .unwrap();
  client.execute(&format!("DROP TABLE {table}"), &[]).await.unwrap();
  let val: Option<i32> = row.get(0);
  assert!(val.is_none(), "expected NULL, got {val:?}");
}

#[tokio::test]
async fn insert_empty_string_is_preserved_for_text_type() {
  let client = make_client().await;
  let table = unique_table();
  setup_table(&client, &table, "s TEXT").await;

  let mut c = make_client().await;
  let headers = vec!["s".to_string()];
  let rows = vec![vec!["".to_string()]];
  execute_insert(&mut c, &table, &[], &[], &headers, &rows).await.unwrap();

  let row = client
    .query_one(&format!("SELECT s FROM {table}"), &[])
    .await
    .unwrap();
  client.execute(&format!("DROP TABLE {table}"), &[]).await.unwrap();
  let val: Option<&str> = row.get(0);
  assert_eq!(val, Some(""), "expected empty string, got {val:?}");
}

#[tokio::test]
async fn insert_with_custom_column_names() {
  let client = make_client().await;
  let table = unique_table();
  setup_table(&client, &table, "db_col TEXT").await;

  let mut c = make_client().await;
  let headers = vec!["sheet_col".to_string()];
  let col_names = vec!["db_col".to_string()];
  let rows = vec![vec!["hello".to_string()]];
  execute_insert(&mut c, &table, &col_names, &[], &headers, &rows).await.unwrap();

  let n = row_count(&client, &table).await;
  client.execute(&format!("DROP TABLE {table}"), &[]).await.unwrap();
  assert_eq!(n, 1);
}

#[tokio::test]
async fn insert_falls_back_to_header_when_column_name_is_empty() {
  let client = make_client().await;
  let table = unique_table();
  setup_table(&client, &table, "name TEXT").await;

  let mut c = make_client().await;
  let headers = vec!["name".to_string()];
  let col_names = vec!["".to_string()]; // empty → falls back to "name"
  let rows = vec![vec!["Alice".to_string()]];
  execute_insert(&mut c, &table, &col_names, &[], &headers, &rows).await.unwrap();

  let n = row_count(&client, &table).await;
  client.execute(&format!("DROP TABLE {table}"), &[]).await.unwrap();
  assert_eq!(n, 1);
}

#[tokio::test]
async fn insert_with_schema_qualified_table_name() {
  let client = make_client().await;
  let table = unique_table();
  // Create in public so that inserting with the public. prefix finds the table.
  client.execute(&format!("CREATE TABLE public.{table} (x TEXT)"), &[]).await.unwrap();

  let mut c = make_client().await;
  let headers = vec!["x".to_string()];
  let rows = vec![vec!["hello".to_string()]];
  execute_insert(&mut c, &format!("public.{table}"), &[], &[], &headers, &rows)
    .await
    .unwrap();

  let n = row_count(&client, &format!("public.{table}")).await;
  client.execute(&format!("DROP TABLE public.{table}"), &[]).await.unwrap();
  assert_eq!(n, 1);
}

#[tokio::test]
async fn insert_rolls_back_entire_batch_on_type_cast_error() {
  let client = make_client().await;
  let table = unique_table();
  setup_table(&client, &table, "n INTEGER").await;

  let mut c = make_client().await;
  let headers = vec!["n".to_string()];
  let col_types = vec!["integer".to_string()];
  let rows = vec![
    vec!["1".to_string()],            // valid
    vec!["not_a_number".to_string()], // invalid — causes the transaction to fail
  ];
  let result = execute_insert(&mut c, &table, &[], &col_types, &headers, &rows).await;

  let n = row_count(&client, &table).await;
  client.execute(&format!("DROP TABLE {table}"), &[]).await.unwrap();
  assert!(result.is_err(), "expected a type cast error");
  assert_eq!(n, 0, "rolled-back transaction must leave no rows");
}
