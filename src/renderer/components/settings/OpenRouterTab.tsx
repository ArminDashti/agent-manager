import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/types'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'

interface OpenRouterTabProps {
  settings: AppSettings
  onChange: (settings: AppSettings) => void
}

export function OpenRouterTab({ settings, onChange }: OpenRouterTabProps) {
  const { loadSettings } = useAppStore()
  const [apiKey, setApiKey] = useState(settings.openRouter?.apiKey ?? '')
  const [model, setModel] = useState(settings.openRouter?.model ?? 'openai/gpt-4o-mini')

  useEffect(() => {
    setApiKey(settings.openRouter?.apiKey ?? '')
    setModel(settings.openRouter?.model ?? 'openai/gpt-4o-mini')
  }, [settings])

  const saveOpenRouter = async () => {
    const confirmed = await showMessage({
      message: 'Save OpenRouter settings?',
      confirm: true
    })
    if (!confirmed) return

    const next: AppSettings = {
      ...settings,
      openRouter: {
        apiKey: apiKey.trim(),
        model: model.trim() || 'openai/gpt-4o-mini'
      }
    }
    await window.agentManager.saveSettings(next)
    onChange(next)
    await loadSettings()
    await showMessage({ message: 'OpenRouter settings saved', type: 'success' })
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-400 uppercase">OpenRouter</h3>
        <p className="text-xs text-zinc-500">
          Used by Refactor by OpenRouter on Skills, Rules, Hooks, and Sub-agents. Get a key at{' '}
          <span className="text-zinc-400">openrouter.ai</span>.
        </p>
      </section>

      <section className="space-y-3">
        <label className="text-sm text-zinc-400 block">API token</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-or-…"
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
        />
      </section>

      <section className="space-y-3">
        <label className="text-sm text-zinc-400 block">Model</label>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="openai/gpt-4o-mini"
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
        />
        <p className="text-xs text-zinc-500">
          OpenRouter model id, e.g. openai/gpt-4o-mini or anthropic/claude-sonnet-4
        </p>
      </section>

      <button
        type="button"
        onClick={() => void saveOpenRouter()}
        className="px-4 py-2 text-sm bg-emerald-700 rounded"
      >
        Save OpenRouter settings
      </button>
    </div>
  )
}
