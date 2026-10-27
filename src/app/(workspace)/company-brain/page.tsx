import { WorkspaceEditor } from "@/components/workspace-editor";
export default function CompanyBrainPage() {
  return <div className="orbit-team"><div className="mission-header"><div><h1>Your company, grounded in evidence.</h1><p>Maintain the company facts your marketing drafts can rely on.</p></div></div><div className="mt-6 max-w-4xl"><WorkspaceEditor mode="knowledge" /></div></div>;
}
