import { useEffect } from 'react'
import { clearToast, useToastState } from '../../state/uiState'

/** Small speech-bubble style message, e.g. after looking at Tok Wan's house. */
export function Toast() {
  const message = useToastState((s) => s.message)
  const key = useToastState((s) => s.key)

  useEffect(() => {
    if (!message) return undefined
    const timer = setTimeout(clearToast, 4200)
    return () => clearTimeout(timer)
  }, [message, key])

  useEffect(() => clearToast, [])

  if (!message) return null
  return (
    <div className="toast" key={key} role="status">
      {message}
    </div>
  )
}
