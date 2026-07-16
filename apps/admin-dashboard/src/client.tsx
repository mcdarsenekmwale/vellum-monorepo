import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles.css";
import { getRouter } from "@/router";
import { RouterProvider } from "@tanstack/react-router";

function loadGoogleFonts() {
  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = "https://fonts.googleapis.com";
  document.head.appendChild(link);

  const link2 = document.createElement("link");
  link2.rel = "preconnect";
  link2.href = "https://fonts.gstatic.com";
  link2.crossOrigin = "anonymous";
  document.head.appendChild(link2);

  const link3 = document.createElement("link");
  link3.rel = "stylesheet";
  link3.href =
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;1,600;1,800&family=JetBrains+Mono:wght@400;500;600&display=swap";
  document.head.appendChild(link3);
}

loadGoogleFonts();

const router = getRouter();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);