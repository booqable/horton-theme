/**
 * Carousel Component
 *
 * High-performance carousel with transform translate approach.
 * Supports navigation buttons and auto-scroll with hover pause.
 *
 * @requires js-utils-core.js
 * @requires js-utils.js
 */

const CarouselConfig = {
  selector: {
    carousel: '.carousel',
    categoryBlock: '.products__category-block',
    item: '.carousel__item',
    navigation: '.carousel__navigation',
    next: '.carousel__btn.next',
    prev: '.carousel__btn.prev',
    region: '.carousel__live-region',
    sidebar: '.sidebar',
    wrapper: '.carousel__wrapper',
    imageHidden: '.image-main.hidden'
  },
  classes: {
    active: 'active',
    hidden: 'hidden',
    initialized: 'initialized',
    pause: 'carousel__pause',
    region: 'carousel__live-region',
    swiping: 'carousel__swiping'
  },
  attr: {
    ariaAtomic: 'aria-atomic',
    ariaLabel: 'aria-label',
    ariaLive: 'aria-live',
    tabIndex: 'tabindex',
    timer: 'data-carousel-timer'
  },
  cssProp: {
    widthDesktop: '--slide-width',
    widthMobile: '--slide-width-mobile',
    widthDesktopBlock: '--slide-width-block'
  },
  viewport: {
    mobileBreakpoint: 992,
    intersectionThreshold: 0.1
  },
  touch: {
    resistance: 0.25,
    threshold: 50
  },
  cache: {
    maxSize: 50,
    ttl: 30000 // 30 seconds
  },
  accessibility: {
    announceDelay: 100
  },
  width: {
    desktop: 328,
    mobile: 250
  },
  lifecycle: {
    poolSize: 10,
    idleTimeout: 2500 // 2.5 seconds before cleanup
  }
}

const CarouselCache = {
  data: new Map(),

  set (key, value) {
    try {
      // Clean up expired entries if cache is getting large
      if (this.data.size >= CarouselConfig.cache.maxSize) this.cleanup()

      this.data.set(key, {
        value,
        timestamp: Date.now()
      })
    } catch (error) {
      console.warn('CarouselCache: Failed to set cache entry', error)
    }
  },

  get (key) {
    try {
      const entry = this.data.get(key)
      if (!entry) return undefined

      // Check if entry is expired
      if (Date.now() - entry.timestamp > CarouselConfig.cache.ttl) {
        this.data.delete(key)
        return undefined
      }

      return entry.value
    } catch (error) {
      console.warn('CarouselCache: Failed to get cache entry', error)
      return undefined
    }
  },

  delete (key) {
    try {
      this.data.delete(key)
    } catch (error) {
      console.warn('CarouselCache: Failed to delete cache entry', error)
    }
  },

  cleanup () {
    try {
      const now = Date.now()
      for (const [key, entry] of this.data.entries()) {
        if (now - entry.timestamp > CarouselConfig.cache.ttl) {
          this.data.delete(key)
        }
      }
    } catch (error) {
      console.warn('CarouselCache: Failed to cleanup cache', error)
    }
  },

  clear () {
    try {
      this.data.clear()
    } catch (error) {
      console.warn('CarouselCache: Failed to clear cache', error)
    }
  }
}

