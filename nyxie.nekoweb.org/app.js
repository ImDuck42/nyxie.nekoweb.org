// ==================================================================================================== //
// CONFIGURATION & STATE
// ==================================================================================================== //
/**
 * Dataset schema used by folder cards and gallery cards so that
 * applyCurrentSort() and applyActiveFilters() can read them:
 *    data-name        -> sortable/searchable label (folder name, or image name)
 *    data-size        -> size in MB/bytes, used for size sorting
 *    data-date        -> creation timestamp, used for date sorting
 *    data-type        -> 'folder' or file extension, used for type sorting
 *    data-folder-name -> (gallery cards only) the folder an image belongs to
 */
const ACCENT_NAMES = [
  'rosewater', 'flamingo', 'pink', 'mauve', 'red',      'maroon', 'peach',
  'yellow',    'green',    'teal', 'sky',   'sapphire', 'blue',   'lavender',
]

const ACCENT_HEX_COLORS = {
  rosewater: '#f5e0dc', flamingo: '#f2cdcd', pink:  '#f5c2e7', mauve:    '#cba6f7',
  red:       '#f38ba8', maroon:   '#eba0ac', peach: '#fab387', yellow:   '#f9e2af',
  green:     '#a6e3a1', teal:     '#94e2d5', sky:   '#89dceb', sapphire: '#74c7ec',
  blue:      '#89b4fa', lavender: '#b4befe',
}

// Selector map
const SELECTORS = {
  folderGrid:      '.folder-grid',
  galleryMasonry:  '.gallery-masonry',
  chipContainer:   '.chip-container',
  fullScreenModal: '.full-screen',
  fullScreenImage: '.full-screen-img',
  contentPanel:    '.content',
  contentSections: '.content > div',
  filterPanel:     '.filter-panel',
  navPill:         '.nav-pill',
  navTab:          '.tab',
  sortPill:        '.sort-pill',
  sortSlider:      '.sort-slider',
  sortOption:      '.sort-option',
  searchIcon:      '.search-pill .fa-search',
  searchInput:     '.search-input',
  searchSubmit:    '.search-submit',
  imageCountLabel: '.image-count',
  folderTitle:     '.folder-title',
  settingsPage:    '.settings-page',
  settingsSection: '.section',
  settingsEntry:   '.entry',
}

const GALLERY_SERVER_URL = localStorage.getItem('serverAdress') || 'http://localhost:4269';

let activeFolderFilters = ['all']
let currentSearchQuery  = ''
let currentSort         = { key: 'name', direction: 'up' }
let cardSequenceNumber  = 0

let   allGalleryImages = []
let   filteredImages   = []
let   renderIndex      = 0
const BATCH_SIZE       = 100

// ==================================================================================================== //
// HELPERS
// ==================================================================================================== //
function pickValidAccent(accentName) {
  return ACCENT_NAMES.includes(accentName) ? accentName : 'mauve'
}

function applyAccentColor(card, accentName) {
  card.style.setProperty('--accent', `var(--ctp-${pickValidAccent(accentName)}-rgb)`)
}

function nextCardTimestamp() {
  cardSequenceNumber += 1
  return Date.now() - cardSequenceNumber * 1000
}

function matchesSearch(text, query) {
  return !query || (text || '').toLowerCase().includes(query)
}

function anyMatchesSearch(values, query) {
  return !query || values.some((value) => matchesSearch(value, query))
}

// ==================================================================================================== //
// DOM FUNCTIONS
// ==================================================================================================== //
function createFolderCard(folderName, previewUrl, accentName, sizeInMB, fileCount) {
  const gridContainer = document.querySelector(SELECTORS.folderGrid)
  if (!gridContainer) return

  const card        = document.createElement('div')
  card.className    = 'folder-card'
  card.dataset.name = folderName
  card.dataset.size = sizeInMB
  card.dataset.date = nextCardTimestamp()
  card.dataset.type = 'folder'
  applyAccentColor(card, accentName)

  card.innerHTML = `
    <div class="folder-tab">
      <span class="file-count">${fileCount} Files</span>
    </div>
    <div class="folder-body">
      <div class="folder-preview">
        <img loading="lazy" decoding="async" src="${previewUrl}" alt="${folderName} Preview">
      </div>
      <div class="folder-info">
        <h3 class="folder-title">
          <span>${folderName}</span>
        </h3>
        <span class="folder-size">${sizeInMB} MB</span>
      </div>
    </div>
  `

  card.addEventListener('click', () => {
    openFolderInGallery(folderName)
  })

  gridContainer.appendChild(card)
}

