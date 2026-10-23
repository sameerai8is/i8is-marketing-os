export default function CompanyBrainPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">Company Brain</h1>
      <p className="text-muted-foreground mb-8">Verified company profile, brand guidelines, and knowledge sources for I8IS.</p>
      
      <div className="grid gap-6">
        <div className="bg-card border rounded-xl p-6">
          <h2 className="text-lg font-medium mb-4">Brand Profile</h2>
          <div className="space-y-4 text-sm">
            <div>
              <label className="font-medium">Company</label>
              <p className="text-muted-foreground mt-1">I8IS — AI-powered recruitment solutions</p>
            </div>
            <div>
              <label className="font-medium">Target Audience</label>
              <p className="text-muted-foreground mt-1">Staffing agencies in Canada, HR leaders</p>
            </div>
            <div>
              <label className="font-medium">Tone</label>
              <p className="text-muted-foreground mt-1">Professional, insightful, practical</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
