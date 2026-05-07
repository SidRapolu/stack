import { useCallback, useEffect, useRef } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type NodeTypes,
  type EdgeTypes as RFEdgeTypes,
  type NodeChange,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { Topbar } from './components/ui/Topbar'
import { Sidebar } from './components/ui/Sidebar'
import { SignalRail } from './components/ai/SignalRail'
import { AIPanel } from './components/ai/AIPanel'
import { ServiceNode } from './components/canvas/ServiceNode'
import { GhostNode } from './components/canvas/GhostNode'
import { StackEdge } from './components/canvas/EdgeTypes'

import { useStore } from './store'
import { findService } from './lib/services'
import { inferSuggestions, triggerScan } from './lib/ai'
import type { StackNode, AISignal } from './types'

import './index.css'

let nodeCount = 0

const nodeTypes: NodeTypes = { service: ServiceNode, ghost: GhostNode }
const edgeTypes: RFEdgeTypes = { stack: StackEdge }

export default function App() {
  const [rfNodes, setRFNodes, _onNodesChange] = useNodesState([])
  const [rfEdges, setRFEdges, onEdgesChange] = useEdgesState([])
  const ghostPositionRef = useRef<{ x: number; y: number } | null>(null)
  const lastGhostSignalId = useRef<string | null>(null)

  const {
    addNode, removeNode,
    addEdge: storeAddEdge,
    setAIPanelOpen, setTriggerNodeId, setPendingSuggestions, setAILoading,
    signals, selectedRailSignalId,
  } = useStore()

  // ── intercept node changes to track ghost position ────────
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    changes.forEach((c) => {
      if (c.type === 'position' && (c as any).id?.startsWith('ghost-') && (c as any).position) {
        ghostPositionRef.current = (c as any).position
      }
    })
    _onNodesChange(changes)
  }, [_onNodesChange])

  // ── ghost node ────────────────────────────────────────────
  useEffect(() => {
    setRFNodes((nds) => {
      const withoutGhosts = nds.filter((n) => n.type !== 'ghost')
      if (!selectedRailSignalId) {
        ghostPositionRef.current = null
        lastGhostSignalId.current = null
        return withoutGhosts
      }
      const sig = signals.find(
        (s) => s.id === selectedRailSignalId && s.type === 'completion' && !s.dismissed
      )
      if (!sig?.suggestedService) return withoutGhosts
      const target = sig.targetNodeId ? withoutGhosts.find((n) => n.id === sig.targetNodeId) : null
      if (!target) return withoutGhosts

      if (lastGhostSignalId.current !== sig.id) {
        ghostPositionRef.current = null
        lastGhostSignalId.current = sig.id
      }

      let ghostX = target.position.x + 220
      let ghostY = target.position.y
      const nodeWidth = 160, nodeHeight = 100, padding = 20
      let attempts = 0
      while (attempts < 8) {
        const collision = withoutGhosts.some((n) =>
          Math.abs(n.position.x - ghostX) < nodeWidth + padding &&
          Math.abs(n.position.y - ghostY) < nodeHeight + padding
        )
        if (!collision) break
        ghostY += nodeHeight + padding
        attempts++
      }

      const position = ghostPositionRef.current ?? { x: ghostX, y: ghostY }

      return [
        ...withoutGhosts,
        {
          id: `ghost-${sig.id}`,
          type: 'ghost',
          position,
          data: { signal: sig, onMaterialize: materializeGhost },
          draggable: true,
        },
      ]
    })
  }, [selectedRailSignalId, signals])

  const materializeGhost = useCallback((signal: AISignal, x: number, y: number) => {
    useStore.getState().setSelectedRailSignalId(null)
    ghostPositionRef.current = null
    lastGhostSignalId.current = null
    const service = findService(signal.suggestedService!)
    if (!service) return
    const id = `n-${++nodeCount}`
    const position = { x, y }
    const stackNode: StackNode = { id, service, status: 'proposed', notes: '', position }
    addNode(stackNode)
    setRFNodes((nds) => [
      ...nds.filter((n) => n.type !== 'ghost'),
      { id, type: 'service', position, data: { stackNode, onRemove: handleRemoveNode } },
    ])
    useStore.getState().dismissSignal(signal.id)
    const state = useStore.getState()
    triggerScan(state.nodes, state.edges)
  }, [addNode, setRFNodes])

  // ── node removal ──────────────────────────────────────────
  const handleRemoveNode = useCallback((id: string) => {
    removeNode(id)
    setRFNodes((nds) => nds.filter((n) => n.id !== id))
    setRFEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
  }, [removeNode, setRFNodes, setRFEdges])

  useEffect(() => {
    setRFNodes((nds) =>
      nds.map((n) => n.type === 'service' ? { ...n, data: { ...n.data, onRemove: handleRemoveNode } } : n)
    )
  }, [handleRemoveNode])

  // ── export ────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const { nodes, edges } = useStore.getState()
    const cells = nodes.map((n) =>
      `<mxCell id="${n.id}" value="${n.service.name}" style="rounded=1;whiteSpace=wrap;" vertex="1" parent="1"><mxGeometry x="${Math.round(n.position.x)}" y="${Math.round(n.position.y)}" width="140" height="60" as="geometry"/></mxCell>`
    ).join('')
    const edgeCells = edges.map((e, i) =>
      `<mxCell id="e${i}" edge="1" source="${e.source}" target="${e.target}" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>`
    ).join('')
    const xml = `<?xml version="1.0"?>\n<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}${edgeCells}</root></mxGraphModel></diagram></mxfile>`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }))
    a.download = 'stack.drawio'
    a.click()
  }, [])

  // ── connect ───────────────────────────────────────────────
  const onConnect = useCallback((connection: Connection) => {
    const id = `e-${connection.source}-${connection.target}`
    setRFEdges((eds) => addEdge({ ...connection, id, type: 'stack' }, eds))
    storeAddEdge({ id, source: connection.source!, target: connection.target! })
    const state = useStore.getState()
    triggerScan(state.nodes, state.edges)
  }, [setRFEdges, storeAddEdge])

  // ── drop ──────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const name = e.dataTransfer.getData('svc')
    if (!name) return
    const service = findService(name)
    if (!service) return
    const bounds = (e.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect()
    if (!bounds) return
    const id = `n-${++nodeCount}`
    const position = { x: e.clientX - bounds.left - 76, y: e.clientY - bounds.top - 44 }
    const stackNode: StackNode = { id, service, status: 'proposed', notes: '', position }
    addNode(stackNode)
    setRFNodes((nds) => [
      ...nds,
      { id, type: 'service', position, data: { stackNode, onRemove: handleRemoveNode } },
    ])
    setAIPanelOpen(true)
    setTriggerNodeId(id)
    setAILoading(true)
    const state = useStore.getState()
    inferSuggestions(stackNode, state.nodes, state.edges)
      .then((sigs) => { setPendingSuggestions(sigs); setAILoading(false) })
      .catch(() => setAILoading(false))
    triggerScan(state.nodes, state.edges)
  }, [addNode, setRFNodes, setAIPanelOpen, setTriggerNodeId, setPendingSuggestions, setAILoading, handleRemoveNode])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  return (
    <div className="root">
      <Topbar onExport={handleExport} />
      <div className="workspace">
        <Sidebar />
        <div className="canvas-wrap">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionLineStyle={{ stroke: '#c0392b', strokeWidth: 1.5, strokeDasharray: '5 4' }}
            fitView={false}
            defaultViewport={{ x: 200, y: 60, zoom: 1 }}
            minZoom={0.25}
            maxZoom={3}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.04)" />
          </ReactFlow>
          <AIPanel rfNodes={rfNodes} setRFNodes={setRFNodes} setRFEdges={setRFEdges} />
        </div>
        <SignalRail />
      </div>
    </div>
  )
}
