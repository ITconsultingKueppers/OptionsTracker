'use client'

import { useState, useEffect } from 'react'
import { AppHeader } from '@/components/app-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useStrategyAlerts } from '@/hooks/use-strategy-alerts'
import { OptionPosition } from '@/types/option'
import { StrategyDetails } from '@/components/strategy-details'
import { getStrategyConfig } from '@/lib/strategies'
import { Pencil, Trash2, LayoutGrid, Table as TableIcon } from 'lucide-react'
import { toast } from 'sonner'

export default function PositionsPage() {
  const [positions, setPositions] = useState<OptionPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')

  // Filter states
  const [stockFilter, setStockFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Stock prices for strategy calculations
  const [stockPrices, setStockPrices] = useState<Map<string, number>>(new Map())

  // Strategy alerts hook
  const { strategyConfig, updateStrategyConfig, allAlerts } = useStrategyAlerts(positions, stockPrices)

  // Fetch positions with filters
  const fetchPositions = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (stockFilter) params.append('stockSymbol', stockFilter)
      if (typeFilter !== 'all') params.append('type', typeFilter)
      if (statusFilter !== 'all') params.append('status', statusFilter)

      const res = await fetch(`/api/positions?${params.toString()}`)
      const data = await res.json()
      setPositions(data)

      // Fetch stock prices for open positions
      const openPositions = data.filter((p: OptionPosition) => p.status === 'open')
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
      console.error('Error fetching positions:', error)
      toast.error('Failed to fetch positions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPositions()
  }, [stockFilter, typeFilter, statusFilter])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this position?')) return

    try {
      const res = await fetch(`/api/positions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Position deleted successfully')
      fetchPositions()
    } catch (error) {
      console.error('Error deleting position:', error)
      toast.error('Failed to delete position')
    }
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const openPositions = positions.filter((p) => p.status === 'open')
  const closedPositions = positions.filter((p) => p.status === 'closed')

  return (
    <>
      <AppHeader />

      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Positions</h1>
          <p className="text-muted-foreground">View and manage all your option positions</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter positions by stock, type, or status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Input
                  placeholder="Search by stock..."
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value)}
                />
              </div>
              <div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="put">Put</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'cards' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('cards')}
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('table')}
                >
                  <TableIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Positions List */}
        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading positions...</p>
          </div>
        ) : (
          <Tabs defaultValue="open" className="w-full">
            <TabsList>
              <TabsTrigger value="open">Open ({openPositions.length})</TabsTrigger>
              <TabsTrigger value="closed">Closed ({closedPositions.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="open">
              {openPositions.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No open positions found
                  </CardContent>
                </Card>
              ) : viewMode === 'cards' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {openPositions.map((position) => {
                    const positionAlerts = allAlerts.filter((a) => a.positionId === position.id)
                    const currentPrice = stockPrices.get(position.stockTicker.toUpperCase()) || null
                    const config = getStrategyConfig(
                      strategyConfig.activeStrategy,
                      strategyConfig.customRollThreshold,
                      strategyConfig.customCloseThreshold
                    )

                    return (
                      <Card key={position.id}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">
                                {position.stockTicker} ${position.strike}
                              </CardTitle>
                              <CardDescription>
                                {position.type === 'put' ? 'Put' : 'Call'} • {formatDate(position.expiration)}
                              </CardDescription>
                            </div>
                            <Badge variant={position.ownsStock ? 'default' : 'secondary'}>
                              {position.type === 'put' ? 'CSP' : position.ownsStock ? 'CC' : 'Call'}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">Contracts</p>
                              <p className="font-semibold">{position.contracts}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Premium</p>
                              <p className="font-semibold">{formatCurrency(position.premium)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Total Premium</p>
                              <p className="font-semibold">
                                {formatCurrency(position.premium * position.contracts * 100)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Unrealized P/L</p>
                              <p
                                className={`font-semibold ${
                                  position.unrealizedPL && position.unrealizedPL > 0
                                    ? 'text-green-600'
                                    : position.unrealizedPL && position.unrealizedPL < 0
                                    ? 'text-red-600'
                                    : ''
                                }`}
                              >
                                {formatCurrency(position.unrealizedPL)}
                              </p>
                            </div>
                          </div>

                          <StrategyDetails
                            position={position}
                            currentStockPrice={currentPrice}
                            strategyConfig={config}
                            alerts={positionAlerts}
                          />

                          <div className="flex gap-2 pt-2">
                            <Button size="sm" variant="outline" className="flex-1">
                              <Pencil className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(position.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticker</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Strike</TableHead>
                        <TableHead>Expiration</TableHead>
                        <TableHead>Contracts</TableHead>
                        <TableHead>Premium</TableHead>
                        <TableHead>Unrealized P/L</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {openPositions.map((position) => (
                        <TableRow key={position.id}>
                          <TableCell className="font-medium">{position.stockTicker}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{position.type === 'put' ? 'Put' : 'Call'}</Badge>
                          </TableCell>
                          <TableCell>${position.strike}</TableCell>
                          <TableCell>{formatDate(position.expiration)}</TableCell>
                          <TableCell>{position.contracts}</TableCell>
                          <TableCell>{formatCurrency(position.premium)}</TableCell>
                          <TableCell
                            className={
                              position.unrealizedPL && position.unrealizedPL > 0
                                ? 'text-green-600'
                                : position.unrealizedPL && position.unrealizedPL < 0
                                ? 'text-red-600'
                                : ''
                            }
                          >
                            {formatCurrency(position.unrealizedPL)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="ghost">
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(position.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="closed">
              {closedPositions.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No closed positions found
                  </CardContent>
                </Card>
              ) : viewMode === 'cards' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {closedPositions.map((position) => (
                    <Card key={position.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              {position.stockTicker} ${position.strike}
                            </CardTitle>
                            <CardDescription>
                              {position.type === 'put' ? 'Put' : 'Call'} • {formatDate(position.openDate)}
                            </CardDescription>
                          </div>
                          <Badge variant="secondary">Closed</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Premium</p>
                            <p className="font-semibold">{formatCurrency(position.premium)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Realized P/L</p>
                            <p
                              className={`font-semibold ${
                                position.realizedPL && position.realizedPL > 0
                                  ? 'text-green-600'
                                  : position.realizedPL && position.realizedPL < 0
                                  ? 'text-red-600'
                                  : ''
                              }`}
                            >
                              {formatCurrency(position.realizedPL)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Close Date</p>
                            <p className="font-semibold text-xs">
                              {position.closeDate ? formatDate(position.closeDate) : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Contracts</p>
                            <p className="font-semibold">{position.contracts}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticker</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Strike</TableHead>
                        <TableHead>Open Date</TableHead>
                        <TableHead>Close Date</TableHead>
                        <TableHead>Premium</TableHead>
                        <TableHead>Realized P/L</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {closedPositions.map((position) => (
                        <TableRow key={position.id}>
                          <TableCell className="font-medium">{position.stockTicker}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{position.type === 'put' ? 'Put' : 'Call'}</Badge>
                          </TableCell>
                          <TableCell>${position.strike}</TableCell>
                          <TableCell>{formatDate(position.openDate)}</TableCell>
                          <TableCell>{position.closeDate ? formatDate(position.closeDate) : 'N/A'}</TableCell>
                          <TableCell>{formatCurrency(position.premium)}</TableCell>
                          <TableCell
                            className={
                              position.realizedPL && position.realizedPL > 0
                                ? 'text-green-600'
                                : position.realizedPL && position.realizedPL < 0
                                ? 'text-red-600'
                                : ''
                            }
                          >
                            {formatCurrency(position.realizedPL)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </>
  )
}
