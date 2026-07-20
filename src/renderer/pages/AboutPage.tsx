import { useEffect, useState } from 'react'

export function AboutPage() {
  const [logoSrc, setLogoSrc] = useState<string | null>(null)

  useEffect(() => {
    window.agentManager.getBrandingPath('janus-logo').then((path) => {
      if (path) setLogoSrc(`file://${path.replace(/\\/g, '/')}`)
    })
  }, [])

  return (
    <div className="p-8 max-w-lg space-y-4">
      {logoSrc ? (
        <img src={logoSrc} alt="Janus" className="h-12 object-contain object-left" />
      ) : (
        <h2 className="text-2xl font-semibold">Janus</h2>
      )}
      <p className="text-zinc-400">Version 1.0.0</p>
      <p className="text-sm text-zinc-500 leading-relaxed">
        Manage Skills, Rules, MCPs, Hooks, Sub-agents, and Tools across Cursor, Cline, Kilo,
        Antigravity, Devin, and Kiro. Local-first editing with Hub catalog and personal Repo Bank
        backup.
      </p>
      <p className="text-sm text-zinc-500">
        Hub:{' '}
        <a
          href="https://armindashti.github.com/agent-manager-hub"
          className="text-blue-400 hover:underline"
          onClick={(e) => e.preventDefault()}
        >
          armindashti.github.com/agent-manager-hub
        </a>
      </p>
      <p className="text-xs text-zinc-600">MIT License · Armin Dashti</p>
    </div>
  )
}
