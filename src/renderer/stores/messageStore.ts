import { create } from 'zustand'

export type MessageType = 'info' | 'success' | 'error'

export interface MessageOptions {
  message: string
  type?: MessageType
  confirm?: boolean
  title?: string
}

interface MessageState {
  open: boolean
  message: string
  type: MessageType
  confirm: boolean
  title: string | null
  resolve: ((value: boolean) => void) | null
  showMessage: (options: MessageOptions) => Promise<boolean>
  close: (confirmed: boolean) => void
}

export const useMessageStore = create<MessageState>((set, get) => ({
  open: false,
  message: '',
  type: 'info',
  confirm: false,
  title: null,
  resolve: null,
  showMessage: (options) =>
    new Promise<boolean>((resolve) => {
      set({
        open: true,
        message: options.message,
        type: options.type ?? 'info',
        confirm: options.confirm ?? false,
        title: options.title ?? null,
        resolve
      })
    }),
  close: (confirmed) => {
    const { resolve } = get()
    resolve?.(confirmed)
    set({ open: false, resolve: null })
  }
}))

export function showMessage(options: MessageOptions): Promise<boolean> {
  return useMessageStore.getState().showMessage(options)
}
