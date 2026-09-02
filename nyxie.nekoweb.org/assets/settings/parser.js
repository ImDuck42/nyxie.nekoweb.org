// ==================================================================================================== //
// SETTINGS PARSER
// ==================================================================================================== //
const SETTINGS_JSON_URL   = './settings.json'
const SETTINGS_SCRIPT_SRC = document.currentScript?.src

const SETTINGS_ACCENTS = [
  'rosewater', 'flamingo', 'pink', 'mauve', 'red',      'maroon', 'peach',
  'yellow',    'green',    'teal', 'sky',   'sapphire', 'blue',   'lavender',
]

const SELECTORS = {
  settingsPage: '.settings-page',
}

let settingsElementSeq = 0
const settingsState    = {}

// ==================================================================================================== //
// unpaid HELPERS
// ==================================================================================================== //
function resolveSettingsAccent(accentName, fallbackAccent) {
  if (accentName && SETTINGS_ACCENTS.includes(accentName)) return accentName
  return fallbackAccent || 'mauve'
}

function applySettingsAccent(node, accentName, fallbackAccent) {
  const accent = resolveSettingsAccent(accentName, fallbackAccent)
  node.style.setProperty('--accent', `var(--ctp-${accent}-rgb)`)
  return accent
}

function settingsIconClass(iconName) {
  return `fas fa-${iconName || 'circle'}`
}

function nextSettingsElementId(element) {
  if (element.id) return element.id
  settingsElementSeq += 1
  return element.variable || `settings-element-${settingsElementSeq}`
}

function isInvisibleSpacer(element) {
  return element.id === ''
}

function applyInvisibleSpacer(wrapper, controls) {
  wrapper.classList.add('invisible')
  wrapper.setAttribute('aria-hidden', 'true')
  controls.forEach((control) => {
    if (!control) return
    control.disabled = true
    control.tabIndex = -1
  })
}

function buildNode(tag, className, ...children) {
  const node = document.createElement(tag)
  if (className) node.className = className
  children.forEach((child) => child && node.append(child))
  return node
}

function measureTextWidth(text) {
  if (!text) return 0

  const canvas  = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return 0

  context.font = '800 1.1rem sans-serif' // Same font as in da selected CSS
  return context.measureText(text).width
}

function registerSettingsVariable(variable, defaultValue) {
  if (variable === undefined) return
  settingsState[variable] = defaultValue
}

function runSettingsExecute(expression) {
  if (!expression) return

  const varNames  = Object.keys(settingsState)
  const varValues = varNames.map((name) => settingsState[name])

  try {
    const fn = new Function(...varNames, `return (${expression})`)
    fn(...varValues)
  } catch (error) {
    console.error('settings execute failed:', expression, error)
  }
}

// ==================================================================================================== //
// Bob(ELEMENT) da BUILDER(S)
// ==================================================================================================== //
function createToggleElement(element, parentAccent) {
  const invisible      = isInvisibleSpacer(element)
  const wrapper        = document.createElement('label')
  wrapper.className    = 'settings-element toggle'
  applySettingsAccent(wrapper, element.accent, parentAccent)

  const input   = document.createElement('input')
  input.type    = 'checkbox'
  input.checked = Boolean(element.default)

  if (invisible) {
    applyInvisibleSpacer(wrapper, [input])
  } else {
    input.id = nextSettingsElementId(element)
    registerSettingsVariable(element.variable, Boolean(element.default))
  }

  input.addEventListener('change', () => {
    if (invisible) return
    if (element.variable) settingsState[element.variable] = input.checked
    runSettingsExecute(element.execute)
  })

  const track = buildNode('span', 'track', buildNode('span', 'thumb'))
  wrapper.append(input, track)
  return wrapper
}

function createCheckboxElement(element, parentAccent) {
  const invisible      = isInvisibleSpacer(element)
  const wrapper        = document.createElement('label')
  wrapper.className    = 'settings-element checkbox'
  applySettingsAccent(wrapper, element.accent, parentAccent)

  const input   = document.createElement('input')
  input.type    = 'checkbox'
  input.checked = Boolean(element.default)

  if (invisible) {
    applyInvisibleSpacer(wrapper, [input])
  } else {
    input.id = nextSettingsElementId(element)
    registerSettingsVariable(element.variable, Boolean(element.default))
  }

  input.addEventListener('change', () => {
    if (invisible) return
    if (element.variable) settingsState[element.variable] = input.checked
    runSettingsExecute(element.execute)
  })

  const box = buildNode('span', 'box', buildNode('i', 'fas fa-pizza-slice')) // as per vote (1 person)
  wrapper.append(input, box)
  return wrapper
}

