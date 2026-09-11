import Icon from '@/components/Icon'
import Image from '@/components/Image'
import Title from '@/components/Title'

function About() {
  return (
    <section className="px-4 py-10 w-full">
      <section className="mb-2">
        <Title title="About" iconProps={{ name: 'info' }} />
      </section>
      <section>
        <div className="z-10 flex justify-center items-center flex-col">
          <Image
            disableAnimation
            src="/logo.png"
            alt="logo"
            width={80}
            height={80}
          />
          <h2 className="block text-3xl font-bold text-primary">AICompress</h2>
        </div>
        <p className="text-center italic text-gray-600 dark:text-gray-400 text-sm my-1">
          Private, quality-first media compression on your own device.
        </p>
        <p className="self-end text-zinc-600 dark:text-zinc-400 ml-2 text-lg font-bold text-center">
          v{window.__appVersion ?? ''}
        </p>
      </section>
      <section className="mt-8">
        <div className="text-sm text-center text-gray-600 dark:text-gray-400 flex-col flex items-center justify-center my-4">
          <Icon
            name="github"
            size={25}
            className="text-gray-800 dark:text-gray-200 mb-1"
          />
          <span>Free and open-source software</span>
          <span className="text-xs">Licensed under AGPL-3.0-only</span>
          <span className="text-xs">
            See LICENSE and NOTICE in the distribution.
          </span>
        </div>
      </section>
    </section>
  )
}

export default About
