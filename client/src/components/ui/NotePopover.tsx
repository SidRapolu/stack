import { useStore } from '../../store'
import styles from './NotePopover.module.css'

interface Props {
  nodeId: string
  onClose: () => void
}

export function NotePopover({ nodeId, onClose }: Props) {
  const { nodes, updateNodeNotes } = useStore()
  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return null

  return (
    <div className={styles.popover}>
      <div className={styles.label}>
        <span>notes — {node.service.name}</span>
        <button className={styles.close} onClick={onClose}>✕</button>
      </div>
      <textarea
        className={styles.textarea}
        placeholder="notes for collaborators..."
        defaultValue={node.notes}
        onChange={(e) => updateNodeNotes(nodeId, e.target.value)}
        onMouseDown={(e) => e.stopPropagation()}
      />
    </div>
  )
}
