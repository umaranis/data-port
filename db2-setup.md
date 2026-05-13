# DB2 Connection Setup

Data Port connects to DB2 via ODBC. This requires two things installed on your machine:
- **unixODBC** — the ODBC driver manager
- **IBM DB2 ODBC/CLI Driver** — the actual DB2 driver library

> [!note]
DBeaver and DataGrip use IBM's JDBC driver (Java based) internally which is a separate stack from ODBC.
::

---

## 1. Install unixODBC

```bash
# Fedora / RHEL / CentOS
sudo dnf install unixODBC unixODBC-devel

# Ubuntu / Debian
sudo apt install unixodbc unixodbc-dev

# macOS
brew install unixodbc
```

`unixODBC-devel` is also required at **build time** when compiling Data Port from source.

---

## 2. Download the IBM DB2 CLI Driver

**Option 1**: download the free "IBM Data Server Driver for ODBC and CLI" from IBM (search "IBM Data Server Driver Package" on ibm.com — it's a free download, no license required).

**Option 2:** The driver is available via the [`rust-ibm_db`](https://github.com/ibmdb/rust-ibm_db) project, which includes a setup tool that downloads drivers hosted on GitHub.

```bash
git clone https://github.com/ibmdb/rust-ibm_db.git
cd rust-ibm_db
cargo run --bin setup
```

This downloads and extracts the clidriver into `./clidriver/lib`. 

---

## 3. Verify Driver Dependencies

Check that all shared library dependencies of the driver are satisfied:

```bash
ldd libdb2.so
```

Look for any line that says `not found`. 

On Fedora, `libcrypt.so.1` may be missing:

```
libcrypt.so.1 => not found
```

Fix it with:

```bash
sudo dnf install libxcrypt-compat
```

Re-run `ldd` to confirm no remaining missing libraries before continuing.

---

## 4. Register the Driver with unixODBC

Create a driver definition file:

```bash
cat > /tmp/db2driver.ini << 'EOF'
[IBM DB2 ODBC DRIVER]
Description = IBM DB2 ODBC Driver
Driver      = /<your_path>/libdb2.so
FileUsage   = 1
EOF
```

Replace the `Driver` path with the actual path from Step 2.

Register it (system-wide requires sudo; user-level does not):

```bash
# System-wide (recommended)
sudo odbcinst -i -d -f /tmp/db2driver.ini

# User-level (no sudo needed)
odbcinst -i -d -f /tmp/db2driver.ini
```

Verify registration:

```bash
odbcinst -q -d
# Should print: [IBM DB2 ODBC DRIVER]
```

---

## 5. Connect from Data Port

1. Launch Data Port and click the **DB2** button in the toolbar.
2. Fill in the connection fields:
   - **Driver** — must match the name in brackets from `odbcinst -q -d` exactly, e.g. `IBM DB2 ODBC DRIVER`
   - **Host** — your DB2 server hostname or IP
   - **Port** — default is `50000`
   - **Database** — the DB2 database name
   - **Username / Password** — your credentials
3. Click **Connect**.

---

## Troubleshooting

**`Can't open lib '...' : file not found`**
The driver name in the dialog doesn't match what's registered, or the driver path in `odbcinst.ini` is wrong. Run `odbcinst -q -d` and make sure the name matches exactly.

**`ldd` shows missing libraries**
Install the missing library (see Step 3 for `libxcrypt-compat`). Re-run `ldd` to confirm.

**Build error: `unable to find library -lodbc`**
`unixODBC-devel` is not installed. See Step 1.

**DBeaver works but Data Port can't connect**
DBeaver uses JDBC, not ODBC — they are separate driver stacks. Complete all steps above even if DBeaver is already working.