const CarouselViewportManager = {
  activeCarousels: new Map(),
  carouselStates: new Map(), // Store individual carousel states
  currentlyInitializing: 0,
  idleTimers: new Map(),
  initializationQueue: [],
  maxConcurrentMobile: 1, // Restrictive only on mobile
  observer: null,
  pendingCarousels: new Set(),
  processingChunk: false,
  queueProcessTimer: null,
  visibleCarousels: new Set(), // Track which carousels are currently visible

  init () {
    try {
      if (this.observer) return this.observer

      const handleIntersection = (entries) => {
        entries.forEach((entry) => {
          const carousel = entry.target,
            isVisible = entry.isIntersecting

          if (isVisible) {
            this.visibleCarousels.add(carousel)
            this.activateCarousel(carousel)
          } else {
            this.visibleCarousels.delete(carousel)
            this.scheduleDeactivation(carousel)
          }
        })
      }

      this.observer = $.intersectionObserver(handleIntersection, {
        threshold: CarouselConfig.viewport.intersectionThreshold
      })

      return this.observer
    } catch (error) {
      console.error('CarouselViewportManager: Failed to initialize', error)
      return null
    }
  },

  observe (carousel) {
    try {
      if (!this.observer) this.init()
      if (!this.observer) return false

      this.pendingCarousels.add(carousel)
      this.observer.observe(carousel)
      return true
    } catch (error) {
      console.error('CarouselViewportManager: Failed to observe carousel', error)
      return false
    }
  },

  unobserve (carousel) {
    try {
      if (this.observer) {
        this.observer.unobserve(carousel)
      }
      this.pendingCarousels.delete(carousel)
      this.clearIdleTimer(carousel)

      // Remove from initialization queue if present
      const queueIndex = this.initializationQueue.indexOf(carousel)
      if (queueIndex > -1) {
        this.initializationQueue.splice(queueIndex, 1)
      }

      this.visibleCarousels.delete(carousel)

      // Process queue if this carousel removal freed up resources
      if (this.initializationQueue.length > 0) {
        this.scheduleQueueProcessing()
      }
    } catch (error) {
      console.error('CarouselViewportManager: Failed to unobserve carousel', error)
    }
  },

  observeLazy (carousel, delay = 2000) {
    try {
      // Create a one-time intersection observer for lazy loading
      const lazyObserver = $.intersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            lazyObserver.unobserve(carousel)

            // Add to queue instead of immediate observation
            setTimeout(() => {
              if (!carousel.classList.contains(CarouselConfig.classes.initialized)) {
                this.observe(carousel)
              }
            }, delay) // Exact timing - viewport visibility overrides delay
          }
        })
      }, { threshold: CarouselConfig.viewport.intersectionThreshold })

      lazyObserver.observe(carousel)

      return true
    } catch (error) {
      console.error('CarouselViewportManager: Failed to observe lazy carousel', error)
      return false
    }
  },

  activateCarousel (carousel) {
    try {
      this.clearIdleTimer(carousel)

      if (this.activeCarousels.has(carousel)) return

      // Smart activation: queue only on mobile restrictions or multiple visible carousels
      const isMobile = $.isMobile(CarouselConfig.viewport.mobileBreakpoint),
        multipleVisible = this.visibleCarousels.size > 1,
        systemBusy = isMobile && this.currentlyInitializing >= this.maxConcurrentMobile

      multipleVisible || systemBusy ?
        this.queueCarouselInitialization(carousel) :
        this.initializeCarousel(carousel)
    } catch (error) {
      console.error('CarouselViewportManager: Failed to activate carousel', error)
    }
  },

  getMaxConcurrent () {
    const isMobile = $.viewportSize().width < CarouselConfig.viewport.mobileBreakpoint
    return isMobile ? this.maxConcurrentMobile : Infinity // No restrictions on desktop
  },

  queueCarouselInitialization (carousel) {
    try {
      if (this.initializationQueue.includes(carousel)) return

      this.initializationQueue.push(carousel)
      this.scheduleQueueProcessing()
    } catch (error) {
      console.error('CarouselViewportManager: Failed to queue carousel', error)
    }
  },

  scheduleQueueProcessing () {
    try {
      // Avoid scheduling multiple timers
      if (this.queueProcessTimer || this.processingChunk) return

      this.queueProcessTimer = $.requestIdle(() => {
        this.processInitializationQueue()
        this.queueProcessTimer = null
      }, { timeout: 1500 })
    } catch (error) {
      console.error('CarouselViewportManager: Failed to schedule queue processing', error)
    }
  },

  processInitializationQueue () {
    try {
      if (this.processingChunk || this.initializationQueue.length === 0) return

      const maxConcurrent = this.getMaxConcurrent()
      if (this.currentlyInitializing >= maxConcurrent) return

      this.processingChunk = true

      // Process carousels in chunks based on available slots
      const availableSlots = maxConcurrent - this.currentlyInitializing,
        chunkSize = Math.min(availableSlots, this.initializationQueue.length)

      for (let i = 0; i < chunkSize; i++) {
        const carousel = this.initializationQueue.shift()
        if (carousel && !this.activeCarousels.has(carousel)) {
          this.initializeCarouselWithDelay(carousel, i * 500) // Stagger by 500ms
        }
      }

      this.processingChunk = false

      // Schedule next chunk processing if queue not empty
      if (this.initializationQueue.length > 0) this.scheduleQueueProcessing()
    } catch (error) {
      console.error('CarouselViewportManager: Failed to process initialization queue', error)
      this.processingChunk = false
    }
  },

  initializeCarouselWithDelay (carousel, delay = 0) {
    try {
      this.currentlyInitializing++

      const initCarousel = () => {
        try {
          // Double-check carousel is still needed
          if (this.activeCarousels.has(carousel)) {
            this.currentlyInitializing--
            return
          }

          const instance = CarouselInstancePool.getOrCreateInstance(carousel)
          if (instance) {
            this.restoreCarouselState(carousel, instance)
            this.activeCarousels.set(carousel, instance)
            instance.init()
          }

          this.currentlyInitializing--

          // Process more items if queue not empty
          if (this.initializationQueue.length > 0) {
            this.scheduleQueueProcessing()
          }
        } catch (error) {
          console.error('CarouselViewportManager: Failed during delayed initialization', error)
          this.currentlyInitializing--
        }
      }

      delay > 0 ?
        setTimeout(initCarousel, delay) :
        initCarousel()
    } catch (error) {
      console.error('CarouselViewportManager: Failed to initialize carousel with delay', error)
      this.currentlyInitializing--
    }
  },

  initializeCarousel (carousel) {
    try {
      this.initializeCarouselWithDelay(carousel, 0)
    } catch (error) {
      console.error('CarouselViewportManager: Failed to initialize carousel', error)
    }
  },

  saveCarouselState (carousel, instance) {
    try {
      const carouselId = carousel.dataset.carouselId
      if (!carouselId) return

      const state = {
        currentIndex: instance.currentIndex || 0,
        isPaused: instance.isPaused || false,
        timestamp: Date.now()
      }

      this.carouselStates.set(carouselId, state)
    } catch (error) {
      console.error('CarouselViewportManager: Failed to save carousel state', error)
    }
  },

  restoreCarouselState (carousel, instance) {
    try {
      const carouselId = carousel.dataset.carouselId
      if (!carouselId) return

      const savedState = this.carouselStates.get(carouselId)
      if (savedState) {
        // Restore the saved index, but ensure it's within bounds
        const targetIndex = Math.max(0, Math.min(savedState.currentIndex, instance.maxIndex))
        instance.currentIndex = targetIndex
        instance.isPaused = savedState.isPaused

        // Add a flag to indicate this carousel needs to restore its visual state after init
        instance.needsStateRestore = true
        instance.restoreTargetIndex = targetIndex
      }
    } catch (error) {
      console.error('CarouselViewportManager: Failed to restore carousel state', error)
    }
  },

  scheduleDeactivation (carousel) {
    try {
      this.clearIdleTimer(carousel)

      const timeout = CarouselConfig.lifecycle.idleTimeout

      const timer = setTimeout(() => {
        this.deactivateCarousel(carousel)
      }, timeout)

      this.idleTimers.set(carousel, timer)
    } catch (error) {
      console.error('CarouselViewportManager: Failed to schedule deactivation', error)
    }
  },

  deactivateCarousel (carousel) {
    try {
      const instance = this.activeCarousels.get(carousel)
      if (instance) {
        this.saveCarouselState(carousel, instance) // Save the carousel's current state before deactivating

        instance.cleanup()
        CarouselInstancePool.returnInstance(carousel, instance)
        this.activeCarousels.delete(carousel)

        // Clear cache entries for this specific carousel to free memory
        const carouselId = carousel.dataset.carouselId
        if (carouselId) {
          CarouselCache.delete(`slideWidth-${carouselId}-mobile`)
          CarouselCache.delete(`slideWidth-${carouselId}-desktop`)
          CarouselCache.delete(`gap-${carouselId}-mobile`)
          CarouselCache.delete(`gap-${carouselId}-desktop`)
        }

        // Decrement counter if this was being initialized
        if (this.currentlyInitializing > 0) {
          this.currentlyInitializing--
        }

        // Process queue if resources freed up
        if (this.initializationQueue.length > 0) {
          this.scheduleQueueProcessing()
        }
      }
      this.clearIdleTimer(carousel)
    } catch (error) {
      console.error('CarouselViewportManager: Failed to deactivate carousel', error)
    }
  },

  clearIdleTimer (carousel) {
    try {
      const timer = this.idleTimers.get(carousel)
      if (timer) {
        clearTimeout(timer)
        this.idleTimers.delete(carousel)
      }
    } catch (error) {
      console.error('CarouselViewportManager: Failed to clear idle timer', error)
    }
  },

  cleanup () {
    try {
      if (this.observer) {
        this.observer.disconnect()
        this.observer = null
      }

      this.idleTimers.forEach((timer) => clearTimeout(timer))
      this.idleTimers.clear()

      this.activeCarousels.forEach((instance) => {
        if (instance && instance.cleanup) instance.cleanup()
      })
      this.activeCarousels.clear()

      this.pendingCarousels.clear()

      // Clear queue and timers
      this.initializationQueue.length = 0
      this.currentlyInitializing = 0
      this.processingChunk = false

      if (this.queueProcessTimer) {
        clearTimeout(this.queueProcessTimer)
        this.queueProcessTimer = null
      }

      this.carouselStates.clear()
      this.visibleCarousels.clear()
    } catch (error) {
      console.error('CarouselViewportManager: Failed to cleanup', error)
    }
  }
}

