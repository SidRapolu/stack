import { memo } from 'react'
import type { NodeProps } from 'reactflow'
import { useStore } from '../../store'
import { findService } from '../../lib/services'
import type { AISignal } from '../../types'
import styles from './GhostNode.module.css'

interface GhostData {
  signal: AISignal
  onMaterialize: (signal: AISignal, x: number, y: number) => void
}

export const GhostNode = memo(({ data, xPos, yPos }: NodeProps<GhostData>) => {
  const { signal, onMaterialize } = data
  const { dismissSignal } = useStore()
  const service = signal.suggestedService ? findService(signal.suggestedService) : null

  return (
    <div className={styles.ghost}>
      <div className={styles.header}>
        {service && (
          <div className={styles.icon} style={{ background: service.bg, color: service.fg, opacity: 0.7 }}>
            {service.icon}
          </div>
        )}
        <div className={styles.title}>{signal.suggestedService}</div>
      </div>
      <div className={styles.body}>
        <div className={styles.detail}>{signal.detail}</div>
        <div className={styles.actions}>
          <button className={styles.addBtn} onClick={() => onMaterialize(signal, xPos, yPos)}>
            + add
          </button>
          <button className={styles.dismissBtn} onClick={() => dismissSignal(signal.id)}>
            dismiss
          </button>
        </div>
      </div>
    </div>
  )
})

GhostNode.displayName = 'GhostNode'
