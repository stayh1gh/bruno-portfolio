import { useCallback, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { Nav, type Panel } from './components/nav'
import { Story } from './components/story'
import { Work } from './components/work'
import { Footer } from './components/footer'
import { Overlay } from './components/overlay'
import { About } from './components/about'
import { OtherWork } from './components/other-work'
import { SoundToggle } from './components/sound-toggle'

export default function App() {
  const [panel, setPanel] = useState<Panel>(null)
  const close = useCallback(() => setPanel(null), [])

  return (
    <MotionConfig reducedMotion="user">
      <Nav panel={panel} setPanel={setPanel} />
      <main id="top">
        <Story />
        <Work />
      </main>
      <Footer />
      <Overlay open={panel !== null} label={panel === 'other' ? 'Other work' : 'About'} onClose={close}>
        {(scrollRef) => (panel === 'other' ? <OtherWork /> : <About scrollRef={scrollRef} />)}
      </Overlay>
      <SoundToggle />
    </MotionConfig>
  )
}
