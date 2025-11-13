import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/metrics - Calculate portfolio metrics
export async function GET(request: NextRequest) {
  try {
    // Fetch all positions
    const positions = await prisma.optionPosition.findMany()

    // Calculate metrics
    const metrics = {
      totalPositions: positions.length,
      openPositions: positions.filter((p) => p.status === 'open').length,
      closedPositions: positions.filter((p) => p.status === 'closed').length,
      assignedPositions: positions.filter((p) => p.status === 'assigned').length,
      realizedPL: 0,
      unrealizedPL: 0,
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

        // Realized P/L
        if (position.realizedPL) {
          metrics.realizedPL += position.realizedPL
        }
      } else if (position.status === 'open') {
        // For open positions: this is potential premium (not yet realized)
        metrics.openPremiumCollected += premiumCollected

        // Unrealized P/L for open positions is just premium collected minus open fees
        metrics.unrealizedPL += premiumCollected - (position.openFees || 0)
      } else if (position.status === 'assigned') {
        // Assigned positions - premium was collected but stock was assigned
        metrics.closedPremiumCollected += premiumCollected
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

    // Round to 2 decimal places
    metrics.realizedPL = Math.round(metrics.realizedPL * 100) / 100
    metrics.unrealizedPL = Math.round(metrics.unrealizedPL * 100) / 100
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
