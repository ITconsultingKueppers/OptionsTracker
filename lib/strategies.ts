import { OptionPosition } from '@/types/option'
import {
  StrategyAlert,
  StrategyConfig,
  AlertUrgency,
  STANDARD_STRATEGY,
} from '@/types/strategy'

/**
 * Calculate roll alert for a position based on current stock price
 * Roll alerts trigger when stock price exceeds strike by threshold percentage
 */
export function calculateRollAlert(
  position: OptionPosition,
  currentPrice: number,
  config: StrategyConfig
): StrategyAlert | null {
  // Only check open positions
  if (position.status !== 'open') return null

  const rollThresholdMultiplier = 1 + config.rollThreshold / 100
  const targetRollPrice = position.strike * rollThresholdMultiplier
  const currentDistancePercent = ((currentPrice - position.strike) / position.strike) * 100

  // For puts: alert when stock price is ABOVE strike + threshold (risk of assignment)
  // For calls: alert when stock price is ABOVE strike + threshold (stock being called away)
  if (currentPrice >= targetRollPrice) {
    // Determine urgency based on how far past threshold
    let urgency: AlertUrgency = 'low'
    const overshoot = currentPrice - targetRollPrice
    const overshootPercent = (overshoot / position.strike) * 100

    if (overshootPercent >= 1) {
      urgency = 'high' // 1% or more past threshold
    } else if (overshootPercent >= 0.25) {
      urgency = 'medium' // 0.25-1% past threshold
    }

    return {
      positionId: position.id,
      ticker: position.stockTicker,
      type: 'roll',
      title: `Roll ${position.type === 'put' ? 'Put' : 'Call'}`,
      message: `Stock at $${currentPrice.toFixed(2)} (+${currentDistancePercent.toFixed(
        2
      )}% above strike). Consider rolling to avoid ${
        position.type === 'put' ? 'assignment' : 'stock being called away'
      }.`,
      targetPrice: targetRollPrice,
      threshold: config.rollThreshold,
      currentDistance: currentDistancePercent,
      urgency,
      position,
    }
  }

  // Check if approaching threshold (within 0.5%)
  const approachThresholdMultiplier = 1 + (config.rollThreshold - 0.5) / 100
  const approachPrice = position.strike * approachThresholdMultiplier

  if (currentPrice >= approachPrice && currentPrice < targetRollPrice) {
    return {
      positionId: position.id,
      ticker: position.stockTicker,
      type: 'warning',
      title: `Approaching Roll Threshold`,
      message: `Stock at $${currentPrice.toFixed(2)} (+${currentDistancePercent.toFixed(
        2
      )}%). Within 0.5% of roll threshold.`,
      targetPrice: targetRollPrice,
      threshold: config.rollThreshold,
      currentDistance: currentDistancePercent,
      urgency: 'low',
      position,
    }
  }

  return null
}

/**
 * Calculate close alert for a position based on premium captured
 * Close alerts trigger when option premium has decayed to target profit level
 *
 * NOTE: This requires current option price data, which we don't have yet.
 * For now, this returns null. Future enhancement: integrate option price API.
 */
export function calculateCloseAlert(
  position: OptionPosition,
  currentOptionPrice: number | null,
  config: StrategyConfig
): StrategyAlert | null {
  // Only check open positions
  if (position.status !== 'open') return null

  // Return null if we don't have option price data
  if (currentOptionPrice === null) return null

  // Calculate target close price (e.g., 75% profit = close at 25% of original premium)
  const targetCloseMultiplier = (100 - config.closeThreshold) / 100
  const targetClosePrice = position.premium * targetCloseMultiplier

  // Calculate profit percentage
  const profitPercent = ((position.premium - currentOptionPrice) / position.premium) * 100

  // Alert if current option price is at or below target
  if (currentOptionPrice <= targetClosePrice) {
    let urgency: AlertUrgency = 'medium'

    // High urgency if we've exceeded target significantly (5% more profit)
    if (profitPercent >= config.closeThreshold + 5) {
      urgency = 'high'
    } else if (profitPercent >= config.closeThreshold) {
      urgency = 'medium'
    }

    return {
      positionId: position.id,
      ticker: position.stockTicker,
      type: 'close',
      title: `Close for Profit`,
      message: `Option at $${currentOptionPrice.toFixed(2)} (~${profitPercent.toFixed(
        1
      )}% profit). Good time to close position.`,
      targetPrice: targetClosePrice,
      threshold: config.closeThreshold,
      currentDistance: profitPercent,
      urgency,
      position,
    }
  }

  return null
}

/**
 * Calculate all alerts for a single position
 */
export function calculatePositionAlerts(
  position: OptionPosition,
  currentStockPrice: number | null,
  currentOptionPrice: number | null,
  config: StrategyConfig
): StrategyAlert[] {
  const alerts: StrategyAlert[] = []

  if (currentStockPrice) {
    const rollAlert = calculateRollAlert(position, currentStockPrice, config)
    if (rollAlert) alerts.push(rollAlert)
  }

  if (currentOptionPrice) {
    const closeAlert = calculateCloseAlert(position, currentOptionPrice, config)
    if (closeAlert) alerts.push(closeAlert)
  }

  return alerts
}

/**
 * Calculate all alerts for multiple positions
 */
export function calculateAllAlerts(
  positions: OptionPosition[],
  stockPrices: Map<string, number>,
  optionPrices: Map<string, number> | null,
  config: StrategyConfig
): StrategyAlert[] {
  const alerts: StrategyAlert[] = []

  positions.forEach((position) => {
    // Skip closed positions
    if (position.status !== 'open') return

    const stockPrice = stockPrices.get(position.stockTicker.toUpperCase())
    const optionPrice = optionPrices?.get(position.id) || null

    const positionAlerts = calculatePositionAlerts(
      position,
      stockPrice || null,
      optionPrice,
      config
    )

    alerts.push(...positionAlerts)
  })

  // Sort by urgency (high -> medium -> low) and then by distance from threshold
  return alerts.sort((a, b) => {
    const urgencyOrder = { high: 0, medium: 1, low: 2 }
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    }
    // Within same urgency, sort by distance (furthest from threshold first)
    return Math.abs(b.currentDistance) - Math.abs(a.currentDistance)
  })
}

/**
 * Get strategy configuration based on user settings
 */
export function getStrategyConfig(
  activeStrategy: 'standard' | 'custom',
  customRollThreshold: number,
  customCloseThreshold: number
): StrategyConfig {
  if (activeStrategy === 'standard') {
    return STANDARD_STRATEGY
  }

  return {
    type: 'custom',
    rollThreshold: customRollThreshold,
    closeThreshold: customCloseThreshold,
  }
}
