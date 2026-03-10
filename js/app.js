/* ═══════════════════════════════════════════════════════════════
   SKYGLOBAL — scroll-driven 3D globe
   video-to-website skill pattern
═══════════════════════════════════════════════════════════════ */

// ─── DOM REFS ─────────────────────────────────────────────────
var loaderEl  = document.getElementById('loader');
var loaderBar = document.getElementById('loader-bar');
var loaderPct = document.getElementById('loader-percent');

// ─── AIRPLANE FRAME GLOBALS ───────────────────────────────────
var airplaneCanvas = null;
var airplaneCtx    = null;
var airplaneFrames = [];
var AIRPLANE_TOTAL = 50;
var lenisInst = null;

// ─── REACH FRAME GLOBALS ──────────────────────────────────────
var reachCanvas = null;
var reachCtx    = null;
var reachFrames = [];
var REACH_TOTAL = 70;

// ─── GLOBE GLOBALS ────────────────────────────────────────────
var renderer      = null;
var scene         = null;
var camera        = null;
var globeGroup    = null;
var globeMesh     = null;
var atmMat        = null;
var uniDotGroup   = null;
var agentDotGroup = null;
var lineGroup     = null;
var autoRotY      = 0;
var LERP          = 0.04;

// ─── UNIVERSITY CARD TRACKING ─────────────────────────────────
var currentUniIdx = -1;

// ─── NETWORK PIN TIMING ────────────────────────────────────────
var NET_PIN = 0.40; // recalculated dynamically by calcNetPin()
var UNI_BREAKS = [0, 0.30, 0.475, 0.65, 0.825, 1.0]; // Silla 30%, 나머지 17.5% 균등

// ─── CACHED NETWORK DOM ELEMENTS ───────────────────────────────
var networkCards  = [];
var netListItems  = [];

// ─── GLOBE STATE DEFINITIONS ──────────────────────────────────
var GLOBE_STATES = {
  hero:    { cameraZ: 2.8, tiltX: 0,    rotSpeed: 0.001,  atmIntensity: 0.7,  atmR: 0.29, atmG: 0.48, atmB: 0.78, showUni: false, showAgent: false, showLines: false },
  why:     { cameraZ: 2.2, tiltX: 0.18, rotSpeed: 0.0005, atmIntensity: 1.0,  atmR: 0.78, atmG: 0.66, atmB: 0.29, showUni: false, showAgent: false, showLines: false },
  network: { cameraZ: 2.4, tiltX: 0.1,  rotSpeed: 0.0004, atmIntensity: 0.8,  atmR: 0.29, atmG: 0.48, atmB: 0.78, showUni: true,  showAgent: false, showLines: false },
  stats:   { cameraZ: 3.3, tiltX: 0,    rotSpeed: 0.0008, atmIntensity: 0.35, atmR: 0.18, atmG: 0.30, atmB: 0.50, showUni: false, showAgent: false, showLines: false },
  reach:   { cameraZ: 3.0, tiltX: 0,    rotSpeed: 0.001,  atmIntensity: 0.65, atmR: 0.29, atmG: 0.48, atmB: 0.78, showUni: false, showAgent: false, showLines: true  },
  cta:     { cameraZ: 2.7, tiltX: 0,    rotSpeed: 0.0025, atmIntensity: 1.0,  atmR: 0.78, atmG: 0.66, atmB: 0.29, showUni: false, showAgent: true,  showLines: false },
};

var targetState      = Object.assign({}, GLOBE_STATES.hero);
var currentStateName = 'hero';

// ─── LERP HELPER ─────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }

