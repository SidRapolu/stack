import { create } from 'zustand'
import type { StackNode, StackEdge, AISignal, ChatMessage, BlockStatus } from '@/types'

interface StackStore {
  // canvas
  nodes: StackNode[]
  edges: StackEdge[]
  addNode: (node: StackNode) => void
  updateNodePosition: (id: string, x: number, y: number) => void
  updateNodeStatus: (id: string, status: BlockStatus) => void
  updateNodeNotes: (id: string, notes: string) => void
  removeNode: (id: string) => void
  addEdge: (edge: StackEdge) => void
  removeEdge: (id: string) => void

  // signals — strictly managed
  signals: AISignal[]
  addSignal: (signal: AISignal) => void
  replaceSignals: (incoming: AISignal[]) => void  // replaces all non-dismissed scan signals at once
  dismissSignal: (id: string) => void
  clearSignals: () => void

  // rail
  selectedRailSignalId: string | null
  setSelectedRailSignalId: (id: string | null) => void

  // ai panel
  aiPanelOpen: boolean
  aiPanelMode: 'suggestions' | 'chat'
  setAIPanelOpen: (open: boolean) => void
  setAIPanelMode: (mode: 'suggestions' | 'chat') => void

  // suggestions
  pendingSuggestions: AISignal[]
  setPendingSuggestions: (suggestions: AISignal[]) => void
  triggerNodeId: string | null
  setTriggerNodeId: (id: string | null) => void

  // chat
  chatMessages: ChatMessage[]
  addChatMessage: (msg: ChatMessage) => void

  // loading
  aiLoading: boolean
  setAILoading: (loading: boolean) => void
}

export const useStore = create<StackStore>((set, get) => ({
  // canvas
  nodes: [],
  edges: [],
  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
  updateNodePosition: (id, x, y) =>
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, position: { x, y } } : n)) })),
  updateNodeStatus: (id, status) =>
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, status } : n)) })),
  updateNodeNotes: (id, notes) =>
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, notes } : n)) })),
  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      signals: s.signals.filter((sig) => sig.targetNodeId !== id),
    })),
  addEdge: (edge) => set((s) => ({ edges: [...s.edges, edge] })),
  removeEdge: (id) => set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

  // signals
  signals: [],

  // addSignal: used for one-off signals (intent)
  addSignal: (signal) =>
    set((s) => {
      // dedupe by type + title
      const deduped = s.signals.filter(
        (x) => !(x.type === signal.type && x.title === signal.title)
      )
      const next = [...deduped, signal]
      // auto-select first completion if none selected
      const sel = s.selectedRailSignalId
      const newSel = sel && next.find((x) => x.id === sel)
        ? sel
        : next.find((x) => x.type === 'completion' && !x.dismissed)?.id ?? sel
      return { signals: next, selectedRailSignalId: newSel }
    }),

  // replaceSignals: atomic replacement of all scan results — prevents stacking
  replaceSignals: (incoming) =>
    set((s) => {
      // keep intent signals and dismissed signals, replace everything else
      const keep = s.signals.filter((x) => x.type === 'intent' || x.dismissed)
      const next = [...keep, ...incoming]
      const sel = s.selectedRailSignalId
      const newSel = sel && next.find((x) => x.id === sel && !x.dismissed)
        ? sel
        : next.find((x) => x.type === 'completion' && !x.dismissed)?.id ?? null
      return { signals: next, selectedRailSignalId: newSel }
    }),

  dismissSignal: (id) =>
    set((s) => {
      const next = s.signals.map((sig) => sig.id === id ? { ...sig, dismissed: true } : sig)
      const sel = s.selectedRailSignalId === id
        ? next.find((x) => x.type === 'completion' && !x.dismissed)?.id ?? null
        : s.selectedRailSignalId
      return { signals: next, selectedRailSignalId: sel }
    }),

  clearSignals: () => set({ signals: [], selectedRailSignalId: null }),

  // rail
  selectedRailSignalId: null,
  setSelectedRailSignalId: (id) => set({ selectedRailSignalId: id }),

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

  // chat
  chatMessages: [],
  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),

  // loading
  aiLoading: false,
  setAILoading: (loading) => set({ aiLoading: loading }),
}))
