const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
}

const CURRENT_LOG_LEVEL = import.meta.env.DEV ? LOG_LEVELS.DEBUG : LOG_LEVELS.ERROR

class Logger {
  constructor(context = 'App') {
    this.context = context
  }

  error(message, data = {}) {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.ERROR) {
      console.error(`[${this.context}] ERROR:`, message, data)
      
      if (import.meta.env.PROD && window.gtag) {
        window.gtag('event', 'exception', {
          description: `${this.context}: ${message}`,
          fatal: false,
          ...data,
        })
      }
    }
  }

  warn(message, data = {}) {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.WARN) {
      console.warn(`[${this.context}] WARN:`, message, data)
    }
  }

  info(message, data = {}) {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.INFO) {
      console.info(`[${this.context}] INFO:`, message, data)
    }
  }

  debug(message, data = {}) {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.DEBUG) {
      console.log(`[${this.context}] DEBUG:`, message, data)
    }
  }

  setContext(context) {
    this.context = context
    return this
  }
}

export const createLogger = (context) => new Logger(context)
