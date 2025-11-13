import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMultipleStockPrices } from '@/lib/stock-price'

export interface StockHolding {
  ticker: string
  quantity: number
  costBasis: number
  totalCostBasis: number
  currentPrice: number | null
  currentValue: number | null
  unrealizedPL: number | null
}

// GET /api/stock-holdings - Get all current stock holdings
export async function GET(request: NextRequest) {
  try {
    // Fetch all positions that own stock (open or assigned status)
    const positions = await prisma.optionPosition.findMany({
      where: {
        ownsStock: true,
        status: {
          in: ['open', 'assigned'],
        },
      },
    })

    // Group by ticker and sum quantities
    const holdingsMap = new Map<string, {
      quantity: number
      costBasis: number
      totalCost: number
    }>()

    positions.forEach((position) => {
      if (position.stockQuantity && position.stockCostBasis) {
        const existing = holdingsMap.get(position.stockTicker)
        if (existing) {
          // Average cost basis weighted by quantity
          const newTotalCost = existing.totalCost + (position.stockCostBasis * position.stockQuantity)
          const newTotalQuantity = existing.quantity + position.stockQuantity
          existing.quantity = newTotalQuantity
          existing.totalCost = newTotalCost
          existing.costBasis = newTotalCost / newTotalQuantity
        } else {
          holdingsMap.set(position.stockTicker, {
            quantity: position.stockQuantity,
            costBasis: position.stockCostBasis,
            totalCost: position.stockCostBasis * position.stockQuantity,
          })
        }
      }
    })

    // Get current prices for all tickers
    const tickers = Array.from(holdingsMap.keys())
    const currentPrices = await getMultipleStockPrices(tickers)

    // Build stock holdings array
    const holdings: StockHolding[] = []
    holdingsMap.forEach((holding, ticker) => {
      const currentPrice = currentPrices.get(ticker.toUpperCase()) || null
      const currentValue = currentPrice ? currentPrice * holding.quantity : null
      const totalCostBasis = holding.costBasis * holding.quantity
      const unrealizedPL = currentValue ? currentValue - totalCostBasis : null

      holdings.push({
        ticker,
        quantity: holding.quantity,
        costBasis: holding.costBasis,
        totalCostBasis,
        currentPrice,
        currentValue,
        unrealizedPL,
      })
    })

    // Sort by ticker name
    holdings.sort((a, b) => a.ticker.localeCompare(b.ticker))

    return NextResponse.json(holdings)
  } catch (error) {
    console.error('Error fetching stock holdings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock holdings' },
      { status: 500 }
    )
  }
}
