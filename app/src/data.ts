// Content for the 2026 motion redesign. Mirrors js/data.js (career, other work, links);
// the story copy and card one-liners come from the Figma file and are placeholders
// Bruno will rewrite.

/** Story text style: b = bold, s = serif italic, a = accent colour, c = second accent colour. */
export type StoryStyle = 'b' | 's' | 'a' | 'c'
export type StorySeg = { t: string; s?: StoryStyle } | { br: true }

export const STORY: StorySeg[] = [
  { t: 'Hi, I’m ' },
  { t: 'Bruno Paradas,', s: 'b' },
  { t: ' a Design Engineer' },
  { br: true },
  { t: 'from ' },
  { t: 'Brazil.', s: 's' },
  { t: ' For eight years, I’ve built ' },
  { t: 'mobile', s: 'a' },
  { t: ' and ' },
  { t: 'web', s: 'a' },
  { br: true },
  { t: 'apps for ' },
  { t: 'B2C', s: 'c' },
  { t: ' and ' },
  { t: 'B2B', s: 'c' },
  { t: ', built ' },
  { t: 'design systems', s: 's' },
  { br: true },
  { t: 'and led multidisciplinary teams.', s: 's' },
  { br: true },
  { t: 'These days, I ' },
  { t: 'design, build and ship', s: 'a' },
  { t: ' web products.' },
  { br: true },
  { t: 'Currently working at ' },
  { t: 'Buzzfeed', s: 'a' },
  { t: ', but previously' },
  { br: true },
  { t: 'Walmart', s: 'c' },
  { t: ', ' },
  { t: 'frete.com', s: 'c' },
  { t: ', ' },
  { t: 'Loadsmart', s: 'c' },
  { t: ' and ' },
  { t: 'Jusbrasil', s: 'c' },
  { t: '.' },
]

export type Media =
  | { kind: 'video'; mp4: string; webm: string; poster: string }
  | { kind: 'image'; src: string; position?: string; bg?: string }
  | { kind: 'chomp' }

export type Project = {
  slug: string
  line: string
  client: string
  tags: string[]
  media: Media
  href?: string
}

export const PROJECTS: Project[] = [
  {
    slug: 'reflections',
    line: 'Building a design system AI agents can read',
    client: 'Reflections',
    tags: ['Design systems', 'AI', 'Front-end'],
    media: {
      kind: 'video',
      mp4: '/images/cards/walkthrough.mp4',
      webm: '/images/cards/walkthrough.webm',
      poster: '/images/cards/walkthrough-poster.jpg',
    },
    href: '/project.html?project=reflections',
  },
  {
    slug: 'chomp',
    line: 'Designing an agent workflow from Figma to PR',
    client: 'Chomp',
    tags: ['AI', 'Tools', 'Design'],
    media: { kind: 'chomp' },
  },
  {
    slug: 'gameplaywiz',
    line: 'Matching new players with pro reviewers',
    client: 'GameplayWiz',
    tags: ['UX/UI', 'Product'],
    media: { kind: 'image', src: '/images/cards/gameplaywiz.webp' },
    href: '/project.html?project=gameplaywiz',
  },
  {
    slug: 'buzzfeed-campaign',
    line: 'Turning campaign setup into one guided flow',
    client: 'BuzzFeed',
    tags: ['UX/UI', 'Design'],
    media: { kind: 'image', src: '/images/other/buzzfeed-campaign.webp', position: 'center top', bg: '#f2f5f9' },
  },
  {
    slug: 'buzzfeed-quiz',
    line: 'Rethinking how quizzes get played',
    client: 'BuzzFeed',
    tags: ['Interaction', 'UX/UI'],
    media: { kind: 'image', src: '/images/other/buzzfeed-quiz.webp' },
  },
  {
    slug: 'walmart-proseller',
    line: 'Giving pro sellers a clearer dashboard',
    client: 'Walmart Marketplace',
    tags: ['UX/UI', 'Data'],
    media: { kind: 'image', src: '/images/other/walmart-proseller.webp', position: 'center top' },
  },
]

export const FILTERS = ['All', 'AI', 'Design systems', 'UX/UI', 'Interaction'] as const

/** Work that doesn't get a card: shown in the "Other work" overlay. */
export const OTHER_WORK = [
  { title: 'Pugs rewards dashboard', src: '/images/other/pugs-rewards.webp' },
  { title: 'Nike Air Force app', src: '/images/other/nike-airforce.webp' },
  { title: 'Tribe onboarding', src: '/images/other/tribe-onboarding.webp' },
  { title: 'Music app', src: '/images/other/music-app.webp' },
  { title: 'Mentorsclub app', src: '/images/other/mentorsclub.webp' },
  { title: 'ChildFund donations', src: '/images/other/childfund.webp' },
]

export type Job = {
  company: string
  role: string
  location: string
  period: string
  logo: string
  /** SVG logos are single-colour marks: render them as a mask in the text colour. */
  mask?: boolean
  summary?: string
}

export const CAREER: Job[] = [
  {
    company: 'BuzzFeed',
    role: 'Product Designer',
    location: 'Remote (US)',
    period: '2024 — Present',
    logo: '/images/logos/buzzfeed.png',
    summary:
      'Designing the tools BuzzFeed’s teams use to build quizzes and campaigns. Shipped an AI-assisted campaign builder from Figma to production.',
  },
  { company: 'Walmart Marketplace', role: 'Product Designer', location: 'Remote (US)', period: '2024 — 2025', logo: '/images/logos/walmart.svg', mask: true },
  { company: 'MillionPugs', role: 'Product Designer', location: 'Remote (PL)', period: '2023 — 2024', logo: '/images/logos/millionpugs.svg', mask: true },
  { company: 'Tribe', role: 'Product Designer', location: 'Remote (US)', period: '2022 — 2023', logo: '/images/logos/tribe.png' },
  { company: 'Smartify', role: 'Product Designer (Contract)', location: 'Remote (UK)', period: '2022', logo: '/images/logos/smartify.svg', mask: true },
  { company: 'frete.com', role: 'Design System Manager', location: 'Remote (BR)', period: '2021 — 2022', logo: '/images/logos/frete.png' },
  { company: 'Loadsmart', role: 'Product Designer', location: 'Remote (US)', period: '2021', logo: '/images/logos/loadsmart.png' },
]

export const CONTACT_EMAIL = 'bruno.paradas1@gmail.com'
export const LINKS = {
  linkedin: 'https://www.linkedin.com/in/bruno-paradas/',
  resume: '/resume.pdf',
}
