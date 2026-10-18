import { defineConfig, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [presetWind3({ preflight: false })],
  rules: [
    ['surface-elevation', { 'box-shadow': 'var(--card-shadow)' }],
    ['panel-elevation', { 'box-shadow': 'var(--panel-shadow)' }],
  ],
  theme: {
    colors: {
      text: 'var(--text)',
      strong: 'var(--text-strong)',
      muted: 'var(--muted)',
      subtle: 'var(--subtle)',
      surface: 'var(--surface)',
      soft: 'var(--surface-soft)',
      hover: 'var(--surface-hover)',
      border: 'var(--border)',
      accent: 'var(--accent)',
      'accent-text': 'var(--accent-text)',
      'accent-bg': 'var(--accent-bg)',
      'accent-border': 'var(--accent-border)',
      track: 'var(--track)',
    },
  },
  shortcuts: {
    'tray-app':
      'relative grid w-full h-full overflow-hidden gap-3 p-[17px_18px_13px] border border-border rounded-[22px] text-text panel-elevation',
    'app-header': 'flex items-center gap-3 min-w-0',
    'app-logo': 'grid place-items-center flex-none w-12 h-12 rounded-[13px] text-white',
    'device-heading': 'flex-1 min-w-0',
    'device-name':
      'mt-0 mb-[3px] overflow-hidden text-ellipsis whitespace-nowrap text-[20px] leading-[1.2] font-700 tracking-[-0.025em]',
    'device-subtitle':
      'm-0 overflow-hidden text-ellipsis whitespace-nowrap text-subtle text-[11px]',
    'device-picker':
      'block w-full h-[25px] mb-[3px] pr-5 overflow-hidden border-0 bg-transparent text-text text-ellipsis whitespace-nowrap text-[20px] leading-[1.2] font-700 cursor-pointer',
    'header-icon':
      'grid place-items-center flex-none w-[43px] h-[43px] p-0 border-0 rounded-full bg-surface text-text hover:bg-hover',
    'tab-bar':
      'relative grid grid-cols-3 gap-[5px] p-[5px] border border-border rounded-[15px] bg-surface',
    'tab-item':
      'relative flex items-center justify-center gap-2 min-w-0 border-0 rounded-[11px] bg-transparent text-muted text-[11px] font-600 whitespace-nowrap',
    'settings-bar':
      'flex items-center gap-[9px] p-[5px_8px] border border-border rounded-[15px] bg-surface text-strong text-[13px] surface-elevation',
    'settings-back':
      'grid place-items-center w-[38px] h-[38px] p-0 border-0 rounded-[10px] bg-soft text-text hover:bg-hover',
    'page-content': 'flex flex-col gap-[11px] min-h-0 mx-[-9px] px-[9px] overflow-hidden',
    'page-view': 'flex flex-1 flex-col gap-[11px] min-h-0',
    'monitor-preview': 'flex flex-col items-center justify-center flex-none h-[191px] pt-1',
    'monitor-screen':
      'flex flex-col items-center justify-center w-[min(70%,296px)] aspect-[16/9] border-[5px] border-[#090909] rounded-[12px] text-white',
    'monitor-size': 'text-[27px] tracking-[-0.04em]',
    'monitor-mode': 'mt-[5px] text-[#c0aca0] text-[11px]',
    'monitor-stem': 'w-[34px] h-[15px]',
    'monitor-foot': 'w-[120px] h-[5px] rounded-[6px] bg-[#343638]',
    'signal-line':
      'flex items-center justify-between flex-none h-5 px-[5px] text-subtle text-[11px] font-600',
    'signal-label': 'flex items-center gap-[7px]',
    'signal-dot': 'w-[6px] h-[6px] rounded-full bg-accent',
    'signal-connection': 'text-accent-text font-600',
    card: 'relative flex-none min-w-0 p-[15px_16px] overflow-hidden border border-border rounded-[15px] surface-elevation',
    'card-title': 'flex items-center gap-2 min-w-0 text-muted text-[13px]',
    'card-value': 'text-text text-[24px] leading-none font-700',
    'card-note': 'mt-[6px] mb-0 text-subtle text-[11px] leading-[1.45]',
    'input-card': 'min-h-[80px]',
    'slider-card': 'min-h-[105px]',
    'slider-row': 'grid grid-cols-[29px_minmax(0,1fr)_29px] items-center gap-[9px] mt-[10px]',
    'slider-step':
      'grid place-items-center w-[29px] h-[29px] p-0 border-0 rounded-full bg-soft text-strong hover:bg-hover',
    'section-caption':
      'flex items-center justify-between flex-none h-[22px] px-[2px] text-muted text-[12px] font-650',
    'compact-card': 'p-[14px_15px]',
    'choice-grid': 'grid gap-[7px] mt-[11px]',
    'choice-option':
      'min-w-0 h-9 px-1 overflow-hidden border border-transparent rounded-[9px] bg-soft text-strong text-ellipsis whitespace-nowrap text-[11px] font-600 hover:bg-hover',
    'topology-grid': 'grid-cols-4',
    'theme-grid': 'grid-cols-3',
    'rate-grid': 'grid-cols-4 auto-rows-[34px]',
    'toggle-card': 'flex items-center justify-between min-h-[57px]',
    switch: 'relative flex-none w-[37px] h-[21px] ml-2',
    'refresh-card': 'min-h-[119px]',
    'resolution-card': 'flex flex-col min-h-0 flex-1',
    'resolution-list':
      'grid auto-rows-[38px] content-start flex-1 min-h-0 mt-[9px] overflow-x-hidden overflow-y-auto overscroll-contain',
    'resolution-option':
      'flex items-center gap-[5px] w-full min-h-0 px-[10px] border-0 rounded-[7px] bg-transparent text-strong text-[12px] font-600 text-left hover:bg-hover',
    pager:
      'flex items-center justify-center gap-[11px] flex-none h-[27px] mt-[5px] text-subtle text-[10px]',
    'pager-button':
      'grid place-items-center w-[25px] h-6 p-0 border-0 rounded-[6px] bg-soft text-strong hover:bg-hover',
    'scale-note': 'flex items-center gap-[6px] min-h-[28px] text-subtle text-[10px]',
    'button-row': 'flex gap-2 min-w-0',
    'dialog-button':
      'inline-flex items-center justify-center gap-[5px] flex-1 min-w-0 h-[35px] px-2 border-0 rounded-[9px] bg-soft text-strong whitespace-nowrap text-[11px] font-600 hover:bg-hover',
    'primary-action':
      'inline-flex items-center justify-center gap-[5px] flex-1 min-w-0 h-[35px] px-2 border-0 rounded-[9px] bg-accent text-white whitespace-nowrap text-[11px] font-600 hover:brightness-110',
    'empty-state':
      'flex flex-1 flex-col items-center justify-center gap-[9px] text-subtle text-center',
    'empty-title': 'm-0 text-strong text-[17px]',
    'empty-message': 'mt-0 mb-3 text-[12px]',
    'status-footer': 'flex items-center gap-[7px] min-w-0 text-subtle text-[10px]',
    'status-indicator': 'w-[7px] h-[7px] flex-none rounded-full bg-[#22b961]',
    'status-label': 'flex-1 overflow-hidden text-ellipsis whitespace-nowrap',
    'status-refresh':
      'grid place-items-center w-[25px] h-[25px] p-0 border-0 rounded-[7px] bg-transparent text-subtle hover:bg-hover hover:text-text',
    'status-error':
      'absolute left-[17px] right-[17px] bottom-[46px] z-8 p-[9px_11px] overflow-hidden border rounded-2 text-ellipsis whitespace-nowrap text-[10px]',
    'confirm-overlay': 'absolute inset-0 z-20 grid place-items-center p-[25px] bg-black/70',
    'confirm-card': 'w-full p-6 border border-border rounded-[17px] bg-surface text-center',
    'confirm-icon':
      'inline-grid place-items-center w-12 h-12 rounded-[14px] bg-accent-bg text-accent-text',
    'confirm-title': 'mt-[15px] mb-[7px] text-[18px]',
    'confirm-description': 'mt-0 mb-[22px] text-muted text-[12px] leading-[1.6]',
    'scene-grid': 'grid grid-cols-4 gap-2 mt-[11px]',
    'scene-option':
      'flex flex-col items-center justify-center gap-[6px] min-w-0 h-[69px] p-[6px_2px] border border-transparent rounded-[11px] bg-soft text-strong text-[12px] font-650 hover:bg-hover',
    'source-control':
      'flex items-center gap-[5px] text-muted text-[10px] whitespace-nowrap cursor-pointer',
    'input-source-options':
      'grid grid-cols-[repeat(auto-fit,minmax(76px,1fr))] gap-[7px] mt-[10px]',
    'source-option':
      'flex items-center justify-center gap-1 min-w-0 h-[34px] px-[7px] border border-transparent rounded-[9px] bg-soft text-strong text-[11px] font-600 hover:bg-hover',
    'settings-description': 'm-0 text-muted text-[11px] leading-[1.6]',
  },
})
