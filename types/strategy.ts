import { OptionPosition } from './option'

// Alert types
export type AlertType = 'roll' | 'close' | 'warning'
export type AlertUrgency = 'low' | 'medium' | 'high'

// Strategy alert interface
export interface StrategyAlert {
  positionId: string
  ticker: string
  type: AlertType
  title: string
  message: string
  targetPrice?: number
  threshold: number
  currentDistance: number // How far from threshold (percentage)
  urgency: AlertUrgency
  position: OptionPosition
}

// Strategy configuration types
export type StrategyType = 'standard' | 'custom'

export interface StrategyConfig {
  type: StrategyType
  rollThreshold: number // Percentage above strike (1-10%)
  closeThreshold: number // Percentage profit target (50-90%)
}

// User strategy settings (stored in localStorage)
export interface UserStrategyConfig {
  activeStrategy: StrategyType
  customRollThreshold: number // 1-10 (%)
  customCloseThreshold: number // 50-90 (%)
  dismissedAlerts: string[] // Array of positionId
  dismissedAt: Record<string, number> // positionId -> timestamp
}

// Default configurations
export const DEFAULT_STRATEGY_CONFIG: UserStrategyConfig = {
  activeStrategy: 'standard',
  customRollThreshold: 3,
  customCloseThreshold: 75,
  dismissedAlerts: [],
  dismissedAt: {},
}

export const STANDARD_STRATEGY: StrategyConfig = {
  type: 'standard',
  rollThreshold: 3,
  closeThreshold: 75,
}

// Validation ranges
export const ROLL_THRESHOLD_RANGE = { min: 1, max: 10 }
export const CLOSE_THRESHOLD_RANGE = { min: 50, max: 90 }
