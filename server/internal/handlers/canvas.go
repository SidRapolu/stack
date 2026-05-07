package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/stack/server/internal/db"
	"github.com/stack/server/internal/models"
)

// POST /api/canvases
func CreateCanvas(w http.ResponseWriter, r *http.Request) {
	var req models.CreateCanvasRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		http.Error(w, "name required", http.StatusBadRequest)
		return
	}
	var canvas models.Canvas
	err := db.DB.QueryRowx(
		`INSERT INTO canvases (name) VALUES ($1) RETURNING id, name, created_at, updated_at`,
		req.Name,
	).StructScan(&canvas)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, canvas)
}

// GET /api/canvases
func ListCanvases(w http.ResponseWriter, r *http.Request) {
	var canvases []models.Canvas
	if err := db.DB.Select(&canvases, `SELECT * FROM canvases ORDER BY updated_at DESC`); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if canvases == nil {
		canvases = []models.Canvas{}
	}
	writeJSON(w, http.StatusOK, canvases)
}

// GET /api/canvases/:id
func GetCanvas(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var canvas models.Canvas
	if err := db.DB.Get(&canvas, `SELECT * FROM canvases WHERE id=$1`, id); err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	var nodes []models.CanvasNode
	if err := db.DB.Select(&nodes, `SELECT * FROM canvas_nodes WHERE canvas_id=$1`, id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	var edges []models.CanvasEdge
	if err := db.DB.Select(&edges, `SELECT * FROM canvas_edges WHERE canvas_id=$1`, id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if nodes == nil {
		nodes = []models.CanvasNode{}
	}
	if edges == nil {
		edges = []models.CanvasEdge{}
	}
	writeJSON(w, http.StatusOK, models.CanvasDetail{Canvas: canvas, Nodes: nodes, Edges: edges})
}

// PUT /api/canvases/:id
func SaveCanvas(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req models.SaveCanvasRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	tx, err := db.DB.Beginx()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// wipe existing nodes and edges for this canvas
	if _, err := tx.Exec(`DELETE FROM canvas_nodes WHERE canvas_id=$1`, id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if _, err := tx.Exec(`DELETE FROM canvas_edges WHERE canvas_id=$1`, id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// insert fresh nodes
	for _, n := range req.Nodes {
		_, err := tx.Exec(
			`INSERT INTO canvas_nodes (canvas_id, node_id, service_name, status, notes, position_x, position_y)
			 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			id, n.NodeID, n.ServiceName, n.Status, n.Notes, n.PositionX, n.PositionY,
		)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	// insert fresh edges
	for _, e := range req.Edges {
		_, err := tx.Exec(
			`INSERT INTO canvas_edges (canvas_id, edge_id, source_id, target_id) VALUES ($1,$2,$3,$4)`,
			id, e.EdgeID, e.SourceID, e.TargetID,
		)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	// bump updated_at
	if _, err := tx.Exec(`UPDATE canvases SET updated_at=NOW() WHERE id=$1`, id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// DELETE /api/canvases/:id
func DeleteCanvas(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := db.DB.Exec(`DELETE FROM canvases WHERE id=$1`, id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// POST /api/canvases/:id/snapshots
func CreateSnapshot(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req models.CreateSnapshotRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Label == "" {
		http.Error(w, "label required", http.StatusBadRequest)
		return
	}

	// build snapshot from current canvas state
	var nodes []models.CanvasNode
	var edges []models.CanvasEdge
	db.DB.Select(&nodes, `SELECT * FROM canvas_nodes WHERE canvas_id=$1`, id)
	db.DB.Select(&edges, `SELECT * FROM canvas_edges WHERE canvas_id=$1`, id)

	snapshotData := map[string]interface{}{"nodes": nodes, "edges": edges}
	snapshotJSON, err := json.Marshal(snapshotData)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var snapshot models.CanvasSnapshot
	err = db.DB.QueryRowx(
		`INSERT INTO canvas_snapshots (canvas_id, label, snapshot_json)
		 VALUES ($1,$2,$3) RETURNING id, canvas_id, label, created_at`,
		id, req.Label, snapshotJSON,
	).StructScan(&snapshot)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, snapshot)
}

// GET /api/canvases/:id/snapshots
func ListSnapshots(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var snapshots []models.CanvasSnapshot
	if err := db.DB.Select(&snapshots,
		`SELECT id, canvas_id, label, created_at FROM canvas_snapshots WHERE canvas_id=$1 ORDER BY created_at DESC`, id,
	); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if snapshots == nil {
		snapshots = []models.CanvasSnapshot{}
	}
	writeJSON(w, http.StatusOK, snapshots)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
