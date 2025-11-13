import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMultipleStockPrices } from '@/lib/stock-price'

// GET /api/metrics - Calculate portfolio metrics
export async function GET(request: NextRequest) {
  try {
    // Fetch all positions
    const positions = await prisma.optionPosition.findMany()

    // Get unique tickers for positions with owned stock (for current price lookup)
    const stockTickers = new Set<string>()
    positions.forEach((position) => {
      if (position.ownsStock && position.stockTicker) {
        stockTickers.add(position.stockTicker)
      }
    })

    // Fetch current stock prices for unrealized P/L calculation
    const currentStockPrices = await getMultipleStockPrices(Array.from(stockTickers))

    // Calculate metrics
    const metrics = {
      totalPositions: positions.length,
      openPositions: positions.filter((p) => p.status === 'open').length,
      closedPositions: positions.filter((p) => p.status === 'closed').length,
      assignedPositions: positions.filter((p) => p.status === 'assigned').length,
      realizedPL: 0,
      premiumRealizedPL: 0, // Premium component of realized P/L
      stockRealizedPL: 0, // Stock component of realized P/L
      unrealizedPL: 0, // Total unrealized P/L (premium + stock)
      premiumUnrealizedPL: 0, // Open option premiums
      stockUnrealizedPL: 0, // Stock unrealized gains/losses
      openPremiumCollected: 0, // Premium from open positions (potential income)
      closedPremiumCollected: 0, // Actual premium collected from closed positions
      totalCapitalAllocated: 0,
      totalFees: 0,
    }

    // Calculate financial metrics
    positions.forEach((position) => {
      const premiumCollected = position.premium * position.contracts * 100
      const fees = (position.openFees || 0) + (position.closeFees || 0)

      metrics.totalFees += fees

      if (position.status === 'closed') {
        // For closed positions: actual premium collected is premium received minus premium paid to close
        const premiumPaidToClose = (position.premiumPaidToClose || 0) * position.contracts * 100
        const netPremium = premiumCollected - premiumPaidToClose
        metrics.closedPremiumCollected += netPremium

        // Realized P/L (total and components)
        if (position.realizedPL) {
          metrics.realizedPL += position.realizedPL
        }
        if (position.premiumRealizedPL) {
          metrics.premiumRealizedPL += position.premiumRealizedPL
        }
        if (position.stockRealizedPL) {
          metrics.stockRealizedPL += position.stockRealizedPL
        }
      } else if (position.status === 'open') {
        // For open positions: this is potential premium (not yet realized)
        metrics.openPremiumCollected += premiumCollected

        // Premium unrealized P/L for open options (premium collected minus open fees)
        const premiumUnrealized = premiumCollected - (position.openFees || 0)
        metrics.premiumUnrealizedPL += premiumUnrealized
      } else if (position.status === 'assigned') {
        // Assigned positions - premium was collected but stock was assigned
        metrics.closedPremiumCollected += premiumCollected

        // Premium Realized P/L for assigned positions (option is done, premium realized)
        if (position.premiumRealizedPL) {
          metrics.premiumRealizedPL += position.premiumRealizedPL
          metrics.realizedPL += position.premiumRealizedPL
        }

        // Stock unrealized P/L for assigned positions (owns stock but hasn't sold yet)
        if (position.ownsStock && position.stockCostBasis && position.stockQuantity) {
          const currentPrice = currentStockPrices.get(position.stockTicker.toUpperCase())
          if (currentPrice) {
            const stockUnrealized = (currentPrice - position.stockCostBasis) * position.stockQuantity
            metrics.stockUnrealizedPL += stockUnrealized
          }
        }
      }

      // Calculate capital allocated
      // For puts: capital at risk is strike × contracts × 100 (cash needed to buy shares)
      // For calls: if you own the stock, it's the stock value, otherwise it's theoretically unlimited
      if (position.status === 'open' || position.status === 'assigned') {
        if (position.type === 'put') {
          // For puts: capital required to buy shares if assigned
          const capitalRequired = position.strike * position.contracts * 100
          metrics.totalCapitalAllocated += capitalRequired
        } else if (position.type === 'call' && position.ownsStock) {
          // For covered calls: your stock value
          const stockValue = position.ownsStock && position.stockCostBasis
            ? position.stockCostBasis * position.contracts * 100
            : position.strike * position.contracts * 100
          metrics.totalCapitalAllocated += stockValue
        }
        // Note: naked calls have theoretically unlimited risk, so we don't add to capital allocated
      }
    })

    // Calculate total unrealized P/L (premium + stock)
    metrics.unrealizedPL = metrics.premiumUnrealizedPL + metrics.stockUnrealizedPL

    // Round to 2 decimal places
    metrics.realizedPL = Math.round(metrics.realizedPL * 100) / 100
    metrics.premiumRealizedPL = Math.round(metrics.premiumRealizedPL * 100) / 100
    metrics.stockRealizedPL = Math.round(metrics.stockRealizedPL * 100) / 100
    metrics.unrealizedPL = Math.round(metrics.unrealizedPL * 100) / 100
    metrics.premiumUnrealizedPL = Math.round(metrics.premiumUnrealizedPL * 100) / 100
    metrics.stockUnrealizedPL = Math.round(metrics.stockUnrealizedPL * 100) / 100
    metrics.openPremiumCollected = Math.round(metrics.openPremiumCollected * 100) / 100
    metrics.closedPremiumCollected = Math.round(metrics.closedPremiumCollected * 100) / 100
    metrics.totalCapitalAllocated = Math.round(metrics.totalCapitalAllocated * 100) / 100
    metrics.totalFees = Math.round(metrics.totalFees * 100) / 100

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error calculating metrics:', error)
    return NextResponse.json(
      { error: 'Failed to calculate metrics' },
      { status: 500 }
    )
  }
}
