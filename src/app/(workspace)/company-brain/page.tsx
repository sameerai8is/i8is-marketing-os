import { WorkspaceEditor } from "@/components/workspace-editor";
import Link from "next/link";
export default function CompanyBrainPage() {
  return <div className="orbit-team"><div className="mission-header"><div><h1>Your company, grounded in evidence.</h1><p>Maintain the company facts your marketing drafts can rely on.</p></div><Link className="orbit-button orbit-button-dark" href="/research">Research website and competitors</Link></div><div className="mt-6 max-w-4xl"><WorkspaceEditor mode="knowledge" /></div></div>;
}
