/* =========================================================================
   NORBERT, UNFINISHED  --  gl3d.js
   A very small WebGL2 renderer, written for exactly one material: clay.

   No library. The whole thing is two programs' worth of GLSL, a unit sphere,
   a unit capsule, and an instance batcher. Everything you see in 3D -- every
   character, every limb, every eye -- is one of those two primitives with a
   matrix and a colour, plus one static mesh per level for the ground.

   The clay comes from the shader:
     - low-frequency sine lumps displace the surface, with the normal
       corrected by the surface gradient, so nothing is ever a true sphere
     - higher-frequency value noise perturbs the normal for pressed
       thumbprints and tool marks
     - lighting is wrapped diffuse (clay is soft and translucent at the
       edges), a warm key, a tinted ambient, and a broad matte specular
     - BOIL: the lump phase is driven by Clay.frame, so the models simmer at
       twelve frames a second exactly like the 2D renderer
   ========================================================================= */

const GL3 = {
  gl: null, ok: false,
  canvas: null,
  prog: null,
  meshes: {},
  _inst: null, _instBuf: null, _n: 0, _cap: 0,
  _batches: new Map(),
  W: 1, H: 1,
};

/* ---- tiny matrix helpers (column-major, like GL wants) ----------------- */

function m4identity(o) {
  o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0;
  o[4] = 0; o[5] = 1; o[6] = 0; o[7] = 0;
  o[8] = 0; o[9] = 0; o[10] = 1; o[11] = 0;
  o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1;
  return o;
}
function m4mul(o, a, b) {
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    o[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    o[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    o[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    o[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return o;
}
function m4perspective(o, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  m4identity(o);
  o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf;
  o[11] = -1; o[14] = 2 * far * near * nf; o[15] = 0;
  return o;
}
function m4lookAt(o, ex, ey, ez, cx, cy, cz) {
  let zx = ex - cx, zy = ey - cy, zz = ez - cz;
  let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
  /* x = normalize(cross(up, z)) with up = +Y */
  let xx = zz, xy = 0, xz = -zx;
  l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
  /* y = cross(z, x) */
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
  o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
  o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
  o[12] = -(xx * ex + xy * ey + xz * ez);
  o[13] = -(yx * ex + yy * ey + yz * ez);
  o[14] = -(zx * ex + zy * ey + zz * ez);
  o[15] = 1;
  return o;
}

/* model matrix from position, non-uniform scale, and a Z then Y rotation --
   which is all this game's rigs ever need */
function m4trs(o, x, y, z, sx, sy, sz, rz, ry) {
  const cz = Math.cos(rz || 0), sz2 = Math.sin(rz || 0);
  const cy = Math.cos(ry || 0), sy2 = Math.sin(ry || 0);
  /* R = Ry * Rz */
  const r00 = cy * cz, r01 = -cy * sz2, r02 = sy2;
  const r10 = sz2, r11 = cz, r12 = 0;
  const r20 = -sy2 * cz, r21 = sy2 * sz2, r22 = cy;
  o[0] = r00 * sx; o[1] = r10 * sx; o[2] = r20 * sx; o[3] = 0;
  o[4] = r01 * sy; o[5] = r11 * sy; o[6] = r21 * sy; o[7] = 0;
  o[8] = r02 * sz; o[9] = r12 * sz; o[10] = r22 * sz; o[11] = 0;
  o[12] = x; o[13] = y; o[14] = z; o[15] = 1;
  return o;
}

/* ---- shaders ----------------------------------------------------------- */

const CLAY_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in float aTone;
layout(location=3) in vec4 aM0;
layout(location=4) in vec4 aM1;
layout(location=5) in vec4 aM2;
layout(location=6) in vec4 aM3;
layout(location=7) in vec4 aColSeed;
layout(location=8) in vec4 aParams;   // wob, boil, gloss, ao

uniform mat4 uViewProj;

out vec3 vN;
out vec3 vWorld;
out vec3 vObj;
out vec3 vCol;
out vec4 vParams;
out float vTone;

/* the same harmonic lumping the 2D renderer uses, in three dimensions */
float lump(vec3 p, float seed, float boil) {
  return 0.50 * sin(p.x * 2.10 + seed * 1.7 + boil)
       + 0.34 * sin(p.y * 2.70 + seed * 3.1)
       + 0.26 * sin(p.z * 3.30 + seed * 5.3 + boil * 0.7)
       + 0.16 * sin((p.x + p.y) * 4.10 + seed * 7.7);
}
vec3 lumpGrad(vec3 p, float seed, float boil) {
  return vec3(
    2.10 * 0.50 * cos(p.x * 2.10 + seed * 1.7 + boil) + 4.10 * 0.16 * cos((p.x + p.y) * 4.10 + seed * 7.7),
    2.70 * 0.34 * cos(p.y * 2.70 + seed * 3.1)        + 4.10 * 0.16 * cos((p.x + p.y) * 4.10 + seed * 7.7),
    3.30 * 0.26 * cos(p.z * 3.30 + seed * 5.3 + boil * 0.7)
  );
}

void main() {
  mat4 M = mat4(aM0, aM1, aM2, aM3);
  float wob = aParams.x;
  float boil = aParams.y;
  float seed = aColSeed.w;

  vec3 p = aPos;
  vec3 n = aNrm;
  if (wob > 0.0001) {
    float d = lump(aPos, seed, boil) * wob;
    p += n * d;
    vec3 g = lumpGrad(aPos, seed, boil) * wob;
    n = normalize(n - (g - dot(g, n) * n));
  }

  vec4 wp = M * vec4(p, 1.0);
  /* the rigs only ever rotate and scale, so this inverse-transpose is enough */
  mat3 nm = mat3(M);
  nm[0] /= max(1e-5, dot(nm[0], nm[0]));
  nm[1] /= max(1e-5, dot(nm[1], nm[1]));
  nm[2] /= max(1e-5, dot(nm[2], nm[2]));

  vN = normalize(nm * n);
  vWorld = wp.xyz;
  vObj = aPos;
  vCol = aColSeed.rgb;
  vParams = aParams;
  vTone = aTone;
  gl_Position = uViewProj * wp;
}`;

const CLAY_FS = `#version 300 es
precision highp float;

in vec3 vN;
in vec3 vWorld;
in vec3 vObj;
in vec3 vCol;
in vec4 vParams;      // wob, boil, gloss, ao
in float vTone;

uniform vec3 uKey;        // key light colour
uniform vec3 uAmb;        // ambient / bounce colour
uniform vec3 uLightDir;   // towards the light
uniform vec3 uEye;
uniform float uBoil;
uniform float uDetail;    // 0 = drop the expensive surface noise

out vec4 frag;

float h31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i + vec3(0,0,0)), h31(i + vec3(1,0,0)), f.x),
                 mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x),
                 mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}

