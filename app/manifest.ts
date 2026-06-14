import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mate-E",
    short_name: "Mate-E",
    description: "AI workspace guidance with continuity memory, whiteboarding, operations, and planning surfaces.",
    id: "/app",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f8fafc",
    theme_color: "#0f766e",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["productivity", "education", "utilities"],
    shortcuts: [
      {
        name: "Workspace",
        short_name: "Workspace",
        url: "/app/workspace",
      },
      {
        name: "Whiteboard",
        short_name: "Whiteboard",
        url: "/app/workspace?mode=whiteboard",
      },
    ],
  };
}