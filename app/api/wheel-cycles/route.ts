import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/wheel-cycles - Get aggregated wheel cycle data
export async function GET(request: NextRequest) {
  try {
    // Fetch all positions
    const positions = await prisma.optionPosition.findMany({
      orderBy: {
        openDate: 'asc',
      },
    })

    // Group positions by wheelCycleName
    const wheelCyclesMap = new Map<string, any>()

    positions.forEach((position) => {
      const cycleName = position.wheelCycleName || 'Uncategorized'

      if (!wheelCyclesMap.has(cycleName)) {
        wheelCyclesMap.set(cycleName, {
          name: cycleName,
          positions: [],
          totalPositions: 0,
          openPositions: 0,
          closedPositions: 0,
          totalPL: 0,
          realizedPL: 0,
          unrealizedPL: 0,
          totalPremiumCollected: 0,
          status: 'active',
        })
      }

      const cycle = wheelCyclesMap.get(cycleName)
      cycle.positions.push(position)
      cycle.totalPositions++

      // Count position types
      if (position.status === 'open' || position.status === 'assigned') {
        cycle.openPositions++
        cycle.status = 'active'

        // Calculate unrealized P/L for open positions
        const premiumCollected = position.premium * position.contracts * 100
        cycle.unrealizedPL += premiumCollected - (position.openFees || 0)
        cycle.totalPremiumCollected += premiumCollected
      } else if (position.status === 'closed') {
        cycle.closedPositions++

        // Add realized P/L
        if (position.realizedPL) {
          cycle.realizedPL += position.realizedPL
        }

        // Calculate premium for closed positions
        const premiumCollected = position.premium * position.contracts * 100
        const premiumPaid = (position.premiumPaidToClose || 0) * position.contracts * 100
        cycle.totalPremiumCollected += premiumCollected - premiumPaid
      }

      // Total P/L = realized + unrealized
      cycle.totalPL = cycle.realizedPL + cycle.unrealizedPL
    })

    // Determine status for each cycle (completed if all positions are closed)
    wheelCyclesMap.forEach((cycle) => {
      if (cycle.openPositions === 0 && cycle.closedPositions > 0) {
        cycle.status = 'completed'
      }
    })

    // Convert map to array and sort by total P/L (descending)
    const wheelCycles = Array.from(wheelCyclesMap.values())
      .map((cycle) => ({
        name: cycle.name,
        totalPositions: cycle.totalPositions,
        openPositions: cycle.openPositions,
        closedPositions: cycle.closedPositions,
        totalPL: Math.round(cycle.totalPL * 100) / 100,
        realizedPL: Math.round(cycle.realizedPL * 100) / 100,
        unrealizedPL: Math.round(cycle.unrealizedPL * 100) / 100,
        totalPremiumCollected: Math.round(cycle.totalPremiumCollected * 100) / 100,
        status: cycle.status,
      }))
      .sort((a, b) => {
        // Active cycles first, then by total P/L
        if (a.status === 'active' && b.status === 'completed') return -1
        if (a.status === 'completed' && b.status === 'active') return 1
        return b.totalPL - a.totalPL
      })

    return NextResponse.json(wheelCycles)
  } catch (error) {
    console.error('Error fetching wheel cycles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch wheel cycles' },
      { status: 500 }
    )
  }
}