const CarouselInstancePool = {
  pool: [],
  activeInstances: new Map(),

  getOrCreateInstance (carousel) {
    try {
      let instance = this.pool.pop()

      if (!instance) {
        instance = CarouselController.createInstance(carousel)
        if (!instance) return null
      } else {
        instance = this.reinitializeInstance(instance, carousel)
      }

      this.activeInstances.set(carousel, instance)
      return instance
    } catch (error) {
      console.error('CarouselInstancePool: Failed to get or create instance', error)
      return null
    }
  },

  returnInstance (carousel, instance) {
    try {
      if (!instance) return

      instance.cleanup()
      this.activeInstances.delete(carousel)

      if (this.pool.length < CarouselConfig.lifecycle.poolSize) {
        this.resetInstanceState(instance)
        this.pool.push(instance)
      }
    } catch (error) {
      console.error('CarouselInstancePool: Failed to return instance', error)
    }
  },

  reinitializeInstance (instance, carousel) {
    try {
      const elements = {
        wrapper: carousel.querySelector(CarouselConfig.selector.wrapper),
        items: carousel.querySelectorAll(CarouselConfig.selector.item),
        prevBtn: carousel.querySelector(CarouselConfig.selector.prev),
        nextBtn: carousel.querySelector(CarouselConfig.selector.next)
      }

      if (!elements.wrapper || !elements.items.length) return null

      const timerVal = carousel.getAttribute(CarouselConfig.attr.timer),
        visibleSlides = CarouselCalculator.getVisibleSlidesCount(carousel),
        maxTranslateIndex = CarouselCalculator.getMaxTranslateIndex(carousel, elements.items.length)

      instance.carousel = carousel
      instance.wrapper = elements.wrapper
      instance.items = elements.items
      instance.prevBtn = elements.prevBtn
      instance.nextBtn = elements.nextBtn
      instance.currentIndex = 0
      instance.maxIndex = maxTranslateIndex
      instance.totalSlides = elements.items.length
      instance.visibleSlides = visibleSlides
      instance.timer = $.is(timerVal, 'string') && timerVal.length > 0 ? parseInt(timerVal) * 1000 : 0

      return instance
    } catch (error) {
      console.error('CarouselInstancePool: Failed to reinitialize instance', error)
      return null
    }
  },

  resetInstanceState (instance) {
    try {
      instance.currentIndex = 0
      instance.autoScrollTimer = null
      instance.isPaused = false
      instance.touch = null
      instance.wheelState = null
      instance.wheelResumeTimer = null
      instance.keyboardHandler = null
      instance.liveRegion = null
      instance.throttler = null

      Object.keys(instance.eventHandlers || {}).forEach((key) => {
        Array.isArray(instance.eventHandlers[key]) ?
          instance.eventHandlers[key] = [] :
          instance.eventHandlers[key] = null
      })
    } catch (error) {
      console.error('CarouselInstancePool: Failed to reset instance state', error)
    }
  },

  cleanup () {
    try {
      this.activeInstances.forEach((instance) => {
        if (instance && instance.cleanup) instance.cleanup()
      })
      this.activeInstances.clear()

      this.pool.forEach((instance) => {
        if (instance && instance.cleanup) instance.cleanup()
      })
      this.pool = []
    } catch (error) {
      console.error('CarouselInstancePool: Failed to cleanup', error)
    }
  }
}

const CarouselDOM = {
  elements: {
    carousels: null
  },

  init () {
    try {
      this.elements.carousels = document.querySelectorAll(CarouselConfig.selector.carousel)
      return this.elements.carousels && this.elements.carousels.length > 0
    } catch (error) {
      console.error('CarouselDOM: Failed to initialize', error)
      return false
    }
  },

  cleanup () {
    try {
      CarouselCache.clear()
      this.elements.carousels = null
    } catch (error) {
      console.warn('CarouselDOM: Failed to cleanup', error)
    }
  }
}

const CarouselElementCache = {
  cache: new Map(),

  getElements(carousel) {
    if (this.cache.has(carousel)) {
      return this.cache.get(carousel)
    }

    const elements = $.batchQuery(carousel, {
      wrapper: CarouselConfig.selector.wrapper,
      itemsAll: CarouselConfig.selector.item + 'All',
      navigation: CarouselConfig.selector.navigation,
      prevBtn: CarouselConfig.selector.prev,
      nextBtn: CarouselConfig.selector.next
    })

    this.cache.set(carousel, elements)
    return elements
  },

  clearCache(carousel) {
    carousel ?
      this.cache.delete(carousel) :
      this.cache.clear()
  }
}

