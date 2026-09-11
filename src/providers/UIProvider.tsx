import { HeroUIProvider } from '@heroui/react'
import React from 'react'
import { ClassNameValue } from 'tailwind-merge'

import { cn } from '@/utils/tailwind'

function UIProvider({
  children,
  className,
}: {
  children: React.ReactNode
  className?: ClassNameValue
}) {
  return (
    <HeroUIProvider
      id="main"
      // vaul-drawer-wrapper="" is required here for scaling effect for drawer effect. See @/components/Drawer
      vaul-drawer-wrapper=""
      className={cn('w-full h-full bg-white1 dark:bg-black1', className)}
    >
      {children}
    </HeroUIProvider>
  )
}

export default UIProvider
