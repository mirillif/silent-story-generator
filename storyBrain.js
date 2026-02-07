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
