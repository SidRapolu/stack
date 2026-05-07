import styles from './Topbar.module.css'

interface Props {
  onExport: () => void
}

export function Topbar({ onExport }: Props) {
  return (
    <header className={styles.topbar}>
      <div className={styles.logo}>
        st<span className={styles.accent}>a</span>ck
      </div>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={() => {}}>
          + custom
        </button>
        <button className={`${styles.btn} ${styles.btnAccent}`} onClick={onExport}>
          export draw.io
        </button>
      </div>
    </header>
  )
}
