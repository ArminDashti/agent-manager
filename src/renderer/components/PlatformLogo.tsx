import { useEffect, useState } from 'react'
import { cn } from '@renderer/lib/utils'
import { PLATFORM_LABELS, type PlatformId } from '@shared/types'

interface PlatformLogoProps {
  platformId: PlatformId | string
  size?: number
  className?: string
}

export function PlatformLogo({ platformId, size = 24, className }: PlatformLogoProps) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    window.agentManager.getLogoPath(platformId).then((path) => {
      if (path) setSrc(`file://${path.replace(/\\/g, '/')}`)
    })
  }, [platformId])

  const label = PLATFORM_LABELS[platformId as PlatformId] ?? platformId

  if (src) {
    return (
      <img
        src={src}
        alt={label}
        width={size}
        height={size}
        className={cn('rounded object-contain', className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-200',
        className
      )}
      style={{ width: size, height: size }}
    >
      {label.slice(0, 2).toUpperCase()}
    </div>
  )
}
