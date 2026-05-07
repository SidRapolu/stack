package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
)

const anthropicURL = "https://api.anthropic.com/v1/messages"
const model = "claude-sonnet-4-6"

// ── Request types from client ──────────────────────────────────

type ChatMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type InferRequest struct {
	Type     string    `json:"type"`               // "suggestions" | "scan" | "chat"
	Prompt   string    `json:"prompt,omitempty"`   // for suggestions + scan
	System   string    `json:"system,omitempty"`   // for chat
	Messages []ChatMsg `json:"messages,omitempty"` // for chat
}

// ── Anthropic API types ────────────────────────────────────────

type anthropicRequest struct {
	Model     string    `json:"model"`
	MaxTokens int       `json:"max_tokens"`
	System    string    `json:"system,omitempty"`
	Messages  []ChatMsg `json:"messages"`
}

type anthropicResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

// ── Handler ────────────────────────────────────────────────────

func Infer(w http.ResponseWriter, r *http.Request) {
	var req InferRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	var anthropicReq anthropicRequest
	anthropicReq.Model = model

	switch req.Type {
	case "suggestions", "scan":
		anthropicReq.MaxTokens = 400
		anthropicReq.Messages = []ChatMsg{{Role: "user", Content: req.Prompt}}
	case "chat":
		anthropicReq.MaxTokens = 600
		anthropicReq.System = req.System
		anthropicReq.Messages = req.Messages
	default:
		http.Error(w, "unknown infer type", http.StatusBadRequest)
		return
	}

	text, err := callAnthropic(anthropicReq)
	if err != nil {
		http.Error(w, fmt.Sprintf("anthropic error: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"text": text})
}

func Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func callAnthropic(req anthropicRequest) (string, error) {
	key := os.Getenv("ANTHROPIC_API_KEY")
	if key == "" {
		return "", fmt.Errorf("ANTHROPIC_API_KEY not set")
	}

	body, err := json.Marshal(req)
	if err != nil {
		return "", err
	}

	httpReq, err := http.NewRequest("POST", anthropicURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", key)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		log.Printf("anthropic error %d: %s", resp.StatusCode, respBody)
		return "", fmt.Errorf("anthropic returned %d: %s", resp.StatusCode, respBody)
	}

	var result anthropicResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", err
	}

	for _, block := range result.Content {
		if block.Type == "text" {
			return block.Text, nil
		}
	}
	return "", fmt.Errorf("no text block in response")
}
