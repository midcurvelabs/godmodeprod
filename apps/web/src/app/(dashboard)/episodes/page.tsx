import {
  LayoutDashboard,
  ListTodo,
  BookOpen,
  FileText,
  Repeat,
  Film,
  Layers,
  Newspaper,
  Image,
} from "lucide-react";
import { ModuleCard } from "@/components/ui/module-card";

const MODULES = [
  {
    name: "Docket",
    description: "Capture, review, and vote on topics for the upcoming episode.",
    status: "planned" as const,
    icon: ListTodo,
    href: "/docket",
  },
  {
    name: "Research Brief",
    description: "Generate pre-show research with depth per confirmed topic.",
    status: "planned" as const,
    icon: BookOpen,
    href: "/research",
  },
  {
    name: "Runsheet",
    description: "Timestamped production document for the live recording.",
    status: "planned" as const,
    icon: FileText,
    href: "/runsheet",
  },
  {
    name: "Repurpose Engine",
    description: "Transform transcript into content for every platform.",
    status: "planned" as const,
    icon: Repeat,
    href: "/repurpose",
  },
  {
    name: "Video Pipeline",
    description: "Cut clips, generate captions, render finished 9:16 reels.",
    status: "planned" as const,
    icon: Film,
    href: "/video",
  },
  {
    name: "Mashup Maker",
    description: "Create hot takes reel with 5 auto-generated variants.",
    status: "planned" as const,
    icon: Layers,
    href: "/mashup",
  },
  {
    name: "Newsletter",
    description: "Generate ready-to-paste Substack post from the episode.",
    status: "planned" as const,
    icon: Newspaper,
    href: "/newsletter",
  },
  {
    name: "Thumbnails",
    description: "Produce branded episode thumbnail from host photos.",
    status: "planned" as const,
    icon: Image,
    href: "/thumbnail",
  },
];

export default function EpisodesPage() {
  return (
    <div>
      {/* Episode header */}
      <div className="mb-8">
        <h1 className="font-display text-5xl text-accent mb-1">EPISODE DASHBOARD</h1>
        <p className="text-text-secondary text-sm">
          Command centre. See what&apos;s done, what&apos;s next, what&apos;s blocked.
        </p>
      </div>

      {/* Phase rail placeholder */}
      <div className="mb-8 bg-bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center gap-4 text-xs font-medium uppercase tracking-wider">
          <span className="text-text-muted">Pre-Production</span>
          <div className="flex-1 h-1 bg-bg-elevated rounded-full">
            <div className="h-1 bg-accent rounded-full w-0 transition-all" />
          </div>
          <span className="text-text-muted">Recording</span>
          <div className="flex-1 h-1 bg-bg-elevated rounded-full">
            <div className="h-1 bg-accent rounded-full w-0 transition-all" />
          </div>
          <span className="text-text-muted">Post-Production</span>
        </div>
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-2 gap-4">
        {MODULES.map((module) => (
          <ModuleCard
            key={module.name}
            name={module.name}
            description={module.description}
            status={module.status}
            icon={module.icon}
          />
        ))}
      </div>
    </div>
  );
}
