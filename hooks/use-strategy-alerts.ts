import { useMemo, useEffect, useState } from 'react'
import { OptionPosition } from '@/types/option'
import {
  StrategyAlert,
  UserStrategyConfig,
  DEFAULT_STRATEGY_CONFIG,
} from '@/types/strategy'
import { calculateAllAlerts, getStrategyConfig } from '@/lib/strategies'

const STORAGE_KEY = 'optionsTracker_strategyConfig'
const ALERT_REAPPEAR_HOURS = 24

/**
 * Hook to manage strategy configuration and calculate alerts
 */
export function useStrategyAlerts(
  positions: OptionPosition[],
  stockPrices: Map<string, number>
) {
  // Load strategy config from localStorage
  const [strategyConfig, setStrategyConfig] = useState<UserStrategyConfig>(() => {
    if (typeof window === 'undefined') return DEFAULT_STRATEGY_CONFIG

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return { ...DEFAULT_STRATEGY_CONFIG, ...JSON.parse(stored) }
      }
    } catch (error) {
      console.error('Error loading strategy config:', error)
    }
    return DEFAULT_STRATEGY_CONFIG
  })

  // Save strategy config to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(strategyConfig))
    } catch (error) {
      console.error('Error saving strategy config:', error)
    }
  }, [strategyConfig])

  // Clean up old dismissed alerts (older than 24 hours)
  useEffect(() => {
    const now = Date.now()
    const hoursInMs = ALERT_REAPPEAR_HOURS * 60 * 60 * 1000

    const newDismissedAlerts = strategyConfig.dismissedAlerts.filter((positionId) => {
      const dismissedTime = strategyConfig.dismissedAt[positionId]
      if (!dismissedTime) return false
      return now - dismissedTime < hoursInMs
    })

    const newDismissedAt = Object.fromEntries(
      Object.entries(strategyConfig.dismissedAt).filter(
        ([positionId]) => newDismissedAlerts.includes(positionId)
      )
    )

    if (newDismissedAlerts.length !== strategyConfig.dismissedAlerts.length) {
      setStrategyConfig({
        ...strategyConfig,
        dismissedAlerts: newDismissedAlerts,
        dismissedAt: newDismissedAt,
      })
    }
  }, [strategyConfig, positions])

  // Calculate all alerts
  const allAlerts = useMemo(() => {
    const config = getStrategyConfig(
      strategyConfig.activeStrategy,
      strategyConfig.customRollThreshold,
      strategyConfig.customCloseThreshold
    )

    return calculateAllAlerts(positions, stockPrices, null, config)
  }, [
    positions,
    stockPrices,
    strategyConfig.activeStrategy,
    strategyConfig.customRollThreshold,
    strategyConfig.customCloseThreshold,
  ])

  // Filter out dismissed alerts
  const activeAlerts = useMemo(() => {
    return allAlerts.filter(
      (alert) => !strategyConfig.dismissedAlerts.includes(alert.positionId)
    )
  }, [allAlerts, strategyConfig.dismissedAlerts])

  // Functions to manage strategy config
  const updateStrategyConfig = (updates: Partial<UserStrategyConfig>) => {
    setStrategyConfig((prev) => ({ ...prev, ...updates }))
  }

  const dismissAlert = (positionId: string) => {
    setStrategyConfig((prev) => ({
      ...prev,
      dismissedAlerts: [...prev.dismissedAlerts, positionId],
      dismissedAt: {
        ...prev.dismissedAt,
        [positionId]: Date.now(),
      },
    }))
  }

  const undismissAlert = (positionId: string) => {
    setStrategyConfig((prev) => {
      const newDismissedAlerts = prev.dismissedAlerts.filter((id) => id !== positionId)
      const newDismissedAt = { ...prev.dismissedAt }
      delete newDismissedAt[positionId]

      return {
        ...prev,
        dismissedAlerts: newDismissedAlerts,
        dismissedAt: newDismissedAt,
      }
    })
  }

  const clearAllDismissed = () => {
    setStrategyConfig((prev) => ({
      ...prev,
      dismissedAlerts: [],
      dismissedAt: {},
    }))
  }

  return {
    strategyConfig,
    updateStrategyConfig,
    allAlerts,
    activeAlerts,
    dismissAlert,
    undismissAlert,
    clearAllDismissed,
  }
}

/**
 * Hook to get alerts for a specific position
 */
export function usePositionAlerts(
  position: OptionPosition,
  allAlerts: StrategyAlert[]
): StrategyAlert[] {
  return useMemo(() => {
    return allAlerts.filter((alert) => alert.positionId === position.id)
  }, [position.id, allAlerts])
}
