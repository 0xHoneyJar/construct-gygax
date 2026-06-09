import { defineConfig } from 'vocs/config'

export default defineConfig({
  title: 'Gygax',
  description:
    'Game systems analyst — design, balance, and stress-test mechanics across 20 game traditions with persistent game-state, scenario-based playtesting, and intent-aware analysis.',
  iconUrl: undefined,
  ogImageUrl: undefined,
  rootDir: '.',
  sidebar: [
    {
      text: 'Welcome',
      items: [
        { text: 'Introduction', link: '/' },
        { text: 'Getting Started', link: '/getting-started' },
        { text: 'Philosophy', link: '/philosophy' },
      ],
    },
    {
      text: 'Core Concepts',
      items: [
        { text: 'Game-State', link: '/concepts/game-state' },
        { text: 'The Grimoire', link: '/concepts/grimoire' },
        { text: 'Designer Intent', link: '/concepts/designer-intent' },
        { text: 'Game Traditions', link: '/concepts/traditions' },
        { text: 'Probability Scripts', link: '/concepts/probability-scripts' },
        { text: 'Code-Grounding', link: '/concepts/code-grounding' },
        { text: 'Engine Tuning', link: '/concepts/engine-tuning' },
        { text: 'Agent Incentives', link: '/concepts/agent-incentives' },
      ],
    },
    {
      text: 'Commands',
      items: [
        { text: '/gygax — Status', link: '/commands/gygax' },
        { text: '/attune — Ingest', link: '/commands/attune' },
        { text: '/homebrew — Design', link: '/commands/homebrew' },
        { text: '/augury — Math', link: '/commands/augury' },
        { text: '/cabal — Playtest', link: '/commands/cabal' },
        { text: '/lore — Heuristics', link: '/commands/lore' },
        { text: '/scry — Forks', link: '/commands/scry' },
        { text: '/delve — Dungeons', link: '/commands/delve' },
      ],
    },
    {
      text: 'Identity',
      items: [
        { text: 'Persona & Voice', link: '/identity/persona' },
        { text: 'Refusals', link: '/identity/refusals' },
        { text: 'Expertise & Boundaries', link: '/identity/expertise' },
      ],
    },
    {
      text: 'Reference',
      items: [
        { text: 'Cabal Archetypes', link: '/reference/archetypes' },
        { text: 'Augury Layers', link: '/reference/augury-layers' },
        { text: 'Delve Frameworks', link: '/reference/delve-frameworks' },
        { text: 'Composition', link: '/reference/composition' },
      ],
    },
  ],
  socials: [
    {
      icon: 'github',
      link: 'https://github.com/0xHoneyJar/construct-gygax',
    },
  ],
  editLink: {
    pattern:
      'https://github.com/0xHoneyJar/construct-gygax/edit/main/src/pages/:path',
    text: 'Edit this page on GitHub',
  },
})
