import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/auth';

export default async function BillingSettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/signin');
  }

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for side projects and personal blogs.',
      features: ['Up to 10 videos', '100MB max per video', '5 min max duration', 'Standard controls customization'],
      current: true,
      buttonText: 'Current Plan',
    },
    {
      name: 'Pro',
      price: '$19',
      period: 'per month',
      description: 'Ideal for professional creators and growing teams.',
      features: ['Unlimited video uploads', '5GB max per video', 'Unlimited duration', 'Remove branding & add custom logos', 'Advanced player analytics', 'Priority email support'],
      current: false,
      buttonText: 'Upgrade to Pro',
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'tailored billing',
      description: 'Built for large-scale operations and custom platform integration.',
      features: ['Dedicated transcoding queue', 'Custom SLA agreements', 'Single Sign-On (SSO)', 'White-label player SDK', '24/7 Phone & Slack support'],
      current: false,
      buttonText: 'Contact Sales',
    },
  ];

  const mockInvoices = [
    { id: 'FV-1002', date: 'June 01, 2026', amount: '$0.00', status: 'Paid' },
    { id: 'FV-1001', date: 'May 01, 2026', amount: '$0.00', status: 'Paid' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">Plans & Billing</h2>
        <p className="text-xs text-[hsl(var(--muted))]">Manage your subscription and view invoices</p>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`detail-surface relative flex flex-col justify-between p-5 ${
              plan.current
                ? 'border-[hsl(var(--accent-border))] ring-2 ring-[hsl(var(--accent)/0.15)]'
                : ''
            }`}
          >
            {plan.current && (
              <span className="absolute top-0 right-4 -translate-y-1/2 rounded-full bg-accent px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white">
                Active
              </span>
            )}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{plan.name}</h3>
                <p className="mt-1 text-[11px] text-[hsl(var(--muted))]">{plan.description}</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-semibold tracking-tight text-[hsl(var(--foreground))]">{plan.price}</span>
                <span className="text-[10px] font-medium text-[hsl(var(--muted))]">/ {plan.period}</span>
              </div>
              <ul className="space-y-2 border-t border-[hsl(var(--hairline))] pt-4 text-[11px] text-[hsl(var(--muted))]">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-6">
              <button
                type="button"
                disabled={plan.current}
                className={`w-full rounded-lg py-1.5 text-center text-xs font-bold ${
                  plan.current
                    ? 'cursor-default bg-[hsl(var(--sidebar))] text-[hsl(var(--muted))]'
                    : 'btn-secondary !h-9'
                }`}
              >
                {plan.buttonText}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Transactions History */}
      <div className="space-y-3 border-t border-[hsl(var(--hairline))] pt-4">
        <h3 className="section-label">Billing History</h3>
        <div className="list-table-wrap overflow-x-auto">
          <table className="list-table">
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {mockInvoices.map((inv) => (
                <tr key={inv.id} className="list-row">
                  <td className="font-mono font-semibold text-[hsl(var(--foreground))]">{inv.id}</td>
                  <td>{inv.date}</td>
                  <td>{inv.amount}</td>
                  <td>
                    <span className="status-pill status-pill-success">{inv.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