function createInputElement(element, parentAccent) {
  const invisible   = isInvisibleSpacer(element)
  const wrapper     = document.createElement('div')
  wrapper.className = 'settings-element'
  applySettingsAccent(wrapper, element.accent, parentAccent)

  const input     = document.createElement('input')
  input.className = 'input'
  input.type      = element.inputType || 'text'

  if (element.placeholder !== undefined) input.placeholder = element.placeholder
  if (element.min         !== undefined) input.min         = element.min
  if (element.max         !== undefined) input.max         = element.max
  if (element.step        !== undefined) input.step        = element.step
  if (element.default     !== undefined) input.value       = element.default

  if (invisible) {
    applyInvisibleSpacer(wrapper, [input])
  } else {
    input.id = nextSettingsElementId(element)
    registerSettingsVariable(element.variable, element.default)
  }

  input.addEventListener('input', () => {
    if (invisible) return
    if (element.variable) settingsState[element.variable] = input.value
    runSettingsExecute(element.execute)
  })

  wrapper.append(input)
  return wrapper
}

function createButtonElement(element, parentAccent) {
  const invisible    = isInvisibleSpacer(element)
  const button       = document.createElement('button')
  button.type        = 'button'
  button.className   = 'settings-element button'
  button.textContent = element.label || ''
  applySettingsAccent(button, element.accent, parentAccent)

  if (invisible) {
    applyInvisibleSpacer(button, [button])
  } else {
    button.id = nextSettingsElementId(element)
  }

  button.addEventListener('click', () => {
    if (invisible) return
    if (element.confirm && !window.confirm(`Run "${element.label}"?`)) return
    runSettingsExecute(element.execute)
  })

  return button
}

function createDropdownElement(element, parentAccent) {
  const invisible   = isInvisibleSpacer(element)
  const wrapper     = document.createElement('div')
  wrapper.className = 'settings-element dropdown'
  applySettingsAccent(wrapper, element.accent, parentAccent)

  const select     = document.createElement('div')
  select.className = 'select'
  select.innerHTML = '<span class="value"></span><i class="fas fa-angles-down indicator"></i>'

  const opt = Array.isArray(element.options) && element.default !== undefined
    ? element.options.find(option => (option?.value ?? option) === element.default) : null;

  select.querySelector('.value').textContent = opt?.label || (opt?.value ?? opt ?? element.default ?? '');

  const optionsContainer     = document.createElement('div')
  optionsContainer.className = 'options'
  const optionLabels         = []

  if (Array.isArray(element.options)) {
    element.options.forEach((opt) => {
      const optionValue    = opt.value !== undefined ? opt.value : opt
      const option         = document.createElement('div')
      option.className     = 'option'
      option.dataset.value = optionValue
      option.textContent   = opt.label || optionValue
      optionLabels.push(option.textContent)

      if (optionValue === element.default) {
        option.classList.add('selected')
        select.querySelector('.value').textContent = option.textContent
      }
      
      option.addEventListener('click', (event) => {
        event.stopPropagation()
        if (invisible) return

        optionsContainer.querySelectorAll('.option').forEach((item) => item.classList.remove('selected'))
        option.classList.add('selected')
        select.querySelector('.value').textContent = option.textContent
        if (element.variable) settingsState[element.variable] = option.dataset.value
        runSettingsExecute(element.execute)
        
        wrapper.classList.remove('open')
      })

      optionsContainer.append(option)
    })
  }

  const widestOptionText = optionLabels.reduce((widest, label) => {
    return measureTextWidth(label) > measureTextWidth(widest) ? label : widest
  }, select.querySelector('.value').textContent || '')

  select.style.minWidth = `${Math.ceil(measureTextWidth(widestOptionText))}px`

  if (invisible) {
    applyInvisibleSpacer(wrapper, [select])
  } else {
    select.id = nextSettingsElementId(element)
    registerSettingsVariable(element.variable, element.default)

    select.addEventListener('click',   ()      => wrapper.classList.toggle('open'))
    document.addEventListener('click', (event) => {
      if (!wrapper.contains(event.target)) wrapper.classList.remove('open')
    })
  }

  wrapper.append(select, optionsContainer)
  return wrapper
}

// ==================================================================================================== //
// ELEMENT of CREATION
// ==================================================================================================== //
const SETTINGS_ELEMENT_BUILDERS = {
  checkbox: createCheckboxElement,
  toggle  : createToggleElement,
  input   : createInputElement,
  button  : createButtonElement,
  dropdown: createDropdownElement,
}

