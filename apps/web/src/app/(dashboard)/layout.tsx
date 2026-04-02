import { Sidebar } from "@/components/layout/sidebar";
import { EpisodeBar } from "@/components/layout/episode-bar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="ml-[220px]">
        <EpisodeBar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