function openFolderInGallery(folderName) {
  const tabs   = document.querySelectorAll(`${SELECTORS.navPill} ${SELECTORS.navTab}`)
  const panels = document.querySelectorAll(SELECTORS.contentSections)
  const chip   = document.querySelector(`${SELECTORS.chipContainer} .chip[data-folder="${folderName}"]`)
  if (!chip) return

  const galleryPanelIndex = 1
  tabs.forEach((tab) => tab.classList.remove('active'))
  tabs[galleryPanelIndex].classList.add('active')
  panels.forEach((panel, panelIndex) => panel.classList.toggle('active', panelIndex === galleryPanelIndex))

  const searchInput = document.querySelector(SELECTORS.searchInput)
  if (searchInput) searchInput.value = ''
  currentSearchQuery = ''

  packAllGalleryCards()

  document.querySelectorAll(`${SELECTORS.chipContainer} .chip`).forEach((item) => item.classList.remove('active'))
  chip.classList.add('active')
  setActiveFolderFilter(folderName)
}

function renderNextBatch() {
  const gridContainer = document.querySelector(SELECTORS.galleryMasonry)
  if (!gridContainer || renderIndex >= filteredImages.length) return

  const fragment = document.createDocumentFragment()
  const end      = Math.min(renderIndex + BATCH_SIZE, filteredImages.length)

  for (let index = renderIndex; index < end; index++) {
    const img  = filteredImages[index]
    const card = document.createElement('div')

    card.className                  = 'gallery-card'
    card.dataset.folderName         = img.folderName
    card.dataset.name               = img.name
    card.dataset.size               = img.size
    card.dataset.date               = img.date
    card.dataset.type               = img.type
    card.style.contentVisibility    = 'auto'
    card.style.containIntrinsicSize = '200px 300px'
    card.innerHTML                  = `<img loading="lazy" decoding="async" src="${img.url}" alt="${img.name}">`
    applyAccentColor(card, img.accent)

    const imageElement = card.querySelector('img')
    imageElement.addEventListener('load', () => packGalleryCard(card))

    fragment.appendChild(card)
  }

  gridContainer.appendChild(fragment)
  renderIndex = end
}

function initInfiniteScroll() {
  const contentPanel = document.querySelector(SELECTORS.contentPanel)
  if (!contentPanel) return

  contentPanel.addEventListener('scroll', () => {
    const isNearBottom = contentPanel.scrollHeight - contentPanel.scrollTop - contentPanel.clientHeight < 800
    if (isNearBottom) {
      requestAnimationFrame(() => renderNextBatch())
    }
  }, { passive: true })
}

// ==================================================================================================== //
// MASONRY GRID
// ==================================================================================================== //
function packGalleryCard(card) {
  const grid = document.querySelector(SELECTORS.galleryMasonry)
  const image = card.querySelector('img')
  if (!grid || !image || !image.naturalWidth) return

  const gridStyles   = getComputedStyle(grid)
  const rowHeight    = parseFloat(gridStyles.getPropertyValue('grid-auto-rows'))
  const rowGap       = parseFloat(gridStyles.getPropertyValue('gap'))
  const cardWidth    = card.getBoundingClientRect().width
  const scaledHeight = cardWidth * (image.naturalHeight / image.naturalWidth)

  const rowSpan         = Math.ceil((scaledHeight + rowGap) / (rowHeight + rowGap))
  card.style.gridRowEnd = `span ${rowSpan}`
}

function packAllGalleryCards() {
  document.querySelectorAll(`${SELECTORS.galleryMasonry} .gallery-card`).forEach(packGalleryCard)
}

