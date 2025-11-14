'use client'

import { useState, useEffect } from 'react'
import { AppHeader } from '@/components/app-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useStrategyAlerts } from '@/hooks/use-strategy-alerts'
import { WheelCycleSummary, OptionPosition } from '@/types/option'
import { RefreshCw, TrendingUp, DollarSign, Calendar } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'

export default function CyclesPage() {
  const [cycles, setCycles] = useState<WheelCycleSummary[]>([])
  const [positions, setPositions] = useState<OptionPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [stockPrices, setStockPrices] = useState<Map<string, number>>(new Map())

  const { strategyConfig, updateStrategyConfig } = useStrategyAlerts(positions, stockPrices)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [cyclesRes, positionsRes] = await Promise.all([
        fetch('/api/wheel-cycles'),
        fetch('/api/positions'),
      ])

      const cyclesData = await cyclesRes.json()
      const positionsData = await positionsRes.json()

      setCycles(cyclesData)
      setPositions(positionsData)
    } catch (error) {
      console.error('Error fetching cycles:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  // Calculate cycle statistics
  const cycleStats = {
    totalCycles: cycles.length,
    activeCycles: cycles.filter((c) => c.status === 'active').length,
    completedCycles: cycles.filter((c) => c.status === 'completed').length,
    totalProfit: cycles.reduce((sum, c) => sum + (c.totalRealized || 0), 0),
    avgCycleProfit:
      cycles.length > 0
        ? cycles.reduce((sum, c) => sum + (c.totalRealized || 0), 0) / cycles.length
        : 0,
  }

  // Chart data - Premium per cycle
  const cycleChartData = cycles
    .map((c) => ({
      cycle: c.cycleName,
      premium: c.totalPremium,
      realized: c.totalRealized || 0,
    }))
    .sort((a, b) => b.premium - a.premium)
    .slice(0, 10)

  // Cycle progression over time
  const cycleProgressionData = cycles
    .filter((c) => c.firstOpenDate)
    .sort((a, b) => new Date(a.firstOpenDate!).getTime() - new Date(b.firstOpenDate!).getTime())
    .map((c, index) => ({
      index: index + 1,
      cycle: c.cycleName,
      premium: c.totalPremium,
    }))

  const activeCycles = cycles.filter((c) => c.status === 'active')
  const completedCycles = cycles.filter((c) => c.status === 'completed')

  if (loading) {
    return (
      <>
        <AppHeader />
        <main className="container mx-auto px-4 py-8 flex-1">
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading cycles...</p>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <AppHeader />

      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Wheel Strategy Cycles</h1>
          <p className="text-muted-foreground">
            Track your wheel strategy performance across different stocks
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Total Cycles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{cycleStats.totalCycles}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Active Cycles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{cycleStats.activeCycles}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Completed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {cycleStats.completedCycles}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Profit
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(cycleStats.totalProfit)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Avg Per Cycle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatCurrency(cycleStats.avgCycleProfit)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Premium by Cycle</CardTitle>
              <CardDescription>Top 10 cycles by total premium collected</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={cycleChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="cycle" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), '']} />
                  <Legend />
                  <Bar dataKey="premium" fill="#3b82f6" name="Total Premium" />
                  <Bar dataKey="realized" fill="#10b981" name="Realized P/L" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cycle Progression</CardTitle>
              <CardDescription>Premium collected over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={cycleProgressionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="index" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Premium']}
                    labelFormatter={(label) =>
                      `Cycle ${label}: ${cycleProgressionData[Number(label) - 1]?.cycle || ''}`
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="premium"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Premium"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Active Cycles */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Active Cycles ({activeCycles.length})</CardTitle>
            <CardDescription>Currently running wheel strategy cycles</CardDescription>
          </CardHeader>
          <CardContent>
            {activeCycles.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No active cycles</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeCycles.map((cycle) => (
                  <Card key={cycle.cycleName}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{cycle.cycleName}</CardTitle>
                          <CardDescription>{cycle.totalPositions} positions</CardDescription>
                        </div>
                        <Badge variant="default">Active</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total Premium</p>
                          <p className="font-semibold">{formatCurrency(cycle.totalPremium)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Unrealized P/L</p>
                          <p
                            className={`font-semibold ${
                              cycle.totalUnrealized && cycle.totalUnrealized > 0
                                ? 'text-green-600'
                                : cycle.totalUnrealized && cycle.totalUnrealized < 0
                                ? 'text-red-600'
                                : ''
                            }`}
                          >
                            {formatCurrency(cycle.totalUnrealized)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Open</p>
                          <p className="font-semibold">{cycle.openPositions}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Closed</p>
                          <p className="font-semibold">{cycle.closedPositions}</p>
                        </div>
                      </div>
                      {cycle.firstOpenDate && (
                        <p className="text-xs text-muted-foreground pt-2 border-t">
                          Started: {new Date(cycle.firstOpenDate).toLocaleDateString()}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Cycles */}
        <Card>
          <CardHeader>
            <CardTitle>Completed Cycles ({completedCycles.length})</CardTitle>
            <CardDescription>Finished wheel strategy cycles</CardDescription>
          </CardHeader>
          <CardContent>
            {completedCycles.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No completed cycles</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedCycles.map((cycle) => (
                  <Card key={cycle.cycleName}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{cycle.cycleName}</CardTitle>
                          <CardDescription>{cycle.totalPositions} positions</CardDescription>
                        </div>
                        <Badge variant="secondary">Completed</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total Premium</p>
                          <p className="font-semibold">{formatCurrency(cycle.totalPremium)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Realized P/L</p>
                          <p
                            className={`font-semibold ${
                              cycle.totalRealized && cycle.totalRealized > 0
                                ? 'text-green-600'
                                : cycle.totalRealized && cycle.totalRealized < 0
                                ? 'text-red-600'
                                : ''
                            }`}
                          >
                            {formatCurrency(cycle.totalRealized)}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Total Positions</p>
                          <p className="font-semibold">{cycle.totalPositions}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                        {cycle.firstOpenDate && (
                          <span>Started: {new Date(cycle.firstOpenDate).toLocaleDateString()}</span>
                        )}
                        {cycle.lastCloseDate && (
                          <span>Ended: {new Date(cycle.lastCloseDate).toLocaleDateString()}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  )
}
