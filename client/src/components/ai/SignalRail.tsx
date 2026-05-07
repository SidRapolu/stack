import { useStore } from '../../store'
import styles from './SignalRail.module.css'

export function SignalRail() {
  const { signals, dismissSignal, selectedRailSignalId, setSelectedRailSignalId } = useStore()

  const completions = signals.filter((s) => s.type === 'completion' && !s.dismissed)
  const insights = signals.filter(
    (s) => s.type !== 'completion' && !s.dismissed
  )

  const intentSignal = signals.find((s) => s.type === 'intent' as never)

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

        {/* completions */}
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
                  <div className={styles.itemConf}>{s.confidence}</div>
                </div>
                <div className={styles.itemDetail}>{s.detail}</div>
              </div>
            ))}
          </>
        )}

        {/* other insights */}
        {insights.length > 0 && (
          <>
            <div className={styles.sectionLabel}>insights</div>
            {insights.map((s) => (
              <div
                key={s.id}
                className={styles.item}
                onClick={() => dismissSignal(s.id)}
                title="click to dismiss"
              >
                <div className={styles.itemTop}>
                  <div className={`${styles.itemDot} ${styles[`dot_${s.type}`]}`} />
                  <div className={styles.itemTitle}>{s.title}</div>
                  <div className={styles.itemConf}>{s.confidence}</div>
                </div>
                <div className={styles.itemDetail}>{s.detail}</div>
              </div>
            ))}
          </>
        )}

        {signals.filter((s) => !s.dismissed).length === 0 && (
          <div className={styles.empty}>signals appear as you build...</div>
        )}
      </div>
    </aside>
  )
}
