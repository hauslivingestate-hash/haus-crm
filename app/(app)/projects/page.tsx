import { Topbar } from "@/components/Topbar";
import { ProjectsBrowser } from "@/components/ProjectsBrowser";
import { getProjects } from "@/lib/queries";

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <>
      <Topbar title="โครงการ" subtitle={`ฐานข้อมูลโครงการ · ${projects.length} โครงการ`} actions={false} />
      <div className="p-4 lg:p-6">
        <ProjectsBrowser projects={projects} />
      </div>
    </>
  );
}
