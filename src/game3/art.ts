// Vite builds each game with a relative base so this also works under
// GitHub Pages at /Game/v3/ as well as the local dev server.
const ACT_ONE_ART_ROOT = 'arts/v3-act1'

// These are the illustrations currently checked into public/arts/v3-act1.
// Keep this mapping separate from the event copy so new art can be added
// without changing the event deck or authored text.
const EVENT_ART: Record<string, string> = {
  'challenge-1': `${ACT_ONE_ART_ROOT}/challenge-1.jpg`,
  oath: `${ACT_ONE_ART_ROOT}/oath.jpg`,
  station: `${ACT_ONE_ART_ROOT}/station.jpg`,
  't-banner': `${ACT_ONE_ART_ROOT}/t-banner.jpg`,
  't-children': `${ACT_ONE_ART_ROOT}/t-children.jpg`,
  't-deserters': `${ACT_ONE_ART_ROOT}/t-deserters.jpg`,
  't-diviner': `${ACT_ONE_ART_ROOT}/t-diviner.jpg`,
  't-feud': `${ACT_ONE_ART_ROOT}/t-feud.jpg`,
  't-granary': `${ACT_ONE_ART_ROOT}/t-granary.jpg`,
  't-lotus': `${ACT_ONE_ART_ROOT}/t-lotus.jpg`,
  't-physician': `${ACT_ONE_ART_ROOT}/t-physician.jpg`,
  't-river': `${ACT_ONE_ART_ROOT}/t-river.jpg`,
  't-salt': `${ACT_ONE_ART_ROOT}/t-salt.jpg`,
  't-scholar': `${ACT_ONE_ART_ROOT}/t-scholar.jpg`,
  't-smith': `${ACT_ONE_ART_ROOT}/t-smith.jpg`,
  't-snow': `${ACT_ONE_ART_ROOT}/t-snow.jpg`,
  't-spoils': `${ACT_ONE_ART_ROOT}/t-spoils.jpg`,
  't-teller': `${ACT_ONE_ART_ROOT}/t-teller.jpg`,
  't-temple': `${ACT_ONE_ART_ROOT}/t-temple.jpg`,
  't-veteran': `${ACT_ONE_ART_ROOT}/t-veteran.jpg`,
  't-warrant': `${ACT_ONE_ART_ROOT}/t-warrant.jpg`,
}

export const artForEvent = (eventId: string) => EVENT_ART[eventId]
