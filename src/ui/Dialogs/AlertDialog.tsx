import { ButtonProps, UseDisclosureProps, useDraggable } from '@heroui/react'
import React from 'react'

import Button from '@/components/Button'
import Divider from '@/components/Divider'
import Icon from '@/components/Icon'
import Modal, {
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@/components/Modal'

type renderFooterArgs = { closeModal: UseDisclosureProps['onClose'] }

type AlertTypes = 'warning' | 'error'

type AlertDialogProps = {
  alertType?: AlertTypes
  title: React.ReactNode
  description: React.ReactNode
  disclosure: UseDisclosureProps
  renderFooter?: (_: renderFooterArgs) => React.ReactNode
  renderIcon?: () => React.ReactNode
}

const iconMapping: Record<AlertTypes, React.JSX.Element> = {
  warning: <Icon name="warning" size={70} className="text-yellow-500 mb-2" />,
  error: <Icon name="error" size={70} className="text-red-500 mb-2" />,
}

function AlertDialog({
  alertType = 'warning',
  disclosure,
  title,
  description,
  renderFooter,
  renderIcon,
}: AlertDialogProps) {
  const targetRef = React.useRef(null)
  const { moveProps } = useDraggable({
    targetRef,
    isDisabled: !disclosure.isOpen,
  })

  return (
    <Modal
      ref={targetRef}
      isOpen={disclosure?.isOpen}
      onClose={disclosure?.onClose}
    >
      <ModalContent className="relative max-w-[20rem] pb-2 overflow-hidden rounded-2xl">
        <>
          <div
            className="absolute top-0 left-0 right-0 w-full h-5"
            {...moveProps}
          />
          <ModalHeader className="flex flex-col justify-center items-center pt-1 pb-1 mt-4">
            {renderIcon?.() ?? iconMapping?.[alertType] ?? null}
            {typeof title === 'string' ? (
              <p className="text-xl text-center">{title}</p>
            ) : (
              title
            )}
          </ModalHeader>
          <ModalBody className="gap-0 px-0">
            {typeof description === 'string' ? (
              <p className="mb-2 px-6 text-sm text-center text-zinc-700 dark:text-zinc-400">
                {description}
              </p>
            ) : (
              description
            )}
            <Divider className="my-4" />
            <ModalFooter className="px-6 py-1 pb-2">
              {renderFooter?.({ closeModal: disclosure.onClose })}
            </ModalFooter>
          </ModalBody>
        </>
      </ModalContent>
    </Modal>
  )
}

export function AlertDialogButton(props: Omit<ButtonProps, 'ref'>) {
  return <Button variant="solid" fullWidth {...props} />
}

export default AlertDialog
