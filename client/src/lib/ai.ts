import type { StackNode, StackEdge, AISignal, SignalType, ChatMessage } from '@/types'
import { VALID_SERVICE_NAMES } from './services'

const API_BASE = '/api'

// ── Helpers ────────────────────────────────────────────────────

function buildTopologyContext(nodes: StackNode[], edges: StackEdge[]): string {
  const nodeList = nodes.map((n) => n.service.name).join(', ')
  const edgeList = edges
    .map((e) => {
      const from = nodes.find((n) => n.id === e.source)
      const to = nodes.find((n) => n.id === e.target)
      return from && to ? `${from.service.name} → ${to.service.name}` : null
    })
    .filter(Boolean)
    .join(', ')
  return `Services on canvas: ${nodeList || 'none'}.\nConnections: ${edgeList || 'none'}.`
}

function makeSignal(
  type: SignalType,
  title: string,
  detail: string,
  opts: Partial<AISignal> = {}
): AISignal {
  return {
    id: crypto.randomUUID(),
    type,
    confidence: 'high',
    title,
    detail,
    timestamp: Date.now(),
    dismissed: false,
    ...opts,
  }
}

async function callAPI(body: object): Promise<string> {
  const res = await fetch(`${API_BASE}/infer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const data = await res.json()
  return data.text as string
}

// ── Signal: Next-block suggestions after a node is dropped ─────

export async function inferSuggestions(
  droppedNode: StackNode,
  nodes: StackNode[],
  edges: StackEdge[]
): Promise<AISignal[]> {
  const ctx = buildTopologyContext(nodes, edges)
  const prompt = `You are a senior cloud architect reasoning about a system being designed.
The user just added "${droppedNode.service.name}" to their canvas.
${ctx}

Suggest exactly 3 services the user likely needs next based on real cloud architecture patterns.
Exclude services already on canvas.
Each suggestion needs a reason under 8 words explaining why it follows structurally.

Respond ONLY with a JSON array, no markdown:
[{"name":"ServiceName","reason":"short reason","confidence":"high"|"medium"|"low"},...]

Valid services: ${VALID_SERVICE_NAMES}`

  const text = await callAPI({ prompt, type: 'suggestions' })
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim()) as Array<{
    name: string
    reason: string
    confidence: 'high' | 'medium' | 'low'
  }>

  return parsed.map((s) =>
    makeSignal('suggestion', s.name, s.reason, {
      confidence: s.confidence,
      suggestedService: s.name,
      targetNodeId: droppedNode.id,
    })
  )
}

// ── Signal: Topology scan — conflicts, gaps, failure modes ─────

export async function scanTopology(
  nodes: StackNode[],
  edges: StackEdge[]
): Promise<AISignal[]> {
  if (nodes.length < 2) return []

  const ctx = buildTopologyContext(nodes, edges)
  const prompt = `You are a senior cloud architect reviewing a system design.
${ctx}

Analyze this architecture for:
1. Missing components that structurally must exist (completion signals)
2. Architectural conflicts or anti-patterns (conflict signals)
3. Failure cascade risks (failure_mode signals)

Only surface signals you are highly confident about. Do not be noisy.
Return empty array if the architecture looks sound.
Maximum 3 signals total.

Respond ONLY with a JSON array, no markdown:
[{
  "type": "completion"|"conflict"|"failure_mode",
  "confidence": "high"|"medium",
  "title": "short label under 6 words",
  "detail": "concrete explanation under 20 words",
  "suggestedService": "service name to add (for completion) or null",
  "targetService": "service name this applies to or null"
}]

Valid services: ${VALID_SERVICE_NAMES}`

  const text = await callAPI({ prompt, type: 'scan' })
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim()) as Array<{
    type: SignalType
    confidence: 'high' | 'medium'
    title: string
    detail: string
    suggestedService: string | null
    targetService: string | null
  }>

  return parsed.map((s) => {
    const targetNode = s.targetService
      ? nodes.find((n) => n.service.name === s.targetService)
      : undefined
    return makeSignal(s.type, s.title, s.detail, {
      confidence: s.confidence,
      targetNodeId: targetNode?.id,
      suggestedService: s.suggestedService ?? undefined,
    })
  })
}

// ── Debounced trigger — fires scan and pushes signals to store ──

let scanTimer: ReturnType<typeof setTimeout> | null = null

export function triggerScan(nodes: StackNode[], edges: StackEdge[]): void {
  if (scanTimer) clearTimeout(scanTimer)
  scanTimer = setTimeout(async () => {
    try {
      const { useStore } = await import('../store')
      const signals = await scanTopology(nodes, edges)
      signals.forEach((sig) => useStore.getState().addSignal(sig))
      // also update intent
      await inferIntent(nodes, edges)
    } catch (e) {
      console.error('scan failed', e)
    }
  }, 1400)
}

// ── Intent inference ────────────────────────────────────────────

export async function inferIntent(
  nodes: StackNode[],
  edges: StackEdge[]
): Promise<void> {
  if (nodes.length < 2) return
  const ctx = buildTopologyContext(nodes, edges)
  const prompt = `You are a cloud architect. ${ctx}
In one sentence under 15 words, what system is this building? Only the sentence, no preamble.`
  try {
    const text = await callAPI({ prompt, type: 'suggestions' })
    const { useStore } = await import('../store')
    // store intent as a special signal
    const existing = useStore.getState().signals.find((s) => s.type === 'intent' as SignalType)
    if (existing) useStore.getState().dismissSignal(existing.id)
    useStore.getState().addSignal(
      makeSignal('intent' as SignalType, 'intent', text.trim(), { confidence: 'high' })
    )
  } catch (e) {
    console.error('intent inference failed', e)
  }
}

// ── Chat ───────────────────────────────────────────────────────

export async function sendChatMessage(
  message: string,
  history: ChatMessage[],
  nodes: StackNode[],
  edges: StackEdge[]
): Promise<string> {
  const ctx = buildTopologyContext(nodes, edges)
  const system = `You are a senior cloud architect assistant embedded in Stack, a system design tool.
${ctx}
Be concise and direct. Under 80 words unless complexity demands more.
If recommending a service, use its exact name from: ${VALID_SERVICE_NAMES}`

  const text = await callAPI({
    type: 'chat',
    system,
    messages: [...history, { role: 'user', content: message }],
  })
  return text
}
