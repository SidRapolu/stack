import { create } from 'zustand'
import type { StackNode, StackEdge, AISignal, ChatMessage, BlockStatus } from '@/types'

interface StackStore {
  // ── Canvas ──────────────────────────────────────────────────
  nodes: StackNode[]
  edges: StackEdge[]
  addNode: (node: StackNode) => void
  updateNodePosition: (id: string, x: number, y: number) => void
  updateNodeStatus: (id: string, status: BlockStatus) => void
  updateNodeNotes: (id: string, notes: string) => void
  removeNode: (id: string) => void
  addEdge: (edge: StackEdge) => void
  removeEdge: (id: string) => void

  // ── AI Signals ──────────────────────────────────────────────
  signals: AISignal[]
  addSignal: (signal: AISignal) => void
  dismissSignal: (id: string) => void
  clearSignals: () => void

  // ── AI Panel ────────────────────────────────────────────────
  aiPanelOpen: boolean
  aiPanelMode: 'suggestions' | 'chat'
  setAIPanelOpen: (open: boolean) => void
  setAIPanelMode: (mode: 'suggestions' | 'chat') => void

  // ── Suggestions (on drop) ───────────────────────────────────
  pendingSuggestions: AISignal[]
  setPendingSuggestions: (suggestions: AISignal[]) => void
  triggerNodeId: string | null
  setTriggerNodeId: (id: string | null) => void

  // rail selection
  selectedRailSignalId: string | null
  setSelectedRailSignalId: (id: string | null) => void

  // ── Chat ────────────────────────────────────────────────────
  chatMessages: ChatMessage[]
  addChatMessage: (msg: ChatMessage) => void

  // ── AI loading ──────────────────────────────────────────────
  aiLoading: boolean
  setAILoading: (loading: boolean) => void
}

export const useStore = create<StackStore>((set) => ({
  // canvas
  nodes: [],
  edges: [],
  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
  updateNodePosition: (id, x, y) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, position: { x, y } } : n)),
    })),
  updateNodeStatus: (id, status) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, status } : n)),
    })),
  updateNodeNotes: (id, notes) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, notes } : n)),
    })),
  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
    })),
  addEdge: (edge) => set((s) => ({ edges: [...s.edges, edge] })),
  removeEdge: (id) => set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

  // signals
  signals: [],
  addSignal: (signal) => set((s) => ({ signals: [...s.signals, signal] })),
  dismissSignal: (id) =>
    set((s) => ({
      signals: s.signals.map((sig) => (sig.id === id ? { ...sig, dismissed: true } : sig)),
    })),
  clearSignals: () => set({ signals: [] }),

  // ai panel
  aiPanelOpen: false,
  aiPanelMode: 'suggestions',
  setAIPanelOpen: (open) => set({ aiPanelOpen: open }),
  setAIPanelMode: (mode) => set({ aiPanelMode: mode }),

  // suggestions
  pendingSuggestions: [],
  setPendingSuggestions: (suggestions) => set({ pendingSuggestions: suggestions }),
  triggerNodeId: null,
  setTriggerNodeId: (id) => set({ triggerNodeId: id }),

  // rail selection
  selectedRailSignalId: null,
  setSelectedRailSignalId: (id) => set({ selectedRailSignalId: id }),

  // chat
  chatMessages: [],
  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),

  // loading
  aiLoading: false,
  setAILoading: (loading) => set({ aiLoading: loading }),
}))
