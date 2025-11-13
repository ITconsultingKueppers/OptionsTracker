import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

// Initialize Yahoo Finance instance
const yahooFinance = new YahooFinance()

// Simple in-memory cache for stock prices
interface PriceCache {
  price: number
  timestamp: number
}

const priceCache = new Map<string, PriceCache>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// GET /api/stock-price/[ticker] - Get current stock price
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params
    const upperTicker = ticker.toUpperCase()

    // Check cache first
    const now = Date.now()
    const cached = priceCache.get(upperTicker)

    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return NextResponse.json({
        ticker: upperTicker,
        price: cached.price,
        timestamp: new Date(cached.timestamp).toISOString(),
        cached: true,
      })
    }

    // Fetch from Yahoo Finance
    const quote = await yahooFinance.quote(upperTicker)

    if (!quote || !quote.regularMarketPrice) {
      return NextResponse.json(
        { error: `No price data available for ${upperTicker}` },
        { status: 404 }
      )
    }

    const price = quote.regularMarketPrice

    // Update cache
    priceCache.set(upperTicker, {
      price,
      timestamp: now,
    })

    return NextResponse.json({
      ticker: upperTicker,
      price,
      timestamp: new Date().toISOString(),
      cached: false,
    })
  } catch (error) {
    console.error('Error fetching stock price:', error)

    // Check if it's an invalid ticker error
    if (error instanceof Error && error.message.includes('Not Found')) {
      return NextResponse.json(
        { error: 'Invalid ticker symbol' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch stock price' },
      { status: 500 }
    )
  }
}
