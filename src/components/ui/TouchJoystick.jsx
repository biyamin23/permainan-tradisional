import { useEffect, useRef, useState } from 'react'
import { setJoystick } from '../../state/input'

const RADIUS = 46

/** On-screen joystick for tablets. Feeds the same input as WASD. */
export function TouchJoystick() {
  const baseRef = useRef(null)
  const pointer = useRef(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })

  useEffect(() => () => setJoystick(0, 0), [])

  const update = (event) => {
    const rect = baseRef.current.getBoundingClientRect()
    let dx = event.clientX - (rect.left + rect.width / 2)
    let dy = event.clientY - (rect.top + rect.height / 2)
    const length = Math.hypot(dx, dy)
    if (length > RADIUS) {
      dx = (dx / length) * RADIUS
      dy = (dy / length) * RADIUS
    }
    setKnob({ x: dx, y: dy })
    setJoystick(dx / RADIUS, -dy / RADIUS)
  }

  const onPointerDown = (event) => {
    pointer.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    update(event)
  }
  const onPointerMove = (event) => {
    if (pointer.current !== event.pointerId) return
    update(event)
  }
  const onPointerUp = (event) => {
    if (pointer.current !== event.pointerId) return
    pointer.current = null
    setKnob({ x: 0, y: 0 })
    setJoystick(0, 0)
  }

  return (
    <div
      ref={baseRef}
      className="joystick"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-hidden="true"
    >
      <div className="joystick__knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  )
}
