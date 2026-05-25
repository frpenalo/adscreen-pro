import { useEffect } from 'react'

export function useWakeLock() {
  useEffect(() => {
    type WakeLockLike = {
      release: () => Promise<void>
      addEventListener: (type: 'release', cb: () => void) => void
    }
    type NavigatorWithLock = Navigator & {
      wakeLock?: { request: (kind: 'screen') => Promise<WakeLockLike> }
    }

    let sentinel: WakeLockLike | null = null
    let cancelled = false

    const requestLock = async () => {
      if (cancelled) return
      const nav = navigator as NavigatorWithLock
      if (!nav.wakeLock) return
      try {
        sentinel = await nav.wakeLock.request('screen')
        sentinel.addEventListener('release', () => { sentinel = null })
      } catch {}
    }

    requestLock()

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !sentinel) requestLock()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      if (sentinel) {
        sentinel.release().catch(() => {})
        sentinel = null
      }
    }
  }, [])
}
