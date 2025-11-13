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

    // Get existing position to merge data for calculations
    const existingPosition = await prisma.optionPosition.findUnique({
      where: { id },
    })

    if (!existingPosition) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 })
    }

    // Merge existing and new data for calculations
    const mergedData = {
      ...existingPosition,
      ...updateData,
    }

    // Calculate metrics
    const metrics = calculatePositionMetrics(mergedData)

    // Update position
    const position = await prisma.optionPosition.update({
      where: { id },
      data: {
        ...updateData,
        status: metrics.status,
        realizedPL: metrics.realizedPL,
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