void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uEye - vWorld);
  float gloss = vParams.z;

  /* thumbprints and tool marks: perturb the normal with object-space noise.
     Fired things (Steve, Glaze) skip this -- they are smooth, and that is
     the whole point of them. */
  if (uDetail > 0.5 && gloss < 0.5) {
    float s = 0.20;
    vec3 q = vObj * 0.42 + vec3(0.0, 0.0, uBoil * 0.02);
    float n0 = vnoise(q);
    float nx = vnoise(q + vec3(0.35, 0.0, 0.0));
    float ny = vnoise(q + vec3(0.0, 0.35, 0.0));
    float nz = vnoise(q + vec3(0.0, 0.0, 0.35));
    N = normalize(N + vec3(nx - n0, ny - n0, nz - n0) * s * 3.0);
    /* a second, finer pass: the grain of the clay itself */
    float m0 = vnoise(vObj * 1.9);
    float mx = vnoise(vObj * 1.9 + vec3(0.5, 0.0, 0.0));
    float my = vnoise(vObj * 1.9 + vec3(0.0, 0.5, 0.0));
    N = normalize(N + vec3(mx - m0, my - m0, 0.0) * 0.35);
  }

  /* wrapped diffuse -- clay does not fall to black at the terminator */
  float ndl = dot(N, uLightDir);
  float wrap = clamp((ndl + 0.45) / 1.45, 0.0, 1.0);
  vec3 base = vCol * (1.0 + vTone);

  vec3 col = base * uKey * pow(wrap, 1.25);

  /* ambient, stronger from above, tinted with the room */
  float sky = N.y * 0.5 + 0.5;
  col += base * uAmb * mix(0.55, 1.25, sky);

  /* the light that scatters through the thin edges of a lump of clay */
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.6);
  col += base * uKey * rim * 0.30 * (0.4 + 0.6 * clamp(ndl, 0.0, 1.0));

  /* matte highlight; glazed surfaces get a tight bright one instead */
  vec3 H = normalize(uLightDir + V);
  float sp = pow(clamp(dot(N, H), 0.0, 1.0), mix(14.0, 90.0, gloss));
  col += uKey * sp * mix(0.10, 0.85, gloss);

  col *= mix(1.0, 0.62, vParams.w);      /* baked contact occlusion */

  /* the table recedes into the room's own shadow colour */
  float depth = clamp((-vWorld.z) / 300.0, 0.0, 1.0);
  col = mix(col, uAmb * 0.85, depth * 0.40);

  /* a soft shoulder instead of a hard clip: the top surfaces catch a lot of
     light and clay never goes to paper white */
  col = pow(1.0 - exp(-col * 1.34), vec3(0.92));
  /* the shoulder washes the colour out; put it back. Terracotta has to stay
     terracotta or none of this was worth doing. */
  col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.26);

  frag = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

