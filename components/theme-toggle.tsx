"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem("recallcode-theme");
    const nextTheme: Theme = stored === "dark" || stored === "light"
      ? stored
      : document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    window.setTimeout(() => setTheme(nextTheme), 0);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  function toggle() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("recallcode-theme", nextTheme);
  }

  const nextLabel = theme === "dark" ? "light" : "dark";
  return <button className="theme-toggle public-theme-toggle" type="button" onClick={toggle} aria-label={`Switch to ${nextLabel} mode`} title={`Switch to ${nextLabel} mode`}><span aria-hidden="true">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</span><span>{theme === "dark" ? "Light mode" : "Dark mode"}</span></button>;
}
