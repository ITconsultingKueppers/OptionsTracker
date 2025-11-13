import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createOptionPositionSchema } from '@/lib/validations'
import { z } from 'zod'

// Helper function to calculate status and P/L
function calculatePositionMetrics(position: any) {
  let status = 'open'
  let realizedPL = null
  let premiumRealizedPL = null
  let stockRealizedPL = null

  // Determine status
  if (position.closeDate) {
    status = 'closed'
  } else if (position.assigned && position.ownsStock) {
    status = 'assigned' // Has stock, might sell calls on it
  }

  // Calculate realized P/L for closed positions
  if (status === 'closed') {
    // 1. Premium component (always present for options)
    const premiumCollected = position.premium * position.contracts * 100
    const premiumPaid = (position.premiumPaidToClose || 0) * position.contracts * 100
    const fees = (position.openFees || 0) + (position.closeFees || 0)
    premiumRealizedPL = premiumCollected - premiumPaid - fees

    // 2. Stock component (only if stock was bought and sold)
    if (position.stockSalePrice && position.stockCostBasis && position.stockQuantity) {
      const stockGain = (position.stockSalePrice - position.stockCostBasis) * position.stockQuantity
      stockRealizedPL = stockGain
    } else {
      stockRealizedPL = 0
    }

    // 3. Total Realized P/L = Premium + Stock
    realizedPL = premiumRealizedPL + stockRealizedPL
  } else if (status === 'assigned') {
    // For assigned positions (e.g., put assignment), premium is realized but stock is not yet sold
    const premiumCollected = position.premium * position.contracts * 100
    const fees = (position.openFees || 0)
    premiumRealizedPL = premiumCollected - fees
    stockRealizedPL = 0 // Stock not sold yet
    realizedPL = premiumRealizedPL // Only premium is realized
  }

  return { status, realizedPL, premiumRealizedPL, stockRealizedPL }
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

    // Auto-calculate stock quantity if ownsStock but no quantity provided
    const stockQuantity = validatedData.ownsStock && !validatedData.stockQuantity
      ? validatedData.contracts * 100
      : validatedData.stockQuantity || null

    // Calculate metrics
    const metrics = calculatePositionMetrics({
      ...validatedData,
      stockQuantity,
      closeDate,
    })

    // Auto-generate wheelCycleName from stockTicker
    const wheelCycleName = validatedData.stockTicker

    // Create position in database
    const position = await prisma.optionPosition.create({
      data: {
        wheelCycleName,
        continueExistingWheel: false, // No longer user-controlled, always false
        openDate,
        stockTicker: validatedData.stockTicker,
        expiration,
        type: validatedData.type,
        contracts: validatedData.contracts,
        strike: validatedData.strike,
        premium: validatedData.premium,
        ownsStock: validatedData.ownsStock,
        stockCostBasis: validatedData.stockCostBasis || null,
        stockQuantity,
        stockAcquisitionDate: validatedData.stockAcquisitionDate
          ? (typeof validatedData.stockAcquisitionDate === 'string'
              ? new Date(validatedData.stockAcquisitionDate)
              : validatedData.stockAcquisitionDate)
          : null,
        stockSalePrice: validatedData.stockSalePrice || null,
        stockSaleDate: validatedData.stockSaleDate
          ? (typeof validatedData.stockSaleDate === 'string'
              ? new Date(validatedData.stockSaleDate)
              : validatedData.stockSaleDate)
          : null,
        assigned: validatedData.assigned,
        openFees: validatedData.openFees || null,
        closeDate,
        premiumPaidToClose: validatedData.premiumPaidToClose || null,
        closeFees: validatedData.closeFees || null,
        notes: validatedData.notes || null,
        status: metrics.status,
        realizedPL: metrics.realizedPL,
        premiumRealizedPL: metrics.premiumRealizedPL,
        stockRealizedPL: metrics.stockRealizedPL,
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