/* ---- meshes ------------------------------------------------------------ */

function buildSphere(seg, rings) {
  const pos = [], nrm = [], idx = [];
  for (let r = 0; r <= rings; r++) {
    const v = r / rings, phi = v * Math.PI;
    const sp = Math.sin(phi), cp = Math.cos(phi);
    for (let s = 0; s <= seg; s++) {
      const u = s / seg, th = u * TAU;
      const x = sp * Math.cos(th), y = cp, z = sp * Math.sin(th);
      pos.push(x, y, z); nrm.push(x, y, z);
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < seg; s++) {
      const a = r * (seg + 1) + s, b = a + seg + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { pos, nrm, idx };
}

/* A capsule: a cylinder of radius 1 spanning y in [-1, 1] with hemispherical
   caps on each end, so it reaches y = +/-2. Every limb, noodle, neck, twig,
   twig-leg and pipe cleaner in the game is one of these, squashed. */
function buildCapsule(seg, caps) {
  const pos = [], nrm = [], idx = [];
  const rows = [];
  /* top cap: y from +2 down to +1 */
  for (let c = 0; c <= caps; c++) {
    const a = (Math.PI / 2) * (1 - c / caps);
    rows.push({ y: 1 + Math.sin(a), r: Math.cos(a), ny: Math.sin(a) });
  }
  /* bottom cap: y from -1 down to -2 */
  for (let c = 0; c <= caps; c++) {
    const a = -(Math.PI / 2) * (c / caps);
    rows.push({ y: -1 + Math.sin(a), r: Math.cos(a), ny: Math.sin(a) });
  }
  for (const row of rows) {
    for (let s2 = 0; s2 <= seg; s2++) {
      const th = (s2 / seg) * TAU;
      const cx = Math.cos(th), cz = Math.sin(th);
      pos.push(cx * row.r, row.y, cz * row.r);
      nrm.push(cx * row.r, row.ny, cz * row.r);
    }
  }
  for (let r = 0; r < rows.length - 1; r++) {
    for (let s2 = 0; s2 < seg; s2++) {
      const a = r * (seg + 1) + s2, b = a + seg + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { pos, nrm, idx };
}

/* ---- context ----------------------------------------------------------- */

GL3.init = function (canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: true, antialias: true, depth: true,
    premultipliedAlpha: true, powerPreference: 'high-performance',
  });
  if (!gl) return false;
  GL3.gl = gl; GL3.canvas = canvas;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, CLAY_VS);
  const fs = compile(gl.FRAGMENT_SHADER, CLAY_FS);
  if (!vs || !fs) return false;
  const p = gl.createProgram();
  gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(p));
    return false;
  }
  GL3.prog = p;
  GL3.u = {
    viewProj: gl.getUniformLocation(p, 'uViewProj'),
    key: gl.getUniformLocation(p, 'uKey'),
    amb: gl.getUniformLocation(p, 'uAmb'),
    lightDir: gl.getUniformLocation(p, 'uLightDir'),
    eye: gl.getUniformLocation(p, 'uEye'),
    boil: gl.getUniformLocation(p, 'uBoil'),
    detail: gl.getUniformLocation(p, 'uDetail'),
  };

  GL3.meshes.blob = GL3.upload(buildSphere(20, 14));
  GL3.meshes.blobLo = GL3.upload(buildSphere(12, 8));
  GL3.meshes.tube = GL3.upload(buildCapsule(14, 5));

  GL3._cap = 4096;
  GL3._inst = new Float32Array(GL3._cap * 24);
  GL3._instBuf = gl.createBuffer();

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  GL3.ok = true;
  return true;
};

