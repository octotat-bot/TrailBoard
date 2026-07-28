import type { Awareness } from 'y-protocols/awareness'

import { usePresenceUsers } from '../collab/usePresence'

export function PresenceBar({ awareness }: { awareness: Awareness }) {
  const users = usePresenceUsers(awareness)

  return (
    <div className="presence" role="list" aria-label="People on this board">
      {users.map((user) => (
        <span
          key={user.clientId}
          role="listitem"
          className="avatar"
          style={{ background: user.color }}
          title={user.isLocal ? `${user.name} (you)` : user.name}
        >
          {user.initials}
        </span>
      ))}
    </div>
  )
}
