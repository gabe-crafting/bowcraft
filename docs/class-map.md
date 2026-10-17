# Class map

Diagram of the game's classes and the message shapes they store. Update this file in the same change whenever a class, interface, or field is added, removed, or renamed.

`+` is public. `−` is private. An arrow means the left type holds or uses the right one. Methods are not listed.

`Player.weapon`, `weaponId`, and `heldBy` are null when a player is unarmed or a weapon is on the ground.

## Ownership

```mermaid
classDiagram
  direction LR
  Game *-- Player
  Game *-- Projectile
  Game *-- Weapon
  Player --> Weapon
  Player --> InputMessage
  Weapon --> ProjectileSpec
  Weapon --> Projectile
  Projectile --> ProjectileSpec
  SceneManager *-- Arena
  SceneManager *-- Scenery
  SceneManager *-- PlayerView
  SceneManager *-- ProjectileView
  SceneManager *-- WeaponView
  SceneManager *-- RadialMenu
  SceneManager *-- Fog
  PlayerView --> BowView
  WeaponView --> BowView
  SceneManager --> Connection
  SceneManager --> SnapshotBuffer
  SceneManager --> InputManager
  SceneManager --> Hud
  Connection --> StateMessage
  SnapshotBuffer --> StateMessage
  StateMessage *-- PlayerSnapshot
  StateMessage *-- ProjectileSnapshot
  StateMessage *-- WeaponSnapshot
  Hud --> Nameplate
```

## Server

`server/src/Game.ts`, `server/src/Player.ts`, `server/src/Weapon.ts`, `server/src/Projectile.ts`

```mermaid
classDiagram
  direction TB
  class Game {
    -Map~string, Player~ players
    -Projectile[] projectiles
    -Weapon[] groundWeapons
    -number tickCount
    -number elapsedMs
    +number playerCount
  }
  class Player {
    +string id
    +string username
    +number spawnIndex
    +number color
    +number x
    +number z
    +number aim
    +number hp
    +boolean alive
    +number respawnAtMs
    +number lastShotMs
    +InputMessage input
    +Weapon weapon
  }
  class Weapon {
    +string id
    +string kind
    +ProjectileSpec spec
    +string holderId
    +number x
    +number z
  }
  class Projectile {
    +string id
    +string ownerId
    +number dirX
    +number dirZ
    +ProjectileSpec spec
    +number x
    +number z
    +number traveled
  }
  class ProjectileSpec {
    +number speed
    +number maxRange
    +number damage
    +number radius
    +boolean explodes
    +boolean penetrates
    +number explosionRadius
    +number fireCooldownMs
  }
  Game *-- Player
  Game *-- Projectile
  Game *-- Weapon
  Player --> Weapon
  Weapon --> ProjectileSpec
  Projectile --> ProjectileSpec
```

Held weapons stay on the player. `groundWeapons` is only the ones lying in the arena. `Weapon` creates each `Projectile` from its spec.

## Client

`client/src/scene/SceneManager.ts` owns the other client objects.

