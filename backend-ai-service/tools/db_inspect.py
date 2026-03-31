from __future__ import annotations

import os

import mysql.connector


def main() -> None:
    conn = mysql.connector.connect(
        host=os.environ.get("DB_HOST", "127.0.0.1"),
        port=int(os.environ.get("DB_PORT", "3306")),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", ""),
        database=os.environ.get("DB_NAME", "woocommerce_ai_customer_support"),
    )
    cur = conn.cursor()
    cur.execute("SHOW TABLES")
    tables = [r[0] for r in cur.fetchall()]
    print("TABLES:")
    for t in sorted(tables):
        print("-", t)

    target = [
        "bai_conversations",
        "bai_messages",
        "bai_openai_calls",
        "bai_escalations",
        "bai_make_webhook_logs",
    ]

    for t in target:
        print("\n==", t, "==")
        if t not in tables:
            print("MISSING")
            continue
        cur.execute(f"SHOW CREATE TABLE `{t}`")
        _, ddl = cur.fetchone()
        print(ddl)
        cur.execute(f"SELECT COUNT(*) FROM `{t}`")
        print("ROWS:", cur.fetchone()[0])

    conn.close()


if __name__ == "__main__":
    main()

