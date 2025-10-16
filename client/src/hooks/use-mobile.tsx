import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const mobile = window.innerWidth < MOBILE_BREAKPOINT
    console.log('[useIsMobile] Initial state:', { innerWidth: window.innerWidth, mobile })
    return mobile
  })

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT
      console.log('[useIsMobile] Change detected:', { innerWidth: window.innerWidth, mobile })
      setIsMobile(mobile)
    }
    mql.addEventListener("change", onChange)
    
    const mobile = window.innerWidth < MOBILE_BREAKPOINT
    console.log('[useIsMobile] Effect mounted:', { innerWidth: window.innerWidth, mobile, matches: mql.matches })
    setIsMobile(mobile)
    
    return () => mql.removeEventListener("change", onChange)
  }, [])

  console.log('[useIsMobile] Render:', isMobile)
  return isMobile
}
