"use client"

// Options Trading Tracker with Strategy Alerts
import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, MessageSquare, Coffee, ChevronDown, Trash2, Pencil, LayoutGrid, Table as TableIcon } from "lucide-react"
import { toast } from "sonner"
import { createOptionPositionFormSchema, type CreateOptionPositionFormData } from "@/lib/validations"
import { OptionPosition, PortfolioMetrics, WheelCycleSummary } from "@/types/option"
import { useStrategyAlerts } from "@/hooks/use-strategy-alerts"
import { getStrategyConfig } from "@/lib/strategies"
import { AlertsDashboard } from "@/components/alerts-dashboard"
import { StrategyDetails } from "@/components/strategy-details"
import { StrategySelector } from "@/components/strategy-selector"
import { Badge } from "@/components/ui/badge"

interface StockHolding {
  ticker: string
  quantity: number
  costBasis: number
  totalCostBasis: number
  currentPrice: number | null
  currentValue: number | null
  unrealizedPL: number | null
}
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

export default function OptionsTracker() {
  const [isROIExpanded, setIsROIExpanded] = useState(false)
  const [positions, setPositions] = useState<OptionPosition[]>([])
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null)
  const [wheelCycles, setWheelCycles] = useState<WheelCycleSummary[]>([])
  const [stockHoldings, setStockHoldings] = useState<StockHolding[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Filter states
  const [stockFilter, setStockFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  // Edit dialog state
  const [editingPosition, setEditingPosition] = useState<OptionPosition | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  // View mode state
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')

  // Stock prices for strategy calculations
  const [stockPrices, setStockPrices] = useState<Map<string, number>>(new Map())

  // Strategy alerts hook
  const {
    strategyConfig,
    updateStrategyConfig,
    allAlerts,
    activeAlerts,
    dismissAlert,
    undismissAlert,
    clearAllDismissed,
  } = useStrategyAlerts(positions, stockPrices)

  // Initialize form with react-hook-form and zod validation
  const form = useForm<CreateOptionPositionFormData>({
    resolver: zodResolver(createOptionPositionFormSchema),
    mode: "onSubmit", // Only validate on submit, not on change/blur
    reValidateMode: "onChange", // After first submit, revalidate on change
    defaultValues: {
      openDate: "",
      stockTicker: "",
      expiration: "",
      type: "put",
      contracts: "",
      strike: "",
      premium: "",
      ownsStock: "no",
      stockCostBasis: "",
      assigned: "no",
      openFees: "",
      closeDate: "",
      premiumPaidToClose: "",
      closeFees: "",
      notes: "",
    },
  })

  // Fetch positions and metrics
  const fetchData = async () => {
    try {
      setLoading(true)

      // Build query params for filters
      const params = new URLSearchParams()
      if (stockFilter) params.append('stockSymbol', stockFilter)
      if (typeFilter !== 'all') params.append('type', typeFilter)
      if (statusFilter !== 'all') params.append('status', statusFilter)

      const [positionsRes, metricsRes, wheelCyclesRes, holdingsRes] = await Promise.all([
        fetch(`/api/positions?${params.toString()}`),
        fetch('/api/metrics'),
        fetch('/api/wheel-cycles'),
        fetch('/api/stock-holdings'),
      ])

      let positionsData: OptionPosition[] = []
      if (positionsRes.ok) {
        positionsData = await positionsRes.json()
        setPositions(positionsData)
      }

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json()
        setMetrics(metricsData)
      }

      if (wheelCyclesRes.ok) {
        const wheelCyclesData = await wheelCyclesRes.json()
        setWheelCycles(wheelCyclesData)
      }

      if (holdingsRes.ok) {
        const holdingsData = await holdingsRes.json()
        setStockHoldings(holdingsData)
      }

      // Fetch stock prices for open positions (for strategy alerts)
      if (positionsData.length > 0) {
        const openPositions = positionsData.filter((p: OptionPosition) => p.status === 'open')
        if (openPositions.length > 0) {
          const tickers = [...new Set(openPositions.map((p: OptionPosition) => p.stockTicker))]
          const prices = new Map<string, number>()

          // Fetch prices in parallel
          await Promise.all(
            tickers.map(async (ticker) => {
              try {
                const res = await fetch(`/api/stock-price/${ticker}`)
                if (res.ok) {
                  const data = await res.json()
                  prices.set(ticker.toUpperCase(), data.price)
                }
              } catch (err) {
                console.error(`Error fetching price for ${ticker}:`, err)
              }
            })
          )

          setStockPrices(prices)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchData()
  }, [stockFilter, typeFilter, statusFilter])

  // Handle form submission
  const onSubmit = async (data: CreateOptionPositionFormData) => {
    try {
      setSubmitting(true)

      const response = await fetch('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        toast.success('Position created successfully!')
        form.reset()
        fetchData() // Refresh data
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create position')
      }
    } catch (error) {
      console.error('Error creating position:', error)
      toast.error('Failed to create position')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle position deletion
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this position?')) return

    try {
      const response = await fetch(`/api/positions/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Position deleted successfully!')
        fetchData()
      } else {
        toast.error('Failed to delete position')
      }
    } catch (error) {
      console.error('Error deleting position:', error)
      toast.error('Failed to delete position')
    }
  }

  // Handle edit position
  const handleEdit = (position: OptionPosition) => {
    setEditingPosition(position)

    // Pre-fill form with position data
    form.reset({
      openDate: new Date(position.openDate).toISOString().split('T')[0],
      stockTicker: position.stockTicker,
      expiration: new Date(position.expiration).toISOString().split('T')[0],
      type: position.type,
      contracts: position.contracts.toString(),
      strike: position.strike.toString(),
      premium: position.premium.toString(),
      ownsStock: position.ownsStock ? "yes" : "no",
      stockCostBasis: position.stockCostBasis?.toString() || "",
      stockQuantity: position.stockQuantity?.toString() || "",
      stockAcquisitionDate: position.stockAcquisitionDate ? new Date(position.stockAcquisitionDate).toISOString().split('T')[0] : "",
      stockSalePrice: position.stockSalePrice?.toString() || "",
      stockSaleDate: position.stockSaleDate ? new Date(position.stockSaleDate).toISOString().split('T')[0] : "",
      assigned: position.assigned ? "yes" : "no",
      openFees: position.openFees?.toString() || "",
      closeDate: position.closeDate ? new Date(position.closeDate).toISOString().split('T')[0] : "",
      premiumPaidToClose: position.premiumPaidToClose?.toString() || "",
      closeFees: position.closeFees?.toString() || "",
      notes: position.notes || "",
    })

    setIsEditDialogOpen(true)
  }

  // Handle update position
  const handleUpdate = async (data: CreateOptionPositionFormData) => {
    if (!editingPosition) return

    try {
      setSubmitting(true)

      const response = await fetch(`/api/positions/${editingPosition.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        toast.success('Position updated successfully!')
        setIsEditDialogOpen(false)
        setEditingPosition(null)
        form.reset()
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update position')
      }
    } catch (error) {
      console.error('Error updating position:', error)
      toast.error('Failed to update position')
    } finally {
      setSubmitting(false)
    }
  }

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  // Format date
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">WT</span>
            </div>
            <h1 className="text-xl font-semibold text-foreground">WheelTracker</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => document.getElementById('new-position-form')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <FileText className="w-4 h-4 mr-2" />
              New Position
            </Button>
            <Button variant="outline" size="icon">
              <MessageSquare className="w-4 h-4" />
            </Button>
            <Button variant="outline" className="bg-yellow-400 hover:bg-yellow-500 text-black border-yellow-400">
              <Coffee className="w-4 h-4 mr-2" />
              Coffee
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Portfolio Summary */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Portfolio Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="bg-metric-blue border-none">
              <CardHeader className="pb-2">
                <CardDescription className="text-metric-blue-text text-xs">Total Positions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-metric-blue-text">
                  {loading ? '...' : metrics?.totalPositions || 0}
                </div>
                <p className="text-xs text-metric-blue-text/70 mt-1">{metrics?.openPositions || 0} open</p>
              </CardContent>
            </Card>

            <Card className="bg-metric-green border-none">
              <CardHeader className="pb-2">
                <CardDescription className="text-metric-green-text text-xs">Realized P/L</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-metric-green-text">
                  {loading ? '...' : formatCurrency(metrics?.realizedPL || 0)}
                </div>
                <div className="text-xs text-metric-green-text/70 mt-1 space-y-0.5">
                  <p>Premium: {loading ? '...' : formatCurrency(metrics?.premiumRealizedPL || 0)}</p>
                  <p>Stock: {loading ? '...' : formatCurrency(metrics?.stockRealizedPL || 0)}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-metric-purple border-none">
              <CardHeader className="pb-2">
                <CardDescription className="text-metric-purple-text text-xs">Unrealized P/L</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-metric-purple-text">
                  {loading ? '...' : formatCurrency(metrics?.unrealizedPL || 0)}
                </div>
                <div className="text-xs text-metric-purple-text/70 mt-1 space-y-0.5">
                  <p>Premium: {loading ? '...' : formatCurrency(metrics?.premiumUnrealizedPL || 0)}</p>
                  <p>Stock: {loading ? '...' : formatCurrency(metrics?.stockUnrealizedPL || 0)}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-metric-orange border-none">
              <CardHeader className="pb-2">
                <CardDescription className="text-metric-orange-text text-xs">Collected on Close</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-metric-orange-text">
                  {loading ? '...' : formatCurrency(metrics?.closedPremiumCollected || 0)}
                </div>
                <p className="text-xs text-metric-orange-text/70 mt-1">Net closed premiums</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-2 border-primary/20 col-span-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-muted-foreground text-xs">Capital Allocated</CardDescription>
                  <div className="text-2xl font-bold text-foreground">
                    {loading ? '...' : formatCurrency(metrics?.totalCapitalAllocated || 0)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {stockHoldings.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Stock</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Buy-In</TableHead>
                          <TableHead className="text-right">Total Cost</TableHead>
                          <TableHead className="text-right">Current Price</TableHead>
                          <TableHead className="text-right">Current Value</TableHead>
                          <TableHead className="text-right">Unrealized P/L</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockHoldings.map((holding) => (
                          <TableRow key={holding.ticker}>
                            <TableCell className="font-medium">{holding.ticker}</TableCell>
                            <TableCell className="text-right">{holding.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(holding.costBasis)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(holding.totalCostBasis)}</TableCell>
                            <TableCell className="text-right">
                              {holding.currentPrice ? formatCurrency(holding.currentPrice) : 'Loading...'}
                            </TableCell>
                            <TableCell className="text-right">
                              {holding.currentValue ? formatCurrency(holding.currentValue) : 'Loading...'}
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${
                              holding.unrealizedPL && holding.unrealizedPL > 0 ? 'text-green-600' :
                              holding.unrealizedPL && holding.unrealizedPL < 0 ? 'text-red-600' : ''
                            }`}>
                              {holding.unrealizedPL ? formatCurrency(holding.unrealizedPL) : 'Loading...'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No stock holdings</p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Strategy Alerts Dashboard */}
        {activeAlerts.length > 0 && (
          <section className="mb-8">
            <AlertsDashboard
              alerts={activeAlerts}
              onDismiss={dismissAlert}
              onViewPosition={(positionId) => {
                const position = positions.find(p => p.id === positionId)
                if (position) {
                  handleEdit(position)
                }
              }}
            />
          </section>
        )}

        {/* Return on Investment */}
        <section className="mb-8">
          <Card>
            <CardHeader
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setIsROIExpanded(!isROIExpanded)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Return on Investment (ROI)</CardTitle>
                  <CardDescription className="text-sm">Closed positions only. Realized gains</CardDescription>
                </div>
                <ChevronDown className={`w-5 h-5 transition-transform ${isROIExpanded ? "rotate-180" : ""}`} />
              </div>
            </CardHeader>
            {isROIExpanded && (
              <CardContent>
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  ROI Chart will appear here
                </div>
              </CardContent>
            )}
          </Card>
        </section>

        {/* Filters and Strategy */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Filters & Strategy</h3>
            <StrategySelector
              strategyConfig={strategyConfig}
              onUpdate={updateStrategyConfig}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="stock-filter" className="text-sm text-muted-foreground mb-2 block">
                Stock Symbol
              </Label>
              <Input
                id="stock-filter"
                placeholder="Filter by stock..."
                className="bg-card"
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="type-filter" className="text-sm text-muted-foreground mb-2 block">
                Type
              </Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger id="type-filter" className="bg-card">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="put">Put</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status-filter" className="text-sm text-muted-foreground mb-2 block">
                Status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter" className="bg-card">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* New Position Form */}
        <section className="mb-8" id="new-position-form">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">New Position</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Position Details - Row 1 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="openDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Open Date <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input type="date" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="stockTicker"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Stock Ticker <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="E.g., AAPL" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="expiration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Expiration <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input type="date" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Position Details - Row 2 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Type <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger className="bg-card">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="put">Put</SelectItem>
                                <SelectItem value="call">Call</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contracts"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            # Contracts <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="1" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="strike"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Strike <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Position Details - Row 3 - Stock Ownership */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="premium"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Premium <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ownsStock"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Own Stock?</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger className="bg-card">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="no">No</SelectItem>
                                <SelectItem value="yes">Yes</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="stockCostBasis"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock Cost Basis</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="stockQuantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock Quantity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="1"
                              placeholder="0"
                              className="bg-card"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="stockAcquisitionDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock Acquisition Date</FormLabel>
                          <FormControl>
                            <Input type="date" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Position Details - Row 3b - Stock Sale Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="stockSalePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock Sale Price</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="stockSaleDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock Sale Date</FormLabel>
                          <FormControl>
                            <Input type="date" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Position Details - Row 4 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="assigned"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger className="bg-card">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="no">No</SelectItem>
                                <SelectItem value="yes">Yes</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="openFees"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Open Fees</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="closeDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Close Date</FormLabel>
                          <FormControl>
                            <Input type="date" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Position Details - Row 5 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="premiumPaidToClose"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Premium Paid to Close</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="closeFees"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Close Fees</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Notes */}
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Any notes about this position..." className="bg-card min-h-24" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Form Actions */}
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => form.reset()}>
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={submitting}>
                      {submitting ? 'Creating...' : 'Create Position'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </section>

        {/* Positions List */}
        <section>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Positions ({positions.length})</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === 'cards' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('cards')}
                  >
                    <LayoutGrid className="w-4 h-4 mr-2" />
                    Cards
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                  >
                    <TableIcon className="w-4 h-4 mr-2" />
                    Table
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">Loading positions...</p>
                </div>
              ) : positions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground font-medium">No positions found</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Create your first position to get started</p>
                </div>
              ) : (
                <Tabs defaultValue="open" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="open">
                      Open Positions ({positions.filter(p => p.status === 'open' || p.status === 'assigned').length})
                    </TabsTrigger>
                    <TabsTrigger value="closed">
                      Closed Positions ({positions.filter(p => p.status === 'closed').length})
                    </TabsTrigger>
                    <TabsTrigger value="wheels">
                      Wheel Cycles ({wheelCycles.length})
                    </TabsTrigger>
                  </TabsList>

                  {/* Open Positions Tab */}
                  <TabsContent value="open" className="mt-4">
                    {positions.filter(p => p.status === 'open' || p.status === 'assigned').length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <p className="text-muted-foreground font-medium">No open positions</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">All positions are closed</p>
                      </div>
                    ) : viewMode === 'cards' ? (
                      <div className="space-y-4">
                        {positions.filter(p => p.status === 'open' || p.status === 'assigned').map((position) => {
                          const positionAlerts = allAlerts.filter((alert) => alert.positionId === position.id)
                          const currentPrice = stockPrices.get(position.stockTicker.toUpperCase())
                          const currentConfig = getStrategyConfig(
                            strategyConfig.activeStrategy,
                            strategyConfig.customRollThreshold,
                            strategyConfig.customCloseThreshold
                          )

                          return (
                            <Card key={position.id} className="border-2">
                              <CardContent className="pt-6">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Stock</p>
                                    <p className="font-semibold text-lg">{position.stockTicker}</p>
                                    <p className="text-xs text-muted-foreground capitalize">{position.type}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Strike / Contracts</p>
                                    <p className="font-semibold">${position.strike} × {position.contracts}</p>
                                    <p className="text-xs text-muted-foreground">Premium: ${position.premium}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Dates</p>
                                    <p className="font-semibold text-sm">{formatDate(position.openDate)}</p>
                                    <p className="text-xs text-muted-foreground">Exp: {formatDate(position.expiration)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Status</p>
                                    <div className="flex items-center gap-2">
                                      <p className={`font-semibold capitalize inline-block px-2 py-1 rounded text-xs ${
                                        position.status === 'open' ? 'bg-blue-500/10 text-blue-500' :
                                        'bg-orange-500/10 text-orange-500'
                                      }`}>
                                        {position.status}
                                      </p>
                                      {positionAlerts.length > 0 && (
                                        <Badge variant={positionAlerts[0].urgency === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                                          {positionAlerts[0].type === 'roll' ? '🔄 Roll' :
                                           positionAlerts[0].type === 'close' ? '✅ Close' : '⚠️'}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-2 ml-4">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEdit(position)}
                                    className="text-primary hover:text-primary"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(position.id)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              {position.notes && (
                                <div className="mt-4 pt-4 border-t">
                                  <p className="text-xs text-muted-foreground mb-1">Notes:</p>
                                  <p className="text-sm">{position.notes}</p>
                                </div>
                              )}
                              {position.wheelCycleName && (
                                <div className="mt-2">
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                    Wheel: {position.wheelCycleName}
                                  </span>
                                </div>
                              )}
                              {/* Strategy Details */}
                              <StrategyDetails
                                position={position}
                                currentStockPrice={currentPrice || null}
                                strategyConfig={currentConfig}
                                alerts={positionAlerts}
                              />
                            </CardContent>
                          </Card>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Stock</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Strike</TableHead>
                              <TableHead>Contracts</TableHead>
                              <TableHead>Premium</TableHead>
                              <TableHead>Expiration</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {positions.filter(p => p.status === 'open' || p.status === 'assigned').map((position) => (
                              <TableRow key={position.id}>
                                <TableCell className="font-semibold">{position.stockTicker}</TableCell>
                                <TableCell className="capitalize">{position.type}</TableCell>
                                <TableCell>${position.strike}</TableCell>
                                <TableCell>{position.contracts}</TableCell>
                                <TableCell>${position.premium}</TableCell>
                                <TableCell>{formatDate(position.expiration)}</TableCell>
                                <TableCell>
                                  <span className={`inline-block px-2 py-1 rounded text-xs capitalize ${
                                    position.status === 'open' ? 'bg-blue-500/10 text-blue-500' :
                                    'bg-orange-500/10 text-orange-500'
                                  }`}>
                                    {position.status}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEdit(position)}
                                      className="h-8 w-8 text-primary hover:text-primary"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDelete(position.id)}
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </TabsContent>

                  {/* Closed Positions Tab */}
                  <TabsContent value="closed" className="mt-4">
                    {positions.filter(p => p.status === 'closed').length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <p className="text-muted-foreground font-medium">No closed positions</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">Close a position to see it here</p>
                      </div>
                    ) : viewMode === 'cards' ? (
                      <div className="space-y-4">
                        {positions.filter(p => p.status === 'closed').map((position) => {
                          const positionAlerts = allAlerts.filter((alert) => alert.positionId === position.id)
                          const currentPrice = stockPrices.get(position.stockTicker.toUpperCase())
                          const currentConfig = getStrategyConfig(
                            strategyConfig.activeStrategy,
                            strategyConfig.customRollThreshold,
                            strategyConfig.customCloseThreshold
                          )

                          return (
                            <Card key={position.id} className="border-2">
                              <CardContent className="pt-6">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Stock</p>
                                    <p className="font-semibold text-lg">{position.stockTicker}</p>
                                    <p className="text-xs text-muted-foreground capitalize">{position.type}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Strike / Contracts</p>
                                    <p className="font-semibold">${position.strike} × {position.contracts}</p>
                                    <p className="text-xs text-muted-foreground">Premium: ${position.premium}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Dates</p>
                                    <p className="font-semibold text-sm">{formatDate(position.openDate)}</p>
                                    <p className="text-xs text-muted-foreground">
                                      Closed: {position.closeDate && formatDate(position.closeDate)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">P/L</p>
                                    {position.realizedPL && (
                                      <p className={`text-lg font-semibold ${position.realizedPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {formatCurrency(position.realizedPL)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2 ml-4">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEdit(position)}
                                    className="text-primary hover:text-primary"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(position.id)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              {position.notes && (
                                <div className="mt-4 pt-4 border-t">
                                  <p className="text-xs text-muted-foreground mb-1">Notes:</p>
                                  <p className="text-sm">{position.notes}</p>
                                </div>
                              )}
                              {position.wheelCycleName && (
                                <div className="mt-2">
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                    Wheel: {position.wheelCycleName}
                                  </span>
                                </div>
                              )}
                              {/* Strategy Details */}
                              <StrategyDetails
                                position={position}
                                currentStockPrice={currentPrice || null}
                                strategyConfig={currentConfig}
                                alerts={positionAlerts}
                              />
                            </CardContent>
                          </Card>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Stock</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Strike</TableHead>
                              <TableHead>Contracts</TableHead>
                              <TableHead>Open Date</TableHead>
                              <TableHead>Close Date</TableHead>
                              <TableHead>P/L</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {positions.filter(p => p.status === 'closed').map((position) => (
                              <TableRow key={position.id}>
                                <TableCell className="font-semibold">{position.stockTicker}</TableCell>
                                <TableCell className="capitalize">{position.type}</TableCell>
                                <TableCell>${position.strike}</TableCell>
                                <TableCell>{position.contracts}</TableCell>
                                <TableCell>{formatDate(position.openDate)}</TableCell>
                                <TableCell>{position.closeDate && formatDate(position.closeDate)}</TableCell>
                                <TableCell>
                                  {position.realizedPL && (
                                    <span className={`font-semibold ${position.realizedPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                      {formatCurrency(position.realizedPL)}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEdit(position)}
                                      className="h-8 w-8 text-primary hover:text-primary"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDelete(position.id)}
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </TabsContent>

                  {/* Wheel Cycles Tab */}
                  <TabsContent value="wheels" className="mt-4">
                    {wheelCycles.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <p className="text-muted-foreground font-medium">No wheel cycles yet</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">Wheel cycles are automatically created for each stock ticker</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {wheelCycles.map((cycle) => (
                          <Card key={cycle.name} className="border-2">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-xl font-bold">{cycle.name}</CardTitle>
                                <span className={`text-xs px-2 py-1 rounded capitalize ${
                                  cycle.status === 'active'
                                    ? 'bg-blue-500/10 text-blue-500'
                                    : 'bg-gray-500/10 text-gray-500'
                                }`}>
                                  {cycle.status}
                                </span>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div>
                                <p className="text-xs text-muted-foreground">Total P/L</p>
                                <p className={`text-2xl font-bold ${
                                  cycle.totalPL >= 0 ? 'text-green-500' : 'text-red-500'
                                }`}>
                                  {formatCurrency(cycle.totalPL)}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                                <div>
                                  <p className="text-xs text-muted-foreground">Realized</p>
                                  <p className={`font-semibold ${
                                    cycle.realizedPL >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {formatCurrency(cycle.realizedPL)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Unrealized</p>
                                  <p className={`font-semibold ${
                                    cycle.unrealizedPL >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {formatCurrency(cycle.unrealizedPL)}
                                  </p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                                <div>
                                  <p className="text-xs text-muted-foreground">Total Positions</p>
                                  <p className="font-semibold">{cycle.totalPositions}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Open / Closed</p>
                                  <p className="font-semibold text-sm">
                                    {cycle.openPositions} / {cycle.closedPositions}
                                  </p>
                                </div>
                              </div>
                              <div className="pt-2 border-t">
                                <p className="text-xs text-muted-foreground">Premium Collected</p>
                                <p className="font-semibold text-green-600">
                                  {formatCurrency(cycle.totalPremiumCollected)}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Edit Position Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open)
        if (!open) {
          setEditingPosition(null)
          form.reset()
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Position - {editingPosition?.stockTicker}</DialogTitle>
            <DialogDescription>
              Update position details. Add closing information when you buy back or let the option expire.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4">
              {/* Quick Close Section - Most Common Use Case */}
              <div className="bg-muted/50 p-4 rounded-lg space-y-4">
                <h3 className="font-semibold text-sm">Quick Close Position</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="closeDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Close Date</FormLabel>
                        <FormControl>
                          <Input type="date" className="bg-card" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="premiumPaidToClose"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Premium Paid to Close</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00 for expired" className="bg-card" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="closeFees"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Close Fees</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" className="bg-card" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* All Other Fields - Collapsible */}
              <details className="space-y-4">
                <summary className="cursor-pointer font-semibold text-sm mb-4">Show All Fields</summary>

                <div className="space-y-4">
                  {/* Position Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="openDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Open Date <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="date" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="stockTicker"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock Ticker <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="E.g., AAPL" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="expiration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expiration <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="date" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger className="bg-card">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="put">Put</SelectItem>
                                <SelectItem value="call">Call</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contracts"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel># Contracts <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="1" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="strike"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Strike <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="premium"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Premium <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ownsStock"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Own Stock?</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger className="bg-card">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="no">No</SelectItem>
                                <SelectItem value="yes">Yes</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="stockCostBasis"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock Cost Basis</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="stockQuantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock Quantity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="1"
                              placeholder="0"
                              className="bg-card"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="stockAcquisitionDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock Acquisition Date</FormLabel>
                          <FormControl>
                            <Input type="date" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="stockSalePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock Sale Price</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="stockSaleDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock Sale Date</FormLabel>
                          <FormControl>
                            <Input type="date" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="assigned"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger className="bg-card">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="no">No</SelectItem>
                                <SelectItem value="yes">Yes</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="openFees"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Open Fees</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" className="bg-card" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Any notes about this position..." className="bg-card min-h-20" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </details>

              {/* Form Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={submitting}>
                  {submitting ? 'Updating...' : 'Update Position'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
