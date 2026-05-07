package db

import (
	"fmt"
	"os"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

var DB *sqlx.DB

func Connect() error {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://localhost:5432/stack?sslmode=disable"
	}
	var err error
	DB, err = sqlx.Connect("postgres", dsn)
	if err != nil {
		return fmt.Errorf("db connect: %w", err)
	}
	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	return nil
}

func Migrate() error {
	_, err := DB.Exec(schema)
	return err
}

const schema = `
CREATE TABLE IF NOT EXISTS canvases (
	id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	name       TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS canvas_nodes (
	id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	canvas_id    UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
	node_id      TEXT NOT NULL,
	service_name TEXT NOT NULL,
	status       TEXT NOT NULL DEFAULT 'proposed',
	notes        TEXT NOT NULL DEFAULT '',
	position_x   FLOAT NOT NULL DEFAULT 0,
	position_y   FLOAT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS canvas_edges (
	id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
	edge_id   TEXT NOT NULL,
	source_id TEXT NOT NULL,
	target_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS canvas_snapshots (
	id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	canvas_id     UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
	label         TEXT NOT NULL,
	snapshot_json JSONB NOT NULL,
	created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canvas_nodes_canvas ON canvas_nodes(canvas_id);
CREATE INDEX IF NOT EXISTS idx_canvas_edges_canvas ON canvas_edges(canvas_id);
CREATE INDEX IF NOT EXISTS idx_canvas_snapshots_canvas ON canvas_snapshots(canvas_id);
`
