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
  Game *-- ArrowStack
  Game *-- Dummy
  Game *-- Explosion
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
  SceneManager *-- ArrowStackView
  SceneManager *-- DummyView
  SceneManager *-- ExplosionView
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
  StateMessage *-- ArrowStackSnapshot
  StateMessage *-- DummySnapshot
  StateMessage *-- ExplosionSnapshot
  Hud --> Nameplate
```

## Server

`server/src/Game.ts`, `server/src/Player.ts`, `server/src/Weapon.ts`, `server/src/Projectile.ts`, `server/src/ArrowStack.ts`, `server/src/Dummy.ts`, `server/src/Explosion.ts`

```mermaid
classDiagram
  direction TB
  class Game {
    -Map~string, Player~ players
    -Projectile[] projectiles
    -Weapon[] groundWeapons
    -ArrowStack[] arrowStacks
    -Dummy[] dummies
    -Explosion[] explosions
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
    +number exposedUntilMs
    +InputMessage input
    +Weapon weapon
    +number[] quiver
    +string selected
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
    +number x
    +number y
    +number z
    +number vx
    +number vy
    +number vz
    +number bendX
    +number bendZ
    +boolean turned
    +number landX
    +number landZ
    +number traveled
    +number age
    +boolean grounded
    +number groundedAt
    +ProjectileSpec spec
    +string arrow
  }
  class ArrowStack {
    +string id
    +string kind
    +number x
    +number z
    +number count
  }
  class Dummy {
    +string id
    +number x
    +number z
    +number hp
    +boolean alive
  }
  class Explosion {
    +string id
    +string ownerId
    +number x
    +number z
    +number radius
    +number bornMs
  }
  class ProjectileSpec {
    +number speed
    +number maxRange
    +number damage
    +number radius
    +boolean explodes
    +boolean penetrates
    +boolean ricochets
    +number explosionRadius
    +number fireCooldownMs
    +string trajectory
  }
  Game *-- Player
  Game *-- Projectile
  Game *-- Weapon
  Game *-- ArrowStack
  Game *-- Dummy
  Game *-- Explosion
  Player --> Weapon
  Weapon --> ProjectileSpec
  Projectile --> ProjectileSpec
```

Held weapons stay on the player. `groundWeapons` is only the ones lying in the arena. `arrowStacks` are piles of ricochet, explosion, bodkin, and flare arrows. Walking over a pile adds them to `quiver`. `selected` is `normal` for the unlimited arrow, or one of those four. Ricochet arrows bounce off walls, trunks, and the arena edge. Explosion arrows burst on the ground, on those surfaces, on hunters, and on dummies, and leave a short `Explosion`. The shooter keeps seeing that arrow and its blast after they leave the view cone. Bodkin arrows pass through walls and trunks. Flare arrows fly slowly and light a full circle, blocked by walls and trunks, until they land. `Dummy` targets stand along the walls and across the arena. They take arrow and blast damage and stay fallen at 0 hp. `Weapon` creates each `Projectile` from the bow and the selected arrow. A shortbow flies flat along the facing and drops. A longbow lofts onto the clicked ground and can pass over low cover. A recurve does the same with a longer reach, and bends once to get around a wall. The bow still sets the time between shots.

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
    -Map~string, ArrowStackView~ stackViews
    -Map~string, DummyView~ dummyViews
    -Map~string, ExplosionView~ explosionViews
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
    -string nocked
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
    -boolean hasArrow
    -string nockKind
    -number shotStarted
  }
  class ProjectileView {
    +Group group
  }
  class WeaponView {
    +Group group
  }
  class ArrowStackView {
    +Group group
  }
  class DummyView {
    +Group group
    -Group body
    -Mesh fill
    -Group bar
  }
  class ExplosionView {
    +Group group
    -Mesh ring
    -Mesh core
    -Mesh[] shards
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
    -number slot
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
    -HTMLDivElement hotbar
    -HotbarSlot[] slots
    -function onSelectHandler
  }
  class HotbarSlot {
    +HTMLDivElement root
    +HTMLDivElement icon
    +HTMLDivElement tip
    +HTMLSpanElement count
    +HTMLDivElement sweep
    +HTMLSpanElement timer
    +string iconKey
  }
  SceneManager *-- Arena
  SceneManager *-- Scenery
  SceneManager *-- PlayerView
  SceneManager *-- ProjectileView
  SceneManager *-- WeaponView
  SceneManager *-- ArrowStackView
  SceneManager *-- DummyView
  SceneManager *-- ExplosionView
  SceneManager *-- RadialMenu
  SceneManager *-- Fog
  PlayerView --> BowView
  WeaponView --> BowView
  SceneManager --> Connection
  SceneManager --> SnapshotBuffer
  SceneManager --> InputManager
  SceneManager --> Hud
  Hud --> HotbarSlot
```

## Messages

Interfaces, not classes. `Player` stores `InputMessage`. `Connection` and `SnapshotBuffer` carry `StateMessage`. `Hud` draws `Nameplate` and the five hotbar squares. `RadialOption` is the menu entry `{ id, label }`. `WallBlock`, `TreeSpot`, and `BushSpot` are the static map. Walls and tree trunks block hunters, arrows, and sight. Bushes do not. A hunter inside a bush is hidden from everyone else until they loose an arrow, which reveals them for two seconds. `PlayerSnapshot.hidden` is that state for the hunter's own client. Sight is a cone in front of the hunter. `InputMessage.slot` asks for the bow (`0`) or a quiver slot (`1` to `4`). `selected` is the arrow that will be shot. `quiver` counts ricochet, explosion, bodkin, and flare. Normal arrows are unlimited. `cooldownMs` is the wait left on the bow. A flying flare reveals hunters, arrows, bows, stacks, and dummies inside its circle, even outside the view cone. `DummySnapshot` is a straw target. `ExplosionSnapshot.ageMs` drives the blast animation.

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
    +number aimX
    +number aimZ
    +boolean shoot
    +number slot
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
    +boolean hidden
    +string selected
    +number[] quiver
    +number cooldownMs
  }
  class ProjectileSnapshot {
    +string id
    +string ownerId
    +number x
    +number y
    +number z
    +number dirX
    +number dirY
    +number dirZ
    +string arrow
  }
  class ArrowStackSnapshot {
    +string id
    +string kind
    +number x
    +number z
    +number count
  }
  class DummySnapshot {
    +string id
    +number x
    +number z
    +number hp
    +boolean alive
  }
  class ExplosionSnapshot {
    +string id
    +string ownerId
    +number x
    +number z
    +number radius
    +number ageMs
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
    +ArrowStackSnapshot[] stacks
    +DummySnapshot[] dummies
    +ExplosionSnapshot[] explosions
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
  StateMessage *-- ArrowStackSnapshot
  StateMessage *-- DummySnapshot
  StateMessage *-- ExplosionSnapshot
```