```mermaid
classDiagram
  direction TB
  class SceneManager {
    -HTMLElement parent
    -Connection connection
    -SnapshotBuffer buffer
    -InputManager input
    -Hud hud
    -string playerId
    -Scene scene
    -PerspectiveCamera camera
    -WebGLRenderer renderer
    -Arena arena
    -Scenery scenery
    -Map~string, PlayerView~ playerViews
    -Map~string, ProjectileView~ projectileViews
    -Map~string, WeaponView~ weaponViews
    -RadialMenu radial
    -Fog fog
    -Raycaster raycaster
    -Vector2 pointer
    -Plane ground
    -Vector3 aimPoint
    -Vector3 labelPoint
    -number lastAim
    -Set~string~ knownShots
    -number raf
    -boolean stopped
  }
  class Arena {
    +Group group
  }
  class Scenery {
    +Group group
  }
  class PlayerView {
    +Group group
    -BowView bow
    -string bowKind
    -Mesh bowArm
    -Mesh drawArm
    -Group leftLeg
    -Group rightLeg
    -number walkPhase
    -number legSwing
  }
  class BowView {
    +Group group
    -Mesh upperString
    -Mesh lowerString
    -Group nock
    -number height
    -number bend
    -number drawDistance
    -number shotStarted
  }
  class ProjectileView {
    +Group group
  }
  class WeaponView {
    +Group group
  }
  class Fog {
    -ShaderMaterial material
    -WebGLRenderTarget target
    -Scene quadScene
    -OrthographicCamera quadCamera
    -boolean revealed
  }
  class RadialMenu {
    -HTMLDivElement root
    -SVGSVGElement svg
    -HTMLParagraphElement caption
    -RadialOption[] options
    -string optionKey
    -WeaponAction highlight
  }
  class Connection {
    -WebSocket socket
    -boolean welcomed
    -boolean notifiedClose
  }
  class SnapshotBuffer {
    -TimedSnapshot previous
    -TimedSnapshot latest
  }
  class InputManager {
    -Set~string~ keys
    -number pointerX
    -number pointerY
    -boolean primaryDown
    -boolean shootLatched
    -boolean menuDown
    -boolean menuReleaseLatched
    -boolean attached
    +object pointer
  }
  class JoinScreen {
    -HTMLDivElement root
    -HTMLInputElement input
    -HTMLButtonElement button
    -HTMLParagraphElement statusEl
    -string statusText
    -function onPlayHandler
    +string status
  }
  class Hud {
    -HTMLDivElement root
    -Map~string, PlateView~ plates
  }
  SceneManager *-- Arena
  SceneManager *-- Scenery
  SceneManager *-- PlayerView
  SceneManager *-- ProjectileView
  SceneManager *-- WeaponView
  SceneManager *-- RadialMenu
  SceneManager *-- Fog
  PlayerView --> BowView
  WeaponView --> BowView
  SceneManager --> Connection
  SceneManager --> SnapshotBuffer
  SceneManager --> InputManager
  SceneManager --> Hud
```

## Messages

Interfaces, not classes. `Player` stores `InputMessage`. `Connection` and `SnapshotBuffer` carry `StateMessage`. `Hud` draws `Nameplate`. `RadialOption` is the menu entry `{ id, label }`. `WallBlock`, `TreeSpot`, and `BushSpot` are the static map. Walls and tree trunks block hunters, arrows, and sight. Bushes do not. Sight is a cone in front of the hunter.

```mermaid
classDiagram
  direction TB
  class InputMessage {
    +string type
    +boolean up
    +boolean down
    +boolean left
    +boolean right
    +number aim
    +boolean shoot
  }
  class ActionMessage {
    +string type
    +string action
  }
  class JoinMessage {
    +string type
    +string username
  }
  class WelcomeMessage {
    +string type
    +string playerId
  }
  class ArenaFullMessage {
    +string type
  }
  class PlayerSnapshot {
    +string id
    +string username
    +number x
    +number z
    +number aim
    +number hp
    +boolean alive
    +number color
    +string weaponId
  }
  class ProjectileSnapshot {
    +string id
    +string ownerId
    +number x
    +number z
    +number dirX
    +number dirZ
  }
  class WeaponSnapshot {
    +string id
    +string kind
    +number x
    +number z
    +string heldBy
  }
  class StateMessage {
    +string type
    +number tick
    +PlayerSnapshot[] players
    +ProjectileSnapshot[] projectiles
    +WeaponSnapshot[] weapons
  }
  class WallBlock {
    +number x
    +number z
    +number width
    +number depth
  }
  class TreeSpot {
    +number x
    +number z
  }
  class BushSpot {
    +number x
    +number z
    +number scale
  }
  class Nameplate {
    +string id
    +string username
    +number hp
    +number screenX
    +number screenY
    +boolean visible
  }
  StateMessage *-- PlayerSnapshot
  StateMessage *-- ProjectileSnapshot
  StateMessage *-- WeaponSnapshot
```