// ─── GEO HELPER ──────────────────────────────────────────────
function latLngTo3D(lat, lng, r) {
  var radius = r || 1.01;
  var phi   = (90 - lat)  * (Math.PI / 180);
  var theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
     (radius * Math.cos(phi)),
     (radius * Math.sin(phi) * Math.sin(theta))
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 1 — LOADER (runs immediately, hides after ~1.2s always)
// ═══════════════════════════════════════════════════════════════
function runLoader() {
  var progress = 0;
  var iv = setInterval(function() {
    progress += Math.random() * 20 + 10;
    if (progress >= 100) { progress = 100; clearInterval(iv); }
    loaderBar.style.width  = Math.round(progress) + '%';
    loaderPct.textContent  = Math.round(progress) + '%';
  }, 100);

  setTimeout(function() {
    clearInterval(iv);
    loaderBar.style.width = '100%';
    loaderPct.textContent = '100%';
    setTimeout(function() {
      loaderEl.classList.add('hidden');
      initScrollScene();   // start scroll after loader gone
    }, 300);
  }, 900);
}

// ═══════════════════════════════════════════════════════════════
// STEP 2 — GLOBE INIT (wrapped in try/catch — won't block loader)
// ═══════════════════════════════════════════════════════════════
function initGlobe() {
  var canvas = document.getElementById('globe-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 2.8);

  // Globe group
  globeGroup = new THREE.Group();
  scene.add(globeGroup);

  // Earth sphere (flat color — texture applied async later)
  var earthMat = new THREE.MeshPhongMaterial({
    color:     new THREE.Color(0x1a3a6b),
    specular:  new THREE.Color(0x0a1628),
    shininess: 15,
  });
  globeMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), earthMat);
  globeGroup.add(globeMesh);

  // Wireframe overlay (looks good without texture)
  globeGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(1.001, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0x23508e, wireframe: true, transparent: true, opacity: 0.09 })
  ));

  // Atmosphere glow
  var atmGeo = new THREE.SphereGeometry(1.08, 64, 64);
  atmMat = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0x4a7bc7) },
      intensity:  { value: 0.7 },
    },
    vertexShader: [
      'varying vec3 vNormal;',
      'void main(){',
      '  vNormal=normalize(normalMatrix*normal);',
      '  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);',
      '}',
    ].join(''),
    fragmentShader: [
      'uniform vec3 glowColor;',
      'uniform float intensity;',
      'varying vec3 vNormal;',
      'void main(){',
      '  float rim=1.0-dot(vNormal,vec3(0.0,0.0,1.0));',
      '  gl_FragColor=vec4(glowColor,pow(rim,3.0)*intensity);',
      '}',
    ].join(''),
    side:        THREE.FrontSide,
    blending:    THREE.AdditiveBlending,
    transparent: true,
    depthWrite:  false,
  });
  scene.add(new THREE.Mesh(atmGeo, atmMat));

  // Stars
  var sp = new Float32Array(2000 * 3);
  for (var i = 0; i < sp.length; i++) sp[i] = (Math.random() - 0.5) * 300;
  var sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xc8d8e8, size: 0.12, transparent: true, opacity: 0.25 })));

  // Lights
  scene.add(new THREE.AmbientLight(0x162745, 0.8));
  var sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(5, 3, 5);
  scene.add(sun);

  buildDots();
  buildArcs();
  startRenderLoop();
  loadTexturesAsync();
}

function buildDots() {
  var UNIS = [
    [35.15,129.06],[35.10,129.02],[37.55,127.07],[35.86,128.50],
    [37.45,126.65],[35.08,129.05],[35.18,128.57],[36.79,127.10],
    [37.60,126.97],[35.54,129.32],
  ];
  uniDotGroup = new THREE.Group();
  UNIS.forEach(function(c) {
    var p = latLngTo3D(c[0], c[1], 1.015);
    var dot = new THREE.Mesh(new THREE.SphereGeometry(0.012,8,8), new THREE.MeshBasicMaterial({color:0xc8a84b}));
    dot.position.copy(p);
    uniDotGroup.add(dot);
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(0.018,0.024,16),
      new THREE.MeshBasicMaterial({color:0xc8a84b,transparent:true,opacity:0.5,side:THREE.DoubleSide})
    );
    ring.position.copy(p); ring.lookAt(new THREE.Vector3(0,0,0));
    uniDotGroup.add(ring);
  });
  uniDotGroup.visible = false;
  globeGroup.add(uniDotGroup);

  var AGENTS = [
    [3.14,101.69],[14.06,100.59],[21.02,105.83],[-6.21,106.85],
    [12.36,1.53],[9.06,7.50],[25.20,55.27],[36.74,3.06],
    [27.47,89.64],[27.70,85.31],[23.68,90.36],[47.90,106.91],
    [55.75,37.62],[-1.29,36.82],[1.36,103.82],
  ];
  agentDotGroup = new THREE.Group();
  AGENTS.forEach(function(c) {
    var p = latLngTo3D(c[0],c[1],1.015);
    var dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.018,8,8),
      new THREE.MeshBasicMaterial({color:0xe8cc7a,transparent:true,opacity:0.9})
    );
    dot.position.copy(p); dot.userData.phase = Math.random()*Math.PI*2;
    agentDotGroup.add(dot);
  });
  agentDotGroup.visible = false;
  globeGroup.add(agentDotGroup);
}

