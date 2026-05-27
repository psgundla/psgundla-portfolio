const GA_TRACKING_ID = import.meta.env.VITE_GA_TRACKING_ID
const ANALYTICS_ENABLED = import.meta.env.VITE_ANALYTICS_ENABLED === 'true'

export const initAnalytics = () => {
  if (!ANALYTICS_ENABLED || !GA_TRACKING_ID || import.meta.env.DEV) {
    return
  }

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  function gtag() {
    window.dataLayer.push(arguments)
  }
  window.gtag = gtag

  gtag('js', new Date())
  gtag('config', GA_TRACKING_ID, {
    page_title: document.title,
    page_location: window.location.href,
  })
}

export const trackTiming = (name, value, category = 'performance') => {
  if (!ANALYTICS_ENABLED || !window.gtag || import.meta.env.DEV) {
    return
  }

  window.gtag('event', 'timing_complete', {
    name: name,
    value: value,
    event_category: category,
  })
}
