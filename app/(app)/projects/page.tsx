import { Topbar } from "@/components/Topbar";
import { ProjectsBrowser } from "@/components/ProjectsBrowser";
import { listProjects } from "@/lib/projects";

export const revalidate = 30;

export default function ProjectsPage() {
  const projects = listProjects();

  return (
    <>
      <Topbar title="โครงการ" subtitle={`ฐานข้อมูลโครงการ · ${projects.length} โครงการ`} actions={false} />
      <div className="p-4 lg:p-6">
        <ProjectsBrowser projects={projects} />
      </div>
    </>
  );
}
