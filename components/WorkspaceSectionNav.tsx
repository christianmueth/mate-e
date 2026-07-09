import Link from "next/link";

const items = [
  {
    href: "/app/workspace",
    label: "Do",
    matches: ["/app/workspace"],
    priority: "primary",
  },
  {
    href: "/app/workspace/operations",
    label: "Plan",
    matches: ["/app/workspace/operations", "/app/workspace/presentations"],
    priority: "primary",
  },
  {
    href: "/app/workspace/whiteboard",
    label: "Capture",
    matches: ["/app/workspace/whiteboard"],
    priority: "secondary",
  },
];

export default function WorkspaceSectionNav({
  currentPath,
  projectName,
}: {
  currentPath: string;
  projectName: string;
}) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current project</p>
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{projectName}</h1>
        <div className="flex flex-wrap gap-2">
          {items.map((item) => {
            const active = item.matches.includes(currentPath);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active
                  ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                  : item.priority === "secondary"
                    ? "rounded-full border border-transparent bg-transparent px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    : "rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}