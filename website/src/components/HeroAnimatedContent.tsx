import { motion } from 'framer-motion'

import { TextBlurIn } from './effects/TextBlurIn'
import { TextFade } from './effects/TextFade'
import TextSlot from './effects/TextSlot'
import { ZoomInBounce } from './effects/ZoomInBounce'

function HeroAnimatedContent() {
  return (
    <>
      <ZoomInBounce>
        <img
          src="/app-icon.png"
          alt="AICompress logo"
          className="w-30 h-auto block  mx-auto!"
        />
      </ZoomInBounce>
      <TextBlurIn className="badge">✨ 100% Free & Open Source</TextBlurIn>
      <h1 style={{ visibility: 'hidden', fontSize: '0' }}>
        Compress any video/image
      </h1>
      <h1>
        <motion.span layoutId="item">Compress any </motion.span>
        <TextSlot
          texts={[
            'mp4',
            'png',
            'mov',
            'jpg',
            'avi',
            'jpeg',
            'mkv',
            'webp',
            'webm',
            'gif',
            'svg',
          ]}
          mainClassName="inline-block md:min-w-[250px] mx-auto text-center flex justify-center"
          staggerFrom={'first'}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '-120%' }}
          staggerDuration={0.025}
          splitLevelClassName="overflow-hidden pb-0.5 sm:pb-1 md:pb-1"
          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          rotationInterval={2000}
        />
        <br />
      </h1>
      <TextFade direction="down" className="subtitle">
        <p className="gradient-text title mb-5!">Completely private</p>
      </TextFade>
    </>
  )
}

export default HeroAnimatedContent
