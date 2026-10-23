export default function HomePage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Command Center</h1>
        <p className="text-muted-foreground mt-1">Current strategy, active campaigns, and decisions needing attention.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-card border rounded-xl p-6">
          <p className="text-sm text-muted-foreground">Active Campaigns</p>
          <p className="text-3xl font-semibold mt-1">2</p>
        </div>
        <div className="bg-card border rounded-xl p-6">
          <p className="text-sm text-muted-foreground">Pending Approvals</p>
          <p className="text-3xl font-semibold mt-1 text-amber-600">5</p>
        </div>
        <div className="bg-card border rounded-xl p-6">
          <p className="text-sm text-muted-foreground">Scheduled This Week</p>
          <p className="text-3xl font-semibold mt-1">12</p>
        </div>
      </div>

      <div className="bg-card border rounded-xl p-6">
        <h2 className="text-lg font-medium mb-4">Rolling 30-Day Strategy</h2>
        <p className="text-sm text-muted-foreground">
          Focus on AI recruitment product launch targeting staffing agencies in Canada. 
          Emphasize demo bookings over vanity metrics. LinkedIn thought leadership + targeted Facebook/Instagram campaigns.
        </p>
        <div className="mt-4 flex gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">Managed Mode</span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">I8IS Internal</span>
        </div>
      </div>
    </div>
  );
}
