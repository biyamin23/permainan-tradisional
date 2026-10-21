import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CapsuleCollider, RigidBody } from '@react-three/rapier'
import { Vector3 } from 'three'
import { npcBodyStore } from '../../../state/npcBodies'

const _world = new Vector3()

function NpcBody({ entry }) {
  const body = useRef()
  useFrame(() => {
    const rb = body.current
    const target = entry.ref.current
    if (!rb || !target) return
    target.getWorldPosition(_world)
    rb.setNextKinematicTranslation(_world)
  })
  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[0, -50, 0]}>
      <CapsuleCollider args={[entry.halfHeight, entry.radius]} position={[0, entry.halfHeight + entry.radius, 0]} />
    </RigidBody>
  )
}

/** Physical bodies for every registered NPC (see state/npcBodies.js). */
export function NpcColliders() {
  const bodies = npcBodyStore.useStore((s) => s.bodies)
  return bodies.map((entry) => <NpcBody key={entry.id} entry={entry} />)
}
