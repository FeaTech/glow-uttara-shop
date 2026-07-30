import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Copy, Check, Share2, Mail, Users, Gift } from "lucide-react";
import { getReferralDashboard, getReferralHistory } from "@/lib/referral.functions";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const dashboardQueryOptions = () =>
  queryOptions({ queryKey: ["referral", "dashboard"], queryFn: () => getReferralDashboard({ data: undefined }) });
const historyQueryOptions = () =>
  queryOptions({ queryKey: ["referral", "history"], queryFn: () => getReferralHistory({ data: undefined }) });

export const Route = createFileRoute("/_authenticated/referrals")({
  head: () => ({
    meta: [
      { title: "Refer & Earn — FEA Glam" },
      { name: "description", content: "Share FEA Glam with friends and earn referral commissions." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(dashboardQueryOptions());
    context.queryClient.ensureQueryData(historyQueryOptions());
  },
  component: ReferralsPage,
});

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  approved: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

function ReferralsPage() {
  const { data: dash } = useSuspenseQuery(dashboardQueryOptions());
  const { data: history } = useSuspenseQuery(historyQueryOptions());
  const [copied, setCopied] = useState(false);

  // RLS scopes realtime events to this user's own commissions, so no filter needed.
  useRealtimeInvalidate({
    channel: "my-referrals",
    table: "referral_commissions",
    invalidate: [["referral", "dashboard"], ["referral", "history"]],
  });

  const link = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://feaglam.com";
    return `${origin}/signup?ref=${dash.referralCode}`;
  }, [dash.referralCode]);

  const shareMessage = `Shop premium beauty at FEA Glam and get a welcome treat! Use my referral link: ${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Referral link copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy — please copy manually");
    }
  };

  const earningCards = [
    { label: "Pending", value: dash.earnings.pending, tone: "text-amber-600 dark:text-amber-400" },
    { label: "Approved", value: dash.earnings.approved, tone: "text-blue-600 dark:text-blue-400" },
    { label: "Paid", value: dash.earnings.paid, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: "Cancelled", value: dash.earnings.cancelled, tone: "text-muted-foreground" },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container-luxe py-12">
        <div className="flex items-center gap-3">
          <Gift className="h-7 w-7 text-primary" />
          <h1 className="font-serif text-3xl font-light text-foreground md:text-4xl">Refer &amp; Earn</h1>
        </div>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Invite friends to FEA Glam. Earn <span className="font-medium text-foreground">{dash.level1Percentage}%</span> when they shop,
          and <span className="font-medium text-foreground">{dash.level2Percentage}%</span> when their invites shop too.
        </p>

        {!dash.programEnabled && (
          <div className="mt-6 rounded-lg border border-amber-300/50 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            The referral program is currently paused. Your existing earnings are safe.
          </div>
        )}

        {/* Share card */}
        <div className="card-luxe mt-8 p-6">
          <h2 className="font-serif text-xl text-foreground">Your referral link</h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1 rounded-md border border-input bg-secondary/40 px-4 py-3 font-mono text-sm text-foreground">
              <div className="text-xs text-muted-foreground">Code: <span className="font-semibold text-primary">{dash.referralCode}</span></div>
              <div className="mt-1 truncate">{link}</div>
            </div>
            <Button className="btn-gold" onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm"><Share2 className="h-4 w-4" /> WhatsApp</Button>
            </a>
            <a href={`mailto:?subject=${encodeURIComponent("A treat for you at FEA Glam")}&body=${encodeURIComponent(shareMessage)}`}>
              <Button variant="outline" size="sm"><Mail className="h-4 w-4" /> Email</Button>
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
          <div className="card-luxe p-5">
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Direct</span><Users className="h-4 w-4 text-primary" /></div>
            <p className="mt-2 font-serif text-2xl text-foreground">{dash.directReferrals}</p>
          </div>
          <div className="card-luxe p-5">
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Indirect</span><Users className="h-4 w-4 text-primary" /></div>
            <p className="mt-2 font-serif text-2xl text-foreground">{dash.indirectReferrals}</p>
          </div>
          {earningCards.map((c) => (
            <div key={c.label} className="card-luxe p-5">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <p className={cn("mt-2 font-serif text-2xl", c.tone)}>{formatINR(c.value)}</p>
            </div>
          ))}
        </div>

        {/* History */}
        <div className="mt-10">
          <h2 className="font-serif text-2xl font-light text-foreground">Referral history</h2>
          {history.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
              No referral earnings yet. Share your link to get started!
            </div>
          ) : (
            <div className="card-luxe mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Eligible</th>
                    <th className="px-4 py-3 text-right">%</th>
                    <th className="px-4 py-3 text-right">Commission</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-mono text-foreground">#{h.orderRef}</td>
                      <td className="px-4 py-3 text-muted-foreground">{h.referredCustomer}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-secondary px-2 py-0.5 text-xs">L{h.level}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(h.orderDate)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatINR(h.eligibleAmount)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{h.percentage}%</td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">{formatINR(h.commissionAmount)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium capitalize", STATUS_STYLES[h.status])}>{h.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
