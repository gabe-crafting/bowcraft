# Recurve curve

The recurve aims at the click. On open ground the arrow flies straight. When that straight line meets a wall or a tree trunk, the arrow bends once around the near end of that obstacle and finishes toward the click. A wall sitting beside the shot, but not across it, does not pull the arrow.

The recurve flies this way.

```text
Click behind a wall                         Nothing across the shot

        click                                   click
          o                                       o
          |                                       |
     _____|                              ________ |
    | wall|                                   wall|
          \                                       |
           \                                      |
            \                                     |
             arrow                                arrow
```

## What the arrow is allowed to do

The curve lives on the ground. Gravity still drops the arrow, and bow power still pays for the length of the path. The bend is a change of heading, not a second shot.

- One bend. After the turn, the arrow holds the new heading until it lands or hits something.
- The bend goes around the first wall or trunk on the line from the hunter to the click.
- Both halves of the path have to miss every wall and every trunk. Bushes are not obstacles. Hunters and dummies are targets, not corners to hook.
- If no such bend exists, the arrow flies straight and strikes the obstacle.

## Step 1. Place the aim point

Call the hunter `S` and the click `C`.

The bow's power, times the arrow's range modifier, is a path budget. A shortbow and a recurve spend that budget in front of them. For the recurve the budget is the longest path the arrow may fly before it must be on the ground.

If `C` is farther than the budget, pull the aim point back along `S → C` until the distance equals the budget. Call that point `A`. If the click is inside the budget, `A` is the click.

The rest of the algorithm aims at `A`, not at a click the bow cannot reach.

## Step 2. Test the straight line

Cast a segment from the arrow's spawn to `A`. The segment is thickened by the arrow's radius, the same test the flight already uses against walls and trunks.

No hit: fly straight from the spawn toward `A`. Stop. This is the right-hand picture. A wall can stand next to the arrow for the whole flight and change nothing, because the segment never enters it.

Hit: keep the first obstacle only. That wall or trunk is the one the arrow may bend around. Call the impact `H`.

## Step 3. Build the gates

A gate is a point just outside the obstacle, where the arrow is allowed to turn. The arrow will fly spawn → gate → `A`.

### Wall

Grow the wall's rectangle by the arrow radius plus a small gap, so the body of the arrow clears the stone. The four corners of that grown rectangle are the gates. Each corner is pushed a little farther out along its outward diagonal, so the turn does not clip the stone.

The drawing is this case. The click sits just past one end of the wall, so the corner at that end is the short way around. The corner at the far end is a much longer trip, and it loses in the next step.

### Tree

A trunk is a circle, so it has no corners. Take the two points on either side of the trunk, perpendicular to `S → A`, sitting just outside the trunk radius plus the same gap. Those two points are the gates. The arrow passes the trunk on the left or on the right.

## Step 4. Keep the first gate that is actually open

A gate `G` is legal only when all of these hold:

1. `G` is inside the arena.
2. The leg from the spawn to `G` hits no wall and no trunk.
3. The leg from `G` to `A` hits no wall and no trunk.

Among the legal gates, keep the one whose path is shortest:

```text
length = distance(spawn, G) + distance(G, A)
```

That single choice is the whole curve. It picks the end of the wall nearest the click when that end is open, and the other end when the near one is boxed in by a second wall or a trunk. It never adds a second bend to get out of that box.

No legal gate: there is no curve. The arrow flies the straight line from step 2 and hits the obstacle at `H`.

## Step 5. Fly the path, then spend the budget

With a gate, the planned path is the two legs `spawn → G → A`. With no gate, it is the one leg `spawn → A`.

Measure that path. If it is longer than the budget, walk backward along the path until the remaining length equals the budget. That point is where the arrow lands. A long hook can therefore land on the second leg, short of the click, or even on the first leg if the bow cannot afford the turn.

Horizontal speed is the bow's speed times the arrow's speed modifier. The time in the air is `path length / speed`. Vertical speed is solved so the arrow is on the ground at that time, the same way a straight recurve shot already drops.

## How the curve itself is calculated

The two legs meet at a sharp corner `G`. The curve is a circle of fixed radius `R` that replaces that corner. The circle is tangent to `spawn → G` and tangent to `G → A`, so the arrow arrives straight, follows the arc, and leaves straight. One arc, then no more turning.

`d1` is the unit direction from the spawn toward `G`. `d2` is the unit direction from `G` toward `A`.

The angle inside the corner, between the way the arrow came from and the way it leaves, is

```text
θ = acos(clamp(−dot(d1, d2), −1, 1))
```

A straight shot has `θ = 180°`. A right-angle hook has `θ = 90°`.

The arc touches the incoming leg at `T1` and the outgoing leg at `T2`. Both sit the same distance `q` back from `G`:

```text
q = R / tan(θ / 2)
T1 = G − d1 · q
T2 = G + d2 · q
```

For a right angle, `q = R`. The tangent points are one radius before the corner and one radius after it.

The center `O` sits on the bisector of that inner angle, far enough from both legs that the radius meets them at a right angle:

```text
bisector = normalize(−d1 + d2)
O = G + bisector · (R / sin(θ / 2))
```

For a right angle that distance is `R√2`, which lands the center exactly `R` off each leg.

The arrow flies straight from the spawn to `T1`, then along the arc from `T1` to `T2` around `O`. The arc sweeps the turn `180° − θ`, the short way, on the inside of the corner. From `T2` it flies straight toward `A`.

`R` starts at a fixed size, about one unit, so the hook reads as a curve and not a kink. If `q` is longer than either leg, shrink `R` until both tangent points fit on their legs. If the arc enters a wall or a trunk, shrink `R` again. If even a tiny arc still cuts the obstacle, drop the circle and turn sharply at `G`. The preview line uses this same path.

While the arrow is on the arc its horizontal heading is the tangent of the circle: perpendicular to `O → position`, pointing from `T1` toward `T2`. Speed along the arc stays the bow's horizontal speed. Vertical speed is unchanged through the turn. Gravity keeps pulling for the whole flight.

## A walk-through of the left-hand picture

The long east-west wall near the middle of the arena is centered at `(-5.5, -3)`, about 6.4 wide and 0.7 deep. Its east end is near `x = -2.3`.

Put the hunter south of that wall, and the click just past the east end, on the far side. The straight segment crosses the wall, so step 2 names that wall.

The four corners are candidates. The two at the east end are close to the click. The north-east corner, grown out past the stone, usually wins: both legs miss the wall, and the path is shorter than going west around the far end. The arrow runs north, bends around that end, and finishes toward the click.

Move the click so the straight segment misses the wall, even by a little. Step 2 stops. The arrow flies straight, which is the right-hand picture. The same wall is still in the arena. It is not across the shot, so it is not a reason to bend.