// ==================================================================================================== //
// UI INTERACTIONS
// ==================================================================================================== //
function initFullScreenModal() {
  const modal      = document.querySelector(SELECTORS.fullScreenModal)
  const modalImage = modal?.querySelector(SELECTORS.fullScreenImage)
  const gallery    = document.querySelector(SELECTORS.galleryMasonry)
  if (!modal || !modalImage || !gallery) return

  const scaleModalImage = () => {
    const imageRatio    = modalImage.naturalWidth / modalImage.naturalHeight
    const viewportRatio = window.innerWidth       / window.innerHeight

    if (imageRatio > viewportRatio) {
      modalImage.style.width  = '100%'
      modalImage.style.height = 'auto'
    } else {
      modalImage.style.height = '100%'
      modalImage.style.width  = 'auto'
    }
  }

  gallery.addEventListener('click', (event) => {
    const card  = event.target.closest('.gallery-card')
    const image = card?.querySelector('img')
    if (!image) return

    modalImage.onload = scaleModalImage
    modalImage.src = image.src
    modalImage.alt = image.alt

    modal.classList.add('active')
  })

  const closeModal = () => modal.classList.remove('active')

  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal()
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('active')) closeModal()
  })
}

function initFilterPanelAutoHide() {
  const contentPanel = document.querySelector(SELECTORS.contentPanel)
  const filterPanel  = document.querySelector(SELECTORS.filterPanel)
  if (!contentPanel || !filterPanel) return

  let lastScrollTop = contentPanel.scrollTop

  contentPanel.addEventListener('scroll', () => {
    const currentScrollTop = contentPanel.scrollTop
    const scrollDelta = currentScrollTop - lastScrollTop

    if (currentScrollTop < 50) {
      filterPanel.classList.remove('hidden')
    } else if (scrollDelta > 5) {
      filterPanel.classList.add('hidden')
    } else if (scrollDelta < -5) {
      filterPanel.classList.remove('hidden')
    }

    lastScrollTop = currentScrollTop
  }, { passive: true })
}

function maxScrollLeftOf(container) {
  return container.scrollWidth - container.clientWidth
}

function stepInertialScroll(container, state) {
  const remainingDistance = state.targetScrollLeft - container.scrollLeft
  if (Math.abs(remainingDistance) > 0.5) {
    container.scrollLeft += remainingDistance * 0.15
    state.animationFrameId = requestAnimationFrame(() => stepInertialScroll(container, state))
  } else {
    container.scrollLeft = state.targetScrollLeft
    state.animationFrameId = 0
  }
}

function enableChipWheelScroll(container, state) {
  container.addEventListener('wheel', (event) => {
    if (state.isPointerDown || container.scrollWidth <= container.clientWidth) return
    if (!state.animationFrameId) state.targetScrollLeft = container.scrollLeft
    event.preventDefault()

    state.targetScrollLeft = Math.max(0, Math.min(state.targetScrollLeft + 0.5 * event.deltaY, maxScrollLeftOf(container)))
    if (!state.animationFrameId) state.animationFrameId = requestAnimationFrame(() => stepInertialScroll(container, state))
  }, { passive: false })
}

function enableChipDragScroll(container, state) {
  container.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    if (state.animationFrameId) {
      cancelAnimationFrame(state.animationFrameId)
      state.animationFrameId = 0
    }

    state.isPointerDown       = true
    state.hasDragged          = false
    state.shouldSuppressClick = false
    state.dragStartX          = event.clientX
    state.dragStartScrollLeft = container.scrollLeft
    state.targetScrollLeft    = state.dragStartScrollLeft
    container.classList.add('dragging')
  })

  window.addEventListener('pointermove', (event) => {
    if (!state.isPointerDown) return
    const dragDistance = event.clientX - state.dragStartX
    if (Math.abs(dragDistance) > 5) state.hasDragged = true

    container.scrollLeft = Math.max(0, Math.min(state.dragStartScrollLeft - dragDistance, maxScrollLeftOf(container)))
  })

  const endPointerDrag = () => {
    if (!state.isPointerDown) return
    state.isPointerDown = false
    container.classList.remove('dragging')
    state.targetScrollLeft = container.scrollLeft
    if (state.hasDragged) state.shouldSuppressClick = true
  }

  window.addEventListener('pointerup', endPointerDrag)
  window.addEventListener('pointercancel', endPointerDrag)

  container.addEventListener('click', (event) => {
    if (state.hasDragged || state.shouldSuppressClick) {
      event.preventDefault()
      event.stopPropagation()
      state.shouldSuppressClick = false
      state.hasDragged          = false
    }
  }, { capture: true })
}

