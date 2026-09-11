import Metadata from './Metadata'

type OthersProps = {
  mediaIndex: number
}

function Others({ mediaIndex }: OthersProps) {
  return (
    <div>
      <Metadata mediaIndex={mediaIndex} />
    </div>
  )
}

export default Others
