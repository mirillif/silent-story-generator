/* =========================================================
   storyEngine.js — Silent Cinematic Cute Story Engine
   - Deterministic with injected RNG
   - Triad-locked (problem ↔ role ↔ helper ↔ props)
   - Story-type templates (15–25 scenes)
   - Rare bittersweet endings (policy controlled)
   ========================================================= */

/* =========================
   CONFIG
========================= */

export const ENDING_POLICY = {
  allowBittersweet: true,
  bittersweetChance: 0.06,          // 6% rare
  allowedTypes: ["Emotional", "Brave"]
};

// Story types → scene range + base template + friend policy
export const STORY_TYPES = {
  Emotional:  { min: 15, max: 17, template: "emotional",  allowsFriends: false },
  Funny:      { min: 15, max: 18, template: "funny",      allowsFriends: true  },
  Brave:      { min: 16, max: 20, template: "brave",      allowsFriends: false },
  Friendship: { min: 15, max: 18, template: "friendship", allowsFriends: true  },
  Adventure:  { min: 18, max: 25, template: "adventure",  allowsFriends: true  }
};

/* =========================
   BEAT TEMPLATES
   - Short base templates expanded to target scene count
   - Expansion duplicates only “middle” beats
========================= */

export const BEAT_TEMPLATES = {
  // Emotional “dad-cat” style (positive)
  emotional: [
    "opening",
    "object_focus",
    "problem_reveal",
    "emotional_pause",
    "helper_arrival",
    "comfort",
    "prep_station",
    "build_step",
    "build_step",
    "build_step",
    "test",
    "reveal",
    "reaction",
    "close"
  ],

  // Emotional bittersweet (no full fix, but comfort + acceptance)
  emotional_bittersweet: [
    "opening",
    "object_focus",
    "problem_reveal",
    "emotional_pause",
    "helper_arrival",
    "comfort",
    "prep_station",
    "try_gently",
    "try_gently",
    "accept",
    "comfort_gift",
    "soft_reframe",
    "reaction",
    "close"
  ],

  // Funny mishap (safe physical comedy)
  funny: [
    "opening",
    "cause",
    "escalation",
    "freeze",
    "helper_arrival",
    "prep_station",
    "attempt_fail",
    "pause",
    "attempt_success",
    "celebrate",
    "close"
  ],

  // Brave (safe fear → step-by-step)
  brave: [
    "opening",
    "scary_reveal",
    "hesitation",
    "helper_arrival",
    "comfort",
    "prep_station",
    "try_step",
    "try_step",
    "success",
    "reaction",
    "close"
  ],

  // Brave bittersweet (rare): comfort + plan to return
  brave_bittersweet: [
    "opening",
    "scary_reveal",
    "hesitation",
    "helper_arrival",
    "comfort",
    "prep_station",
    "try_step",
    "try_step",
    "accept",
    "plan_for_later",
    "proud_anyway",
    "close"
  ],

  // Friendship sharing/fairness
  friendship: [
    "opening",
    "social_tension",
    "problem_reveal",
    "emotional_pause",
    "helper_arrival",
    "prep_station",
    "attempt_fail",
    "pause",
    "attempt_success",
    "swap_turns",
    "celebrate",
    "close"
  ],

  // Adventure journey: mission + travel + 2–3 obstacles
  adventure: [
    "opening",
    "mission",
    "prep_station",
    "travel",
    "obstacle",
    "adjust",
    "travel",
    "obstacle",
    "adjust",
    "travel",
    "arrival",
    "success",
    "celebrate",
    "close"
  ]
};

/* =========================
   MASTER CHARACTERS (names)
   - DNA text is handled by your Prompt Compiler page
========================= */

const HERO = "Willy (Baby Golden Retriever)";
const FRIENDS_POOL = [
  "Panby (Baby Giant Panda)",
  "Quok (Baby Quokka)"
];

/* =========================
   UTILITIES
========================= */