function enableChipScrollInteractions() {
  const container = document.querySelector(SELECTORS.chipContainer)
  if (!container) return

  const state = {
    targetScrollLeft:    container.scrollLeft,
    animationFrameId:    0,
    isPointerDown:       false,
    hasDragged:          false,
    shouldSuppressClick: false,
    dragStartX:          0,
    dragStartScrollLeft: 0,
  }

  enableChipWheelScroll(container, state)
  enableChipDragScroll(container,  state)
}

function initSearchIconHover() {
  const icon = document.querySelector(SELECTORS.searchIcon)
  if (!icon) return

  const randomizeIconColor = () => {
    const accentName = ACCENT_NAMES[Math.floor(Math.random() * ACCENT_NAMES.length)]
    icon.style.color = `rgb(var(--ctp-${accentName}-rgb))`
  }

  icon.addEventListener('mouseenter', randomizeIconColor)
  icon.addEventListener('click',      randomizeIconColor)
}

function initSearchControls() {
  const input        = document.querySelector(SELECTORS.searchInput)
  const submitButton = document.querySelector(SELECTORS.searchSubmit)
  if (!input) return

  const submitSearch = () => {
    currentSearchQuery = input.value.trim().toLowerCase()
    applyActiveFilters()
  }

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      submitSearch()
    }
  })

  input.addEventListener('input', () => {
    if (input.value.trim() === '') {
      submitSearch()
    }
  })

  submitButton?.addEventListener('click', (event) => {
    event.preventDefault()
    submitSearch()
  })
}

function toggleFilterChip(folderName, chip) {
  const chipContainer = document.querySelector(SELECTORS.chipContainer)
  if (!chipContainer) return

  const willBeActive = !chip.classList.contains('active')

  if (folderName === 'all') {
    chipContainer.querySelectorAll('.chip').forEach((item) => item.classList.remove('active'))
    if (willBeActive) chip.classList.add('active')
  } else {
    chipContainer.querySelector('.chip[data-folder="all"]')?.classList.remove('active')
    chip.classList.toggle('active')
  }

  activeFolderFilters = Array.from(chipContainer.querySelectorAll('.chip.active'))
    .map((activeChip) => activeChip.dataset.folder)

  applyActiveFilters()
}

function setActiveFolderFilter(folderName) {
  const chipContainer = document.querySelector(SELECTORS.chipContainer)
  if (!chipContainer) return

  chipContainer.querySelectorAll('.chip').forEach((item) => item.classList.remove('active'))
  chipContainer.querySelector(`.chip[data-folder="${folderName}"]`)?.classList.add('active')
  activeFolderFilters = [folderName]

  applyActiveFilters()
}

function filterSettingsEntries(query) {
  const settingsPage = document.querySelector(SELECTORS.settingsPage)
  if (!settingsPage) return

  settingsPage.querySelectorAll(SELECTORS.settingsSection).forEach((section) => {
    const entries = Array.from(section.querySelectorAll(SELECTORS.settingsEntry))
    let sectionHasMatch = entries.length === 0

    entries.forEach((entry) => {
      const entryMatchesQuery = matchesSearch(entry.textContent, query)
      entry.style.display = entryMatchesQuery ? '' : 'none'
      if (entryMatchesQuery) sectionHasMatch = true
    })

    section.style.display = sectionHasMatch ? '' : 'none'
  })
}

function getActiveTabInfo() {
  const panels = document.querySelectorAll(SELECTORS.contentSections)
  return {
    isGalleryTab:  panels.length > 1 && panels[1].classList.contains('active'),
    isSettingsTab: panels.length > 2 && panels[2].classList.contains('active'),
  }
}

