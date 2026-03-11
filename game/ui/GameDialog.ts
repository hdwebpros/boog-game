/**
 * Simple in-game dialog system using HTML DOM elements overlaid on the Phaser canvas.
 * Replaces window.prompt/alert/confirm with styled dialogs that match the game aesthetic.
 */

/** Show a prompt dialog overlaid on the game canvas. Returns the entered text, or null if cancelled. */
export function gamePrompt(title: string, defaultValue = ''): Promise<string | null> {
  return new Promise((resolve) => {
    // Find the game canvas to position relative to
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
    const parent = canvas?.parentElement ?? document.body

    // Overlay backdrop
    const overlay = document.createElement('div')
    Object.assign(overlay.style, {
      position: 'absolute',
      top: '0', left: '0', width: '100%', height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '9999',
      fontFamily: 'monospace',
    })

    // Dialog box
    const dialog = document.createElement('div')
    Object.assign(dialog.style, {
      background: '#111133',
      border: '2px solid #4444aa',
      borderRadius: '4px',
      padding: '16px 20px',
      minWidth: '250px',
      maxWidth: '350px',
      color: '#cccccc',
      fontSize: '14px',
    })

    // Title
    const label = document.createElement('div')
    label.textContent = title
    Object.assign(label.style, {
      color: '#00ffff',
      marginBottom: '10px',
      fontSize: '14px',
    })
    dialog.appendChild(label)

    // Input
    const input = document.createElement('input')
    input.type = 'text'
    input.value = defaultValue
    Object.assign(input.style, {
      width: '100%',
      boxSizing: 'border-box',
      background: '#0a0a1a',
      border: '1px solid #4444aa',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '14px',
      padding: '6px 8px',
      borderRadius: '2px',
      outline: 'none',
    })
    dialog.appendChild(input)

    // Buttons row
    const btnRow = document.createElement('div')
    Object.assign(btnRow.style, {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '8px',
      marginTop: '12px',
    })

    const makeBtn = (text: string, color: string) => {
      const btn = document.createElement('button')
      btn.textContent = text
      Object.assign(btn.style, {
        background: 'none',
        border: `1px solid ${color}`,
        color,
        fontFamily: 'monospace',
        fontSize: '13px',
        padding: '4px 12px',
        cursor: 'pointer',
        borderRadius: '2px',
      })
      btn.addEventListener('mouseenter', () => { btn.style.color = '#ffffff'; btn.style.borderColor = '#ffffff' })
      btn.addEventListener('mouseleave', () => { btn.style.color = color; btn.style.borderColor = color })
      return btn
    }

    const cancelBtn = makeBtn('Cancel', '#888888')
    const okBtn = makeBtn('OK', '#00ff88')
    btnRow.appendChild(cancelBtn)
    btnRow.appendChild(okBtn)
    dialog.appendChild(btnRow)
    overlay.appendChild(dialog)

    let resolved = false
    const cleanup = () => { overlay.remove() }
    const submit = () => { if (resolved) return; resolved = true; cleanup(); resolve(input.value) }
    const cancel = () => { if (resolved) return; resolved = true; cleanup(); resolve(null) }

    okBtn.addEventListener('click', submit)
    cancelBtn.addEventListener('click', cancel)
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cancel() })
    input.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Enter') submit()
      if (e.key === 'Escape') cancel()
    })

    // Prevent game input from firing while dialog is open
    overlay.addEventListener('keydown', (e) => e.stopPropagation())
    overlay.addEventListener('keyup', (e) => e.stopPropagation())
    overlay.addEventListener('mousedown', (e) => e.stopPropagation())
    overlay.addEventListener('mouseup', (e) => e.stopPropagation())
    overlay.addEventListener('pointerdown', (e) => e.stopPropagation())
    overlay.addEventListener('pointerup', (e) => e.stopPropagation())

    parent.style.position = 'relative'
    parent.appendChild(overlay)
    input.focus()
    input.select()
  })
}
