import Link from "next/link";

const items = [
  {
    href: "/app/workspace/operations",
    label: "Organize",
    matches: ["/app/workspace/operations", "/app/workspace/presentations"],
    priority: "primary",
  },
  {
    href: "/app/workspace",
    label: "Execute",
    matches: ["/app/workspace"],
    priority: "primary",
  },
  {
    href: "/app/workspace/whiteboard",
    label: "Capture",
    matches: ["/app/workspace/whiteboard"],
    priority: "secondary",
  },
];

export default function WorkspaceSectionNav({ currentPath }: { currentPath: string }) {
  return (
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
  );
}