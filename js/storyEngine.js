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

/* ======================
   BEAT TEMPLATES — CINEMATIC PHASED TRAM (15–25)
   This replaces the old “generic beats” logic.
====================== */

// A “beat” is a scene-intent token, not prose.
// Renderer converts beats -> your Scene 1..N text lines.
const PHASES = [
  "OPENING",
  "GOAL_FOCUS",
  "CAUSE_START",
  "EFFECT_PROBLEM",
  "REACTION_LOW",
  "HELPER_ARRIVAL",
  "HELPER_INTENT",
  "TOOLS_ENTER",
  "ATTEMPT_1",
  "REACTION_PAUSE",
  "ATTEMPT_2",
  "SUCCESS",
  "JOY",
  "CALM_ECHO",
];

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

// Only these “filler” beats may be duplicated when sceneCount > base.
// They are cinematic and preserve logic.
const EXPANDABLE_BEATS = [
  "TRAVEL",
  "PROGRESS",
  "OBSTACLE_SMALL",
  "ADJUSTMENT_MICRO",
  "SHOW_WORK",
];

// Base tram (15 scenes). For 20/25 we expand with safe filler.
const BASE_TRAM_15 = [
  "OPENING",
  "GOAL_FOCUS",
  "CAUSE_START",
  "EFFECT_PROBLEM",
  "REACTION_LOW",
  "HELPER_ARRIVAL",
  "HELPER_INTENT",
  "TOOLS_ENTER",
  "ATTEMPT_1",
  "REACTION_PAUSE",
  "ATTEMPT_2",
  "SUCCESS",
  "JOY",
  "CALM_ECHO",
  "EXTRA_CUTE",
];

// For 20/25 we insert extra beats *between* TOOLS_ENTER and SUCCESS
// so story stays coherent (more “work” and “progress”).
function expandTram(base, targetCount, rng) {
  const beats = [...base];
  const baseCount = beats.length;
  if (targetCount <= baseCount) return beats.slice(0, targetCount);

  const extraNeeded = targetCount - baseCount;

  // Insert extras after TOOLS_ENTER and before ATTEMPT_1 / ATTEMPT_2.
  const insertZoneStart = beats.indexOf("TOOLS_ENTER") + 1;
  const insertZoneEnd = beats.indexOf("ATTEMPT_1"); // insert before Attempt 1

  for (let k = 0; k < extraNeeded; k++) {
    const b = pick(rng, EXPANDABLE_BEATS);
    const pos = clamp(
      insertZoneStart + Math.floor(rng() * Math.max(1, (insertZoneEnd - insertZoneStart))),
      insertZoneStart,
      insertZoneEnd
    );
    beats.splice(pos, 0, b);
  }

  return beats;
}

function buildCinematicTram(storyType, sceneCount, rng) {
  // storyType affects how many “work/progress” beats appear later
  const target = clamp(sceneCount || 15, 15, 25);

  // Start with 15-base then expand
  const beats = expandTram(BASE_TRAM_15, target, rng);

  // Ensure required beats exist in correct order
  enforceOrder(beats, "EFFECT_PROBLEM", "REACTION_LOW");
  enforceOrder(beats, "REACTION_LOW", "HELPER_ARRIVAL");
  enforceOrder(beats, "HELPER_ARRIVAL", "ATTEMPT_1");
  enforceOrder(beats, "ATTEMPT_1", "ATTEMPT_2");
  enforceOrder(beats, "ATTEMPT_2", "SUCCESS");
  enforceOrder(beats, "SUCCESS", "JOY");
  enforceOrder(beats, "JOY", "CALM_ECHO");

  return beats;
}

function enforceOrder(arr, a, b) {
  const ia = arr.indexOf(a);
  const ib = arr.indexOf(b);
  if (ia === -1 || ib === -1) return;
  if (ia < ib) return;

  // If wrong order, swap the first occurrence positions
  const tmp = arr[ia];
  arr[ia] = arr[ib];
  arr[ib] = tmp;
}

// Helper: map storyType -> tone hints (used by renderer)
function toneHints(storyType) {
  switch ((storyType || "").toLowerCase()) {
    case "emotional": return { endingMode: "soft", tempo: "slow", friends: false };
    case "brave": return { endingMode: "positive", tempo: "steady", friends: false };
    case "funny": return { endingMode: "positive", tempo: "playful", friends: true };
    case "friendship": return { endingMode: "soft", tempo: "steady", friends: true };
    case "adventure": return { endingMode: "positive", tempo: "cinematic", friends: true };
    default: return { endingMode: "positive", tempo: "steady", friends: true };
  }
}