function filterFolderChips(query, isGalleryTab) {
  const chipContainer = document.querySelector(SELECTORS.chipContainer)
  const allChip       = chipContainer?.querySelector('.chip[data-folder="all"]')
  const folderChips   = Array.from(chipContainer?.querySelectorAll('.chip:not([data-folder="all"])') || [])

  folderChips.forEach((chip) => {
    const folderName = chip.dataset.folder || ''
    const chipMatchesQuery = isGalleryTab
      ? anyMatchesSearch(allGalleryImages.filter((img) => img.folderName === folderName).map((img) => img.name), query)
      : matchesSearch(folderName, query)

    chip.style.display = chipMatchesQuery ? '' : 'none'
  })

  if (allChip) allChip.style.display = ''

  return folderChips
    .filter((chip) => chip.style.display !== 'none')
    .map((chip)    => chip.dataset.folder)
}

function filterFolderCards(query, isGalleryTab) {
  document.querySelectorAll(`${SELECTORS.folderGrid} .folder-card`).forEach((card) => {
    const folderName          = card.dataset.name || ''
    const matchesFolderFilter = isGalleryTab ? activeFolderFilters.includes('all') || activeFolderFilters.includes(folderName) : true
    const matchesQuery        = anyMatchesSearch([folderName, card.textContent], query)
    card.style.display        = matchesFolderFilter && matchesQuery ? '' : 'none'
  })
}

function filterGalleryImages(query, isGalleryTab) {
  return allGalleryImages.filter((img) => {
    const matchesFolderFilter = activeFolderFilters.includes('all') || activeFolderFilters.includes(img.folderName)
    const matchesQuery = isGalleryTab
      ? matchesSearch(img.name, query)
      : anyMatchesSearch([img.folderName, img.name], query)

    return matchesFolderFilter && matchesQuery
  })
}

function rerenderGalleryGrid() {
  const gridContainer = document.querySelector(SELECTORS.galleryMasonry)
  if (gridContainer) gridContainer.innerHTML = ''

  renderIndex = 0
  renderNextBatch()
}

function applyActiveFilters() {
  const query = currentSearchQuery.trim().toLowerCase()
  const { isGalleryTab, isSettingsTab } = getActiveTabInfo()

  if (isSettingsTab) {
    filterSettingsEntries(query)
    return
  }

  const visibleFolderNames = filterFolderChips(query, isGalleryTab)
  activeFolderFilters      = activeFolderFilters.filter((folder) => folder === 'all' || visibleFolderNames.includes(folder))

  filterFolderCards(query, isGalleryTab)

  filteredImages = filterGalleryImages(query, isGalleryTab)
  updateImageCount(filteredImages.length)

  rerenderGalleryGrid()
}

function updateImageCount(count) {
  const countLabel = document.querySelector(SELECTORS.imageCountLabel)
  if (countLabel) countLabel.textContent = `${count} Images`
}

function setupMarquee(root = document) {
  root.querySelectorAll(SELECTORS.folderTitle).forEach((title) => {
    const label = title.querySelector('span')
    if (!label) return

    if (label.scrollWidth > title.clientWidth) {
      title.classList.add('marquee')
      title.style.setProperty('--marquee-room', `${title.clientWidth}px`)
    } else {
      title.classList.remove('marquee')
      title.style.removeProperty('--marquee-room')
    }
  })
}

function initNavPill() {
  const pill = document.querySelector(SELECTORS.navPill)
  if (!pill) return

  const tabs   = pill.querySelectorAll(SELECTORS.navTab)
  const panels = document.querySelectorAll(SELECTORS.contentSections)

  const showPanel = (panelIndex) => {
    panels.forEach((panel, index) => panel.classList.toggle('active', index === panelIndex))
    if (panelIndex === 1) packAllGalleryCards()
  }

  tabs.forEach((tab, tabIndex) => {
    tab.addEventListener('click', (event) => {
      event.preventDefault()
      if (tab.classList.contains('active')) return

      tabs.forEach((item) => item.classList.remove('active'))
      tab.classList.add('active')

      const searchInput = document.querySelector(SELECTORS.searchInput)
      if (searchInput) searchInput.value = ''
      currentSearchQuery = ''

      showPanel(tabIndex)
      applyActiveFilters()
    })
  })

  const activeTabIndex = Array.from(tabs).findIndex((tab) => tab.classList.contains('active'))
  showPanel(activeTabIndex === -1 ? 0 : activeTabIndex)
}

