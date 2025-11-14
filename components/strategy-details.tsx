'use client'

import { OptionPosition } from '@/types/option'
import { StrategyAlert, StrategyConfig } from '@/types/strategy'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

interface StrategyDetailsProps {
  position: OptionPosition
  currentStockPrice: number | null
  strategyConfig: StrategyConfig
  alerts: StrategyAlert[]
}

export function StrategyDetails({
  position,
  currentStockPrice,
  strategyConfig,
  alerts,
}: StrategyDetailsProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Calculate roll price
  const rollMultiplier = 1 + strategyConfig.rollThreshold / 100
  const rollPrice = position.strike * rollMultiplier

  // Calculate close target (75% profit = close at 25% of premium)
  const closeMultiplier = (100 - strategyConfig.closeThreshold) / 100
  const closeTargetPremium = position.premium * closeMultiplier

  // Calculate current distance from roll price
  const distanceFromRoll = currentStockPrice
    ? ((currentStockPrice - position.strike) / position.strike) * 100
    : null

  // Determine status color
  const getStatusColor = () => {
    if (!currentStockPrice) return 'text-muted-foreground'
    if (currentStockPrice >= rollPrice) return 'text-red-600 dark:text-red-400'
    if (distanceFromRoll && distanceFromRoll >= strategyConfig.rollThreshold - 0.5)
      return 'text-yellow-600 dark:text-yellow-400'
    return 'text-green-600 dark:text-green-400'
  }

  // Get status icon
  const getStatusIcon = () => {
    if (!currentStockPrice) return '⚪'
    if (currentStockPrice >= rollPrice) return '🔴'
    if (distanceFromRoll && distanceFromRoll >= strategyConfig.rollThreshold - 0.5) return '🟡'
    return '🟢'
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-3">
      <CollapsibleTrigger className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
        <span>
          Strategy Details ({strategyConfig.type === 'standard' ? 'Standard' : 'Custom'})
        </span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
          {/* Roll Alert Section */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Roll Alert Price</p>
              <span className={`text-xs font-medium ${getStatusColor()}`}>
                {getStatusIcon()} Status
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-lg font-semibold">${rollPrice.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">
                ({strategyConfig.rollThreshold}% above strike)
              </p>
            </div>
            {currentStockPrice && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Current Price:</span>
                <span className="font-medium">${currentStockPrice.toFixed(2)}</span>
                {distanceFromRoll !== null && (
                  <span className={getStatusColor()}>
                    ({distanceFromRoll >= 0 ? '+' : ''}
                    {distanceFromRoll.toFixed(2)}%)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Close Alert Section */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Close Target Premium</p>
            <div className="flex items-baseline gap-2">
              <p className="text-lg font-semibold">${closeTargetPremium.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">
                ({strategyConfig.closeThreshold}% profit target)
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Original Premium: ${position.premium.toFixed(2)}
            </p>
          </div>

          {/* Active Alerts */}
          {alerts.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs font-semibold mb-2">Active Alerts:</p>
              <div className="space-y-1">
                {alerts.map((alert, index) => (
                  <div
                    key={index}
                    className={`text-xs p-2 rounded ${
                      alert.urgency === 'high'
                        ? 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-100'
                        : alert.urgency === 'medium'
                        ? 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950/50 dark:text-yellow-100'
                        : 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-100'
                    }`}
                  >
                    <p className="font-medium">{alert.title}</p>
                    <p className="mt-1 opacity-90">{alert.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strategy Info */}
          <div className="pt-2 border-t text-xs text-muted-foreground">
            <p>
              <strong>Strategy:</strong> Roll when stock reaches $
              {rollPrice.toFixed(2)}
              {position.type === 'put' ? ' (to avoid assignment)' : ' (to avoid stock being called away)'}
            </p>
            <p className="mt-1">
              <strong>Target:</strong> Close when premium decays to ${closeTargetPremium.toFixed(2)} (
              {strategyConfig.closeThreshold}% profit)
            </p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
