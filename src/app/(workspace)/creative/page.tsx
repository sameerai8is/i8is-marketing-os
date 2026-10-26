export default function CreativePage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">Creative Studio</h1>
        <p className="text-muted-foreground mt-1">AI-generated branded images, covers, and visual briefs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border rounded-xl overflow-hidden">
            <div className="aspect-square bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-muted-foreground text-sm">
              Generated image {i}
            </div>
            <div className="p-4">
              <p className="text-sm font-medium">LinkedIn cover — AI recruitment</p>
              <p className="text-xs text-muted-foreground mt-1">Pending revision</p>
              <button className="mt-3 text-xs text-primary hover:underline">Request revision</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
