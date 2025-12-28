'use client';

import { useMemo, useState } from 'react';

interface Order {
  price: number;
  shares: number;
  total: number;
  orderId?: string;
}

interface Trade {
  id: string;
  price: number;
  shares: number;
  total: number;
  side: 'buy' | 'sell';
  timestamp: string;
}

interface OrderBookProps {
  buyOrders: Order[];
  sellOrders: Order[];
  currentPrice: number;
  onOrderClick?: (price: number, type: 'buy' | 'sell') => void;
  maxRows?: number;
  trades?: Trade[];
}

export default function OrderBook({
  buyOrders,
  sellOrders,
  currentPrice,
  onOrderClick,
  maxRows = 10,
  trades = [],
}: OrderBookProps) {
  const [activeTab, setActiveTab] = useState<'orderbook' | 'trades'>('orderbook');

  // Calculate cumulative totals and max for bar widths
  const processedSellOrders = useMemo(() => {
    let cumulative = 0;
    return sellOrders
      .sort((a, b) => a.price - b.price) // Lowest first (best ask at bottom)
      .slice(0, maxRows)
      .reverse() // Reverse to show best ask at bottom
      .map(order => {
        cumulative += order.shares;
        return { ...order, cumulative };
      });
  }, [sellOrders, maxRows]);

  const processedBuyOrders = useMemo(() => {
    let cumulative = 0;
    return buyOrders
      .sort((a, b) => b.price - a.price) // Highest first (best bid at top)
      .slice(0, maxRows)
      .map(order => {
        cumulative += order.shares;
        return { ...order, cumulative };
      });
  }, [buyOrders, maxRows]);

  const maxCumulative = useMemo(() => {
    const sellMax = processedSellOrders.length > 0 
      ? processedSellOrders[0].cumulative || 0 
      : 0;
    const buyMax = processedBuyOrders.length > 0 
      ? processedBuyOrders[processedBuyOrders.length - 1]?.cumulative || 0 
      : 0;
    return Math.max(sellMax, buyMax, 1);
  }, [processedSellOrders, processedBuyOrders]);

  const spread = useMemo(() => {
    if (processedSellOrders.length === 0 || processedBuyOrders.length === 0) return 0;
    const lowestAsk = processedSellOrders[processedSellOrders.length - 1]?.price || 0;
    const highestBid = processedBuyOrders[0]?.price || 0;
    return lowestAsk - highestBid;
  }, [processedSellOrders, processedBuyOrders]);

  const spreadPercent = useMemo(() => {
    if (currentPrice === 0) return 0;
    return (spread / currentPrice) * 100;
  }, [spread, currentPrice]);

  const formatPrice = (price: number) => {
    return `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
  };

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden h-full">
      {/* Tab Header */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('orderbook')}
          className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'orderbook'
              ? 'text-white border-b-2 border-red-500 bg-zinc-800/50'
              : 'text-gray-400 hover:text-white hover:bg-zinc-800/30'
          }`}
        >
          Order Book
        </button>
        <button
          onClick={() => setActiveTab('trades')}
          className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'trades'
              ? 'text-white border-b-2 border-red-500 bg-zinc-800/50'
              : 'text-gray-400 hover:text-white hover:bg-zinc-800/30'
          }`}
        >
          Trades
        </button>
      </div>

      {activeTab === 'orderbook' ? (
        <>
          {/* Column Headers */}
          <div className="grid grid-cols-3 gap-2 px-3 py-2 text-xs text-gray-400 border-b border-zinc-800">
            <span>Price (₹)</span>
            <span className="text-center">Size</span>
            <span className="text-right">Total</span>
          </div>

          {/* Sell Orders (Asks) */}
          <div className="overflow-hidden">
            {processedSellOrders.length === 0 ? (
              <div className="px-3 py-4 text-center text-gray-500 text-sm">
                No sell orders
              </div>
            ) : (
              processedSellOrders.map((order, index) => (
                <div
                  key={`sell-${index}`}
                  className="relative grid grid-cols-3 gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-zinc-800/50 transition-colors"
                  onClick={() => onOrderClick?.(order.price, 'sell')}
                >
                  {/* Background bar */}
                  <div
                    className="absolute inset-0 bg-red-500/10"
                    style={{
                      width: `${((order.cumulative || 0) / maxCumulative) * 100}%`,
                      right: 0,
                      left: 'auto',
                    }}
                  />
                  <span className="relative text-red-400 font-medium">{formatPrice(order.price)}</span>
                  <span className="relative text-center text-white">{order.shares.toLocaleString()}</span>
                  <span className="relative text-right text-gray-400">{formatPrice(order.total)}</span>
                </div>
              ))
            )}
          </div>

          {/* Spread / Current Price */}
          <div className="px-3 py-3 bg-zinc-800 border-y border-zinc-700">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-white">
                {formatPrice(currentPrice)}
              </span>
              <div className="text-right">
                <span className="text-xs text-gray-400">Spread: </span>
                <span className="text-xs text-white">
                  {formatPrice(spread)} ({spreadPercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Buy Orders (Bids) */}
          <div className="overflow-hidden">
            {processedBuyOrders.length === 0 ? (
              <div className="px-3 py-4 text-center text-gray-500 text-sm">
                No buy orders
              </div>
            ) : (
              processedBuyOrders.map((order, index) => (
                <div
                  key={`buy-${index}`}
                  className="relative grid grid-cols-3 gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-zinc-800/50 transition-colors"
                  onClick={() => onOrderClick?.(order.price, 'buy')}
                >
                  {/* Background bar */}
                  <div
                    className="absolute inset-0 bg-green-500/10"
                    style={{
                      width: `${((order.cumulative || 0) / maxCumulative) * 100}%`,
                      right: 0,
                      left: 'auto',
                    }}
                  />
                  <span className="relative text-green-400 font-medium">{formatPrice(order.price)}</span>
                  <span className="relative text-center text-white">{order.shares.toLocaleString()}</span>
                  <span className="relative text-right text-gray-400">{formatPrice(order.total)}</span>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          {/* Trades Tab */}
          {/* Column Headers */}
          <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs text-gray-400 border-b border-zinc-800">
            <span>Price (₹)</span>
            <span className="text-center">Size</span>
            <span className="text-center">Total</span>
            <span className="text-right">Time</span>
          </div>

          {/* Trades List */}
          <div className="overflow-y-auto max-h-[200px]">
            {trades.length === 0 ? (
              <div className="px-3 py-8 text-center text-gray-500 text-sm">
                No recent trades
              </div>
            ) : (
              trades.slice(0, maxRows * 2).map((trade) => (
                <div
                  key={trade.id}
                  className="grid grid-cols-4 gap-2 px-3 py-1.5 text-xs hover:bg-zinc-800/30 transition-colors"
                >
                  <span className={`font-medium ${
                    trade.side === 'buy' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatPrice(trade.price)}
                  </span>
                  <span className="text-center text-white">{trade.shares.toLocaleString()}</span>
                  <span className="text-center text-gray-400">{formatPrice(trade.total)}</span>
                  <span className="text-right text-gray-500">{formatTime(trade.timestamp)}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