function initSortPill() {
  const pill = document.querySelector(SELECTORS.sortPill)
  if (!pill) return

  const slider  = pill.querySelector(SELECTORS.sortSlider)
  const options = pill.querySelectorAll(SELECTORS.sortOption)

  const moveSlider = (option) => {
    slider.style.width     = `${option.offsetWidth}px`
    slider.style.transform = `translateX(${option.offsetLeft}px)`
  }

  const setSortArrow = (option, direction) => {
    if (option.dataset.sort === 'type') return
    const icon = option.querySelector('i')
    if (!icon) return

    icon.classList.remove('fa-arrow-up', 'fa-arrow-down')
    icon.classList.add(direction === 'down' ? 'fa-arrow-down' : 'fa-arrow-up')
  }

  const nextDirectionFor = (option) => {
    const wasActive      = option.classList.contains('active')
    const savedDirection = option.dataset.direction
    if (!wasActive) return savedDirection || 'up'
    return savedDirection === 'up' ? 'down' : 'up'
  }

  options.forEach((option) => {
    option.addEventListener('click', () => {
      const direction = nextDirectionFor(option)

      options.forEach((item) => {
        item.classList.remove('active')
        if (item !== option) setSortArrow(item, item.dataset.direction || 'up')
      })

      option.classList.add('active')
      option.dataset.direction = direction
      currentSort = { key: option.dataset.sort, direction }
      setSortArrow(option, direction)
      moveSlider(option)
      applyCurrentSort()
    })
  })

  const activeOption = pill.querySelector(`${SELECTORS.sortOption}.active`)
  if (activeOption) {
    activeOption.dataset.direction = 'up'
    setSortArrow(activeOption, 'up')
    moveSlider(activeOption)
  }

  window.addEventListener('resize', () => {
    const currentOption = pill.querySelector(`${SELECTORS.sortOption}.active`)
    if (currentOption) moveSlider(currentOption)
  })
}

function compareByCurrentSort(itemA, itemB, valueOf) {
  if (currentSort.key === 'type') {
    return (Math.random() > 0.5 ? 1 : -1) * (currentSort.direction === 'up' ? 1 : -1)
  }

  const valueA = valueOf(itemA)
  const valueB = valueOf(itemB)

  const comparison = currentSort.key === 'size' || currentSort.key === 'date'
    ? (Number(valueA) || 0) - (Number(valueB) || 0)
    : String(valueA).localeCompare(String(valueB), undefined, { numeric: true, sensitivity: 'base' })

  return currentSort.direction === 'up' ? comparison : -comparison
}

function applyCurrentSort() {
  const folderGrid = document.querySelector(SELECTORS.folderGrid)
  if (folderGrid) {
    const cards = Array.from(folderGrid.querySelectorAll('.folder-card'))
    cards.sort((cardA, cardB) => compareByCurrentSort(cardA, cardB, (card) => card.dataset[currentSort.key] ?? ''))
    cards.forEach((card) => folderGrid.appendChild(card))
  }

  allGalleryImages.sort((imgA, imgB) => compareByCurrentSort(imgA, imgB, (img) => img[currentSort.key] ?? ''))

  applyActiveFilters()
}

function initGalleryFilters() {
  const allChip = document.querySelector('.chip[data-folder="all"]')
  allChip?.addEventListener('click', () => toggleFilterChip('all', allChip))
}

// ==================================================================================================== //
// FOLDER LOADING (via server.py by default on localhost:4269)
// ==================================================================================================== //
function buildImageUrl(folderName, fileName) {
  return `${GALLERY_SERVER_URL}/image?folder=${encodeURIComponent(folderName)}&file=${encodeURIComponent(fileName)}`
}

function getFolderPreviewUrl(folder) {
  return folder.images.length > 0 ? buildImageUrl(folder.name, folder.images[0].name) : ''
}

function registerFolderImages(folder) {
  folder.images.forEach((img) => {
    allGalleryImages.push({
      folderName: folder.name,
      name:       img.name,
      size:       img.size,
      date:       nextCardTimestamp(),
      type:       (img.name.split('.').pop() || 'img').toLowerCase(),
      accent:     folder.accent,
      url:        buildImageUrl(folder.name, img.name)
    })
  })
}