function buildArcs() {
  var KOREA  = [37.57, 126.98];
  var DESTS  = [
    [3.14,101.69],[14.06,100.59],[21.02,105.83],[-6.21,106.85],
    [12.36,1.53],[9.06,7.50],[25.20,55.27],[36.74,3.06],
    [27.47,89.64],[27.70,85.31],[23.68,90.36],[47.90,106.91],
    [55.75,37.62],[-1.29,36.82],[1.36,103.82],
  ];
  lineGroup = new THREE.Group();
  DESTS.forEach(function(c, idx) {
    var s = latLngTo3D(KOREA[0],KOREA[1],1.01);
    var e = latLngTo3D(c[0],c[1],1.01);
    var m = new THREE.Vector3().addVectors(s,e).normalize().multiplyScalar(1.5+Math.random()*0.2);
    var curve = new THREE.CatmullRomCurve3([s,m,e]);
    var tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve,30,0.003,4,false),
      new THREE.MeshBasicMaterial({color:0x7aa9e0,transparent:true,opacity:0})
    );
    tube.userData.arcIdx = idx;
    lineGroup.add(tube);
    var trav = new THREE.Mesh(
      new THREE.SphereGeometry(0.008,6,6),
      new THREE.MeshBasicMaterial({color:0xc8a84b})
    );
    trav.userData.curve = curve;
    trav.userData.progress = Math.random();
    trav.userData.speed = 0.003+Math.random()*0.002;
    trav.visible = false;
    lineGroup.add(trav);
  });
  lineGroup.visible = false;
  globeGroup.add(lineGroup);
}

function loadTexturesAsync() {
  var tl = new THREE.TextureLoader();
  tl.load('https://raw.githubusercontent.com/turban/webgl-earth/master/images/2_no_clouds_4k.jpg', function(tex) {
    if (!globeMesh) return;
    globeMesh.material.map   = tex;
    globeMesh.material.color = new THREE.Color(0xffffff);
    globeMesh.material.needsUpdate = true;
  });
  tl.load('https://raw.githubusercontent.com/turban/webgl-earth/master/images/elev_bump_4k.jpg', function(tex) {
    if (!globeMesh) return;
    globeMesh.material.bumpMap   = tex;
    globeMesh.material.bumpScale = 0.05;
    globeMesh.material.needsUpdate = true;
  });
}

// ─── RENDER LOOP ─────────────────────────────────────────────
function startRenderLoop() {
  function tick() {
    requestAnimationFrame(tick);
    if (!globeGroup || !renderer) return;

    autoRotY += targetState.rotSpeed;
    globeGroup.rotation.y = autoRotY;
    camera.position.z = lerp(camera.position.z, targetState.cameraZ, LERP);
    globeGroup.rotation.x = lerp(globeGroup.rotation.x, targetState.tiltX, LERP);

    if (atmMat) {
      atmMat.uniforms.intensity.value = lerp(atmMat.uniforms.intensity.value, targetState.atmIntensity, LERP);
      var gc = atmMat.uniforms.glowColor.value;
      gc.r = lerp(gc.r, targetState.atmR, LERP);
      gc.g = lerp(gc.g, targetState.atmG, LERP);
      gc.b = lerp(gc.b, targetState.atmB, LERP);
    }

    if (agentDotGroup && agentDotGroup.visible) {
      agentDotGroup.children.forEach(function(d) {
        if (d.userData.phase !== undefined)
          d.scale.setScalar(1 + 0.4 * Math.sin(Date.now() * 0.002 + d.userData.phase));
      });
    }

    if (lineGroup && lineGroup.visible) {
      lineGroup.children.forEach(function(c) {
        if (c.userData.curve && c.visible) {
          c.userData.progress = (c.userData.progress + c.userData.speed) % 1;
          c.position.copy(c.userData.curve.getPoint(c.userData.progress));
        }
      });
    }

    renderer.render(scene, camera);
  }
  tick();
}