function randIntInclusive(min, max, rng) {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  return Math.floor(rng() * (b - a + 1)) + a;
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function maybe(rng, p) {
  return rng() < p;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function safeLower(s) {
  return String(s || "").toLowerCase();
}

/* =========================
   ENDING MODE
========================= */

export function decideEndingMode(storyType, rng) {
  if (!ENDING_POLICY.allowBittersweet) return "positive";
  if (!ENDING_POLICY.allowedTypes.includes(storyType)) return "positive";
  return (rng() < ENDING_POLICY.bittersweetChance) ? "bittersweet" : "positive";
}

/* =========================
   TRIAD PICKER
   - Must match storyType
========================= */

export function pickTriad(storyType, triads, rng) {
  const allowed = triads.filter(t => (t.storyTypes || []).includes(storyType));
  if (!allowed.length) {
    throw new Error(`No TRIADS found for storyType="${storyType}". Add triads.storyTypes accordingly.`);
  }
  return pick(rng, allowed);
}

/* =========================
   FRIENDS PICKER
   - Only if allowed by story type
   - Deterministic but non-chaotic
========================= */

export function pickFriends(storyType, rng) {
  const cfg = STORY_TYPES[storyType];
  if (!cfg || !cfg.allowsFriends) return [];

  // Friendship usually wants at least one friend
  if (storyType === "Friendship") {
    return maybe(rng, 0.5) ? [...FRIENDS_POOL] : [pick(rng, FRIENDS_POOL)];
  }

  // Adventure/Funny can have 0–2 friends
  const roll = rng();
  if (roll < 0.35) return [];
  if (roll < 0.75) return [pick(rng, FRIENDS_POOL)];
  return [...FRIENDS_POOL];
}

/* =========================
   TEMPLATE CHOICE + EXPANSION
   - Expands safely to target count by duplicating middle beats
========================= */

function chooseTemplateKey(storyType, endingMode) {
  const base = STORY_TYPES[storyType]?.template;
  if (!base) throw new Error(`Unknown storyType "${storyType}".`);

  if (endingMode === "bittersweet") {
    if (storyType === "Emotional") return "emotional_bittersweet";
    if (storyType === "Brave") return "brave_bittersweet";
  }
  return base;
}

function expandBeatsToCount(beats, targetCount, storyType, rng) {
  // No expansion needed
  if (beats.length >= targetCount) return beats.slice(0, targetCount);

  const expanded = [...beats];

  // Define safe expansion slots by template type
  // Insert extra beats in the “middle” (prep/build/travel/obstacle) zone.
  const midInsertionIndex = (() => {
    // find first build/travel/obstacle/prep to insert around it
    const idx = expanded.findIndex(b => ["prep_station","build_step","travel","obstacle","adjust","try_gently","try_step"].includes(b));
    return idx === -1 ? Math.floor(expanded.length / 2) : idx;
  })();

  while (expanded.length < targetCount) {
    if (storyType === "Adventure") {
      // Prefer adding travel/obstacle/adjust variety
      const add = pick(rng, ["travel", "obstacle", "adjust", "travel"]);
      expanded.splice(midInsertionIndex + 1, 0, add);
    } else if (storyType === "Funny") {
      // Add micro-variation: pause / attempt_fail / attempt_success (but keep readable)
      const add = pick(rng, ["pause", "attempt_fail", "pause", "attempt_success"]);
      expanded.splice(midInsertionIndex + 1, 0, add);
    } else if (storyType === "Brave") {
      // Add more step-by-step tries (safe)
      const add = pick(rng, ["try_step", "hesitation", "comfort"]);
      expanded.splice(midInsertionIndex + 1, 0, add);
    } else if (storyType === "Friendship") {
      // Add turn-taking or fairness reinforcement
      const add = pick(rng, ["pause", "swap_turns", "attempt_success"]);
      expanded.splice(midInsertionIndex + 1, 0, add);
    } else {
      // Emotional: expand build montage or gentle tries
      const add = pick(rng, ["build_step", "build_step", "test", "comfort"]);
      expanded.splice(midInsertionIndex + 1, 0, add);
    }
  }

  return expanded.slice(0, targetCount);
}

/* =========================
   LOCATION/WEATHER SANITY
   - Keep this simple in the engine; your UI can supply richer catalogs
   - If you pass location/weather in options, they’ll be validated
========================= */

function isIndoorLocation(locationText) {
  const t = safeLower(locationText);
  return t.includes("indoor") || t.includes("playroom") || t.includes("workshop") || t.includes("reading nook") || t.includes("home");
}

function sanitizeWeatherForLocation(location, weather, rng) {
  // If indoor, convert to indoor-lighting weather
  if (isIndoorLocation(location)) {
    const indoorLighting = [
      "Indoor: warm window light, cozy shadows",
      "Indoor: rainy-day window glow, soft grey light",
      "Indoor: early sunbeam stripes, gentle dust motes",
      "Indoor: soft afternoon light, gentle warmth"
    ];
    return pick(rng, indoorLighting);
  }

  // Outdoor constraints: avoid snow on beach/tropical
  const loc = safeLower(location);
  const w = safeLower(weather);

  if ((loc.includes("beach") || loc.includes("tropical")) && (w.includes("snow") || w.includes("frost") || w.includes("winter"))) {
    return "Warm summer afternoon, bright sun, clear sky";
  }

  // Avoid "hot" on snowy clearing
  if ((loc.includes("snow") || loc.includes("frost")) && (w.includes("hot") || w.includes("summer"))) {
    return "Cold winter morning, pale sun, frosty air";
  }

  return weather;
}

/* =========================
   PROP / TOOL TRACK SANITY
   - Triad defines props; engine derives Prop DNA strings consistently
========================= */

function buildPropDNA(triad) {
  const obj = triad?.props?.object || "none";
  const tools = triad?.props?.tools || [];
  const vehicle = triad?.props?.vehicle || "none";

  const objectDNA = obj === "none"
    ? "OBJECT DNA: (None)"
    : `OBJECT DNA: (${obj}; toy-scale; material: soft fabric or matte plastic depending on item; exact name must be repeated verbatim.)`;

  const toolDNA = (tools.length && tools[0] !== "none")
    ? `TOOL DNA: (${tools.join(", ")}; toy-scale; no text; realistic weight; used only in still/slow interactions.)`
    : "TOOL DNA: (None)";

  const vehicleDNA = (vehicle && vehicle !== "none")
    ? `VEHICLE DNA: (${vehicle}; 28cm; matte plastic; no text; toy-scale; realistic rolling/weight.)`
    : "VEHICLE DNA: (None)";

  return { objectDNA, toolDNA, vehicleDNA };
}

/* =========================
   RENDER: Beat → Scene sentence
   - Concrete, physical, no abstract verbs
   - One readable action per scene
   - Uses triad props only
========================= */

function roleActionHint(helperRole, tools, rng) {
  // Keep actions grounded and role-specific
  const role = safeLower(helperRole);
  const toolName = tools?.length ? tools[0] : "a small tool";

  if (role.includes("medic") || role.includes("caregiver")) {
    return pick(rng, [
      "places a comfort item down once",
      "leans closer and holds still beside Willy",
      "gently covers the spot with a soft blanket once",
      "nudges a calming gesture once"
    ]);
  }
  if (role.includes("builder") || role.includes("carpenter") || role.includes("bridge")) {
    return pick(rng, [
      `sets a small support piece in place once`,
      `presses a plank down once so it lies flat`,
      `tightens a rope line once and stops`,
      `taps the structure once to test stability`
    ]);
  }
  if (role.includes("mechanic") || role.includes("model plane")) {
    return pick(rng, [
      `uses ${toolName} for one careful adjustment`,
      `aligns a small part once and holds still`,
      `tightens a tiny piece once with careful weight`,
      `tests the moving part once with a gentle spin`
    ]);
  }
  if (role.includes("delivery")) {
    return pick(rng, [
      "pulls the wagon forward once and stops",
      "repositions the package once so it sits stable",
      "points a safe route with one wing gesture",
      "parks the wagon neatly once"
    ]);
  }
  if (role.includes("friendship") || role.includes("mediator") || role.includes("play")) {
    return pick(rng, [
      "places a clear turn-taking token down once",
      "creates two equal spots side-by-side once",
      "moves the shared toy to the middle once",
      "signals a simple ‘swap’ gesture once"
    ]);
  }
  // Generic fallback
  return pick(rng, [
    `places ${toolName} down once with realistic weight`,
    "stops, looks, then makes one careful adjustment",
    "repositions a small item once and holds still"
  ]);
}

export function renderBeat(beat, ctx, rng) {
  const {
    storyType,
    hero,
    friends,
    helperAnimal,
    helperRole,
    problem,
    props,
    location,
    weather,
    endingMode
  } = ctx;

  const obj = props?.object || "none";
  const tools = props?.tools || [];
  const vehicle = props?.vehicle || "none";

  // Helper phrases (keep consistent)
  const heroRef = hero;
  const helperRef = helperAnimal;

  // Friends mention helper
  const friendLine = friends?.length ? ` ${friends.join(" and ")} is nearby.` : "";

  switch (beat) {
    case "opening":
      return `Calm opening in ${location} under ${weather}. ${heroRef} is present and still, tiny blep visible.${friendLine}`;

    case "object_focus":
      if (obj !== "none") return `${heroRef} approaches ${obj} slowly and stops with nose close (still/slow).`;
      return `${heroRef} looks around the space once, then becomes still (no words).`;

    case "mission":
      return `${heroRef} looks toward the route ahead, then back to the goal item once, showing a clear mission without words.`;

    case "cause":
      return `${heroRef} performs one playful action that starts the mishap (one motion, safe).`;

    case "escalation":
      return `Effect: the situation becomes a little sillier but stays safe, with believable physics.`;

    case "freeze":
      return `${heroRef} freezes in a funny posture; ears sit unevenly and paws stay planted (still).`;

    case "social_tension":
      if (friends?.length) return `${heroRef} and a friend reach toward the same item at once, then both stop (still).`;
      return `${heroRef} hesitates near the shared spot; posture shows uncertainty (still).`;

    case "problem_reveal":
      return `The problem becomes clearly visible: ${problem}.`;

    case "scary_reveal":
      return `A safe but scary-looking obstacle is revealed: ${problem}.`;

    case "hesitation":
      return `${heroRef} leans back slightly; tail lowers and paws pause at the edge (still).`;

    case "helper_arrival":
      return `${helperRef} arrives and stops near ${heroRef}, looking at ${heroRef} then the situation (never the camera).`;

    case "comfort":
      return `${helperRef} moves closer and performs one calming gesture, then holds still beside ${heroRef} (still/slow).`;

    case "prep_station":
      if (vehicle !== "none") {
        return `${helperRef} rolls ${vehicle} into frame and parks it neatly (one action, realistic rolling).`;
      }
      return `${helperRef} turns toward a small work area and makes one purposeful gesture (one action).`;

    case "build_step":
      return `${helperRef} ${roleActionHint(helperRole, tools, rng)} (one action, still/slow).`;

    case "test":
      return `${helperRef} tests the result gently once; the change is visible and believable (one action).`;

    case "attempt_fail":
      return `Attempt 1: ${helperRef} tries a simple solution once — it fails visibly but safely.`;

    case "pause":
      return `Reaction: everyone pauses and stares at the result (still/slow), showing confusion through posture.`;

    case "attempt_success":
      return `Attempt 2: ${helperRef} changes one thing (angle/traction/strap) once and the solution works clearly.`;

    case "adjust":
      return `${helperRef} adjusts the approach once (route/angle/traction) and stops to check stability (still/slow).`;

    case "travel":
      return `Travel beat: ${heroRef} and ${helperRef} move forward carefully; camera stays static/slow; environment stays consistent.`;

    case "obstacle":
      return `A new small obstacle appears (safe): terrain/wind/water creates one clear challenge (one action revealed).`;

    case "try_step":
      return `${heroRef} takes one careful step toward the obstacle, then stops to check footing (one action).`;

    case "success":
      return `Success: the solution works and ${problem.toLowerCase()} is resolved safely with one clear cause → effect.`;

    case "arrival":
      return `The destination comes into view; ${helperRef} slows and stops at the target spot (one action).`;

    case "swap_turns":
      return `Everyone performs one clear swap of turns: the shared item moves once from one side to the other (one action).`;

    case "celebrate":
      return `A tiny celebration: ${heroRef} does one small happy bounce while ${helperRef} makes a cute “done” motion (one action).`;

    case "reveal":
      if (obj !== "none") return `${helperRef} presents ${obj} back to ${heroRef} slowly, holding still so the exchange is readable.`;
      return `${helperRef} reveals the finished result by stepping aside once so it can be seen clearly (one action).`;

    case "reaction":
      if (endingMode === "bittersweet") {
        return `${heroRef} settles closer to ${helperRef}; tail lifts slightly in a calm, comforted way (still/slow).`;
      }
      return `${heroRef} shows joy through tail wag and soft posture, then steps closer slowly (one motion).`;

    // Bittersweet-specific beats
    case "try_gently":
      return `${helperRef} attempts one careful step toward fixing the issue (one action), but the situation does not fully change yet (safe).`;

    case "accept":
      return `${helperRef} stops and shifts closer to ${heroRef}; both become still, showing acceptance through posture (still).`;

    case "comfort_gift":
      return `${helperRef} places a small comfort item beside ${heroRef} once, then waits still (one action).`;

    case "soft_reframe":
      return `${heroRef} touches the comfort item once and relaxes beside ${helperRef}, calm even without a complete fix (still/slow).`;

    case "plan_for_later":
      return `${helperRef} points toward a safe route back with one gesture, suggesting they will return later; both turn together (one action).`;

    case "proud_anyway":
      return `${heroRef} takes one small brave step, then pauses; tail lifts slightly in quiet pride (still).`;

    case "close":
      return `Calm closing echo in ${location} under ${weather}. ${heroRef} stays near ${helperRef}, both relaxed.`;

    default:
      return `${heroRef} performs one small readable action, then becomes still (one action).`;
  }
}

/* =========================
   VALIDATOR
   - Hard gate: story must be coherent & usable without edits
========================= */

function includesAny(text, regexList) {
  return regexList.some(r => r.test(text));
}

export function validateStory(scenes, ctx) {
  const lc = scenes.map(s => safeLower(s));
  const prob = safeLower(ctx.problem || "");

  // 1) Problem must appear by early scenes
  const earlySlice = lc.slice(0, 6).join(" ");
  if (!earlySlice.includes(prob.split(" ").slice(0, 4).join(" "))) {
    // fallback: any partial
    if (!earlySlice.includes(prob.slice(0, Math.min(18, prob.length)))) return false;
  }

  // 2) Ending check depends on endingMode
  const tail = lc.slice(-5).join(" ");
  if (ctx.endingMode === "positive") {
    if (!includesAny(tail, [/success/i, /resolved/i, /works/i, /completed/i, /fixed/i, /delivered/i, /safe/i])) return false;
  } else {
    if (!includesAny(tail, [/comfort/i, /accept/i, /calm/i, /relax/i, /beside/i, /close/i])) return false;
  }

  // 3) Helper role-specific actions must appear at least twice
  const helper = safeLower(ctx.helperAnimal || "");
  const helperMentions = lc.filter(s => s.includes(helper)).length;
  if (helperMentions < Math.floor(ctx.sceneCount * 0.35)) {
    // helper should be present in a good portion of scenes
    return false;
  }

  // 4) One action per scene heuristic: avoid “and and and”
  // This is a soft heuristic; keep it permissive.
  const tooManyAnd = scenes.some(s => (s.match(/\sand\s/gi) || []).length >= 3);
  if (tooManyAnd) return false;

  return true;
}

/* =========================
   STORY FRAME OUTPUT BUILDER
========================= */

export function buildStoryFrame(ctx, scenes) {
  const { objectDNA, toolDNA, vehicleDNA } = buildPropDNA(ctx.triad);

  const title = ctx.title;
  const friendsLine = ctx.friends.length ? ctx.friends.join(", ") : "None";
  const objectLine = (ctx.triad?.props?.object && ctx.triad.props.object !== "none") ? ctx.triad.props.object : "None";

  const out = [];
  out.push("STORY TITLE");
  out.push(title);
  out.push("");
  out.push("STORY SETTINGS");
  out.push(`- Type: ${ctx.storyType}`);
  out.push(`- Hero: ${ctx.hero}`);
  out.push(`- Friends (optional): ${friendsLine}`);
  out.push(`- Location: ${ctx.location}`);
  out.push(`- Weather/Time: ${ctx.weather}`);
  out.push(`- Helper (animal-only): ${ctx.helperAnimal}`);
  out.push(`- Primary helper role: ${ctx.helperRole}`);
  out.push(`- Problem: ${ctx.problem}`);
  out.push(`- Object of affection: ${objectLine}`);
  out.push("");
  out.push("PROP DNA (must be repeated verbatim in prompts)");
  out.push(objectDNA);
  out.push(toolDNA);
  out.push(vehicleDNA);
  out.push("");
  out.push(`SCENES (${scenes.length})`);
  out.push(...scenes);
  out.push("");
  out.push("SOP CHECK");
  out.push("- No dialogue, no text, no subtitles, no logos");
  out.push("- One action per scene (still/slow for detailed interaction)");
  out.push("- Visible cause → effect in every scene");
  out.push("- Physics: weight, gravity, scale are believable");
  out.push("- Animals only (photoreal anatomy, natural fur, no human limbs)");
  out.push("- Calm closing echo of opening");

  return out.join("\n");
}

/* =========================
   TITLE BUILDER
========================= */

function buildTitle(ctx, rng) {
  const hooks = [
    "and the Little Problem That Became a Big Smile",
    "and the Tiny Fix That Felt Like a Hug",
    "and the Brave Step on a Small Day",
    "and the Helpful Friend Who Came Quietly",
    "and the Silly Mishap That Turned Sweet"
  ];

  const typeNoun =
    ctx.storyType === "Adventure"  ? "Little Adventure" :
    ctx.storyType === "Friendship" ? "Happy Teamwork" :
    ctx.storyType === "Funny"      ? "Silly Rescue" :
    ctx.storyType === "Brave"      ? "Brave Moment" :
                                    "Gentle Care";

  const hook = pick(rng, hooks);

  // Keep title short but specific; mention problem in a compact way
  const prob = ctx.problem.toLowerCase();
  const shortProb = prob.length > 52 ? prob.slice(0, 49) + "…" : prob;

  return `Willy & Friends: ${typeNoun} — ${hook} — ${shortProb}`;
}

/* =========================
   MAIN API: generateStoryFrame()
   - You call this from UI
   - Returns complete story text (ready to paste into compiler)
========================= */

export function generateStoryFrame(options, triads, rng) {
  const storyType = options?.storyType || "Adventure";
  const cfg = STORY_TYPES[storyType];
  if (!cfg) throw new Error(`Unknown storyType "${storyType}"`);

  // Decide ending mode
  const endingMode = decideEndingMode(storyType, rng);

  // Choose triad
  const triad = pickTriad(storyType, triads, rng);

  // Choose helper animal from triad
  const helperAnimal = pick(rng, triad.allowedHelpers || []);
  const helperRole = triad.helperRole;

  // Friends
  const friends = options?.friends ?? pickFriends(storyType, rng);

  // Scene count (variable)
  const sceneCount = randIntInclusive(cfg.min, cfg.max, rng);

  // Location/weather:
  // If user provides them, validate; else fall back to safe defaults.
  const location = options?.location || "Park meadow — soft grass, big tree, distant hills";
  const weatherRaw = options?.weather || "Spring morning, soft sunlight, mild breeze";
  const weather = sanitizeWeatherForLocation(location, weatherRaw, rng);

  // Choose template + expand
  const templateKey = chooseTemplateKey(storyType, endingMode);
  const baseBeats = BEAT_TEMPLATES[templateKey];
  if (!baseBeats) throw new Error(`Missing template "${templateKey}"`);

  const beats = expandBeatsToCount(baseBeats, sceneCount, storyType, rng);

  // Context used by renderer
  const ctx = {
    storyType,
    endingMode,
    sceneCount,
    triad,
    hero: HERO,
    friends,
    helperAnimal,
    helperRole,
    problem: triad.problem,
    props: triad.props,
    location,
    weather,
    title: "" // set below
  };

  ctx.title = buildTitle(ctx, rng);

  // Render scenes
  const scenes = beats.map((b, i) => `Scene ${i + 1}: ${renderBeat(b, ctx, rng)}`);

  // Validate
  // Retry by re-rolling triad a few times if something is off.
  // (Engine is designed so it should pass nearly always.)
  let passes = validateStory(scenes, ctx);
  let attempts = 0;

  while (!passes && attempts < 3) {
    attempts++;
    ctx.triad = pickTriad(storyType, triads, rng);
    ctx.problem = ctx.triad.problem;
    ctx.props = ctx.triad.props;
    ctx.helperRole = ctx.triad.helperRole;
    ctx.helperAnimal = pick(rng, ctx.triad.allowedHelpers || []);
    ctx.title = buildTitle(ctx, rng);

    const scenes2 = beats.map((b, i) => `Scene ${i + 1}: ${renderBeat(b, ctx, rng)}`);
    if (validateStory(scenes2, ctx)) {
      return buildStoryFrame(ctx, scenes2);
    }
  }

  // If still failing, return last attempt anyway (should be extremely rare),
  // but you can also throw here if you prefer strict.
  return buildStoryFrame(ctx, scenes);
}