function createFolderChip(folderName) {
  const chipContainer = document.querySelector(SELECTORS.chipContainer)
  if (!chipContainer) return

  const chip          = document.createElement('button')
  chip.className      = 'chip'
  chip.dataset.folder = folderName
  chip.innerHTML      = `<span>${folderName}</span>`
  chip.addEventListener('click', () => toggleFilterChip(folderName, chip))
  chipContainer.appendChild(chip)
}

async function loadFoldersFromServer() {
  const manifestResponse = await fetch(`${GALLERY_SERVER_URL}/folders`)
  if (!manifestResponse.ok) throw new Error(`Manifest request failed: ${manifestResponse.status}`)

  const manifest = await manifestResponse.json()

  for (const folder of manifest) {
    createFolderCard(folder.name, getFolderPreviewUrl(folder), folder.accent, folder.sizeMB, folder.fileCount)
    registerFolderImages(folder)
    createFolderChip(folder.name)
  }

  applyCurrentSort()
}

// ==================================================================================================== //
// INIT
// ==================================================================================================== //
document.addEventListener('DOMContentLoaded', async () => {
  initFilterPanelAutoHide()
  initNavPill()
  initSortPill()
  initGalleryFilters()
  initSearchControls()
  initSearchIconHover()
  initFullScreenModal()
  enableChipScrollInteractions()
  initInfiniteScroll()

  try {
    await loadFoldersFromServer()
  } catch (error) {}

  setupMarquee()

  window.addEventListener('resize', () => {
    setupMarquee()
    packAllGalleryCards()
  })
})




















































/** Dont read, ignore this, it dosnt exist yet
 * Ideas for context
 * Download Image
 * Copy Image
 * View Metadata
 * Rename \
 * Delete -\-> Both only if loaded from python server
 */

/* Don't put false statements in divider pls */
const contextMenu = () => [
  { label:  'Download File',
    icon:   'download',
    accent: 'green',
    action: () => console.log('No sank u') },
  { label:  'Copy File',
    icon:   'copy',
    accent: 'teal',
    action: () => console.log('Me broken, please do again later') },
  { label:  'Rename File',
    icon:   'pen',
    accent: 'rosewater',
    action: () => console.log('The file is now called "I Only Wanted To Fix A Single Typo In The Header, But It Broke The Entire User Authentication Pipeline And Now The Production Database Is On Fire"') },
  { label:  'View File Metadata',
    icon:   'address-card',
    accent: 'yellow',
    action: () => console.log('Viewing da Metadata..., or do I??? *vsauce music starts playing*') },
  { divider: 'false' },
  { label:  'Delete File',
    icon:   'eraser',
    accent: 'red',
    action: () => console.log('Deleted image: "💢😭💦-06192019.webp"') },
];

const initContextMenu = () => {
  const menu = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'context-menu' }))
  
  const hide = () => { menu.classList.remove('visible'); menu.innerHTML = ''; }

  document.addEventListener('contextmenu', event => {
    event.preventDefault();
    menu.innerHTML = ''
    
    contextMenu().forEach(option => {
      menu.appendChild(Object.assign(document.createElement(option.divider ? 'div' : 'button'), {
        className: option.divider ? 'divider' : `option ${option.disabled ? 'disabled' : ''}`,
        disabled:  !!option.disabled,
        innerHTML: option.divider ? '' : `<i class="fas fa-${option.icon}"></i><span>${option.label}</span>`,
        onclick: () => !option.disabled && (hide(), option.action?.())
      })).style.setProperty('--accent', `var(--ctp-${option.accent || 'mauve'}-rgb)`)
    })

    menu.classList.add('visible')
    Object.assign(menu.style, { left: `${Math.max(Math.min(event.clientX, window.innerWidth  - menu.offsetWidth  - 10))}px`,
                                top:  `${Math.max(Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 10))}px` })
  })

  document.addEventListener('click',   event => !menu.contains(event.target) && hide())
  document.addEventListener('keydown', event => event.key === 'Escape'       && hide())
  document.addEventListener('scroll',  hide, { passive: true, capture: true })
}

initContextMenu();