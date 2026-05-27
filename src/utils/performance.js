import { trackTiming } from './analytics'

export const measurePerformance = () => {
  if (!window.performance || import.meta.env.DEV) {
    return
  }

  window.addEventListener('load', () => {
    setTimeout(() => {
      const navigation = performance.getEntriesByType('navigation')[0]
      
      if (navigation) {
        trackTiming('page_load_time', Math.round(navigation.loadEventEnd - navigation.fetchStart))
        trackTiming('dom_content_loaded', Math.round(navigation.domContentLoadedEventEnd - navigation.fetchStart))
        trackTiming('first_paint', Math.round(navigation.responseEnd - navigation.fetchStart))
      }

      const paintEntries = performance.getEntriesByType('paint')
      paintEntries.forEach((entry) => {
        trackTiming(entry.name, Math.round(entry.startTime))
      })

      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === 'largest-contentful-paint') {
              trackTiming('largest_contentful_paint', Math.round(entry.startTime))
            }
          })
        })
        
        try {
          observer.observe({ entryTypes: ['largest-contentful-paint'] })
        } catch {
          console.warn('Performance observer not supported')
        }
      }
    }, 1000)
  })
}

export const measureWebVitals = async () => {
  if (import.meta.env.DEV) {
    return
  }

  try {
    const { getCLS, getFID, getFCP, getLCP, getTTFB } = await import('web-vitals')
    
    getCLS((metric) => trackTiming('cumulative_layout_shift', metric.value * 1000))
    getFID((metric) => trackTiming('first_input_delay', metric.value))
    getFCP((metric) => trackTiming('first_contentful_paint', metric.value))
    getLCP((metric) => trackTiming('largest_contentful_paint', metric.value))
    getTTFB((metric) => trackTiming('time_to_first_byte', metric.value))
  } catch (error) {
    console.warn('Web Vitals not available:', error)
  }
}
