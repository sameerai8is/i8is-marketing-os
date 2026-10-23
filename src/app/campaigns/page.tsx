export default function CampaignsPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Campaign Studio</h1>
          <p className="text-muted-foreground mt-1">AI-proposed campaigns with objectives and content plans.</p>
        </div>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium">
          Generate Campaign
        </button>
      </div>

      <div className="grid gap-4">
        <div className="bg-card border rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium">AI Recruitment Product Launch</h3>
              <p className="text-sm text-muted-foreground mt-1">Target staffing agencies in Canada • Generate demo bookings</p>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              Needs Approval
            </span>
          </div>
          <div className="mt-4 flex gap-2 text-xs text-muted-foreground">
            <span>LinkedIn • Facebook • Instagram</span>
            <span>•</span>
            <span>30-day campaign</span>
          </div>
        </div>
      </div>
    </div>
  );
}
