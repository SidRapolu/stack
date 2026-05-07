import { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useStore } from '../../store'
import { NotePopover } from '../ui/NotePopover'
import type { StackNode, BlockStatus } from '../../types'
import styles from './ServiceNode.module.css'

const STATUSES: { key: BlockStatus; label: string }[] = [
  { key: 'proposed', label: 'proposed' },
  { key: 'decided', label: 'decided' },
  { key: 'inuse', label: 'in use' },
  { key: 'deprecated', label: 'depr.' },
]

interface NodeData {
  stackNode: StackNode
}

export const ServiceNode = memo(({ data, selected }: NodeProps<NodeData>) => {
  const { stackNode } = data
  const { service, id, status } = stackNode
  const [noteOpen, setNoteOpen] = useState(false)

  const { updateNodeStatus, removeNode, signals } = useStore()

  const nodeSignals = signals.filter((s) => s.targetNodeId === id && !s.dismissed)
  const conflictSignal = nodeSignals.find((s) => s.type === 'conflict')
  const failureSignal = nodeSignals.find((s) => s.type === 'failure_mode')

  return (
    <div className={`${styles.node} ${selected ? styles.selected : ''}`}>
      {/* ports */}
      <Handle type="target" position={Position.Left} className={styles.port} />
      <Handle type="source" position={Position.Right} className={styles.port} />
      <Handle type="target" position={Position.Top} className={styles.portTop} />
      <Handle type="source" position={Position.Bottom} className={styles.portBottom} />

      {/* signal badges */}
      {conflictSignal && (
        <div className={`${styles.badge} ${styles.badgeConflict}`} title={conflictSignal.detail} />
      )}
      {failureSignal && (
        <div className={`${styles.badge} ${styles.badgeFailure}`} title={failureSignal.detail} />
      )}

      {/* header */}
      <div className={styles.header}>
        <div className={styles.icon} style={{ background: service.bg, color: service.fg }}>
          {service.icon}
        </div>
        <div className={styles.title}>{service.name}</div>
        <div className={styles.actions}>
          <button
            className={`${styles.iconBtn} ${noteOpen ? styles.iconBtnActive : ''}`}
            onClick={() => setNoteOpen((v) => !v)}
            title="notes"
          >
            <svg viewBox="0 0 12 12" fill="none">
              <path d="M1.5 3h9M1.5 6h9M1.5 9h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
          <button
            className={styles.iconBtn}
            onClick={() => removeNode(id)}
            title="remove"
          >
            <svg viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* body */}
      <div className={styles.body}>
        <div className={styles.category}>{service.category}</div>
        <div className={styles.statuses}>
          {STATUSES.map((s) => (
            <span
              key={s.key}
              className={`${styles.status} ${styles[`status_${s.key}`]} ${status === s.key ? styles.statusActive : ''}`}
              onClick={() => updateNodeStatus(id, s.key)}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* floating note */}
      {noteOpen && <NotePopover nodeId={id} onClose={() => setNoteOpen(false)} />}
    </div>
  )
})

ServiceNode.displayName = 'ServiceNode'
