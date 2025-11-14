'use client'

import { useState, useEffect, useMemo } from 'react'
import { AppHeader } from '@/components/app-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useStrategyAlerts } from '@/hooks/use-strategy-alerts'
import { OptionPosition, PortfolioMetrics } from '@/types/option'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, DollarSign, Percent, Target } from 'lucide-react'

interface StockHolding {
  ticker: string
  quantity: number
  costBasis: number
  totalCostBasis: number
  currentPrice: number | null
  currentValue: number | null
  unrealizedPL: number | null
}

export default function AnalyticsPage() {
  const [positions, setPositions] = useState<OptionPosition[]>([])
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null)
  const [stockHoldings, setStockHoldings] = useState<StockHolding[]>([])
  const [loading, setLoading] = useState(true)
  const [stockPrices, setStockPrices] = useState<Map<string, number>>(new Map())

  const { strategyConfig, updateStrategyConfig } = useStrategyAlerts(positions, stockPrices)

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true)
      const [positionsRes, metricsRes, holdingsRes] = await Promise.all([
        fetch('/api/positions'),
        fetch('/api/metrics'),
        fetch('/api/stock-holdings'),
      ])

      const positionsData = await positionsRes.json()
      const metricsData = await metricsRes.json()
      const holdingsData = await holdingsRes.json()

      setPositions(positionsData)
      setMetrics(metricsData)
      setStockHoldings(holdingsData)

      // Fetch stock prices
      const openPositions = positionsData.filter((p: OptionPosition) => p.status === 'open')
      const uniqueTickers = [...new Set(openPositions.map((p: OptionPosition) => p.stockTicker))]

      const pricePromises = uniqueTickers.map(async (ticker) => {
        try {
          const res = await fetch(`/api/stock-price/${ticker}`)
          const data = await res.json()
          return [ticker, data.price] as [string, number]
        } catch {
          return [ticker, 0] as [string, number]
        }
      })

      const prices = await Promise.all(pricePromises)
      setStockPrices(new Map(prices))
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // ROI Calculations
  const roiMetrics = useMemo(() => {
    if (!metrics) return null

    const totalCapital =
      stockHoldings.reduce((sum, holding) => sum + holding.totalCostBasis, 0) || 1

    // Calculate daily ROI (assuming average holding period)
    const avgHoldingDays = 30 // Approximate
    const dailyROI = ((metrics.totalRealized || 0) / totalCapital / avgHoldingDays) * 100

    // Calculate annualized ROI
    const annualizedROI = dailyROI * 365

    // Calculate per-ticker ROI
    const tickerROI = stockHoldings.map((holding) => {
      const tickerPositions = positions.filter((p) => p.stockTicker === holding.ticker)
      const tickerPremiums = tickerPositions.reduce(
        (sum, p) => sum + (p.realizedPL || 0),
        0
      )
      const roi = holding.totalCostBasis > 0 ? (tickerPremiums / holding.totalCostBasis) * 100 : 0

      return {
        ticker: holding.ticker,
        roi,
        premiums: tickerPremiums,
        capital: holding.totalCostBasis,
      }
    })

    return {
      dailyROI,
      annualizedROI,
      totalROI: totalCapital > 0 ? ((metrics.totalRealized || 0) / totalCapital) * 100 : 0,
      tickerROI,
    }
  }, [metrics, stockHoldings, positions])

  // Cumulative P/L Over Time
  const cumulativePLData = useMemo(() => {
    const closedPositions = positions
      .filter((p) => p.status === 'closed' && p.closeDate)
      .sort((a, b) => new Date(a.closeDate!).getTime() - new Date(b.closeDate!).getTime())

    let cumulative = 0
    return closedPositions.map((p) => {
      cumulative += p.realizedPL || 0
      return {
        date: new Date(p.closeDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: cumulative,
      }
    })
  }, [positions])

  // Premium Collected Per Ticker
  const premiumPerTickerData = useMemo(() => {
    const tickerMap = new Map<string, number>()

    positions.forEach((p) => {
      const totalPremium = p.premium * p.contracts * 100
      tickerMap.set(p.stockTicker, (tickerMap.get(p.stockTicker) || 0) + totalPremium)
    })

    return Array.from(tickerMap.entries())
      .map(([ticker, premium]) => ({ ticker, premium }))
      .sort((a, b) => b.premium - a.premium)
      .slice(0, 10) // Top 10
  }, [positions])

  // Premium Collection Over Time
  const premiumOverTimeData = useMemo(() => {
    const dateMap = new Map<string, { puts: number; calls: number }>()

    positions.forEach((p) => {
      const date = new Date(p.openDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      })
      const totalPremium = p.premium * p.contracts * 100

      if (!dateMap.has(date)) {
        dateMap.set(date, { puts: 0, calls: 0 })
      }

      const entry = dateMap.get(date)!
      if (p.type === 'put') {
        entry.puts += totalPremium
      } else {
        entry.calls += totalPremium
      }
    })

    return Array.from(dateMap.entries())
      .map(([date, premiums]) => ({ date, ...premiums }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [positions])

  // Win Rate by Ticker
  const winRateData = useMemo(() => {
    const tickerStats = new Map<string, { wins: number; total: number }>()

    positions
      .filter((p) => p.status === 'closed')
      .forEach((p) => {
        if (!tickerStats.has(p.stockTicker)) {
          tickerStats.set(p.stockTicker, { wins: 0, total: 0 })
        }
        const stats = tickerStats.get(p.stockTicker)!
        stats.total += 1
        if ((p.realizedPL || 0) > 0) {
          stats.wins += 1
        }
      })

    return Array.from(tickerStats.entries())
      .map(([ticker, stats]) => ({
        ticker,
        winRate: (stats.wins / stats.total) * 100,
        wins: stats.wins,
        total: stats.total,
      }))
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 8) // Top 8
  }, [positions])

  // Performance Percentage (ROI per ticker for pie chart)
  const performanceData = useMemo(() => {
    if (!roiMetrics) return []
    return roiMetrics.tickerROI
      .filter((t) => t.roi > 0)
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 6)
  }, [roiMetrics])

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  if (loading) {
    return (
      <>
        <AppHeader />
        <main className="container mx-auto px-4 py-8 flex-1">
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading analytics...</p>
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
          <h1 className="text-3xl font-bold mb-2">Analytics & ROI</h1>
          <p className="text-muted-foreground">
            Detailed performance metrics and visualizations
          </p>
        </div>

        {/* ROI Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Percent className="w-4 h-4" />
                Total ROI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {roiMetrics?.totalROI.toFixed(2)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                On deployed capital
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Annualized ROI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {roiMetrics?.annualizedROI.toFixed(2)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Projected annual return
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Realized
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatCurrency(metrics?.totalRealized || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                All closed positions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Win Rate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {metrics?.winRate?.toFixed(1) || '0.0'}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Profitable positions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Cumulative P/L Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Cumulative P/L Over Time</CardTitle>
              <CardDescription>Track your profit/loss progression</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={cumulativePLData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'P/L']}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Cumulative P/L"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Premium Per Ticker */}
          <Card>
            <CardHeader>
              <CardTitle>Premium Collected Per Ticker</CardTitle>
              <CardDescription>Top 10 stocks by total premium</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={premiumPerTickerData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ticker" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Premium']}
                  />
                  <Legend />
                  <Bar dataKey="premium" fill="#10b981" name="Premium" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Premium Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Premium Collection Over Time</CardTitle>
              <CardDescription>Monthly premium breakdown by type</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={premiumOverTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), '']}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="puts"
                    stackId="1"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    name="Puts"
                  />
                  <Area
                    type="monotone"
                    dataKey="calls"
                    stackId="1"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    name="Calls"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Win Rate Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Win Rate by Ticker</CardTitle>
              <CardDescription>Success rate for each stock</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={winRateData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ticker" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === 'winRate' ? [`${value.toFixed(1)}%`, 'Win Rate'] : [value, name]
                    }
                  />
                  <Legend />
                  <Bar dataKey="winRate" fill="#8b5cf6" name="Win Rate %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Performance Percentage Pie */}
          <Card>
            <CardHeader>
              <CardTitle>ROI Distribution</CardTitle>
              <CardDescription>Return on investment by ticker</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={performanceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.ticker} (${entry.roi.toFixed(1)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="roi"
                  >
                    {performanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(2)}%`, 'ROI']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ROI Per Ticker Table */}
          <Card>
            <CardHeader>
              <CardTitle>ROI Breakdown by Ticker</CardTitle>
              <CardDescription>Detailed return on investment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {roiMetrics?.tickerROI
                  .sort((a, b) => b.roi - a.roi)
                  .map((ticker) => (
                    <div
                      key={ticker.ticker}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex-1">
                        <p className="font-semibold">{ticker.ticker}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(ticker.premiums)} / {formatCurrency(ticker.capital)}
                        </p>
                      </div>
                      <div
                        className={`text-lg font-bold ${
                          ticker.roi > 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {ticker.roi.toFixed(2)}%
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
