/**
 * Optimized Core Utilities (critical subset)
 */
window.Utils = window.Utils || {}
window.$ = window.Utils

// Core type checking - critical for safe operation
Utils.is = (value, type) => {
  switch (type) {
    case 'function': return typeof value === 'function'
    case 'undefined': return typeof value === 'undefined'
    case 'string': return typeof value === 'string'
    case 'number': return typeof value === 'number' && !isNaN(value)
    case 'boolean': return typeof value === 'boolean'
    case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value)
    case 'array': return Array.isArray(value)
    case 'null': return value === null
    default: return false
  }
}

// Connection speed detection - important for adaptive loading
Utils.slowConnection = () => {
  if (!navigator.connection) return false
  const connectionType = navigator.connection.effectiveType
  return connectionType === '2g' || connectionType === 'slow-2g'
}

// Viewport detection - critical for responsive behavior
Utils.inViewport = (element) => {
  if (!element) return false
  const rect = element.getBoundingClientRect()
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  )
}

// Viewport dimensions - widely used for responsive components
Utils.viewportSize = () => ({
  width: window.innerWidth,
  height: window.innerHeight
})

// Animation frame utilities - critical for performance
Utils.nextFrame = (callback) => window.requestAnimationFrame(callback)

// Cleanup function with the global theme cleanup system
Utils.cleanup = (cleanupName, handler) => {
  if (!cleanupName || !$.is(handler, 'function')) return

  window[cleanupName] = handler()

  // Ensure cleanup is idempotent
  const originalCleanup = window[cleanupName]
  window[cleanupName] = () => {
    if (!$.is(originalCleanup, 'function')) return
    originalCleanup()
    window[cleanupName] = () => {} // Replace with no-op after cleanup
  }

  if (window.themeCleanup) {
    const originalThemeCleanup = window.themeCleanup
    window.themeCleanup = () => {
      if (window[cleanupName]) window[cleanupName]()
      originalThemeCleanup()
    }
  }
}

// Observer utilities - critical for modern performance patterns
Utils.intersectionObserver = (callback, customOptions = {}) => {
  const defaultOptions = {
    root: null,
    rootMargin: '100px',
    threshold: 0.01
  }
  return new IntersectionObserver(callback, { ...defaultOptions, ...customOptions })
}

// Performance utilities
Utils.requestIdle = (callback, options = {}) => {
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, options)
  }
  const timeout = options.timeout || 50,
    startTime = Date.now()
  return setTimeout(() => {
    callback({
      didTimeout: false,
      timeRemaining: () => Math.max(0, 50 - (Date.now() - startTime))
    })
  }, timeout)
}

Utils.debounce = (func, wait) => {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      clearTimeout(timeout)
      func(...args)
    }, wait)
  }
}

// DOM utilities - for efficient class toggling
Utils.toggleClass = (element, className, force) => {
  if (!element) return
  $.is(force, 'boolean') ?
    element.classList.toggle(className, force) :
    element.classList.toggle(className)
}

// Feature detection for modern image loading
Utils.isFetchPriority = () => 'fetchPriority' in HTMLImageElement.prototype

// Batches DOM operations to prevent layout thrashing
Utils.batchDOM = (callback) => {
  return $.nextFrame(() => callback())
}

// Separates DOM reads and writes to optimize performance
Utils.frameSequence = (readCallback, writeCallback) => {
  return $.nextFrame(() => {
    const result = readCallback()
    $.nextFrame(() => {
      writeCallback(result)
    })
  })
}

// Event management - most widely used utility
Utils.eventListener = (method, nodes, event, handler, options) => {
  if (!nodes) return

  // Handle single object case
  if (nodes === window ||
    nodes === document ||
    nodes instanceof HTMLElement ||
    (typeof nodes === 'object' &&
      ($.is(nodes.addEventListener, 'function')))) {
    if (method === 'add') nodes.addEventListener(event, handler, options)
    if (method === 'remove') nodes.removeEventListener(event, handler, options)
    return
  }

  if (!nodes.length) return

  Array.from(nodes).forEach((node) => {
    if (!node || $.is(node.addEventListener, 'function')) return
    if (method === 'add') node.addEventListener(event, handler, options)
    if (method === 'remove') node.removeEventListener(event, handler, options)
  })
}

// Element dimension calculations with transform support
Utils.getDimensions = (element) => {
  if (!element) return { width: 0, height: 0 }
  const rect = element.getBoundingClientRect()
  return {
    width: rect.width,
    height: rect.height
  }
}

// Cached DOM dimensions with automatic invalidation
Utils.getCachedDimensions = (() => {
  const cache = new Map()
  const resizeObserver = new ResizeObserver((entries) => {
    // Clear cache for resized elements
    entries.forEach(entry => cache.delete(entry.target))
  })

  return (element) => {
    if (!element) return { width: 0, height: 0, offsetWidth: 0, clientWidth: 0 }

    if (cache.has(element)) {
      return cache.get(element)
    }

    const dimensions = {
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
      offsetWidth: element.offsetWidth,
      clientWidth: element.clientWidth
    }

    cache.set(element, dimensions)
    resizeObserver.observe(element)

    return dimensions
  }
})()

// Touch device detection
Utils.isTouchDevice = () => {
  return (
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0) ||
    (navigator.msMaxTouchPoints > 0)
  )
}

// Cached mobile detection based on viewport width
Utils.isMobile = (() => {
  let cachedResult = null
  let cachedWidth = null

  return (breakpoint = 992) => {
    const currentWidth = window.innerWidth

    // Return cached result if width hasn't changed
    if (cachedResult !== null && cachedWidth === currentWidth) {
      return cachedResult
    }

    // Update cache
    cachedWidth = currentWidth
    cachedResult = currentWidth < breakpoint
    return cachedResult
  }
})()

// Generic memoization utility with TTL and key-based invalidation
Utils.memoize = (fn, options = {}) => {
  const cache = new Map()
  const { ttl = 30000, maxSize = 100 } = options // 30s TTL, max 100 entries

  return (...args) => {
    const key = JSON.stringify(args)
    const now = Date.now()

    // Check if cached result exists and is still valid
    if (cache.has(key)) {
      const { result, timestamp } = cache.get(key)
      if (now - timestamp < ttl) {
        return result
      }
      cache.delete(key) // Remove expired entry
    }

    // Clean up cache if it gets too large
    if (cache.size >= maxSize) {
      const oldestKey = cache.keys().next().value
      cache.delete(oldestKey)
    }

    // Calculate and cache result
    const result = fn.apply(this, args)
    cache.set(key, { result, timestamp: now })
    return result
  }
}

// Batch DOM queries utility - reduces multiple querySelector calls
Utils.batchQuery = (element, selectors) => {
  const results = {}
  const selectorKeys = Object.keys(selectors)

  // Single traversal approach for better performance
  for (const key of selectorKeys) {
    const selector = selectors[key]
    if (Array.isArray(selector)) {
      // Handle array of selectors
      results[key] = selector.map(sel => element.querySelector(sel))
    } else if (selector.endsWith('All')) {
      // Handle querySelectorAll cases
      results[key] = element.querySelectorAll(selector.slice(0, -3))
    } else {
      // Handle single querySelector cases
      results[key] = element.querySelector(selector)
    }
  }

  return results
}
