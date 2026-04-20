from app.services.snowflake_service import get_snowflake_connection

conn = get_snowflake_connection()
cur = conn.cursor()

cur.execute("SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'AGRI_SCHEMA' ORDER BY TABLE_TYPE, TABLE_NAME")
rows = cur.fetchall()
if rows:
    for r in rows:
        print(f"  {r[1]:25s} {r[0]}")
else:
    print("NO TABLES FOUND — schema.sql has not been executed yet")

conn.close()