// ─── GLOBE STATE TRANSITIONS ─────────────────────────────────
function transitionGlobe(name) {
  if (currentStateName === name) return;
  currentStateName = name;
  targetState = Object.assign({}, GLOBE_STATES[name]);
  if (!globeGroup) return;

  uniDotGroup.visible   = targetState.showUni;
  agentDotGroup.visible = targetState.showAgent;

  if (targetState.showLines && !lineGroup.visible) {
    lineGroup.visible = true;
    lineGroup.children.forEach(function(c) {
      if (c.userData.arcIdx !== undefined && c.material)
        gsap.to(c.material, { opacity: 0.6, duration: 0.6, delay: c.userData.arcIdx * 0.07 });
      if (c.userData.curve) c.visible = true;
    });
  } else if (!targetState.showLines) {
    lineGroup.children.forEach(function(c) {
      if (c.material) c.material.opacity = 0;
      if (c.userData.curve) c.visible = false;
    });
    lineGroup.visible = false;
  }
}

// ═══════════════════════════════════════════════════════════════
// AIRPLANE FRAME ANIMATION
// ═══════════════════════════════════════════════════════════════
function preloadAirplaneFrames() {
  airplaneCanvas = document.getElementById('airplane-canvas');
  if (!airplaneCanvas) return;
  var dpr = Math.min(window.devicePixelRatio, 2);
  var canvasW = window.innerWidth * 0.55;
  airplaneCanvas.width  = canvasW * dpr;
  airplaneCanvas.height = window.innerHeight * dpr;
  airplaneCanvas.style.width  = canvasW + 'px';
  airplaneCanvas.style.height = window.innerHeight + 'px';
  airplaneCtx = airplaneCanvas.getContext('2d');

  for (var i = 0; i < AIRPLANE_TOTAL; i++) {
    var img = new Image();
    img.src = 'airplane jpgs/airplane movie_' + String(i).padStart(3, '0') + '.jpg';
    airplaneFrames.push(img);
  }
}

