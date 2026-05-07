import { SERVICES, SERVICE_CATEGORIES } from '../../lib/services'
import type { ServiceCategory } from '../../types'
import styles from './Sidebar.module.css'

export function Sidebar() {
  const onDragStart = (e: React.DragEvent, name: string) => {
    e.dataTransfer.setData('svc', name)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>services</div>
      <div className={styles.body}>
        {SERVICE_CATEGORIES.map((cat) => (
          <div key={cat}>
            <div className={styles.categoryLabel}>{cat}</div>
            {SERVICES.filter((s) => s.category === (cat as ServiceCategory)).map((s) => (
              <div
                key={s.name}
                className={styles.serviceBlock}
                draggable
                onDragStart={(e) => onDragStart(e, s.name)}
              >
                <div
                  className={styles.icon}
                  style={{ background: s.bg, color: s.fg }}
                >
                  {s.icon}
                </div>
                <span className={styles.name}>{s.name}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
}
