import Divider from '@/components/Divider'
import Metadata from './Metadata'
import Subtitles from './Subtitles'

type OthersProps = {
  mediaIndex: number
}

function Others({ mediaIndex }: OthersProps) {
  return (
    <div>
      <Subtitles mediaIndex={mediaIndex} />
      <Divider className="my-3" />
      <Metadata mediaIndex={mediaIndex} />
    </div>
  )
}

export default Others
