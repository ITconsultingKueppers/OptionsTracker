'use client'

import { useState } from 'react'
import { UserStrategyConfig, ROLL_THRESHOLD_RANGE, CLOSE_THRESHOLD_RANGE } from '@/types/strategy'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Input } from '@/components/ui/input'
import { Settings } from 'lucide-react'

interface StrategySelectorProps {
  strategyConfig: UserStrategyConfig
  onUpdate: (updates: Partial<UserStrategyConfig>) => void
}

export function StrategySelector({ strategyConfig, onUpdate }: StrategySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [localConfig, setLocalConfig] = useState(strategyConfig)

  const handleSave = () => {
    onUpdate(localConfig)
    setIsOpen(false)
  }

  const handleCancel = () => {
    setLocalConfig(strategyConfig)
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Strategy: {strategyConfig.activeStrategy === 'standard' ? 'Standard' : 'Custom'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Strategy Configuration</DialogTitle>
          <DialogDescription>
            Configure your alert thresholds for position management
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Strategy Type Selection */}
          <div className="space-y-3">
            <Label>Strategy Type</Label>
            <RadioGroup
              value={localConfig.activeStrategy}
              onValueChange={(value: 'standard' | 'custom') =>
                setLocalConfig({ ...localConfig, activeStrategy: value })
              }
            >
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="standard" id="standard" />
                <div className="space-y-1">
                  <Label htmlFor="standard" className="font-medium cursor-pointer">
                    Standard Strategy
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Roll at <strong>3%</strong> above strike, Close at <strong>75%</strong> profit
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <div className="space-y-1">
                  <Label htmlFor="custom" className="font-medium cursor-pointer">
                    Custom Strategy
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Define your own thresholds below
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Custom Strategy Configuration */}
          {localConfig.activeStrategy === 'custom' && (
            <div className="space-y-4 pl-6 border-l-2">
              {/* Roll Threshold */}
              <div className="space-y-2">
                <Label htmlFor="rollThreshold">Roll Threshold (%)</Label>
                <p className="text-xs text-muted-foreground">
                  Alert when stock price exceeds strike by this percentage
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    id="rollThreshold"
                    type="number"
                    min={ROLL_THRESHOLD_RANGE.min}
                    max={ROLL_THRESHOLD_RANGE.max}
                    step="0.5"
                    value={localConfig.customRollThreshold}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        customRollThreshold: Math.min(
                          ROLL_THRESHOLD_RANGE.max,
                          Math.max(ROLL_THRESHOLD_RANGE.min, parseFloat(e.target.value) || ROLL_THRESHOLD_RANGE.min)
                        ),
                      })
                    }
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                  <span className="text-xs text-muted-foreground">
                    ({ROLL_THRESHOLD_RANGE.min}-{ROLL_THRESHOLD_RANGE.max}%)
                  </span>
                </div>
              </div>

              {/* Close Threshold */}
              <div className="space-y-2">
                <Label htmlFor="closeThreshold">Close Threshold (% Profit)</Label>
                <p className="text-xs text-muted-foreground">
                  Alert when option has captured this percentage of profit
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    id="closeThreshold"
                    type="number"
                    min={CLOSE_THRESHOLD_RANGE.min}
                    max={CLOSE_THRESHOLD_RANGE.max}
                    step="5"
                    value={localConfig.customCloseThreshold}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        customCloseThreshold: Math.min(
                          CLOSE_THRESHOLD_RANGE.max,
                          Math.max(CLOSE_THRESHOLD_RANGE.min, parseFloat(e.target.value) || CLOSE_THRESHOLD_RANGE.min)
                        ),
                      })
                    }
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                  <span className="text-xs text-muted-foreground">
                    ({CLOSE_THRESHOLD_RANGE.min}-{CLOSE_THRESHOLD_RANGE.max}%)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium">How it works:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>
                <strong>Roll Alert:</strong> Triggered when stock price exceeds your strike price by
                the threshold percentage
              </li>
              <li>
                <strong>Close Alert:</strong> Triggered when option premium has decayed to your profit
                target (currently disabled - requires option price data)
              </li>
              <li>Alerts appear at the top of your dashboard and on position cards</li>
              <li>Dismissed alerts reappear after 24 hours</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Strategy</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