/* ======================
   RENDERER — BEAT → SCENE LINE
   These lines are the “Story Tram” output, not prompts.
====================== */

function renderBeat(beat, ctx, rng, idx) {
  const H = ctx.hero;
  const F = (ctx.friends && ctx.friends.length) ? ctx.friends : [];
  const helper = ctx.helperAnimal;
  const role = ctx.helperRole;
  const loc = ctx.location;
  const w = ctx.weather;
  const obj = ctx.objectOfAffection || "the small goal item";
  const prob = ctx.problem;

  // One-action verbs to keep scenes readable
  const oneMove = [
    "takes one small step forward (one motion)",
    "turns its head once (one motion)",
    "leans closer once (one motion)",
    "backs up slightly (one motion)",
    "pads forward slowly (one motion)",
  ];

  // Work verbs: physical, grounded
  const workMoves = [
    "places the tool down carefully (one action)",
    "aligns the object once (one action)",
    "tests the fit gently (one action)",
    "adjusts the angle once (one action)",
    "tightens or secures one point (one action)",
  ];

  // Small obstacles: safe + cute
  const smallObstacles = [
    "a tiny wobble makes the setup drift (safe)",
    "the surface is slightly slippery (safe)",
    "a gust/breeze nudges it off-line (safe)",
    "a small gap is just a bit too wide (safe)",
    "the strap/bridge is a little too short (safe)",
  ];

  switch (beat) {
    case "OPENING":
      return `Calm opening in ${loc} under ${w}. ${H} is present near ${obj}, tiny blep visible.`;
    case "GOAL_FOCUS":
      return `${H} looks from the surroundings back to ${obj}, showing a clear mission without words (still/slow).`;
    case "CAUSE_START":
      return `Cause: ${H} starts moving with purpose toward the goal area (one clear motion).`;
    case "EFFECT_PROBLEM":
      return `Effect: ${prob} becomes clearly visible with believable physics (safe).`;
    case "REACTION_LOW":
      return `${H} pauses; ears and tail show worry while staring at ${obj} (one still beat).`;
    case "HELPER_ARRIVAL":
      return `${helper} arrives and stops at a respectful distance, looking at ${H} then the problem (never the camera).`;
    case "HELPER_INTENT":
      return `${helper} shows the vibe of ${role} by turning toward a small work area and making one purposeful gesture (one action).`;
    case "TOOLS_ENTER":
      // Use your prop DNA builder — you already output TOOL DNA + VEHICLE DNA.
      // Here we just reference them generically so it stays consistent.
      return `${helper} brings the toy helper cart into frame and parks it neatly (one action, realistic rolling).`;
    case "TRAVEL":
      return `Movement shot: ${helper} leads the route and ${H} follows slower; camera static or slow tracking (one motion total).`;
    case "SHOW_WORK":
      return `Close work beat: ${helper} ${pick(rng, workMoves)} with realistic weight and friction (still/slow).`;
    case "PROGRESS":
      return `Progress beat: the fix looks closer to working; ${H} watches closely, tail giving one tiny wag (still/slow).`;
    case "OBSTACLE_SMALL":
      return `Small complication: ${pick(rng, smallObstacles)}; everyone freezes for readability (still).`;
    case "ATTEMPT_1":
      return `Attempt 1: ${helper} tries a simple fix (one action) — it fails visibly but safely.`;
    case "REACTION_PAUSE":
      return `Reaction pause: both characters stare at the result (still/slow), body language shows “hmm.”`;
    case "ADJUSTMENT_MICRO":
      return `Micro-adjustment: ${helper} changes one small thing (angle/traction/support) (one action).`;
    case "ATTEMPT_2":
      return `Attempt 2: ${helper} changes one key variable (angle/route/strap/bridge plank) (one action).`;
    case "SUCCESS":
      return `Success: the adjustment works — ${prob} is resolved cleanly and safely (one readable action).`;
    case "JOY":
      return `${H} reacts with visible joy (tail wag, soft eyes, tiny blep) and steps closer slowly (one motion).`;
    case "CALM_ECHO":
      return `Calm closing echo in ${loc} under ${w}. ${H} stays near ${helper}, both relaxed.`;
    case "EXTRA_CUTE":
      return `Extra cute beat: ${H} gently taps ${obj} once as if saying “thank you,” then settles (one motion).`;
    default:
      // fallback: safe beat
      return `${H} does ${pick(rng, oneMove)} while staying focused on the mission (one motion).`;
  }
}

/* ======================
   BUILD SCENES — uses cinematic tram
====================== */

function buildScenesCinematic(ctx, storyType, sceneCount, rng) {
const scenes = buildScenesCinematic(ctx, storyType, sceneCount, rng);
  return scenes;
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