const CarouselCalculator = {
  getSlideWidth: $.memoize((carousel) => {
    const isMobile = $.isMobile(CarouselConfig.viewport.mobileBreakpoint),
      fallbackWidth = isMobile ? CarouselConfig.width.mobile : CarouselConfig.width.desktop

    try {
      if (!carousel) return fallbackWidth

      const hasSiblingElement = carousel.parentNode.querySelector(CarouselConfig.selector.categoryBlock) ||
        carousel.parentNode.parentNode.querySelector(CarouselConfig.selector.sidebar)

      const cacheKey = `slideWidth-${carousel.dataset.carouselId}-${isMobile ? 'mobile' : 'desktop'}-${hasSiblingElement ? 'block' : 'normal'}`
      let cachedWidth = CarouselCache.get(cacheKey)

      if (cachedWidth) return cachedWidth

      let slideWidthVar

      isMobile ?
        slideWidthVar = CarouselConfig.cssProp.widthMobile :
        slideWidthVar = hasSiblingElement ? CarouselConfig.cssProp.widthDesktopBlock : CarouselConfig.cssProp.widthDesktop

      const computedStyle = getComputedStyle(carousel),
        slideWidthValue = computedStyle.getPropertyValue(slideWidthVar)

      let slideWidth
      if (slideWidthValue && slideWidthValue.includes('%')) {
        const parentWidth = $.getCachedDimensions(carousel).offsetWidth || $.getCachedDimensions(carousel).clientWidth,
          percentage = parseFloat(slideWidthValue) / 100
        slideWidth = Math.round(parentWidth * percentage)
      } else {
        slideWidth = parseInt(slideWidthValue) || fallbackWidth
      }

      if (slideWidth <= 0 || slideWidth > 2000) {
        console.warn('CarouselCalculator: Invalid slide width detected', { slideWidthVar, slideWidthValue, slideWidth, hasSiblingElement })
        return fallbackWidth
      }

      CarouselCache.set(cacheKey, slideWidth)
      return slideWidth
    } catch (error) {
      console.error('CarouselCalculator: Failed to get slide width', error)
      return fallbackWidth
    }
  }, { ttl: 10000 }),

  getGap (carousel) {
    const defaultGap = 0

    try {
      if (!carousel) return defaultGap // Safe fallback

      const isMobile = $.isMobile(CarouselConfig.viewport.mobileBreakpoint),
        cacheKey = `gap-${carousel.dataset.carouselId}-${isMobile ? 'mobile' : 'desktop'}`
      let cachedGap = CarouselCache.get(cacheKey)

      if (cachedGap !== undefined) return cachedGap

      const elements = CarouselElementCache.getElements(carousel)
      if (!elements.wrapper) return defaultGap

      const computedStyle = getComputedStyle(elements.wrapper),
        gapValue = computedStyle.gap,
        gap = gapValue === '0px' ? 0 : parseInt(gapValue)

      // Validate the result
      if (gap < 0 || gap > 100) {
        console.warn('CarouselCalculator: Invalid gap detected', gap)
        return defaultGap
      }

      CarouselCache.set(cacheKey, gap)
      return gap
    } catch (error) {
      console.error('CarouselCalculator: Failed to get gap', error)
      return defaultGap
    }
  },

  getHorizontalPadding (carousel) {
    try {
      if (!carousel) return 0

      const elements = CarouselElementCache.getElements(carousel)
      if (!elements.wrapper) return 0

      const computedStyle = getComputedStyle(elements.wrapper),
        paddingLeft = parseInt(computedStyle.paddingLeft) || 0,
        paddingRight = parseInt(computedStyle.paddingRight) || 0,
        totalPadding = paddingLeft + paddingRight

      // Validate the result
      if (totalPadding < 0 || totalPadding > 200) {
        console.warn('CarouselCalculator: Invalid padding detected', totalPadding)
        return 0
      }

      return totalPadding
    } catch (error) {
      console.error('CarouselCalculator: Failed to get horizontal padding', error)
      return 0
    }
  },

  getVisibleSlidesCount (carousel) {
    try {
      const carouselWidth = $.getCachedDimensions(carousel).offsetWidth,
        slideWidth = this.getSlideWidth(carousel),
        gap = this.getGap(carousel),
        horizontalPadding = this.getHorizontalPadding(carousel),
        availableWidth = carouselWidth - horizontalPadding + gap,
        slideAndGapWidth = slideWidth + gap,
        visibleCount = Math.floor(availableWidth / slideAndGapWidth)

      // Ensure at least 1 slide is visible, but not more than total slides
      const items = carousel.querySelectorAll(CarouselConfig.selector.item)
      return Math.max(1, Math.min(visibleCount, items.length))
    } catch (error) {
      console.error('CarouselCalculator: Failed to get visible slides count', error)
      return 1
    }
  },

  getMaxTranslateIndex (carousel, totalSlides) {
    try {
      const carouselWidth = $.getCachedDimensions(carousel).offsetWidth,
        slideWidth = this.getSlideWidth(carousel),
        gap = this.getGap(carousel),
        horizontalPadding = this.getHorizontalPadding(carousel),
        availableWidth = carouselWidth - horizontalPadding,
        totalContentWidth = (slideWidth * totalSlides) + (gap * (totalSlides - 1))

      // If all content fits in the available space, no translation needed
      if (totalContentWidth <= availableWidth) return 0

      // Calculate how many slides can start a "viewport window"
      const slideAndGapWidth = slideWidth + gap

      // Find the last slide and pin it to the right side of the carousel
      const minLastSlidePosition = totalContentWidth - availableWidth,
        maxStartingSlideIndex = Math.ceil(minLastSlidePosition / slideAndGapWidth),
        maxIndex = Math.min(maxStartingSlideIndex, totalSlides - 1)

      return Math.max(0, maxIndex)
    } catch (error) {
      console.error('CarouselCalculator: Failed to calculate max translate index', error)
      return 0
    }
  },

  getTranslateValue (carousel, targetIndex) {
    try {
      const slideWidth = this.getSlideWidth(carousel),
        gap = this.getGap(carousel),
        carouselWidth = $.getCachedDimensions(carousel).offsetWidth,
        horizontalPadding = this.getHorizontalPadding(carousel),
        items = carousel.querySelectorAll(CarouselConfig.selector.item),
        totalSlides = items.length

      if (targetIndex === 0) return 0

      // Available width inside the wrapper (accounting for padding)
      const availableWidth = carouselWidth - horizontalPadding,
        slideAndGapWidth = slideWidth + gap,
        totalContentWidth = (slideWidth * totalSlides) + (gap * (totalSlides - 1))

      // If all content fits, no translation needed
      if (totalContentWidth <= availableWidth) return 0

      // Standard translation (slide by slide)
      const standardTranslate = -(slideAndGapWidth * targetIndex)

      // Check if this would over-translate (leave empty space on the right)
      const contentEndPosition = totalContentWidth + standardTranslate

      if (contentEndPosition < availableWidth) {
        const rightAlignedTranslate = -(totalContentWidth - availableWidth)
        return rightAlignedTranslate
      }

      return standardTranslate
    } catch (error) {
      console.error('CarouselCalculator: Failed to calculate translate value', error)
      return 0
    }
  },

  shouldShowControls (carousel) {
    try {
      const items = carousel.querySelectorAll(CarouselConfig.selector.item)
      if (!items.length) return false

      // Detect if ANY content overflows (even 1px)
      const carouselDimensions = $.getCachedDimensions(carousel),
        carouselWidth = carouselDimensions.offsetWidth || carouselDimensions.clientWidth,
        slideWidth = this.getSlideWidth(carousel),
        gap = this.getGap(carousel),
        horizontalPadding = this.getHorizontalPadding(carousel),
        availableWidth = carouselWidth - horizontalPadding,
        totalContentWidth = (slideWidth * items.length) + (gap * (items.length - 1))

      // If carousel width is 0 or undefined, default to showing controls
      if (!carouselWidth || carouselWidth <= 0) return true

      // Show controls if ANY part of content doesn't fit (even 1px overflow)
      return totalContentWidth > availableWidth
    } catch (error) {
      console.error('CarouselCalculator: Failed to determine control visibility', error)
      return true // Default to showing controls on error
    }
  }
}

