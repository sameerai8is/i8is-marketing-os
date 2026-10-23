"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

const samplePosts = [
  { day: 6, platform: "LinkedIn", title: "AI recruitment launch", status: "scheduled", time: "9:00 AM" },
  { day: 8, platform: "Instagram", title: "Product demo reel", status: "pending_approval", time: "2:00 PM" },
  { day: 10, platform: "Facebook", title: "Customer success story", status: "scheduled", time: "11:30 AM" },
  { day: 13, platform: "LinkedIn", title: "Thought leadership post", status: "draft", time: "—" },
  { day: 15, platform: "Instagram", title: "Carousel: 5 benefits", status: "pending_approval", time: "10:00 AM" },
  { day: 18, platform: "LinkedIn", title: "Webinar announcement", status: "scheduled", time: "8:00 AM" },
  { day: 22, platform: "Facebook", title: "Industry trend report", status: "published", time: "3:00 PM" },
];

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 border-gray-200 text-gray-700",
  pending_approval: "bg-amber-50 border-amber-200 text-amber-800",
  scheduled: "bg-blue-50 border-blue-200 text-blue-700",
  published: "bg-green-50 border-green-200 text-green-700",
  failed: "bg-red-50 border-red-200 text-red-700",
};

export default function CalendarPage() {
  const [view, setView] = useState<"week" | "month">("month");
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">Content Calendar</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Planned, approved, scheduled, and published content across channels.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" />
          New Post
        </button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="border-b px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <button className="p-1.5 hover:bg-muted rounded">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium px-2">October 2026</span>
            <button className="p-1.5 hover:bg-muted rounded">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            <button
              onClick={() => setView("week")}
              className={`px-3 py-1 text-sm rounded-md ${view === "week" ? "bg-background shadow-sm" : ""}`}
            >
              Week
            </button>
            <button
              onClick={() => setView("month")}
              className={`px-3 py-1 text-sm rounded-md ${view === "month" ? "bg-background shadow-sm" : ""}`}
            >
              Month
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const posts = samplePosts.filter((p) => p.day === day);
              return (
                <div
                  key={day}
                  className="min-h-[90px] border rounded-lg p-1.5 text-xs hover:bg-muted/50 transition-colors"
                >
                  <div className="font-medium text-muted-foreground mb-1">{day}</div>
                  <div className="space-y-1">
                    {posts.map((post, idx) => (
                      <div
                        key={idx}
                        className={`border rounded px-1.5 py-1 truncate ${statusColors[post.status]}`}
                        title={`${post.platform}: ${post.title}`}
                      >
                        <span className="font-medium">{post.platform}</span>
                        <span className="block truncate opacity-80">{post.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-400" /> Draft</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Pending</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> Scheduled</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /> Published</span>
      </div>
    </div>
  );
}
