import { useState, useEffect, useRef } from "react";
import { getProjects } from "../api/client";
import type { ApiProject } from "../types/api";
import ProjectStatusBadge from "./ProjectStatusBadge";

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
        className="flex items-center justify-between w-full px-3 py-2 border border-slate-300 rounded-lg bg-white cursor-pointer hover:bg-slate-50 focus-within:ring-2 focus-within:ring-primary-500"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm text-slate-900 truncate">
          {selectedProject ? selectedProject.name : placeholder}
        </span>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
            className="text-slate-400 hover:text-slate-600"
            title="Clear"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                loadProjects(e.target.value);
              }}
              placeholder="Search projects..."
              className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              autoFocus
            />
          </div>
          {loading ? (
            <div className="p-3 text-sm text-slate-500">Loading...</div>
          ) : (
            filteredProjects.map((p) => (
              <div
                key={p.id}
                className="p-3 cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm text-slate-900">{p.name}</p>
                  <ProjectStatusBadge status={p.status} />
                </div>
                {p.customer_name && <p className="text-xs text-slate-500">{p.customer_name}</p>}
              </div>
            ))
          )}
          {!loading && filteredProjects.length === 0 && (
            <div className="p-3 text-sm text-slate-500">No projects found</div>
          )}
        </div>
      )}
    </div>
  );
}