const CarouselRenderer = {
  setSlideEffect (wrapper, translate) {
    const transform = () => {
      wrapper.style.transform = `translateX(${translate}px)`
    }
    $.batchDOM(transform)
  },

  toggleControls (carousel, shouldHide) {
    const read = () => {
      const elements = CarouselElementCache.getElements(carousel)
      return { navigation: elements.navigation }
    }

    const write = (controls) => {
      if (controls.navigation) $.toggleClass(controls.navigation, CarouselConfig.classes.hidden, shouldHide)
    }

    $.frameSequence(read, write)
  }
}

const CarouselTouch = {
  handleWheelEvent (instance, event) {
    try {
      // Only handle horizontal scrolling or when shift is held for vertical trackpads
      const horizontalScroll = Math.abs(event.deltaX) > Math.abs(event.deltaY),
        verticalScroll = event.shiftKey && Math.abs(event.deltaY) > 0

      if (!horizontalScroll && !verticalScroll) return

      event.preventDefault()

      let deltaX = horizontalScroll ? event.deltaX : event.deltaY

      // Normalize wheel delta (different browsers/devices have different scales)
      const normalizedDelta = Math.sign(deltaX) * Math.min(Math.abs(deltaX), 100)

      const now = Date.now()
      if (!instance.wheelState) {
        instance.wheelState = {
          lastWheelTime: 0,
          accumulatedDelta: 0,
          debounceTimer: null
        }
      }

      instance.wheelState.accumulatedDelta += normalizedDelta
      instance.wheelState.lastWheelTime = now

      if (instance.wheelState.debounceTimer) {
        clearTimeout(instance.wheelState.debounceTimer)
      }

      // Set new debounce timer to process accumulated scroll
      instance.wheelState.debounceTimer = setTimeout(() => {
        const threshold = 50 // Minimum accumulated delta to trigger navigation

        if (Math.abs(instance.wheelState.accumulatedDelta) > threshold) {
          const scrollToLeft = () => {
            if (instance.currentIndex > 0) instance.goToPrev() // Scroll left/up - go to previous slide
          }
          const scrollToRight = () => {
            if (instance.currentIndex < instance.maxIndex) instance.goToNext() // Scroll right/down - go to next slide
          }

          instance.wheelState.accumulatedDelta > 0 ? scrollToRight() : scrollToLeft()
        }

        instance.wheelState.accumulatedDelta = 0
      }, 50) // Debounce delay

      instance.pauseAutoScroll()
      if (instance.wheelResumeTimer) {
        clearTimeout(instance.wheelResumeTimer)
      }
      instance.wheelResumeTimer = setTimeout(() => {
        instance.resumeAutoScroll()
      }, 250)
    } catch (error) {
      console.error('CarouselTouch: Failed to handle wheel event', error)
    }
  },

  handleTouchStart (instance, event) {
    try {
      const touch = event.touches[0]
      instance.touch = {
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        startTime: Date.now(),
        isDragging: false,
        initialTransform: instance.getCurrentTransform()
      }

      $.toggleClass(instance.carousel, CarouselConfig.classes.swiping, true)

      instance.pauseAutoScroll()
    } catch (error) {
      console.error('CarouselTouch: Failed to handle touch start', error)
    }
  },

  handleTouchMove (instance, event) {
    try {
      if (!instance.touch) return

      const touch = event.touches[0],
        deltaX = touch.clientX - instance.touch.startX,
        deltaY = touch.clientY - instance.touch.startY

      // Check horizontally swiping
      if (!instance.touch.isDragging && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        instance.touch.isDragging = true
        event.preventDefault()
      }

      if (instance.touch.isDragging) {
        instance.touch.currentX = touch.clientX

        // Apply resistance at boundaries
        let resistance = 1
        const start = instance.currentIndex === 0 && deltaX > 0,
          end = instance.currentIndex === instance.maxIndex && deltaX < 0

        if (start || end) {
          resistance = CarouselConfig.touch.resistance
        }

        const constrainedDelta = deltaX * resistance,
          newTransform = instance.touch.initialTransform + constrainedDelta

        const applyTransform = () => {
          instance.wrapper.style.transform = `translateX(${newTransform}px)`
          instance.wrapper.style.transition = 'none'
        }
        $.batchDOM(applyTransform)
      }
    } catch (error) {
      console.error('CarouselTouch: Failed to handle touch move', error)
    }
  },

  handleTouchEnd (instance, event) {
    try {
      if (!instance.touch) return

      const deltaX = instance.touch.currentX - instance.touch.startX,
        deltaTime = Date.now() - instance.touch.startTime,
        velocity = Math.abs(deltaX) / deltaTime

      $.toggleClass(instance.carousel, CarouselConfig.classes.swiping, false)

      const resetTransition = () => {
        instance.wrapper.style.transition = ''
      }
      $.batchDOM(resetTransition)

      if (instance.touch.isDragging) {
        // Determine if we should change slides
        const threshold = CarouselConfig.touch.threshold,
          shouldChange = Math.abs(deltaX) > threshold || velocity > 0.5

        const transformHandler = () => {
          if (deltaX > 0 && instance.currentIndex > 0) {
            instance.goToPrev()
          } else if (deltaX < 0 && instance.currentIndex < instance.maxIndex) {
            instance.goToNext()
          } else {
            instance.goToSlide(instance.currentIndex)
          }
        }

        shouldChange ? transformHandler() : instance.goToSlide(instance.currentIndex)

        event.preventDefault()
      }

      instance.resumeAutoScroll()
      instance.touch = null
    } catch (error) {
      console.error('CarouselTouch: Failed to handle touch end', error)
    }
  }
}

