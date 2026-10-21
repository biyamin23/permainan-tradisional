/**
 * Unified movement input: keyboard (WASD + arrows, Shift to run) and an
 * on-screen joystick for touch devices. Read once per frame by the player.
 */

const KEY_BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  backward: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
}

const MOVEMENT_CODES = new Set(Object.values(KEY_BINDINGS).flat())

const pressed = new Set()
const joystick = { x: 0, y: 0 }

const isTypingTarget = (target) =>
  target instanceof HTMLElement &&
  (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

function onKeyDown(event) {
  if (isTypingTarget(event.target)) return
  if (!MOVEMENT_CODES.has(event.code)) return
  if (event.code.startsWith('Arrow')) event.preventDefault()
  pressed.add(event.code)
}

function onKeyUp(event) {
  pressed.delete(event.code)
}

function clearAll() {
  pressed.clear()
  joystick.x = 0
  joystick.y = 0
}

/** Attach keyboard listeners. Returns a cleanup function. */
export function attachKeyboardInput() {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', clearAll)
  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', clearAll)
    clearAll()
  }
}

/** x/y in [-1, 1]; y = 1 means "forward". */
export function setJoystick(x, y) {
  joystick.x = x
  joystick.y = y
}

const isDown = (action) => KEY_BINDINGS[action].some((code) => pressed.has(code))

/**
 * Returns the desired movement in camera space.
 * x: right (+) / left (-), y: forward (+) / backward (-), length <= 1.
 */
export function getMoveInput() {
  let x = (isDown('right') ? 1 : 0) - (isDown('left') ? 1 : 0)
  let y = (isDown('forward') ? 1 : 0) - (isDown('backward') ? 1 : 0)

  x += joystick.x
  y += joystick.y

  const length = Math.hypot(x, y)
  if (length > 1) {
    x /= length
    y /= length
  }

  // the joystick only walks: pushing it to the edge on a phone shouldn't make you sprint
  return { x, y, run: isDown('run') }
}
