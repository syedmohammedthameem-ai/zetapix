import { createFileRoute } from '@tanstack/react-router'

import Layout from '@/components/Layout'
import Setting from './ui/app-settings/Setting'
import Workstation from './ui/Workstation'

export const Route = createFileRoute('/(root)/')({
  component: Root,
})

function Root() {
  return (
    <Layout containerProps={{ className: 'relative' }}>
      <Workstation />
      <Setting />
    </Layout>
  )
}

export default Root
