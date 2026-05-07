// ── Service Block ──────────────────────────────────────────────
export type ServiceCategory =
  | 'Compute'
  | 'Data'
  | 'Messaging'
  | 'Networking'
  | 'Auth'
  | 'Observability'
  | 'Custom'

export type BlockStatus = 'proposed' | 'decided' | 'inuse' | 'deprecated'

export interface ServiceDef {
  name: string
  icon: string
  bg: string
  fg: string
  category: ServiceCategory
}

export interface StackNode {
  id: string
  service: ServiceDef
  status: BlockStatus
  notes: string
  position: { x: number; y: number }
}

export interface StackEdge {
  id: string
  source: string
  target: string
}

// ── AI Signal Bus ──────────────────────────────────────────────
export type SignalType =
  | 'completion'      // missing piece that structurally must exist
  | 'conflict'        // two components in architectural tension
  | 'pattern'         // recognized known architecture pattern
  | 'failure_mode'    // cascade risk detected in topology
  | 'cost_shape'      // cost model misaligned with likely traffic
  | 'suggestion'      // next block suggestion after drop

export type SignalConfidence = 'high' | 'medium' | 'low'

export interface AISignal {
  id: string
  type: SignalType
  confidence: SignalConfidence
  targetNodeId?: string        // node this signal is attached to
  targetEdgeId?: string        // edge this signal is attached to
  title: string                // short label for UI
  detail: string               // full explanation
  suggestedService?: string    // for completion/suggestion signals
  timestamp: number
  dismissed: boolean
}

// ── Canvas State ───────────────────────────────────────────────
export interface CanvasSnapshot {
  id: string
  label: string
  nodes: StackNode[]
  edges: StackEdge[]
  createdAt: number
}

// ── Chat ───────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
