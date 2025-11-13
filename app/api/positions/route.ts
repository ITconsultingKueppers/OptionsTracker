import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createOptionPositionSchema } from '@/lib/validations'
import { z } from 'zod'

// Helper function to calculate status and P/L
function calculatePositionMetrics(position: any) {
  let status = 'open'
  let realizedPL = null

  // Determine status
  if (position.closeDate) {
    status = 'closed'
  } else if (position.assigned) {
    status = 'assigned'
  }

  // Calculate realized P/L for closed positions
  if (status === 'closed') {
    const premiumCollected = position.premium * position.contracts * 100
    const premiumPaid = (position.premiumPaidToClose || 0) * position.contracts * 100
    const fees = (position.openFees || 0) + (position.closeFees || 0)
    realizedPL = premiumCollected - premiumPaid - fees
  }

  return { status, realizedPL }
}

// POST /api/positions - Create new position
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validatedData = createOptionPositionSchema.parse(body)

    // Convert date strings to Date objects
    const openDate = typeof validatedData.openDate === 'string'
      ? new Date(validatedData.openDate)
      : validatedData.openDate

    const expiration = typeof validatedData.expiration === 'string'
      ? new Date(validatedData.expiration)
      : validatedData.expiration

    const closeDate = validatedData.closeDate
      ? typeof validatedData.closeDate === 'string'
        ? new Date(validatedData.closeDate)
        : validatedData.closeDate
      : null

    // Calculate metrics
    const metrics = calculatePositionMetrics({
      ...validatedData,
      closeDate,
    })

    // Create position in database
    const position = await prisma.optionPosition.create({
      data: {
        wheelCycleName: validatedData.wheelCycleName || null,
        continueExistingWheel: validatedData.continueExistingWheel,
        openDate,
        stockTicker: validatedData.stockTicker,
        expiration,
        type: validatedData.type,
        contracts: validatedData.contracts,
        strike: validatedData.strike,
        premium: validatedData.premium,
        ownsStock: validatedData.ownsStock,
        stockCostBasis: validatedData.stockCostBasis || null,
        assigned: validatedData.assigned,
        openFees: validatedData.openFees || null,
        closeDate,
        premiumPaidToClose: validatedData.premiumPaidToClose || null,
        closeFees: validatedData.closeFees || null,
        notes: validatedData.notes || null,
        status: metrics.status,
        realizedPL: metrics.realizedPL,
      },
    })

    return NextResponse.json(position, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating position:', error)
    return NextResponse.json(
      { error: 'Failed to create position' },
      { status: 500 }
    )
  }
}

// GET /api/positions - Fetch all positions with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const stockSymbol = searchParams.get('stockSymbol')
    const type = searchParams.get('type')
    const status = searchParams.get('status')

    // Build filter object
    const where: any = {}

    if (stockSymbol && stockSymbol !== '') {
      where.stockTicker = {
        contains: stockSymbol.toUpperCase(),
      }
    }

    if (type && type !== 'all') {
      where.type = type
    }

    if (status && status !== 'all') {
      where.status = status
    }

    // Fetch positions
    const positions = await prisma.optionPosition.findMany({
      where,
      orderBy: {
        openDate: 'desc',
      },
    })

    return NextResponse.json(positions)
  } catch (error) {
    console.error('Error fetching positions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch positions' },
      { status: 500 }
    )
  }
}
