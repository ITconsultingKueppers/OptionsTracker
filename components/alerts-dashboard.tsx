'use client'

import { StrategyAlert } from '@/types/strategy'
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X, TrendingUp, CheckCircle, AlertTriangle } from 'lucide-react'

interface AlertsDashboardProps {
  alerts: StrategyAlert[]
  onDismiss: (positionId: string) => void
  onViewPosition: (positionId: string) => void
}

export function AlertsDashboard({
  alerts,
  onDismiss,
  onViewPosition,
}: AlertsDashboardProps) {
  // Don't show if no alerts
  if (alerts.length === 0) return null

  // Count alerts by urgency
  const highUrgencyCount = alerts.filter((a) => a.urgency === 'high').length
  const mediumUrgencyCount = alerts.filter((a) => a.urgency === 'medium').length

  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-r from-orange-50/50 to-red-50/50 dark:from-orange-950/20 dark:to-red-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <CardDescription className="text-base font-semibold text-foreground">
              Action Required
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {highUrgencyCount > 0 && (
              <Badge variant="destructive" className="font-semibold">
                {highUrgencyCount} High
              </Badge>
            )}
            {mediumUrgencyCount > 0 && (
              <Badge
                variant="secondary"
                className="bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-100"
              >
                {mediumUrgencyCount} Medium
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => (
          <AlertCard
            key={alert.positionId}
            alert={alert}
            onDismiss={onDismiss}
            onViewPosition={onViewPosition}
          />
        ))}
      </CardContent>
    </Card>
  )
}

interface AlertCardProps {
  alert: StrategyAlert
  onDismiss: (positionId: string) => void
  onViewPosition: (positionId: string) => void
}

function AlertCard({ alert, onDismiss, onViewPosition }: AlertCardProps) {
  const getAlertIcon = () => {
    switch (alert.type) {
      case 'roll':
        return <TrendingUp className="h-4 w-4" />
      case 'close':
        return <CheckCircle className="h-4 w-4" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  const getUrgencyColor = () => {
    switch (alert.urgency) {
      case 'high':
        return 'border-red-500 bg-red-50 dark:bg-red-950/30'
      case 'medium':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30'
      case 'low':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
    }
  }

  const getAlertBadge = () => {
    switch (alert.type) {
      case 'roll':
        return (
          <Badge variant="destructive" className="gap-1">
            {getAlertIcon()}
            Roll
          </Badge>
        )
      case 'close':
        return (
          <Badge variant="default" className="bg-green-600 gap-1">
            {getAlertIcon()}
            Close
          </Badge>
        )
      case 'warning':
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-100 gap-1"
          >
            {getAlertIcon()}
            Warning
          </Badge>
        )
    }
  }

  return (
    <div
      className={`relative rounded-lg border-2 p-4 ${getUrgencyColor()} transition-all hover:shadow-md`}
    >
      {/* Dismiss button */}
      <button
        onClick={() => onDismiss(alert.positionId)}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Dismiss alert"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Alert content */}
      <div className="space-y-2 pr-8">
        {/* Header */}
        <div className="flex items-center gap-2">
          {getAlertBadge()}
          <span className="font-semibold text-sm">
            {alert.ticker} {alert.position.type === 'put' ? 'Put' : 'Call'} $
            {alert.position.strike}
          </span>
        </div>

        {/* Message */}
        <p className="text-sm text-foreground/80">{alert.message}</p>

        {/* Details */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {alert.targetPrice && (
            <span>
              Target: <span className="font-medium">${alert.targetPrice.toFixed(2)}</span>
            </span>
          )}
          <span>
            Threshold: <span className="font-medium">{alert.threshold}%</span>
          </span>
          <span>
            Distance: <span className="font-medium">{alert.currentDistance.toFixed(2)}%</span>
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewPosition(alert.positionId)}
            className="h-7 text-xs"
          >
            View Position
          </Button>
        </div>
      </div>
    </div>
  )
}
