import sys

p = '/Volumes/WorkDrive/Develop/45.paperclipai/paperclip/packages/db/src/backup-lib.ts'
t = open(p).read()
orig = t

# --- 1. add the cursor batch-size constant ---
old_const = 'const DEFAULT_BACKUP_WRITE_BUFFER_BYTES = 1024 * 1024;\n'
new_const = (
    'const DEFAULT_BACKUP_WRITE_BUFFER_BYTES = 1024 * 1024;\n'
    '// Rows are streamed in batches so heap use stays flat no matter how large a table grows.\n'
    'const BACKUP_ROW_CURSOR_BATCH = 500;\n'
)
assert t.count(old_const) == 1, 'const anchor'
t = t.replace(old_const, new_const)

# --- 2. give the writer a drain() so callers can apply backpressure ---
old_close = '''    async close() {
      if (closed) return;
      closed = true;
      flushBufferedLines();'''
new_close = '''    // Awaits writes already queued by emit(). Callers that emit in a tight loop must
    // await this periodically, otherwise every chunk stacks up in the pendingWrite
    // chain and the whole dump is held in memory.
    async drain() {
      if (streamError) throw streamError;
      await pendingWrite;
      if (streamError) throw streamError;
    },
    async close() {
      if (closed) return;
      closed = true;
      flushBufferedLines();'''
assert t.count(old_close) == 1, 'close anchor'
t = t.replace(old_close, new_close)

# --- 3. stream rows with a cursor instead of materializing the whole table ---
old_dump = '''      const rows = await sql.unsafe(`SELECT * FROM ${qualifiedTableName}`).values();
      const nullifiedColumns = nullifiedColumnsByTable.get(tablename) ?? new Set<string>();
      for (const row of rows) {
        const values = row.map((rawValue: unknown, index) => {
          const columnName = cols[index]?.column_name;
          const val = columnName && nullifiedColumns.has(columnName) ? null : rawValue;
          if (val === null || val === undefined) return "NULL";
          if (typeof val === "boolean") return val ? "true" : "false";
          if (typeof val === "number") return String(val);
          if (val instanceof Date) return formatSqlLiteral(val.toISOString());
          if (typeof val === "object") return formatSqlLiteral(JSON.stringify(val));
          return formatSqlLiteral(String(val));
        });
        emitStatement(`INSERT INTO ${qualifiedTableName} (${colNames}) VALUES (${values.join(", ")});`);
      }
      emit("");'''

new_dump = '''      const nullifiedColumns = nullifiedColumnsByTable.get(tablename) ?? new Set<string>();
      const rowCursor = sql
        .unsafe(`SELECT * FROM ${qualifiedTableName}`)
        .values()
        .cursor(BACKUP_ROW_CURSOR_BATCH);
      for await (const batch of rowCursor) {
        for (const row of batch) {
          const values = row.map((rawValue: unknown, index) => {
            const columnName = cols[index]?.column_name;
            const val = columnName && nullifiedColumns.has(columnName) ? null : rawValue;
            if (val === null || val === undefined) return "NULL";
            if (typeof val === "boolean") return val ? "true" : "false";
            if (typeof val === "number") return String(val);
            if (val instanceof Date) return formatSqlLiteral(val.toISOString());
            if (typeof val === "object") return formatSqlLiteral(JSON.stringify(val));
            return formatSqlLiteral(String(val));
          });
          emitStatement(`INSERT INTO ${qualifiedTableName} (${colNames}) VALUES (${values.join(", ")});`);
        }
        await writer.drain();
      }
      emit("");'''

assert t.count(old_dump) == 1, 'dump anchor'
t = t.replace(old_dump, new_dump)

assert t != orig
open(p, 'w').write(t)
print('patched', p)
