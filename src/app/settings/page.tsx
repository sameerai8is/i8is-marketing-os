export default function SettingsPage() {
  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight mb-2">Settings</h1>
      <p className="text-muted-foreground mb-8">Autonomy mode, publishing limits, and account connections.</p>

      <div className="space-y-6 max-w-2xl">
        <div className="bg-card border rounded-xl p-6">
          <h2 className="font-medium mb-4">Autonomy Mode</h2>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-3">
              <input type="radio" name="mode" defaultChecked className="accent-primary" />
              <span><strong>Managed</strong> — Campaign approval required, then AI publishes within boundaries</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="radio" name="mode" className="accent-primary" />
              <span><strong>Assisted</strong> — Approve every post</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="radio" name="mode" className="accent-primary" />
              <span><strong>Autonomous</strong> — AI runs organic campaigns within pre-authorized limits</span>
            </label>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-6">
          <h2 className="font-medium mb-4">Publishing</h2>
          <p className="text-sm text-muted-foreground">Buffer connection and simulation mode.</p>
          <button className="mt-3 text-sm bg-muted px-3 py-1.5 rounded-lg">Connect Buffer (coming soon)</button>
        </div>
      </div>
    </div>
  );
}
