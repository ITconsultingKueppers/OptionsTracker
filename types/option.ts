// Type definitions for Options Trading

export type OptionType = 'put' | 'call'
export type OptionStatus = 'open' | 'closed' | 'assigned'

export interface OptionPosition {
  id: string
  createdAt: Date
  updatedAt: Date

  // Wheel cycle tracking
  wheelCycleName?: string | null
  continueExistingWheel: boolean

  // Position details - Required fields
  openDate: Date
  stockTicker: string
  expiration: Date
  type: OptionType
  contracts: number
  strike: number
  premium: number

  // Stock ownership tracking
  ownsStock: boolean
  stockCostBasis?: number | null

  // Status and assignment
  assigned: boolean
  status: OptionStatus

  // Optional closing details
  openFees?: number | null
  closeDate?: Date | null
  premiumPaidToClose?: number | null
  closeFees?: number | null
  notes?: string | null

  // Calculated fields
  realizedPL?: number | null
  unrealizedPL?: number | null
}

// Form input types (what user provides)
export interface CreateOptionPositionInput {
  // Wheel cycle
  wheelCycleName?: string
  continueExistingWheel: boolean

  // Required fields
  openDate: string | Date
  stockTicker: string
  expiration: string | Date
  type: OptionType
  contracts: number
  strike: number
  premium: number

  // Stock ownership
  ownsStock: boolean
  stockCostBasis?: number

  // Optional fields
  assigned: boolean
  openFees?: number
  closeDate?: string | Date
  premiumPaidToClose?: number
  closeFees?: number
  notes?: string
}

export interface UpdateOptionPositionInput extends Partial<CreateOptionPositionInput> {
  id: string
}

// Portfolio metrics
export interface PortfolioMetrics {
  totalPositions: number
  openPositions: number
  closedPositions: number
  assignedPositions: number
  realizedPL: number
  unrealizedPL: number
  openPremiumCollected: number // Premium from open positions
  closedPremiumCollected: number // Premium actually collected from closed positions
  totalCapitalAllocated: number // Capital at risk (strike × contracts × 100 for puts, stock value for calls)
  totalFees: number
}

// Filter options
export interface PositionFilters {
  stockSymbol?: string
  type?: 'all' | OptionType
  status?: 'all' | OptionStatus
}

// Wheel cycle summary (from API)
export interface WheelCycleSummary {
  name: string
  totalPositions: number
  openPositions: number
  closedPositions: number
  totalPL: number
  realizedPL: number
  unrealizedPL: number
  totalPremiumCollected: number
  status: 'active' | 'completed'
}