function drawAirplaneFrame(index) {
  if (!airplaneCtx || !airplaneFrames.length) return;
  var img = airplaneFrames[Math.max(0, Math.min(index, AIRPLANE_TOTAL - 1))];
  if (!img || !img.complete || !img.naturalWidth) return;
  var W = airplaneCanvas.width, H = airplaneCanvas.height;
  airplaneCtx.clearRect(0, 0, W, H);
  var IMAGE_SCALE = 0.85; // SKILL.md padded cover mode
  var scale = Math.max(W / img.naturalWidth, H / img.naturalHeight) * IMAGE_SCALE;
  var dw = img.naturalWidth  * scale;
  var dh = img.naturalHeight * scale;
  airplaneCtx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function preloadReachFrames() {
  reachCanvas = document.getElementById('reach-canvas');
  if (!reachCanvas) return;
  var dpr = Math.min(window.devicePixelRatio, 2);
  var canvasW = window.innerWidth * 0.55;
  reachCanvas.width  = canvasW * dpr;
  reachCanvas.height = window.innerHeight * dpr;
  reachCanvas.style.width  = canvasW + 'px';
  reachCanvas.style.height = window.innerHeight + 'px';
  reachCtx = reachCanvas.getContext('2d');

  for (var i = 0; i < REACH_TOTAL; i++) {
    var img = new Image();
    img.src = '005%20movie%20%232_000/005%20movie%20%232_' + String(i).padStart(3, '0') + '.jpg';
    reachFrames.push(img);
  }
}

function drawReachFrame(index) {
  if (!reachCtx || !reachFrames.length) return;
  var img = reachFrames[Math.max(0, Math.min(index, REACH_TOTAL - 1))];
  if (!img || !img.complete || !img.naturalWidth) return;
  var W = reachCanvas.width, H = reachCanvas.height;
  reachCtx.clearRect(0, 0, W, H);
  var IMAGE_SCALE = 0.85;
  var scale = Math.max(W / img.naturalWidth, H / img.naturalHeight) * IMAGE_SCALE;
  var dw = img.naturalWidth  * scale;
  var dh = img.naturalHeight * scale;
  reachCtx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

// ─── UNIVERSITY CARD CROSSFADE ────────────────────────────────
function updateActiveUniversity(newIdx) {
  if (newIdx === currentUniIdx) return;
  var prevIdx = currentUniIdx;
  currentUniIdx = newIdx;

  var cards     = document.querySelectorAll('.network-card-item');
  var listItems = document.querySelectorAll('#s-network .section-list li');

  if (prevIdx >= 0 && prevIdx < cards.length) {
    gsap.to(cards[prevIdx], { opacity: 0, duration: 0.35, ease: 'power2.in' });
  }
  if (newIdx >= 0 && newIdx < cards.length) {
    gsap.fromTo(cards[newIdx],
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', delay: 0.1 }
    );
  }

  listItems.forEach(function(li, i) {
    li.classList.toggle('active', i === newIdx);
  });
}

// ═══════════════════════════════════════════════════════════════
// STEP 3 — SCROLL SCENE (called after loader hides)
// ═══════════════════════════════════════════════════════════════
function initScrollScene() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    console.warn('GSAP not loaded — scroll animations disabled');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  preloadAirplaneFrames();
  preloadReachFrames();

  // ── Lenis (optional — degrades gracefully if missing) ───────
  if (typeof Lenis !== 'undefined') {
    lenisInst = new Lenis({ duration: 1.2, smoothWheel: true });
    lenisInst.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function(t) { lenisInst.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  // ── Nav 바로가기 (Lenis 유무 무관하게 항상 등록) ──────────────
  document.querySelectorAll('[data-scroll-to]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      var p = parseFloat(el.getAttribute('data-scroll-to'));
      var sc = document.getElementById('scroll-container');
      var targetY = sc.offsetTop + p * (sc.offsetHeight - window.innerHeight);
      if (lenisInst) {
        lenisInst.scrollTo(targetY, { duration: 1.4 });
      } else {
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      }
    });
  });

  // ── Position sections at their scroll midpoints ─────────────
  document.querySelectorAll('.scroll-section').forEach(function(s) {
    var e = parseFloat(s.dataset.enter);
    var l = parseFloat(s.dataset.leave || '100');
    s.style.top = ((e + l) / 2) + '%';
  });

  var SC                = document.getElementById('scroll-container');
  var cWrap             = document.getElementById('canvas-wrap');
  var dOver             = document.getElementById('dark-overlay');
  var hero              = document.getElementById('hero');
  var header            = document.getElementById('site-header');
  var networkCardsWrap  = document.getElementById('network-cards-wrap');
  var sNetwork          = document.getElementById('s-network');
  var networkCardsStrip = document.getElementById('network-cards-strip');

  // ── Build section animation timelines ───────────────────────
  var SECTIONS = [];
  document.querySelectorAll('.scroll-section').forEach(function(el) {
    var enter   = parseFloat(el.dataset.enter)  / 100;
    var leave   = parseFloat(el.dataset.leave || '100') / 100;
    var persist = el.dataset.persist === 'true';
    var type    = el.dataset.animation || 'fade-up';
    var kids    = el.querySelectorAll('.section-label,.section-heading,.section-body,.section-note,.section-list,.country-list,.stat,.cta-button');
    var tl      = gsap.timeline({ paused: true });
    buildTimeline(tl, type, kids);
    SECTIONS.push({ el: el, enter: enter, leave: leave, persist: persist, tl: tl, active: false });
  });

  // ── Cache network card/list DOM elements ────────────────────────
  networkCards  = Array.from(document.querySelectorAll('.network-card-item'));
  netListItems  = Array.from(document.querySelectorAll('#s-network .section-list li'));

  // ── Calculate exact scroll progress when #s-network is at viewport center ──
  function calcNetPin() {
    if (!sNetwork || !SC) return;
    var topPct = parseFloat(sNetwork.style.top) / 100; // 0.40
    var totalH = SC.offsetHeight;
    var viewH  = window.innerHeight;
    NET_PIN = (topPct * totalH - viewH / 2) / (totalH - viewH);
  }
  calcNetPin();
  window.addEventListener('resize', calcNetPin);

  // ── Master scroll driver ─────────────────────────────────────
  ScrollTrigger.create({
    trigger:  SC,
    start:    'top top',
    end:      'bottom bottom',
    scrub:    true,
    onUpdate: function(self) {
      var p = self.progress;

      // Circle-wipe reveal (0→6% scroll = 0→80% radius)
      cWrap.style.clipPath = 'circle(' + (Math.min(1, p / 0.06) * 80) + '% at 50% 50%)';

      // Dark overlay (stats 60–78%)
      var op = 0;
      if      (p >= 0.57 && p < 0.60) op = (p - 0.57) / 0.03;
      else if (p >= 0.60 && p <= 0.78) op = 0.92;
      else if (p > 0.78 && p <= 0.81) op = 0.92 * (1 - (p - 0.78) / 0.03);
      dOver.style.opacity = op;

      // Network cards (003 section)
      // NET_PIN: dynamically calculated (exact p when #s-network is at viewport center)
      var NET_LEAVE = 0.58, NET_FADE = 0.03;

      // 카드 래퍼: NET_PIN부터 fade-in, 50-53% fade-out
      var netOp = 0;
      if      (p >= NET_PIN && p < NET_PIN + NET_FADE)       netOp = (p - NET_PIN) / NET_FADE;
      else if (p >= NET_PIN + NET_FADE && p <= NET_LEAVE)    netOp = 1;
      else if (p > NET_LEAVE && p <= NET_LEAVE + NET_FADE)   netOp = 1 - (p - NET_LEAVE) / NET_FADE;
      if (networkCardsWrap) networkCardsWrap.style.opacity = netOp;

      // 오른쪽 텍스트: NET_PIN에서 정확히 핀 고정 (점프 없음), 50-53% fade-out
      if (sNetwork) {
        if (p >= NET_PIN && p <= NET_LEAVE + NET_FADE) {
          sNetwork.classList.add('is-pinned');
        } else {
          sNetwork.classList.remove('is-pinned');
        }
        sNetwork.style.opacity = (p > NET_LEAVE) ? String(netOp) : '';
      }

      // 순수 스크롤 기반 카드 opacity (GSAP 없음 → 스크롤 속도 무관하게 정확히 동기화)
      var XFADE = 0.020;
      var XFADE_SILLA = 0.038; // Silla 전용 fade-out (더 긴 전환)
      var totalRange = NET_LEAVE - NET_PIN;

      for (var i = 0; i < networkCards.length; i++) {
        var lo = NET_PIN + UNI_BREAKS[i] * totalRange;
        var hi = NET_PIN + UNI_BREAKS[i + 1] * totalRange;
        var cardOp;

        if (i === 0) {
          // 첫 카드: wrapper가 fade-in 담당, hi 이후 XFADE_SILLA로 페이드아웃
          if      (p <= hi)                  cardOp = 1;
          else if (p <= hi + XFADE_SILLA)    cardOp = 1 - (p - hi) / XFADE_SILLA;
          else                               cardOp = 0;
        } else if (i === networkCards.length - 1) {
          // 마지막 카드: lo 이전 XFADE로 페이드인, NET_LEAVE까지 유지
          if      (p < lo - XFADE)    cardOp = 0;
          else if (p < lo)            cardOp = (p - (lo - XFADE)) / XFADE;
          else                        cardOp = 1;
        } else {
          // 중간 카드: 양쪽 크로스페이드
          if      (p < lo - XFADE)    cardOp = 0;
          else if (p < lo)            cardOp = (p - (lo - XFADE)) / XFADE;
          else if (p <= hi)           cardOp = 1;
          else if (p <= hi + XFADE)   cardOp = 1 - (p - hi) / XFADE;
          else                        cardOp = 0;
        }

        if (networkCards[i]) networkCards[i].style.opacity = cardOp;
      }

      // 리스트 active: 위치 기반 (cardOp와 분리 → 정확히 1개만 active, crossfade 영향 없음)
      if (p >= NET_PIN && p < NET_LEAVE) {
        var normList = Math.min((p - NET_PIN) / totalRange, 0.9999);
        for (var j = 0; j < netListItems.length; j++) {
          netListItems[j].classList.toggle('active',
            normList >= UNI_BREAKS[j] && normList < UNI_BREAKS[j + 1]);
        }
      } else {
        for (var j = 0; j < netListItems.length; j++) {
          netListItems[j].classList.remove('active');
        }
      }

      // Airplane frames (why section: 8–28%)
      var AIR_ENTER = 0.08, AIR_LEAVE = 0.28, AIR_FADE = 0.05, AIR_FADE_OUT = 0.04;
      var airOp = 0;
      if      (p >= AIR_ENTER - AIR_FADE && p < AIR_ENTER)        airOp = (p - (AIR_ENTER - AIR_FADE)) / AIR_FADE;
      else if (p >= AIR_ENTER && p <= AIR_LEAVE)                   airOp = 1;
      else if (p > AIR_LEAVE && p <= AIR_LEAVE + AIR_FADE_OUT)     airOp = 1 - (p - AIR_LEAVE) / AIR_FADE_OUT;
      if (airplaneCanvas) airplaneCanvas.style.opacity = airOp;
      if (airOp > 0) {
        var FRAME_SPEED = 2.0;
        var normP = Math.max(0, Math.min((p - AIR_ENTER) / (AIR_LEAVE - AIR_ENTER), 1));
        var accelerated = Math.min(normP * FRAME_SPEED, 1);
        drawAirplaneFrame(Math.floor(accelerated * AIRPLANE_TOTAL));
      }

      // Reach frames (005 section: 76–92%)
      var REACH_ENTER = 0.82, REACH_LEAVE = 0.92, REACH_FADE = 0.03;
      var reachOp = 0;
      if      (p >= REACH_ENTER - REACH_FADE && p < REACH_ENTER)       reachOp = (p - (REACH_ENTER - REACH_FADE)) / REACH_FADE;
      else if (p >= REACH_ENTER && p <= REACH_LEAVE)                    reachOp = 1;
      else if (p > REACH_LEAVE && p <= REACH_LEAVE + REACH_FADE)        reachOp = 1 - (p - REACH_LEAVE) / REACH_FADE;
      if (reachCanvas) reachCanvas.style.opacity = reachOp;
      if (reachOp > 0) {
        var normR = Math.max(0, Math.min((p - REACH_ENTER) / (REACH_LEAVE - REACH_ENTER), 1));
        drawReachFrame(Math.floor(normR * REACH_TOTAL));
      }

      // Globe state
      if      (p < 0.10) transitionGlobe('hero');
      else if (p < 0.32) transitionGlobe('why');
      else if (p < 0.60) transitionGlobe('network');
      else if (p < 0.76) transitionGlobe('stats');
      else if (p < 0.92) transitionGlobe('reach');
      else               transitionGlobe('cta');

      // Marquee opacity
      document.querySelectorAll('.marquee-wrap').forEach(function(el) {
        var e = parseFloat(el.dataset.enter) / 100;
        var l = parseFloat(el.dataset.leave)  / 100;
        var F = 0.025;
        var o = 0;
        if      (p >= e - F && p < e)  o = (p - (e - F)) / F;
        else if (p >= e && p <= l)      o = 1;
        else if (p > l && p <= l + F)   o = 1 - (p - l) / F;
        el.style.opacity = o;
      });

      // Section animations
      SECTIONS.forEach(function(s) {
        var inR = (p >= s.enter && p <= s.leave);
        if (inR && !s.active) {
          s.active = true;
          s.el.classList.add('is-active');
          s.tl.play();
          if (s.el.id === 's-stats') triggerCounters(s.el);
        } else if (!inR && s.active && !s.persist) {
          s.active = false;
          s.el.classList.remove('is-active');
          s.tl.reverse();
        }
      });
    },
  });

  // Hero fades out
  ScrollTrigger.create({
    trigger:  hero,
    start:    'top top',
    end:      'bottom top',
    scrub:    true,
    onUpdate: function(self) {
      hero.style.opacity = Math.max(0, 1 - self.progress * 1.5);
    },
  });

  // Nav scrolled state
  ScrollTrigger.create({
    trigger:     SC,
    start:       'top top',
    onEnter:     function() { header.classList.add('scrolled'); },
    onLeaveBack: function() { header.classList.remove('scrolled'); },
  });

  // Marquee translation
  document.querySelectorAll('.marquee-wrap').forEach(function(el) {
    gsap.to(el.querySelector('.marquee-text'), {
      xPercent: parseFloat(el.dataset.scrollSpeed) || -25,
      ease: 'none',
      scrollTrigger: { trigger: SC, start: 'top top', end: 'bottom bottom', scrub: true },
    });
  });

  // Hero words entrance
  gsap.from('.hero-word', { y: 70, opacity: 0, stagger: 0.12, duration: 1.0, ease: 'power3.out', delay: 0.1 });
  gsap.from('.hero-tagline, .hero-eyebrow', { y: 20, opacity: 0, duration: 0.8, ease: 'power3.out', delay: 0.65 });

  // Resize handler
  window.addEventListener('resize', function() {
    if (renderer && camera) {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
    if (airplaneCanvas) {
      var dpr = Math.min(window.devicePixelRatio, 2);
      var canvasW = window.innerWidth * 0.55;
      airplaneCanvas.width  = canvasW * dpr;
      airplaneCanvas.height = window.innerHeight * dpr;
      airplaneCanvas.style.width  = canvasW + 'px';
      airplaneCanvas.style.height = window.innerHeight + 'px';
    }
    ScrollTrigger.refresh();
  }, { passive: true });
}

// ─── SECTION TIMELINE BUILDER ─────────────────────────────────
function buildTimeline(tl, type, kids) {
  var base = { stagger: 0.13, ease: 'power3.out' };
  switch (type) {
    case 'slide-left':   tl.from(kids, Object.assign({ x: -80,   opacity: 0, duration: 0.9 }, base)); break;
    case 'slide-right':  tl.from(kids, Object.assign({ x:  80,   opacity: 0, duration: 0.9 }, base)); break;
    case 'fade-up':      tl.from(kids, Object.assign({ y:  50,   opacity: 0, duration: 0.9 }, base)); break;
    case 'scale-up':     tl.from(kids, Object.assign({ scale: 0.85, opacity: 0, duration: 1.0, ease: 'power2.out' }, { stagger: 0.12 })); break;
    case 'stagger-up':   tl.from(kids, Object.assign({ y:  60,   opacity: 0, duration: 0.8, stagger: 0.18 }, { ease: 'power3.out' })); break;
    case 'clip-reveal':  tl.from(kids, { clipPath: 'inset(100% 0 0 0)', opacity: 0, stagger: 0.15, duration: 1.2, ease: 'power4.inOut' }); break;
    default:             tl.from(kids, Object.assign({ y:  30,   opacity: 0, duration: 0.8 }, base));
  }
}

// ─── COUNTER ANIMATIONS ───────────────────────────────────────
function triggerCounters(section) {
  section.querySelectorAll('.stat-number').forEach(function(el) {
    var target = parseFloat(el.dataset.value);
    var obj    = { val: 0 };
    gsap.to(obj, {
      val: target, duration: 2.2, ease: 'power1.out',
      onUpdate: function() {
        var v = Math.round(obj.val);
        el.textContent = target >= 1000 ? v.toLocaleString() : v;
      },
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// BOOT — loader first (always), globe second (in try/catch)
// ═══════════════════════════════════════════════════════════════
runLoader();   // ← runs first, unconditionally

try {
  initGlobe();
} catch (err) {
  console.error('Globe init failed:', err);
}

// ─── CTA 프로필 카드 자동 슬라이드 ───────────────────────────────
(function () {
  const panel = document.getElementById('cta-profiles-panel');
  const slides = Array.from(panel.querySelectorAll('.cta-slide'));
  const dots   = Array.from(panel.querySelectorAll('.cta-dot'));
  let current = 0;
  let timer = null;

  function goTo(idx) {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = ((idx % slides.length) + slides.length) % slides.length;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
  }

  function startTimer() {
    if (timer) return;
    timer = setInterval(() => goTo(current + 1), 2000);
  }

  function stopTimer() {
    clearInterval(timer);
    timer = null;
  }

  // Hover → pause / resume
  panel.addEventListener('mouseenter', stopTimer);
  panel.addEventListener('mouseleave', () => {
    if (document.getElementById('s-cta').classList.contains('is-active')) startTimer();
  });

  // Dot click
  dots.forEach((dot, i) => dot.addEventListener('click', () => {
    stopTimer(); goTo(i); startTimer();
  }));

  // CTA 섹션 is-active 감지 → 타이머 시작 (1회)
  const ctaSection = document.getElementById('s-cta');
  const obs = new MutationObserver(() => {
    if (ctaSection.classList.contains('is-active')) {
      startTimer();
      obs.disconnect();
    }
  });
  obs.observe(ctaSection, { attributes: true, attributeFilter: ['class'] });
})();
