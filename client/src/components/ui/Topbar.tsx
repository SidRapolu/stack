import styles from './Topbar.module.css'

export function Topbar() {
  const handleExport = () => {
    // export logic will pull from store
    console.log('export')
  }

  return (
    <header className={styles.topbar}>
      <div className={styles.logo}>
        st<span className={styles.accent}>a</span>ck
      </div>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={() => {}}>
          + custom
        </button>
        <button className={`${styles.btn} ${styles.btnAccent}`} onClick={handleExport}>
          export draw.io
        </button>
      </div>
    </header>
  )
}
