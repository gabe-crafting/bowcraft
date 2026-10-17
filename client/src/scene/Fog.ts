import {
  FOG_COLOR,
  FOG_OPACITY,
  TREES,
  TREE_TRUNK_RADIUS,
  VISION_ANGLE_FALLOFF,
  VISION_FALLOFF,
  VISION_HALF_ANGLE,
  VISION_RADIUS,
  VISION_SELF_RADIUS,
  WALLS,
  wallBounds,
} from '@bounty/shared'
import {
  DepthTexture,
  GLSL3,
  Matrix4,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Camera,
  type WebGLRenderer,
} from 'three'

const MAX_WALLS = 16
const MAX_TREES = 16
const SURFACE_GAP = 0.15

const vertexShader = `
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const fragmentShader = `
  precision highp float;
  in vec2 vUv;
  out vec4 fragColor;

  uniform sampler2D tDepth;
  uniform vec2 uOrigin;
  uniform vec2 uForward;
  uniform float uRadius;
  uniform float uFalloff;
  uniform float uHalfAngle;
  uniform float uAngleFalloff;
  uniform float uSelfRadius;
  uniform vec3 uFogColor;
  uniform float uOpacity;
  uniform mat4 uInverseProjection;
  uniform mat4 uInverseView;
  uniform vec4 uWalls[${MAX_WALLS}];
  uniform float uWallCount;
  uniform vec3 uTrees[${MAX_TREES}];
  uniform float uTreeCount;

  bool hitsWall(vec2 from, vec2 to, vec4 box) {
    vec2 delta = to - from;
    float tMin = 0.0;
    float tMax = 1.0;
    for (int axis = 0; axis < 2; axis++) {
      float origin = axis == 0 ? from.x : from.y;
      float step = axis == 0 ? delta.x : delta.y;
      float minBound = axis == 0 ? box.x : box.z;
      float maxBound = axis == 0 ? box.y : box.w;
      if (abs(step) < 0.00001) {
        if (origin < minBound || origin > maxBound) return false;
      } else {
        float tEnter = (minBound - origin) / step;
        float tExit = (maxBound - origin) / step;
        if (tEnter > tExit) {
          float swap = tEnter;
          tEnter = tExit;
          tExit = swap;
        }
        tMin = max(tMin, tEnter);
        tMax = min(tMax, tExit);
        if (tMin > tMax) return false;
      }
    }
    return tMin >= 0.0 && tMin <= 1.0;
  }

  bool hitsTrunk(vec2 from, vec2 to, vec3 trunk) {
    vec2 delta = to - from;
    vec2 offset = from - trunk.xy;
    float a = dot(delta, delta);
    if (a < 0.00001) return false;
    float b = 2.0 * dot(offset, delta);
    float c = dot(offset, offset) - trunk.z * trunk.z;
    float disc = b * b - 4.0 * a * c;
    if (disc < 0.0) return false;
    float t = (-b - sqrt(disc)) / (2.0 * a);
    return t >= 0.0 && t <= 1.0;
  }

  bool blocked(vec2 point) {
    vec2 delta = point - uOrigin;
    float distance = length(delta);
    if (distance <= ${SURFACE_GAP.toFixed(2)}) return false;
    vec2 end = uOrigin + delta * ((distance - ${SURFACE_GAP.toFixed(2)}) / distance);
    for (int index = 0; index < ${MAX_WALLS}; index++) {
      if (float(index) >= uWallCount) break;
      if (hitsWall(uOrigin, end, uWalls[index])) return true;
    }
    for (int index = 0; index < ${MAX_TREES}; index++) {
      if (float(index) >= uTreeCount) break;
      if (hitsTrunk(uOrigin, end, uTrees[index])) return true;
    }
    return false;
  }

  float visionFog(vec2 point) {
    vec2 delta = point - uOrigin;
    float distance = length(delta);
    if (distance < 0.001) return 0.0;
    float selfLight = 1.0 - smoothstep(uSelfRadius, uSelfRadius + 0.28, distance);
    vec2 direction = delta / distance;
    float facing = dot(direction, uForward);
    float clear = cos(uHalfAngle);
    float edge = cos(uHalfAngle + uAngleFalloff);
    float inFront = smoothstep(edge, clear, facing);
    float inRange = 1.0 - smoothstep(uRadius, uRadius + uFalloff, distance);
    float open = inFront * inRange;
    if (blocked(point)) open = 0.0;
    open = max(open, selfLight);
    return 1.0 - open;
  }

  void main() {
    float depth = texture(tDepth, vUv).r;
    float fog = 1.0;
    if (depth < 0.999) {
      vec4 clip = vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      vec4 view = uInverseProjection * clip;
      view /= view.w;
      vec3 world = (uInverseView * view).xyz;
      fog = visionFog(world.xz);
    }
    float shade = fog * uOpacity;
    fragColor = vec4(uFogColor * shade, shade);
  }
