"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

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
  return <Button className="fixed right-4 top-4 z-20" variant="outline" size="sm" type="button" onClick={toggle} aria-label={`Switch to ${nextLabel} mode`} title={`Switch to ${nextLabel} mode`}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}<span className="hidden sm:inline">{theme === "dark" ? "Light" : "Dark"}</span></Button>;
}
