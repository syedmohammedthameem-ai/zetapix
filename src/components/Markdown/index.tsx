import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import Link from '@/tauri/components/Link'
import { cn } from '@/utils/tailwind'

interface MarkdownProps {
  content: string
  className?: string
}

function Markdown({ content, className = '' }: MarkdownProps) {
  return (
    <div
      className={cn(
        'prose prose-sm prose-zinc dark:prose-invert max-w-none',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => <Link href={href!}>{children}</Link>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default React.memo(Markdown)
