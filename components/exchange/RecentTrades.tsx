'use client';

import { ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';

interface Trade {
  id: string;
  price: number;
  shares: number;
  total: number;
  side: 'buy' | 'sell';
  timestamp: string;
}

interface RecentTradesProps {
  trades: Trade[];
  maxRows?: number;
}

export default function RecentTrades({ trades, maxRows = 20 }: RecentTradesProps) {
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatPrice = (price: number) => {
    return `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden h-[400px] flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          Recent Trades
        </h3>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs text-gray-400 border-b border-zinc-800">
        <span>Price (₹)</span>
        <span className="text-center">Size</span>
        <span className="text-center">Total</span>
        <span className="text-right">Time</span>
      </div>

      {/* Trades List */}
      <div className="overflow-y-auto max-h-80">
        {trades.length === 0 ? (
          <div className="px-3 py-8 text-center text-gray-500 text-sm">
            No recent trades
          </div>
        ) : (
          trades.slice(0, maxRows).map((trade) => (
            <div
              key={trade.id}
              className="grid grid-cols-4 gap-2 px-3 py-1.5 text-xs hover:bg-zinc-800/50 transition-colors"
            >
              <span className={`font-medium flex items-center gap-1 ${
                trade.side === 'buy' ? 'text-green-400' : 'text-red-400'
              }`}>
                {trade.side === 'buy' ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {formatPrice(trade.price)}
              </span>
              <span className="text-center text-white">{trade.shares.toLocaleString()}</span>
              <span className="text-center text-gray-400">{formatPrice(trade.total)}</span>
              <span className="text-right text-gray-500">{formatTime(trade.timestamp)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
