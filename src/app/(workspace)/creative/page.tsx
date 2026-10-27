import Link from "next/link";
export default function CreativePage() {
  return <div className="orbit-team"><div className="mission-header"><div><h1>Creative Studio</h1><p>Bring the company’s voice to your next post.</p></div></div><section className="orbit-surface p-8 mt-6"><h2>Write with your verified company knowledge.</h2><p className="text-sm text-muted-foreground my-4">The Planner can generate text drafts from reviewed company facts, then lets you edit the copy and inspect its references. Image generation, carousel design, asset storage, and visual revisions are not enabled yet.</p><Link className="orbit-button orbit-button-dark" href="/calendar">Create a text draft</Link></section></div>;
}
