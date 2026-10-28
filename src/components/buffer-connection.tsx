"use client";

import { useState } from "react";
import type { PublishingConnection } from "@/lib/publishing/types";

export function BufferConnection() {
  const [connection, setConnection] = useState<PublishingConnection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function checkConnection() {
    setLoading(true);
    setError("");
    setConnection(null);
    try {
      const response = await fetch("/api/publishing/connection", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to check Buffer.");
      setConnection(result);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to check Buffer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bg-card border rounded-xl p-6" aria-labelledby="buffer-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="buffer-heading" className="font-medium">Connected accounts</h2>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">Live publishing available</span>
      </div>
      <p className="text-sm text-muted-foreground mt-3">Check the social profiles connected to I8IS through Buffer. An administrator can publish approved posts from Planner. This connection check does not send posts.</p>
      <button onClick={checkConnection} disabled={loading} className="mt-4 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm disabled:opacity-50">
        {loading ? "Checking Buffer…" : connection ? "Refresh profiles" : "Check Buffer connection"}
      </button>
      <div aria-live="polite" aria-busy={loading} className="mt-4">
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {connection && <>
          <p className="text-sm text-green-700">Buffer connected · {connection.channels.length} profiles</p>
          {connection.channels.length === 0 && <p className="text-sm text-muted-foreground mt-2">No profiles found. Connect your social accounts in Buffer, then refresh.</p>}
          <ul className="mt-3 space-y-3">
            {connection.channels.map(channel => <li key={channel.id} className="border rounded-lg p-3 text-sm">
              <p className="font-medium">{channel.name}</p>
              <p className="capitalize text-muted-foreground mt-1">{channel.platform}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className={channel.connected ? "text-green-700" : "text-red-700"}>{channel.connected ? "Connected" : "Reconnect in Buffer"}</span>
                {channel.locked && <span className="text-red-700">Locked in Buffer</span>}
                {channel.queuePaused && <span className="text-amber-700">Queue paused</span>}
              </div>
            </li>)}
          </ul>
        </>}
      </div>
      <a href="https://publish.buffer.com" target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-sm text-primary hover:underline">Manage profiles in Buffer</a>
    </section>
  );
}
