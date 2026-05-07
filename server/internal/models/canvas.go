package models

import "time"

type Canvas struct {
	ID        string    `db:"id"         json:"id"`
	Name      string    `db:"name"       json:"name"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

type CanvasNode struct {
	ID          string  `db:"id"           json:"id"`
	CanvasID    string  `db:"canvas_id"    json:"canvasId"`
	NodeID      string  `db:"node_id"      json:"nodeId"`
	ServiceName string  `db:"service_name" json:"serviceName"`
	Status      string  `db:"status"       json:"status"`
	Notes       string  `db:"notes"        json:"notes"`
	PositionX   float64 `db:"position_x"   json:"positionX"`
	PositionY   float64 `db:"position_y"   json:"positionY"`
}

type CanvasEdge struct {
	ID       string `db:"id"        json:"id"`
	CanvasID string `db:"canvas_id" json:"canvasId"`
	EdgeID   string `db:"edge_id"   json:"edgeId"`
	SourceID string `db:"source_id" json:"sourceId"`
	TargetID string `db:"target_id" json:"targetId"`
}

type CanvasSnapshot struct {
	ID           string    `db:"id"            json:"id"`
	CanvasID     string    `db:"canvas_id"     json:"canvasId"`
	Label        string    `db:"label"         json:"label"`
	SnapshotJSON []byte    `db:"snapshot_json" json:"snapshot"`
	CreatedAt    time.Time `db:"created_at"    json:"createdAt"`
}

// ── Request / Response shapes ──────────────────────────────────

type CreateCanvasRequest struct {
	Name string `json:"name"`
}

type SaveCanvasRequest struct {
	Nodes []NodePayload `json:"nodes"`
	Edges []EdgePayload `json:"edges"`
}

type NodePayload struct {
	NodeID      string  `json:"nodeId"`
	ServiceName string  `json:"serviceName"`
	Status      string  `json:"status"`
	Notes       string  `json:"notes"`
	PositionX   float64 `json:"positionX"`
	PositionY   float64 `json:"positionY"`
}

type EdgePayload struct {
	EdgeID   string `json:"edgeId"`
	SourceID string `json:"sourceId"`
	TargetID string `json:"targetId"`
}

type CanvasDetail struct {
	Canvas
	Nodes []CanvasNode `json:"nodes"`
	Edges []CanvasEdge `json:"edges"`
}

type CreateSnapshotRequest struct {
	Label string `json:"label"`
}
