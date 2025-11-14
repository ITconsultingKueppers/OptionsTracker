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

// PATCH /api/positions/[id] - Update position
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Validate input (partial validation for updates)
    const validatedData = createOptionPositionSchema.partial().parse(body)

    // Convert date strings to Date objects if present
    const updateData: any = { ...validatedData }

    if (updateData.openDate) {
      updateData.openDate =
        typeof updateData.openDate === 'string'
          ? new Date(updateData.openDate)
          : updateData.openDate
    }

    if (updateData.expiration) {
      updateData.expiration =
        typeof updateData.expiration === 'string'
          ? new Date(updateData.expiration)
          : updateData.expiration
    }

    if (updateData.closeDate) {
      updateData.closeDate =
        typeof updateData.closeDate === 'string'
          ? new Date(updateData.closeDate)
          : updateData.closeDate
    }

    if (updateData.stockAcquisitionDate) {
      updateData.stockAcquisitionDate =
        typeof updateData.stockAcquisitionDate === 'string'
          ? new Date(updateData.stockAcquisitionDate)
          : updateData.stockAcquisitionDate
    }

    if (updateData.stockSaleDate) {
      updateData.stockSaleDate =
        typeof updateData.stockSaleDate === 'string'
          ? new Date(updateData.stockSaleDate)
          : updateData.stockSaleDate
    }

    // Convert empty strings to null for optional date fields
    if (updateData.closeDate === '') updateData.closeDate = null
    if (updateData.stockAcquisitionDate === '') updateData.stockAcquisitionDate = null
    if (updateData.stockSaleDate === '') updateData.stockSaleDate = null

    // Get existing position to merge data for calculations
    const existingPosition = await prisma.optionPosition.findUnique({
      where: { id },
    })

    if (!existingPosition) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 })
    }

    // Auto-generate wheelCycleName from stockTicker if stockTicker is being updated
    if (updateData.stockTicker) {
      updateData.wheelCycleName = updateData.stockTicker
    }

    // Merge existing and new data for calculations
    const mergedData = {
      ...existingPosition,
      ...updateData,
    }

    // Auto-calculate stock quantity if ownsStock but no quantity provided
    const stockQuantity = (mergedData.ownsStock && !mergedData.stockQuantity)
      ? mergedData.contracts * 100
      : mergedData.stockQuantity || null

    // Update merged data with calculated quantity
    const mergedDataWithQuantity = {
      ...mergedData,
      stockQuantity
    }

    // Calculate metrics
    const metrics = calculatePositionMetrics(mergedDataWithQuantity)

    // Update position
    const position = await prisma.optionPosition.update({
      where: { id },
      data: {
        ...updateData,
        stockQuantity,
        status: metrics.status,
        realizedPL: metrics.realizedPL,
        premiumRealizedPL: metrics.premiumRealizedPL,
        stockRealizedPL: metrics.stockRealizedPL,
      },
    })

    return NextResponse.json(position)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating position:', error)
    return NextResponse.json(
      { error: 'Failed to update position' },
      { status: 500 }
    )
  }
}

// DELETE /api/positions/[id] - Delete position
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.optionPosition.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting position:', error)
    return NextResponse.json(
      { error: 'Failed to delete position' },
      { status: 500 }
    )
  }
}

// GET /api/positions/[id] - Get single position
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const position = await prisma.optionPosition.findUnique({
      where: { id },
    })

    if (!position) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 })
    }

    return NextResponse.json(position)
  } catch (error) {
    console.error('Error fetching position:', error)
    return NextResponse.json(
      { error: 'Failed to fetch position' },
      { status: 500 }
    )
  }
}