const CarouselAccessibility = {
  setupAccessibility (instance) {
    try {
      this.setupLiveRegion(instance) // Setup live region for announcements
      this.setupKeyboardNavigation(instance) // Setup keyboard navigation
      this.setupFocusManagement(instance) // Setup focus management
    } catch (error) {
      console.error('CarouselAccessibility: Failed to setup accessibility', error)
    }
  },

  setupLiveRegion (instance) {
    try {
      let liveRegion = instance.carousel.querySelector(CarouselConfig.selector.region)
      if (!liveRegion) {
        liveRegion = document.createElement('div')
        liveRegion.className = CarouselConfig.classes.region
        liveRegion.setAttribute(CarouselConfig.attr.ariaLive, 'polite')
        liveRegion.setAttribute(CarouselConfig.attr.ariaAtomic, 'true')
        liveRegion.style.cssText = 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;'
        instance.carousel.appendChild(liveRegion)
      }
      instance.liveRegion = liveRegion
    } catch (error) {
      console.error('CarouselAccessibility: Failed to setup live region', error)
    }
  },

  announceSlideChange (instance) {
    try {
      if (!instance.liveRegion) return

      const currentSlide = instance.currentIndex + 1,
        totalSlides = instance.totalSlides,
        message = `Slide ${currentSlide} of ${totalSlides}`

      setTimeout(() => {
        instance.liveRegion.textContent = message // Delay announcement to avoid overwhelming screen readers
      }, CarouselConfig.accessibility.announceDelay)
    } catch (error) {
      console.error('CarouselAccessibility: Failed to announce slide change', error)
    }
  },

  setupKeyboardNavigation (instance) {
    try {
      instance.carousel.setAttribute(CarouselConfig.attr.tabIndex, '0')

      instance.keyboardHandler = (event) => {
        switch (event.key) {
          case 'ArrowLeft':
            event.preventDefault()
            instance.goToPrev()
            break
          case 'ArrowRight':
            event.preventDefault()
            instance.goToNext()
            break
          case 'Home':
            event.preventDefault()
            instance.goToSlide(0)
            break
          case 'End':
            event.preventDefault()
            instance.goToSlide(instance.maxIndex)
            break
          case ' ':
          case 'Enter':
            event.preventDefault()
            instance.isPaused ?
              instance.resumeAutoScroll() :
              instance.pauseAutoScroll()
            break
        }
      }

      $.eventListener('add', instance.carousel, 'keydown', instance.keyboardHandler)
    } catch (error) {
      console.error('CarouselAccessibility: Failed to setup keyboard navigation', error)
    }
  },

  setupFocusManagement (instance) {
    try {
      // Ensure navigation buttons are properly focusable
      if (instance.prevBtn) {
        instance.prevBtn.setAttribute(CarouselConfig.attr.tabIndex, '0')
      }
      if (instance.nextBtn) {
        instance.nextBtn.setAttribute(CarouselConfig.attr.tabIndex, '0')
      }

    } catch (error) {
      console.error('CarouselAccessibility: Failed to setup focus management', error)
    }
  }
}

const CarouselDetection = {
  observer: null,
  observerSetup: false,
  resizeHandler: null,

  setResizeObserver () {
    if (this.observerSetup) return this.observer

    const handleResize = () => {
      CarouselCache.clear()

      // Handle traditional instances
      CarouselController.instances.forEach((instance) => {
        instance.handleResize()
      })

      // Handle viewport-managed instances
      CarouselViewportManager.activeCarousels.forEach((instance) => {
        if (instance && instance.handleResize) {
          instance.handleResize()
        }
      })
    }

    const { observer, cleanup: resizeObserverCleanup } = $.resizeObserver(handleResize, {
      debounceTime: 100
    })

    this.resizeHandler = $.debounce(handleResize, 150)
    $.eventListener('add', window, 'resize', this.resizeHandler, { passive: true })

    this.observer = observer
    this.observerSetup = true
    this.resizeObserverCleanup = resizeObserverCleanup

    return this.observer
  },

  cleanup () {
    if (this.resizeObserverCleanup) this.resizeObserverCleanup()

    if (this.resizeHandler) {
      $.eventListener('remove', window, 'resize', this.resizeHandler, { passive: true })
      this.resizeHandler = null
    }

    this.observer = null
    this.observerSetup = false
  }
}

