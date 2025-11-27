'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Loader2, ArrowUpRight, Clock, Ban, ChevronDown, ChevronUp
} from 'lucide-react';
import { useWallet, useWithdrawals } from './hooks';
import { StatusBadge } from './StatusBadge';
import { 
  formatCurrency, formatDate, 
  getTransactionIconComponent, getTransactionIconColor, isCredit 
} from './utils';
import type { Withdrawal, Transaction } from './types';

/**
 * Transaction and withdrawal history tab component
 */
export function HistoryTab() {
  const { transactions, isLoading: isLoadingWallet, fetchWalletData } = useWallet();
  const { withdrawals, isLoading: isLoadingWithdrawals, fetchWithdrawals, cancelWithdrawal } = useWithdrawals();
  
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);

  useEffect(() => {
    fetchWalletData();
    fetchWithdrawals();
  }, [fetchWalletData, fetchWithdrawals]);

  const handleCancelWithdrawal = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this withdrawal?')) return;

    try {
      const response = await cancelWithdrawal(id);

      if (response.ok) {
        fetchWalletData();
        fetchWithdrawals();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to cancel withdrawal');
      }
    } catch (error) {
      console.error('Error cancelling withdrawal:', error);
    }
  };

  const pendingWithdrawals = withdrawals.filter((w: Withdrawal) => ['PENDING', 'PROCESSING'].includes(w.status));

  return (
    <div className="space-y-6">
      {/* Pending Withdrawals */}
      {pendingWithdrawals.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800 p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-yellow-500" />
            Pending Withdrawals
          </h3>
          <div className="space-y-3">
            {pendingWithdrawals.map((withdrawal: Withdrawal) => (
              <div
                key={withdrawal.id}
                className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <ArrowUpRight className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {formatCurrency(withdrawal.netAmount)} to {withdrawal.bankAccount.bankName}
                    </p>
                    <p className="text-sm text-gray-400">
                      ****{withdrawal.bankAccount.accountNumberLast4} • {formatDate(withdrawal.requestedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <StatusBadge status={withdrawal.status} />
                  {withdrawal.status === 'PENDING' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancelWithdrawal(withdrawal.id)}
                      className="bg-zinc-800 border-zinc-700 hover:bg-red-600/20 text-red-400"
                    >
                      <Ban className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Transaction History */}
      <Card className="bg-zinc-900 border-zinc-800 p-6">
        <h3 className="text-xl font-bold text-white mb-4">Transaction History</h3>
        
        {isLoadingWallet || isLoadingWithdrawals ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No transactions yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Your transaction history will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction: Transaction) => {
              const IconComponent = getTransactionIconComponent(transaction.type);
              const iconColor = getTransactionIconColor(transaction.type);
              
              return (
                <div
                  key={transaction.id}
                  className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50 hover:bg-zinc-800 transition-colors"
                >
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedTransaction(
                      expandedTransaction === transaction.id ? null : transaction.id
                    )}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                        <IconComponent className={`w-5 h-5 ${iconColor}`} />
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          {transaction.type.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-gray-400">
                          {transaction.description || formatDate(transaction.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className={`font-semibold ${
                          isCredit(transaction.type) 
                            ? 'text-green-500' 
                            : 'text-red-500'
                        }`}>
                          {isCredit(transaction.type) ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </p>
                        <div className="mt-1">
                          <StatusBadge status={transaction.status} />
                        </div>
                      </div>
                      {expandedTransaction === transaction.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {expandedTransaction === transaction.id && (
                    <div className="mt-4 pt-4 border-t border-zinc-700 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Transaction ID</p>
                        <p className="text-gray-300 font-mono text-xs">{transaction.id}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Date</p>
                        <p className="text-gray-300">{formatDate(transaction.createdAt)}</p>
                      </div>
                      {transaction.fee > 0 && (
                        <div>
                          <p className="text-gray-500">Fee</p>
                          <p className="text-red-400">{formatCurrency(transaction.fee)}</p>
                        </div>
                      )}
                      {transaction.netAmount && transaction.netAmount !== transaction.amount && (
                        <div>
                          <p className="text-gray-500">Net Amount</p>
                          <p className="text-gray-300">{formatCurrency(transaction.netAmount)}</p>
                        </div>
                      )}
                      {transaction.completedAt && (
                        <div>
                          <p className="text-gray-500">Completed</p>
                          <p className="text-gray-300">{formatDate(transaction.completedAt)}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