GL3.upload = function (m) {
  const gl = GL3.gl;
  const n = m.pos.length / 3;
  const inter = new Float32Array(n * 7);
  const tone = m.tone || null;
  for (let i = 0; i < n; i++) {
    inter[i * 7] = m.pos[i * 3];
    inter[i * 7 + 1] = m.pos[i * 3 + 1];
    inter[i * 7 + 2] = m.pos[i * 3 + 2];
    inter[i * 7 + 3] = m.nrm[i * 3];
    inter[i * 7 + 4] = m.nrm[i * 3 + 1];
    inter[i * 7 + 5] = m.nrm[i * 3 + 2];
    inter[i * 7 + 6] = tone ? tone[i] : 0;
  }
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);
  const ibo = gl.createBuffer();
  const Idx = n > 65535 ? Uint32Array : Uint16Array;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Idx(m.idx), gl.STATIC_DRAW);
  return { vbo, ibo, count: m.idx.length, type: n > 65535 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
};

GL3.dispose = function (mesh) {
  if (!mesh || !GL3.gl) return;
  GL3.gl.deleteBuffer(mesh.vbo);
  GL3.gl.deleteBuffer(mesh.ibo);
};

/* ---- per-frame batching ------------------------------------------------ */

GL3.begin = function (cam, light) {
  GL3._batches.clear();
  GL3._n = 0;
  GL3.cam = cam;
  GL3.light = light;
};

const _tmpM = new Float32Array(16);

/* Queue one lump. Everything in the game funnels through here. */
GL3.push = function (mesh, x, y, z, sx, sy, sz, rz, ry, color, seed, wob, gloss, ao) {
  let arr = GL3._batches.get(mesh);
  if (!arr) { arr = []; GL3._batches.set(mesh, arr); }
  m4trs(_tmpM, x, y, z, sx, sy, sz, rz, ry);
  const c = hex2rgb(color);
  arr.push(
    _tmpM[0], _tmpM[1], _tmpM[2], _tmpM[3],
    _tmpM[4], _tmpM[5], _tmpM[6], _tmpM[7],
    _tmpM[8], _tmpM[9], _tmpM[10], _tmpM[11],
    _tmpM[12], _tmpM[13], _tmpM[14], _tmpM[15],
    c.r / 255, c.g / 255, c.b / 255, seed || 0,
    wob === undefined ? 0.10 : wob, GL3.boil || 0, gloss || 0, ao || 0
  );
};

GL3.flush = function () {
  const gl = GL3.gl, p = GL3.prog;
  gl.useProgram(p);

  const cam = GL3.cam;
  gl.uniformMatrix4fv(GL3.u.viewProj, false, cam.viewProj);
  gl.uniform3fv(GL3.u.key, GL3.light.key);
  gl.uniform3fv(GL3.u.amb, GL3.light.amb);
  gl.uniform3fv(GL3.u.lightDir, GL3.light.dir);
  gl.uniform3f(GL3.u.eye, cam.ex, cam.ey, cam.ez);
  gl.uniform1f(GL3.u.boil, GL3.boil || 0);
  gl.uniform1f(GL3.u.detail, Clay.quality ? 1 : 0);

  for (const [mesh, data] of GL3._batches) {
    const count = data.length / 24;
    if (!count) continue;
    if (count * 24 > GL3._inst.length) GL3._inst = new Float32Array(count * 24 * 2);
    GL3._inst.set(data);

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 24);
    gl.vertexAttribDivisor(0, 0); gl.vertexAttribDivisor(1, 0); gl.vertexAttribDivisor(2, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, GL3._instBuf);
    gl.bufferData(gl.ARRAY_BUFFER, GL3._inst.subarray(0, count * 24), gl.DYNAMIC_DRAW);
    for (let i = 0; i < 6; i++) {
      const loc = 3 + i;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 96, i * 16);
      gl.vertexAttribDivisor(loc, 1);
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
    gl.drawElementsInstanced(gl.TRIANGLES, mesh.count, mesh.type, 0, count);
  }
};

/* a static mesh (the terrain) drawn as a single instance */
GL3.drawStatic = function (mesh, color, ao) {
  if (!mesh) return;
  const gl = GL3.gl;
  GL3.push(mesh, 0, 0, 0, 1, 1, 1, 0, 0, color, 3, 0, 0, ao || 0);
};

GL3.resize = function (w, h) {
  const c = GL3.canvas;
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  GL3.W = w; GL3.H = h;
  GL3.gl.viewport(0, 0, w, h);
};

GL3.clear = function () {
  const gl = GL3.gl;
  gl.clearColor(0, 0, 0, 0);
  gl.depthMask(true);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
};
