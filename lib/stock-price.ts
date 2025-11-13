import yahooFinance from 'yahoo-finance2'

// In-memory cache for stock prices
interface PriceCache {
  price: number
  timestamp: number
}

const priceCache = new Map<string, PriceCache>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Get current stock price with 5-minute caching
 */
export async function getStockPrice(ticker: string): Promise<number | null> {
  try {
    const upperTicker = ticker.toUpperCase()
    const now = Date.now()

    // Check cache first
    const cached = priceCache.get(upperTicker)
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return cached.price
    }

    // Fetch from Yahoo Finance
    const quote = await yahooFinance.quote(upperTicker)

    if (!quote || !quote.regularMarketPrice) {
      console.warn(`No price data available for ${upperTicker}`)
      return null
    }

    const price = quote.regularMarketPrice

    // Update cache
    priceCache.set(upperTicker, {
      price,
      timestamp: now,
    })

    return price
  } catch (error) {
    console.error(`Error fetching stock price for ${ticker}:`, error)
    return null
  }
}

/**
 * Get multiple stock prices efficiently
 */
export async function getMultipleStockPrices(
  tickers: string[]
): Promise<Map<string, number>> {
  const prices = new Map<string, number>()

  // Fetch all prices in parallel
  const results = await Promise.allSettled(
    tickers.map(async (ticker) => {
      const price = await getStockPrice(ticker)
      return { ticker, price }
    })
  )

  // Collect successful results
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value.price !== null) {
      prices.set(result.value.ticker.toUpperCase(), result.value.price)
    }
  })

  return prices
}

/**
 * Clear the price cache (useful for testing or manual refresh)
 */
export function clearPriceCache() {
  priceCache.clear()
}
