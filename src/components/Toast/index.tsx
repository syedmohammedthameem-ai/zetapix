import { Toaster as NativeToaster, toast } from 'sonner'

import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/utils/tailwind'

type ToasterProps = React.ComponentProps<typeof NativeToaster>

export function Toaster(props: ToasterProps) {
  const { theme } = useTheme()
  return (
    <NativeToaster
      position="bottom-center"
      richColors
      theme={theme}
      {...props}
      toastOptions={{
        classNames: {
          default:
            'w-fit rounded-[3rem] px-4 py-2 flex justify-center align-center',
          ...(props?.toastOptions?.classNames ?? {}),
        },
        duration: 2500,
        ...(props?.toastOptions ?? {}),
      }}
      className={cn('flex justify-center items-center', props?.className ?? '')}
    />
  )
}

export { toast }