const CarouselController = {
  instances: [],

  createInstance (carousel) {
    // Batch DOM queries for better performance
    const elements = {
      wrapper: carousel.querySelector(CarouselConfig.selector.wrapper),
      items: carousel.querySelectorAll(CarouselConfig.selector.item),
      prevBtn: carousel.querySelector(CarouselConfig.selector.prev),
      nextBtn: carousel.querySelector(CarouselConfig.selector.next)
    }

    if (!elements.wrapper || !elements.items.length) return null

    const timerVal = carousel.getAttribute(CarouselConfig.attr.timer),
      visibleSlides = CarouselCalculator.getVisibleSlidesCount(carousel),
      maxTranslateIndex = CarouselCalculator.getMaxTranslateIndex(carousel, elements.items.length)

    const instance = {
      carousel,
      wrapper: elements.wrapper,
      items: elements.items,
      prevBtn: elements.prevBtn,
      nextBtn: elements.nextBtn,
      currentIndex: 0,
      maxIndex: maxTranslateIndex,
      totalSlides: elements.items.length,
      visibleSlides,
      timer: $.is(timerVal, 'string') && timerVal.length > 0 ? parseInt(timerVal) * 1000 : 0,
      autoScrollTimer: null,
      isPaused: false,
      throttler: null,
      eventHandlers: {
        prev: null,
        next: null,
        mouseenter: null,
        mouseleave: null,
        touchstart: null,
        touchmove: null,
        touchend: null,
        wheel: null
      },
      touch: null,
      wheelState: null,
      wheelResumeTimer: null,
      keyboardHandler: null,
      liveRegion: null,

      init () {
        try {
          this.setupEventHandlers()
          this.setupTouchHandlers()
          this.updateControlsVisibility()
          this.startAutoScroll()
          CarouselAccessibility.setupAccessibility(this)

          this.preloadCarouselImages()

          // Handle state restoration after initialization is complete
          if (this.needsStateRestore && this.restoreTargetIndex !== undefined) {
            // Restore to the saved slide position
            this.goToSlide(this.restoreTargetIndex)
            this.needsStateRestore = false
            this.restoreTargetIndex = undefined
          }

          this.markInitialized()
        } catch (error) {
          console.error('Carousel: Failed to initialize', error)
        }
      },

      preloadCarouselImages () {
        try {
          const images = this.carousel.querySelectorAll(CarouselConfig.selector.imageHidden)
          if (!images.length || !$.imageLoader) return

          images.forEach((img) => $.imageLoader.loadImage(img))
        } catch (error) {
          console.error('Carousel: Failed to preload images', error)
        }
      },

      getCurrentTransform () {
        try {
          const transform = this.wrapper.style.transform
          if (!transform || transform === 'none') return 0

          const matrix = transform.match(/translateX?\(([^)]+)\)/)
          if (matrix && matrix[1]) return parseFloat(matrix[1]) || 0

          return 0
        } catch (error) {
          console.error('Carousel: Failed to get current transform', error)
          return 0
        }
      },

      setupTouchHandlers () {
        try {
          this.eventHandlers.touchstart = (event) => CarouselTouch.handleTouchStart(this, event)
          this.eventHandlers.touchmove = (event) => CarouselTouch.handleTouchMove(this, event)
          this.eventHandlers.touchend = (event) => CarouselTouch.handleTouchEnd(this, event)
          this.eventHandlers.wheel = (event) => CarouselTouch.handleWheelEvent(this, event)

          $.eventListener('add', this.wrapper, 'touchstart', this.eventHandlers.touchstart, { passive: false })
          $.eventListener('add', this.wrapper, 'touchmove', this.eventHandlers.touchmove, { passive: false })
          $.eventListener('add', this.wrapper, 'touchend', this.eventHandlers.touchend, { passive: false })
          $.eventListener('add', this.carousel, 'wheel', this.eventHandlers.wheel, { passive: false })
        } catch (error) {
          console.error('Carousel: Failed to setup touch handlers', error)
        }
      },

      setupEventHandlers () {
        const hasPause = this.carousel.classList.contains(CarouselConfig.classes.pause)
        const eventPrevClick = () => {
          this.eventHandlers.prev = () => this.goToPrev()
          $.eventListener('add', this.prevBtn, 'click', this.eventHandlers.prev)
        }
        const eventNextClick = () => {
          this.eventHandlers.next = () => this.goToNext()
          $.eventListener('add', this.nextBtn, 'click', this.eventHandlers.next)
        }
        const eventPause = () => {
          this.eventHandlers.mouseenter = () => this.pauseAutoScroll()
          this.eventHandlers.mouseleave = () => this.resumeAutoScroll()
          this.eventHandlers.touchstart = () => this.pauseAutoScroll()
          this.eventHandlers.touchend = () => this.resumeAutoScroll()

          $.eventListener('add', this.carousel, 'mouseenter', this.eventHandlers.mouseenter)
          $.eventListener('add', this.carousel, 'mouseleave', this.eventHandlers.mouseleave)
          $.eventListener('add', this.carousel, 'touchstart', this.eventHandlers.touchstart, { passive: true })
          $.eventListener('add', this.carousel, 'touchend', this.eventHandlers.touchend, { passive: true })
        }

        if (this.prevBtn) eventPrevClick()
        if (this.nextBtn) eventNextClick()
        if (this.timer > 0 && hasPause) eventPause()
      },

      goToPrev () {
        const prevIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.maxIndex
        this.goToSlide(prevIndex)
      },

      goToNext () {
        const nextIndex = this.currentIndex < this.maxIndex ? this.currentIndex + 1 : 0
        this.goToSlide(nextIndex)
      },

      goToSlide (targetIndex) {
        try {
          if (targetIndex === this.currentIndex) return

          const newIndex = Math.max(0, Math.min(targetIndex, this.maxIndex))
          if (newIndex === this.currentIndex) return

          this.currentIndex = newIndex

          const translateX = CarouselCalculator.getTranslateValue(this.carousel, this.currentIndex)
          CarouselRenderer.setSlideEffect(this.wrapper, translateX)

          // Announce slide change for accessibility
          CarouselAccessibility.announceSlideChange(this)
        } catch (error) {
          console.error('Carousel: Failed to go to slide', error)
        }
      },


      startAutoScroll () {
        if (this.timer <= 0) return

        this.autoScrollTimer = setInterval(() => {
          if (!this.isPaused) this.goToNext()
        }, this.timer)
      },

      pauseAutoScroll () {
        this.isPaused = true
      },

      resumeAutoScroll () {
        this.isPaused = false
      },

      stopAutoScroll () {
        if (!this.autoScrollTimer) return null
        clearInterval(this.autoScrollTimer)
        this.autoScrollTimer = null
      },

      updateControlsVisibility () {
        // Add small delay to ensure DOM is fully rendered and styles are applied
        setTimeout(() => {
          const read = () => {
            return CarouselCalculator.shouldShowControls(this.carousel)
          }

          const write = (shouldShow) => {
            CarouselRenderer.toggleControls(this.carousel, !shouldShow)
          }

          $.frameSequence(read, write)
        }, 50) // Small delay to ensure proper dimensions
      },

      handleResize () {
        const read = () => {
          // Force cache invalidation for this specific carousel (both mobile and desktop)
          const carouselId = this.carousel.dataset.carouselId
          CarouselCache.delete(`slideWidth-${carouselId}-mobile`)
          CarouselCache.delete(`slideWidth-${carouselId}-desktop`)
          CarouselCache.delete(`gap-${carouselId}-mobile`)
          CarouselCache.delete(`gap-${carouselId}-desktop`)

          // Read current state and calculate new bounds
          const newVisibleSlides = CarouselCalculator.getVisibleSlidesCount(this.carousel),
            newMaxIndex = CarouselCalculator.getMaxTranslateIndex(this.carousel, this.totalSlides)

          return {
            newVisibleSlides,
            newMaxIndex,
            currentIndex: this.currentIndex
          }
        }

        const write = (data) => {
          const { newVisibleSlides, newMaxIndex, currentIndex } = data

          // Update instance properties
          this.visibleSlides = newVisibleSlides
          this.maxIndex = newMaxIndex

          // If controls are no longer needed, reset to beginning
          const resetHandler = () => {
            this.currentIndex = 0
            this.stopAutoScroll() // Stop auto-scroll when no navigation is needed
          }

          const resumeHandler = () => {
            // Ensure current index is within new bounds
            if (currentIndex > newMaxIndex) this.currentIndex = newMaxIndex

            // Restart auto-scroll if it was configured and we need navigation
            if (this.timer > 0 && !this.autoScrollTimer) this.startAutoScroll()
          }

          newMaxIndex === 0 ? resetHandler() : resumeHandler()

          // Update controls visibility with small delay to ensure proper calculations
          setTimeout(() => {
            this.updateControlsVisibility()
          }, 100)

          const translateX = CarouselCalculator.getTranslateValue(this.carousel, this.currentIndex)
          CarouselRenderer.setSlideEffect(this.wrapper, translateX)
        }

        $.frameSequence(read, write)
      },

      markInitialized () {
        const initialized = () => {
          $.toggleClass(this.carousel, CarouselConfig.classes.initialized, true)
        }

        $.batchDOM(initialized)
      },

      cleanup () {
        try {
          this.stopAutoScroll()

          // Remove navigation event handlers
          if (this.eventHandlers.prev && this.prevBtn) {
            $.eventListener('remove', this.prevBtn, 'click', this.eventHandlers.prev)
          }
          if (this.eventHandlers.next && this.nextBtn) {
            $.eventListener('remove', this.nextBtn, 'click', this.eventHandlers.next)
          }

          // Remove hover/touch handlers for auto-scroll
          if (this.timer > 0 && this.carousel.classList.contains(CarouselConfig.classes.pause)) {
            if (this.eventHandlers.mouseenter) {
              $.eventListener('remove', this.carousel, 'mouseenter', this.eventHandlers.mouseenter)
            }
            if (this.eventHandlers.mouseleave) {
              $.eventListener('remove', this.carousel, 'mouseleave', this.eventHandlers.mouseleave)
            }
          }

          // Remove touch gesture handlers
          if (this.eventHandlers.touchstart) {
            $.eventListener('remove', this.wrapper, 'touchstart', this.eventHandlers.touchstart, { passive: false })
          }
          if (this.eventHandlers.touchmove) {
            $.eventListener('remove', this.wrapper, 'touchmove', this.eventHandlers.touchmove, { passive: false })
          }
          if (this.eventHandlers.touchend) {
            $.eventListener('remove', this.wrapper, 'touchend', this.eventHandlers.touchend, { passive: false })
          }

          // Remove wheel event handler
          if (this.eventHandlers.wheel) {
            $.eventListener('remove', this.carousel, 'wheel', this.eventHandlers.wheel, { passive: false })
          }

          // Clean up wheel timers
          if (this.wheelState && this.wheelState.debounceTimer) {
            clearTimeout(this.wheelState.debounceTimer)
          }
          if (this.wheelResumeTimer) {
            clearTimeout(this.wheelResumeTimer)
          }

          // Remove keyboard handler
          if (this.keyboardHandler) {
            $.eventListener('remove', this.carousel, 'keydown', this.keyboardHandler)
          }

          // Remove live region
          if (this.liveRegion && this.liveRegion.parentNode) {
            this.liveRegion.parentNode.removeChild(this.liveRegion)
          }

          return null
        } catch (error) {
          console.error('Carousel: Failed to cleanup', error)
          return null
        }
      }
    }

    return instance
  },

  init () {
    if (!CarouselDOM.init()) return null

    CarouselDetection.setResizeObserver()
    CarouselViewportManager.init()

    const carousels = CarouselDOM.elements.carousels,
      isMobile = $.viewportSize().width < CarouselConfig.viewport.mobileBreakpoint

    // Load carousels in chunks: immediate + lazy
    const immediateCount = isMobile ? 2 : 4 // Load first 2 on mobile, 4 on desktop immediately

    carousels.forEach((carousel, index) => {
      carousel.dataset.carouselId = `carousel-${index}`

      if (index < immediateCount) {
        // Load first few carousels immediately
        CarouselViewportManager.observe(carousel)
      } else {
        // Lazy load remaining carousels with device-specific delays
        const carouselPosition = index - immediateCount // 0, 1, 2, 3...

        let delay
        if (isMobile) {
          // Mobile: Progressive staggered delays - 2s, 4.5s, 7s, 9.5s...
          const baseDelay = 2000 // Start at 2s
          const increment = 2500 // Increase by 2.5s each time
          delay = baseDelay + (carouselPosition * increment)
        } else {
          // Desktop: Shorter, consistent delays - 1s, 2s, 3s, 4s...
          delay = (carouselPosition + 1) * 1000
        }

        CarouselViewportManager.observeLazy(carousel, delay)
      }
    })

    return this.cleanup.bind(this)
  },


  cleanup () {
    this.instances.forEach((instance) => {
      if (instance.cleanup) instance.cleanup()
    })
    this.instances = []

    CarouselViewportManager.cleanup()
    CarouselInstancePool.cleanup()
    CarouselDetection.cleanup()
    CarouselDOM.cleanup()
    return null
  }
}

const handleCarousels = () => {
  return CarouselController.init()
}

const initCarousels = () => {
  $.cleanup('cleanupCarousels', handleCarousels)
}

initCarousels()
