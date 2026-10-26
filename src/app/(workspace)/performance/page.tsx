export default function PerformancePage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">Performance Intelligence</h1>
        <p className="text-muted-foreground mt-1">Engagement patterns and recommendations for the next cycle.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Impressions (30d)", value: "48.2K", change: "+12%" },
          { label: "Engagement Rate", value: "4.8%", change: "+0.6%" },
          { label: "Demo Bookings", value: "17", change: "+5" },
          { label: "Top Channel", value: "LinkedIn", change: "—" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="text-2xl font-semibold mt-1">{kpi.value}</p>
            <p className="text-xs text-green-600 mt-1">{kpi.change}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-xl p-6">
        <h2 className="font-medium mb-4">AI Insights</h2>
        <ul className="space-y-3 text-sm">
          <li className="flex gap-2">
            <span className="text-green-600">•</span>
            LinkedIn posts about AI automation consistently outperform general technology content by ~2.4×.
          </li>
          <li className="flex gap-2">
            <span className="text-blue-600">•</span>
            Carousel formats on Instagram are driving higher save rates — recommend increasing frequency.
          </li>
          <li className="flex gap-2">
            <span className="text-amber-600">•</span>
            Facebook engagement is soft; consider testing shorter video clips for the next cycle.
          </li>
        </ul>
      </div>
    </div>
  );
}