function createSettingsElement(element, parentAccent) {
  const builder = SETTINGS_ELEMENT_BUILDERS[element.type]
  if (!builder) {
    console.warn('unknown settings element type:', element.type)
    return buildNode('div', 'settings-element unknown')
  }

  if (!isInvisibleSpacer(element)) {
    element.id = nextSettingsElementId(element)
  }

  const node = builder(element, parentAccent)
  if (!isInvisibleSpacer(element)) {
    window.SettingsElements[element.id] = { config: element, accent: parentAccent }
  }

  return node
}

function createSettingsEntry(entry, parentAccent) {
  const row           = document.createElement('div')
  row.className       = 'entry'
  row.dataset.entryId = entry.id
  const entryAccent   = applySettingsAccent(row, entry.accent, parentAccent)

  const icon = buildNode('div', 'icon', buildNode('i', settingsIconClass(entry.icon)))

  const info = buildNode('div', 'info',
    buildNode('span', 'label', document.createTextNode(entry.label || '')),
    entry.description ? buildNode('span', 'description', document.createTextNode(entry.description)) : null,
  )

  const elementsWrap = buildNode('div', 'elements')
  ;(entry.elements || []).forEach((element) => elementsWrap.append(createSettingsElement(element, entryAccent)))

  row.append(icon, info, elementsWrap)
  return row
}

function createSettingsSection(section) {
  const wrapper             = document.createElement('div')
  wrapper.className         = 'section'
  wrapper.dataset.sectionId = section.id
  const sectionAccent       = applySettingsAccent(wrapper, section.accent, undefined)

  const header = buildNode('div', 'header',
    buildNode('i', settingsIconClass(section.icon)),
    buildNode('span', 'section-label', document.createTextNode(section.label || section.id)),
  )

  const list = buildNode('div', 'entries')
  ;(section.entries || []).forEach((entry) => list.append(createSettingsEntry(entry, sectionAccent)))

  wrapper.append(header, list)
  return wrapper
}

// ==================================================================================================== //
// SETTINGS API
// ==================================================================================================== //
window.SettingsElements = window.SettingsElements || {}
window.SettingsAPI      = {
  updateSetting(id, newConfig) {
    const record = window.SettingsElements[id]
    if (!record) return console.warn(`[SettingsAPI] Element "${id}" not found.`)

    if (record.config.variable && settingsState[record.config.variable] !== undefined) {
      record.config.default = settingsState[record.config.variable]
    }

    Object.assign(record.config, newConfig)

    const innerNode = document.getElementById(id)
    if (!innerNode) return
    const wrapper = innerNode.closest('.settings-element')
    if (!wrapper) return

    const builder    = SETTINGS_ELEMENT_BUILDERS[record.config.type]
    const newWrapper = builder(record.config, record.accent)

    wrapper.replaceWith(newWrapper)
  },

  getVariable(variable) {
    return settingsState[variable]
  }
}

// ==================================================================================================== //
// LOADING *old PC noises*
// ==================================================================================================== //
function loadSettingsScript(src) {
  return new Promise((resolve, reject) => {
    const script   = document.createElement('script')
    script.src     = src
    script.onload  = () => resolve()
    script.onerror = () => reject(new Error(`failed to load settings script: ${src}`))
    document.head.append(script)
  })
}

async function loadSettingsPage(containerSelector = SELECTORS.settingsPage) {
  const container  = document.querySelector(containerSelector)
  if (!container) return

  const settingsSrc = new URL(
    SETTINGS_JSON_URL, SETTINGS_SCRIPT_SRC
  )

  const response = await fetch(settingsSrc)
  if (!response.ok) throw new Error(`settings request failed: ${response.status}`)
  const config = await response.json()

  if (config.imports) await loadSettingsScript(new URL(config.imports, settingsSrc))

  container.innerHTML = '';
  (config.sections || []).forEach((section) => container.append(createSettingsSection(section)))
}

// ==================================================================================================== //
// EXTERNAL IMPORT RENDERING
// ==================================================================================================== //
function appendAndRenderSettings(newSections) {
  const container = document.querySelector(SELECTORS.settingsPage)
  if (!container) {
    console.warn('[Parser] Settings page container not found.')
    return
  }

  (newSections || []).forEach((section) => {
    const sectionNode = createSettingsSection(section)
    container.append(sectionNode)
  })
}

// ==================================================================================================== //
// It's beautiful outside today INIT?
// ==================================================================================================== //
document.addEventListener('DOMContentLoaded', () => {
  loadSettingsPage().catch((error) => console.error(error))
})