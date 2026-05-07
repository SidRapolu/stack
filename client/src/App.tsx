import { useCallback } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type NodeTypes,
  type EdgeTypes as RFEdgeTypes,
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
import type { StackNode } from './types'

import './index.css'

const nodeTypes: NodeTypes = {
  service: ServiceNode,
  ghost: GhostNode,
}

const edgeTypes: RFEdgeTypes = {
  stack: StackEdge,
}

let nodeCount = 0

export default function App() {
  const [rfNodes, setRFNodes, onNodesChange] = useNodesState([])
  const [rfEdges, setRFEdges, onEdgesChange] = useEdgesState([])

  const {
    addNode,
    addEdge: storeAddEdge,
    setAIPanelOpen,
    setTriggerNodeId,
    setPendingSuggestions,
    setAILoading,
  } = useStore()

  const onConnect = useCallback(
    (connection: Connection) => {
      const id = `e-${connection.source}-${connection.target}`
      setRFEdges((eds) => addEdge({ ...connection, id, type: 'stack' }, eds))
      storeAddEdge({ id, source: connection.source!, target: connection.target! })
      // get latest state directly for the scan
      const state = useStore.getState()
      triggerScan(state.nodes, state.edges)
    },
    [setRFEdges, storeAddEdge]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const name = e.dataTransfer.getData('svc')
      if (!name) return
      const service = findService(name)
      if (!service) return

      const bounds = (e.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect()
      if (!bounds) return

      const id = `n-${++nodeCount}`
      const position = { x: e.clientX - bounds.left - 76, y: e.clientY - bounds.top - 44 }

      const stackNode: StackNode = {
        id,
        service,
        status: 'proposed',
        notes: '',
        position,
      }

      addNode(stackNode)
      setRFNodes((nds) => [
        ...nds,
        { id, type: 'service', position, data: { stackNode } },
      ])

      setAIPanelOpen(true)
      setTriggerNodeId(id)
      setAILoading(true)

      const state = useStore.getState()
      inferSuggestions(stackNode, state.nodes, state.edges)
        .then((signals) => {
          setPendingSuggestions(signals)
          setAILoading(false)
        })
        .catch(() => setAILoading(false))

      triggerScan(state.nodes, state.edges)
    },
    [addNode, setRFNodes, setAIPanelOpen, setTriggerNodeId, setPendingSuggestions, setAILoading]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  return (
    <div className="root">
      <Topbar />
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
            fitView={false}
            defaultViewport={{ x: 200, y: 60, zoom: 1 }}
            minZoom={0.25}
            maxZoom={3}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="rgba(255,255,255,0.04)"
            />
          </ReactFlow>
          <AIPanel rfNodes={rfNodes} setRFNodes={setRFNodes} setRFEdges={setRFEdges} />
        </div>
        <SignalRail />
      </div>
    </div>
  )
}
