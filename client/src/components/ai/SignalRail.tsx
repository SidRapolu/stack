import { useStore } from '../../store'
import styles from './SignalRail.module.css'

export function SignalRail() {
  const { signals, dismissSignal, selectedRailSignalId, setSelectedRailSignalId } = useStore()

  // intent is shown in its own card — never in the signal list
  const intentSignal = signals.filter((s) => s.type === 'intent' as never && !s.dismissed).at(-1)

  // only show non-intent, non-dismissed signals
  const activeSignals = signals.filter(
    (s) => s.type !== ('intent' as never) && !s.dismissed
  )

  const completions = activeSignals.filter((s) => s.type === 'completion')
  const insights = activeSignals.filter((s) => s.type !== 'completion')

  return (
    <aside className={styles.rail}>
      <div className={styles.header}>
        <div className={styles.dot} />
        signals
      </div>
      <div className={styles.body}>
        {/* intent card */}
        <div className={styles.intentCard}>
          <div className={styles.intentLabel}>intent</div>
          <div className={styles.intentText}>
            {intentSignal ? intentSignal.detail : (
              <span className={styles.intentPlaceholder}>
                add blocks to infer intent...
              </span>
            )}
          </div>
        </div>

        {/* completions — linked to ghost node */}
        {completions.length > 0 && (
          <>
            <div className={styles.sectionLabel}>completions</div>
            {completions.map((s) => (
              <div
                key={s.id}
                className={`${styles.item} ${selectedRailSignalId === s.id ? styles.itemActive : ''}`}
                onClick={() => setSelectedRailSignalId(s.id)}
              >
                <div className={styles.itemTop}>
                  <div className={`${styles.itemDot} ${styles.dotCompletion}`} />
                  <div className={styles.itemTitle}>{s.title}</div>
                  <button
                    className={styles.dismissBtn}
                    onClick={(e) => { e.stopPropagation(); dismissSignal(s.id) }}
                    title="dismiss"
                  >✕</button>
                </div>
                <div className={styles.itemDetail}>{s.detail}</div>
              </div>
            ))}
          </>
        )}

        {/* conflict / failure insights */}
        {insights.length > 0 && (
          <>
            <div className={styles.sectionLabel}>insights</div>
            {insights.map((s) => (
              <div key={s.id} className={styles.item}>
                <div className={styles.itemTop}>
                  <div className={`${styles.itemDot} ${styles[`dot_${s.type}`]}`} />
                  <div className={styles.itemTitle}>{s.title}</div>
                  <button
                    className={styles.dismissBtn}
                    onClick={() => dismissSignal(s.id)}
                    title="dismiss"
                  >✕</button>
                </div>
                <div className={styles.itemDetail}>{s.detail}</div>
              </div>
            ))}
          </>
        )}

        {activeSignals.length === 0 && (
          <div className={styles.empty}>signals appear as you build...</div>
        )}
      </div>
    </aside>
  )
}
