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

  // build a deduplicated, clean node list
  const uniqueNodeNames = [...new Set(nodes.map((n) => n.service.name))]
  const edgeList = edges
    .map((e) => {
      const from = nodes.find((n) => n.id === e.source)
      const to = nodes.find((n) => n.id === e.target)
      return from && to ? `${from.service.name} → ${to.service.name}` : null
    })
    .filter(Boolean)
    .join(', ')

  const prompt = `You are a senior cloud architect reviewing a system design in progress.

Services on canvas (${uniqueNodeNames.length} total): ${uniqueNodeNames.join(', ')}.
Connections: ${edgeList || 'none yet'}.

Your job: identify the most important architectural gap or issue. Return a maximum of 2 signals.

Rules:
- Only return signals you are architecturally certain about (high confidence only)
- "completion" = a service that is structurally required but missing (e.g. no DLQ on SQS, no cache on high-read DB)
- "conflict" = two services or connections that are architecturally incompatible or backwards
- "failure_mode" = a single point of failure or cascade risk in the current topology
- Do NOT comment on services that are not on the canvas
- Do NOT hallucinate duplicates — if a service appears once in the list, it exists exactly once
- Return empty array [] if the architecture looks reasonable for its current stage

Respond ONLY with a JSON array, no markdown, no explanation:
[{"type":"completion"|"conflict"|"failure_mode","confidence":"high","title":"max 5 words","detail":"max 15 words","suggestedService":"exact service name or null","targetService":"exact service name from canvas or null"}]

Valid service names: ${VALID_SERVICE_NAMES}`

  const text = await callAPI({ prompt, type: 'scan' })
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim()) as Array<{
    type: SignalType
    confidence: 'high' | 'medium'
    title: string
    detail: string
    suggestedService: string | null
    targetService: string | null
  }>

  // only keep high confidence, max 2
  return parsed
    .filter((s) => s.confidence === 'high')
    .slice(0, 2)
    .map((s) => {
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

// ── Debounced trigger — atomic signal replacement ──────────────

let scanTimer: ReturnType<typeof setTimeout> | null = null

export function triggerScan(nodes: StackNode[], edges: StackEdge[]): void {
  if (scanTimer) clearTimeout(scanTimer)
  scanTimer = setTimeout(async () => {
    try {
      const { useStore } = await import('../store')
      const signals = await scanTopology(nodes, edges)
      // atomic replace — wipes old scan results and sets new ones
      useStore.getState().replaceSignals(signals)
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
  const uniqueNames = [...new Set(nodes.map((n) => n.service.name))].join(', ')
  const edgeList = edges
    .map((e) => {
      const from = nodes.find((n) => n.id === e.source)
      const to = nodes.find((n) => n.id === e.target)
      return from && to ? `${from.service.name} → ${to.service.name}` : null
    })
    .filter(Boolean)
    .join(', ')
  const prompt = `Services: ${uniqueNames}. Connections: ${edgeList || 'none'}.
In one sentence under 15 words, what system is this building? Only the sentence, no preamble.`
  try {
    const text = await callAPI({ prompt, type: 'suggestions' })
    const { useStore } = await import('../store')
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