`

export class Fog {
  private readonly material: ShaderMaterial
  private readonly target: WebGLRenderTarget
  private readonly quadScene = new Scene()
  private readonly quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private revealed = false

  constructor() {
    if (WALLS.length > MAX_WALLS || TREES.length > MAX_TREES) {
      throw new Error('Vision shader cannot hold every wall and tree')
    }

    const depthTexture = new DepthTexture(1, 1)
    depthTexture.magFilter = NearestFilter
    depthTexture.minFilter = NearestFilter
    this.target = new WebGLRenderTarget(1, 1, { depthTexture, depthBuffer: true })

    const walls = WALLS.map((wall) => {
      const bounds = wallBounds(wall)
      return new Vector4(bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ)
    })
    while (walls.length < MAX_WALLS) walls.push(new Vector4())

    const trees = TREES.map((tree) => new Vector3(tree.x, tree.z, TREE_TRUNK_RADIUS))
    while (trees.length < MAX_TREES) trees.push(new Vector3())

    this.material = new ShaderMaterial({
      glslVersion: GLSL3,
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        tDepth: { value: depthTexture },
        uOrigin: { value: new Vector2() },
        uForward: { value: new Vector2(0, 1) },
        uRadius: { value: VISION_RADIUS },
        uFalloff: { value: VISION_FALLOFF },
        uHalfAngle: { value: VISION_HALF_ANGLE },
        uAngleFalloff: { value: VISION_ANGLE_FALLOFF },
        uSelfRadius: { value: VISION_SELF_RADIUS },
        uFogColor: { value: hexColor(FOG_COLOR) },
        uOpacity: { value: FOG_OPACITY },
        uInverseProjection: { value: new Matrix4() },
        uInverseView: { value: new Matrix4() },
        uWalls: { value: walls },
        uWallCount: { value: WALLS.length },
        uTrees: { value: trees },
        uTreeCount: { value: TREES.length },
      },
      vertexShader,
      fragmentShader,
    })

    this.quadScene.add(new Mesh(new PlaneGeometry(2, 2), this.material))
  }

  setSize(width: number, height: number): void {
    this.target.setSize(Math.max(1, width), Math.max(1, height))
  }

  follow(x: number, z: number, aim: number, camera: Camera): void {
    this.revealed = true
    const origin = this.material.uniforms.uOrigin?.value
    if (origin instanceof Vector2) origin.set(x, z)
    const forward = this.material.uniforms.uForward?.value
    if (forward instanceof Vector2) forward.set(Math.sin(aim), Math.cos(aim))

    camera.updateMatrixWorld()
    const inverseProjection = this.material.uniforms.uInverseProjection?.value
    const inverseView = this.material.uniforms.uInverseView?.value
    if (inverseProjection instanceof Matrix4) inverseProjection.copy(camera.projectionMatrixInverse)
    if (inverseView instanceof Matrix4) inverseView.copy(camera.matrixWorld)
  }

  render(renderer: WebGLRenderer, scene: Scene, camera: Camera): void {
    renderer.setRenderTarget(null)
    renderer.autoClear = true
    renderer.render(scene, camera)
    if (!this.revealed) return

    renderer.setRenderTarget(this.target)
    renderer.render(scene, camera)
    renderer.setRenderTarget(null)
    renderer.autoClear = false
    renderer.render(this.quadScene, this.quadCamera)
    renderer.autoClear = true
  }

  dispose(): void {
    this.target.depthTexture?.dispose()
    this.target.dispose()
    this.material.dispose()
    const quad = this.quadScene.children[0]
    if (quad instanceof Mesh) quad.geometry.dispose()
  }
}

function hexColor(hex: number): Vector3 {
  return new Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255)
}
