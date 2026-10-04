import { useState, useEffect, useRef } from "react";
import { getProjects } from "../api/client";
import type { ApiProject } from "../types/api";
import ProjectStatusBadge from "./ProjectStatusBadge";
import { ChevronDown } from "lucide-react";

interface ProjectSelectorProps {
  value?: string;
  onChange: (projectId: string | undefined) => void;
  placeholder?: string;
  className?: string;
}

export default function ProjectSelector({ value, onChange, placeholder = "Select a project...", className = "" }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      loadProjects();
    }
  }, [open]);

  const loadProjects = async (q?: string) => {
    setLoading(true);
    try {
      const data = await getProjects({ search: q, status: "active" });
      setProjects(data.projects?.filter((p: ApiProject) => p.status !== "archived") ?? []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === value);

  const filteredProjects = search
    ? projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : projects;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className="dropdown-toggle"
        onClick={() => setOpen(!open)}
      >
        <span className="truncate" title={selectedProject ? selectedProject.name : placeholder}>
          {selectedProject ? selectedProject.name : placeholder}
        </span>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
            className="text-tertiary hover:text-secondary shrink-0 ml-2"
            title="Clear"
          >
            ×
          </button>
        )}
        {!value && <ChevronDown className="dropdown-chevron" />}
      </div>

      {open && (
        <div className="dropdown-content">
          <div className="p-2 border-b border-color-subtle">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                loadProjects(e.target.value);
              }}
              placeholder="Search projects..."
              className="form-control"
              autoFocus
            />
          </div>
          {loading ? (
            <div className="p-3 text-sm text-secondary">Loading...</div>
          ) : (
            filteredProjects.map((p) => (
              <div
                key={p.id}
                className="p-3 cursor-pointer hover:bg-surface-alt border-b border-color-subtle last:border-b-0"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm text-primary">{p.name}</p>
                  <ProjectStatusBadge status={p.status} />
                </div>
                {p.customer_name && <p className="text-xs text-secondary">{p.customer_name}</p>}
              </div>
            ))
          )}
          {!loading && filteredProjects.length === 0 && (
            <div className="p-3 text-sm text-secondary">No projects found</div>
          )}
        </div>
      )}
    </div>
  );
}




