"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { verticals } from "@/verticals";
import { useVertical } from "./providers";

export function Header() {
  const { vertical, setVerticalId } = useVertical();
  const path = usePathname();

  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="brand">
          Bookflow
        </Link>
        <nav className="nav">
          <Link href="/" aria-current={path === "/" ? "page" : undefined}>
            Book
          </Link>
          <Link href="/admin/" aria-current={path.startsWith("/admin") ? "page" : undefined}>
            Admin
          </Link>
        </nav>
        <label className="switcher">
          <span>Deployment</span>
          <select value={vertical.id} onChange={(e) => setVerticalId(e.target.value)}>
            {verticals.map((v) => (
              <option key={v.id} value={v.id}>
                {v.businessName} ({v.id})
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
