function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
function createStoryContract(state, rng) {
  return {
    goal: state.problem,
    lesson: pick(rng, [
      "asking for help is brave",
      "patience makes things work",
      "being careful matters",
      "friends make hard things easier",
      "trying again is okay"
    ]),
    location: state.location,
    weather: state.weather,
    timeFlow: "continuous",
    stakes: "problem remains unresolved if actions fail",
    objectOfFocus: state.useObject ? state.object : null
  };
}
function createStoryLogic(contract) {
  return [
    { id: "notice",      type: "setup",     desc: "Willy notices the problem" },
    { id: "try_alone",   type: "action",    desc: "Willy tries alone and fails" },
    { id: "emotion_low", type: "emotion",   desc: "Willy feels discouraged" },
    { id: "decision",   type: "choice",    desc: "Willy decides to seek help" },
    { id: "helper",     type: "arrival",   desc: "Helper arrives because of Willy" },
    { id: "wrong_fix",  type: "attempt",   desc: "First fix attempt fails" },
    { id: "adjust",     type: "learning",  desc: "Adjustment is made" },
    { id: "success",    type: "resolution",desc: "Problem is fixed" },
    { id: "payoff",     type: "emotion",   desc: "Emotional resolution" }
  ];
}
function createWorldState(contract) {
  return {
    location: contract.location,
    weather: contract.weather,
    objectsPresent: [
      contract.objectOfFocus,
      "problem source"
    ].filter(Boolean),
    toolsIntroduced: [],
    resolved: false
  };
}
function validateWorld(scene, world) {
  if (scene.location && scene.location !== world.location) return false;
  if (scene.weather && scene.weather !== world.weather) return false;
  return true;
}
const EMOTIONS = [
  "curious",
  "hopeful",
  "frustrated",
  "sad",
  "relieved",
  "joyful"
];

function nextEmotion(current) {
  const idx = EMOTIONS.indexOf(current);
  return EMOTIONS[Math.min(idx + 1, EMOTIONS.length - 1)];
}
