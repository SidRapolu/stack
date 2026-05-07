import { useState, useRef, useEffect, useCallback } from 'react'
import type { Node, Edge } from 'reactflow'
import { useStore } from '../../store'
import { findService } from '../../lib/services'
import { sendChatMessage } from '../../lib/ai'
import type { ChatMessage, AISignal } from '../../types'
import styles from './AIPanel.module.css'

interface Props {
  rfNodes: Node[]
  setRFNodes: React.Dispatch<React.SetStateAction<Node[]>>
  setRFEdges: React.Dispatch<React.SetStateAction<Edge[]>>
}

let nodeCount = 1000

export function AIPanel({ setRFNodes, setRFEdges }: Props) {
  const {
    aiPanelOpen, setAIPanelOpen,
    aiLoading, pendingSuggestions,
    triggerNodeId,
    nodes, edges,
    addNode, addEdge,
    chatMessages, addChatMessage,
  } = useStore()

  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [size, setSize] = useState({ width: 260, height: 400 })
  const isResizing = useRef(false)
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })
  const msgsRef = useRef<HTMLDivElement>(null)

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height }

    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return
      const dw = resizeStart.current.x - ev.clientX // dragging left = wider
      const dh = resizeStart.current.y - ev.clientY // dragging up = taller
      setSize({
        width: Math.min(Math.max(resizeStart.current.w + dw, 220), 520),
        height: Math.min(Math.max(resizeStart.current.h + dh, 200), 700),
      })
    }
    const onUp = () => {
      isResizing.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [size])

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [chatMessages])

  const addSuggestion = (sig: AISignal) => {
    const service = findService(sig.suggestedService!)
    if (!service) return
    const fromNode = nodes.find((n) => n.id === triggerNodeId)
    const x = fromNode ? fromNode.position.x + 210 : 100
    const y = fromNode ? fromNode.position.y : 100
    const id = `n-${++nodeCount}`

    addNode({ id, service, status: 'proposed', notes: '', position: { x, y } })
    setRFNodes((nds) => [...nds, { id, type: 'service', position: { x, y }, data: { stackNode: { id, service, status: 'proposed', notes: '', position: { x, y } } } }])

    if (fromNode) {
      const edgeId = `e-${triggerNodeId}-${id}`
      addEdge({ id: edgeId, source: triggerNodeId!, target: id })
      setRFEdges((eds) => [...eds, { id: edgeId, source: triggerNodeId!, target: id, type: 'stack' }])
    }

    setAIPanelOpen(false)
  }

  const handleSend = async () => {
    const text = chatInput.trim()
    if (!text || chatLoading) return
    setChatInput('')
    const userMsg: ChatMessage = { role: 'user', content: text }
    addChatMessage(userMsg)
    setChatLoading(true)
    try {
      const reply = await sendChatMessage(text, chatMessages, nodes, edges)
      addChatMessage({ role: 'assistant', content: reply })
    } catch {
      addChatMessage({ role: 'assistant', content: 'Could not reach AI.' })
    } finally {
      setChatLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  if (!aiPanelOpen) {
    return (
      <button className={styles.fab} onClick={() => setAIPanelOpen(true)}>
        <div className={styles.fabDot} />
        ask stack AI
      </button>
    )
  }

  return (
    <div className={styles.panel} style={{ width: size.width, maxHeight: size.height }}>
      <div className={styles.resizeHandle} onMouseDown={onResizeMouseDown} title="drag to resize" />
      <div className={styles.header}>
        <div className={styles.dot} />
        <div className={styles.label}>stack AI</div>
        {aiLoading && <div className={styles.spinner} />}
        <button
          className={`${styles.ctrl} ${chatOpen ? styles.ctrlActive : ''}`}
          onClick={() => setChatOpen((v) => !v)}
          title="chat"
        >
          <svg viewBox="0 0 12 12" fill="none">
            <rect x="1" y="1.5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M3.5 9.5L4.5 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        <button className={styles.ctrl} onClick={() => setAIPanelOpen(false)} title="close">
          <svg viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {!chatOpen ? (
        <div className={styles.suggestView}>
          <div className={styles.msg}>
            {aiLoading
              ? 'analyzing canvas...'
              : pendingSuggestions.length
              ? `AI suggests:`
              : 'select a block for suggestions'}
          </div>
          <div className={styles.suggestions}>
            {pendingSuggestions.map((s) => {
              const sv = findService(s.suggestedService!)
              return (
                <button key={s.id} className={styles.suggestion} onClick={() => addSuggestion(s)}>
                  <div className={styles.sugIcon} style={{ background: sv?.bg || '#2d3748', color: sv?.fg || '#94a3b8' }}>
                    {sv?.icon || '+'}
                  </div>
                  <div className={styles.sugText}>
                    <div className={styles.sugName}>{s.suggestedService}</div>
                    <div className={styles.sugReason}>{s.detail}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className={styles.chatView}>
          <div className={styles.chatCtx}>
            context: {nodes.map((n) => n.service.name).join(', ') || 'no blocks yet'}
          </div>
          <div className={styles.messages} ref={msgsRef}>
            {chatMessages.map((m, i) => (
              <div key={i} className={`${styles.message} ${m.role === 'user' ? styles.msgUser : styles.msgAI}`}>
                {m.content}
              </div>
            ))}
            {chatLoading && <div className={`${styles.message} ${styles.msgAI} ${styles.thinking}`}>thinking...</div>}
          </div>
          <div className={styles.inputRow}>
            <textarea
              className={styles.input}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ask about your architecture..."
              rows={1}
            />
            <button className={styles.send} onClick={handleSend}>↑</button>
          </div>
        </div>
      )}
    </div>
  )
}
