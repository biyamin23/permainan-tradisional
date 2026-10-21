import { useEffect, useRef } from 'react'

/** Warm, blurred-backdrop dialog used by the game menus. Esc closes it. */
export function Modal({ children, onClose, labelledBy, className = '' }) {
  const panelRef = useRef(null)

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div className="modal" role="presentation" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={panelRef} className={`modal__panel ${className}`} role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby={labelledBy}>
        {children}
      </div>
    </div>
  )
}
