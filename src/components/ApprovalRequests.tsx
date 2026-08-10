import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDate, formatCurrency, CategoryIcon } from '../utils/format';
import { Check, X, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { ApprovalVote } from '../types';

export default function ApprovalRequests() {
  const { state, castVote, finalizeApproval } = useApp();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pendingRequests = state.approvalRequests.filter((r) => r.status === 'pending_approval');

  // Auto-finalize if majority of non-requester roommates have voted
  const handleVote = (requestId: string, roommateId: string, vote: 'approve' | 'reject') => {
    const voteEntry: ApprovalVote = { roommateId, vote, timestamp: Date.now() };
    castVote(requestId, voteEntry);

    // Check if majority reached after this vote
    const request = state.approvalRequests.find((r) => r.id === requestId);
    if (!request) return;

    const activeRoommates = state.settings.roommates.filter((r) => r.id !== request.requestedBy);
    const totalVoters = activeRoommates.length;
    const approveVotes = request.votes.filter((v) => v.vote === 'approve').length + (vote === 'approve' ? 1 : 0);
    const rejectVotes = request.votes.filter((v) => v.vote === 'reject').length + (vote === 'reject' ? 1 : 0);

    // Majority = more than half of active roommates
    const threshold = Math.ceil(totalVoters / 2);

    if (approveVotes >= threshold) {
      setTimeout(() => finalizeApproval(requestId, 'approved'), 300);
    } else if (rejectVotes >= threshold) {
      setTimeout(() => finalizeApproval(requestId, 'rejected'), 300);
    }
  };

  const getProgress = (requestId: string) => {
    const request = state.approvalRequests.find((r) => r.id === requestId);
    if (!request) return { approved: 0, rejected: 0, total: 0 };
    const activeRoommates = state.settings.roommates.filter((r) => r.id !== request.requestedBy);
    const approved = request.votes.filter((v) => v.vote === 'approve').length;
    const rejected = request.votes.filter((v) => v.vote === 'reject').length;
    return { approved, rejected, total: activeRoommates.length };
  };

  if (pendingRequests.length === 0) return null;

  return (
    <div className="mb-5 space-y-2">
      <div className="flex items-center gap-2 px-1">
        <div className="w-2 h-2 rounded-full bg-gold animate-mic-pulse" />
        <p className="text-xs font-medium text-foreground/60 uppercase tracking-wider">
          Pending Approval ({pendingRequests.length})
        </p>
      </div>

      {pendingRequests.map((request) => {
        const payer = state.settings.roommates.find((r) => r.id === request.expense.paidBy);
        const progress = getProgress(request.id);

        return (
          <div key={request.id} className="bg-white rounded-2xl shadow-card p-4 animate-fade-slide-in">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <CategoryIcon category={request.expense.category} className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-900">{request.expense.note}</p>
                  <p className="text-[10px] text-foreground/50">
                    {payer?.name || 'Someone'} &bull; {formatDate(request.expense.timestamp)}
                  </p>
                </div>
              </div>
              <p className="text-base font-bold text-green-900 tabular-nums">{formatCurrency(request.expense.amount)}</p>
            </div>

            {/* Vote progress */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex">
                <div className="bg-accent transition-all duration-300" style={{ width: `${(progress.approved / Math.max(progress.total, 1)) * 100}%` }} />
                <div className="bg-destructive/50 transition-all duration-300" style={{ width: `${(progress.rejected / Math.max(progress.total, 1)) * 100}%` }} />
              </div>
              <span className="text-[10px] text-foreground/50 tabular-nums">
                {progress.approved + progress.rejected}/{progress.total}
              </span>
            </div>

            {/* Vote buttons */}
            <div className="flex gap-2">
              {state.settings.roommates
                .filter((r) => r.id !== request.requestedBy)
                .map((rm) => {
                  const myVote = request.votes.find((v) => v.roommateId === rm.id);
                  return (
                    <button key={rm.id}
                      onClick={() => !myVote && handleVote(request.id, rm.id, 'approve')}
                      disabled={!!myVote}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer disabled:cursor-not-allowed ${
                        myVote?.vote === 'approve' ? 'bg-accent/20 text-accent' :
                        myVote?.vote === 'reject' ? 'bg-destructive/10 text-destructive' :
                        'bg-muted text-foreground/60 hover:bg-muted/80'
                      }`}
                      title={myVote ? `Voted ${myVote.vote}` : `Vote as ${rm.name}`}
                    >
                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: rm.color }} />
                      <span>{rm.name.split(' ')[0]}</span>
                      {myVote?.vote === 'approve' && <Check className="w-3 h-3" />}
                      {myVote?.vote === 'reject' && <X className="w-3 h-3" />}
                    </button>
                  );
                })}
            </div>

            {/* Quick actions */}
            {expandedId === request.id && (
              <div className="mt-3 pt-3 border-t border-border flex gap-2">
                <button onClick={() => {
                  // Vote approval on behalf of remaining roommates
                  state.settings.roommates
                    .filter((r) => r.id !== request.requestedBy && !request.votes.find((v) => v.roommateId === r.id))
                    .forEach((r) => handleVote(request.id, r.id, 'approve'));
                }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-all cursor-pointer">
                  <ThumbsUp className="w-3.5 h-3.5" /> Approve All
                </button>
                <button onClick={() => finalizeApproval(request.id, 'rejected')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-all cursor-pointer">
                  <ThumbsDown className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            )}
            <button onClick={() => setExpandedId(expandedId === request.id ? null : request.id)}
              className="mt-1 w-full text-center text-[10px] text-foreground/40 hover:text-foreground/70 transition-all cursor-pointer">
              {expandedId === request.id ? 'Less' : 'More'}
            </button>
          </div>
        );
      })}
    </div>
  );
}