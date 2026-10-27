import { BufferConnection } from "@/components/buffer-connection";
import { WorkspaceEditor } from "@/components/workspace-editor";
export default function SettingsPage() {
  return <div className="orbit-team"><div className="mission-header"><div><h1>Workspace settings.</h1><p>Set your review workflow and check connected accounts.</p></div></div><div className="space-y-6 mt-6 max-w-3xl"><WorkspaceEditor mode="autonomy" /><BufferConnection /></div></div>;
}
