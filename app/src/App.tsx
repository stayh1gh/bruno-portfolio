import { useCallback, useEffect, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { Nav, type Panel } from './components/nav'
import { Story } from './components/story'
import { Work } from './components/work'
import { Footer } from './components/footer'
import { Overlay } from './components/overlay'
import { About } from './components/about'
import { OtherWork } from './components/other-work'
import { SoundToggle } from './components/sound-toggle'
import { Cursor } from './components/cursor'
import { SpaceBackdrop } from './components/space-backdrop'
import { startSmoothScroll } from './lib/smooth-scroll'

export default function App() {
  const [panel, setPanel] = useState<Panel>(null)
  const close = useCallback(() => setPanel(null), [])
  useEffect(startSmoothScroll, [])

  return (
    <MotionConfig reducedMotion="user">
      <Nav panel={panel} setPanel={setPanel} />
      {/* The space painting spans everything in this wrapper, top to bottom. */}
      <div className="relative">
        <SpaceBackdrop />
        <main id="top">
          <Story />
          <Work />
        </main>
        <Footer />
      </div>
      <Overlay open={panel !== null} label={panel === 'other' ? 'Other work' : 'About'} onClose={close}>
        {(scrollRef) => (panel === 'other' ? <OtherWork /> : <About scrollRef={scrollRef} />)}
      </Overlay>
      <SoundToggle />
      <Cursor />
    </MotionConfig>
  )
}
