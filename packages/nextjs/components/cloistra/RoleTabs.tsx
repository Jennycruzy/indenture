"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCorridor } from "~~/hooks/cloistra/useCorridor";

const TABS = [
  { href: "/playground", label: "Playground", role: "sender" },
  { href: "/operator", label: "Operator", role: "operator" },
  { href: "/sender", label: "Sender", role: "sender" },
  { href: "/officer", label: "Compliance", role: "officer" },
  { href: "/docs", label: "Docs", role: null },
] as const;

export function RoleTabs() {
  const pathname = usePathname();
  const { role } = useCorridor();

  return (
    <nav className="flex flex-wrap gap-1">
      {TABS.map(t => {
        const active = pathname === t.href;
        const isYou = t.role && t.role === role;
        return (
          <Link
            key={t.href}
            href={t.href}
            className="ob-chip cursor-pointer transition-all"
            style={
              active
                ? { borderColor: "var(--ob-seal-b)", color: "var(--ob-ink)", background: "rgba(99,102,241,0.1)" }
                : undefined
            }
          >
            {t.label}
            {isYou && <span className="ob-audit-text text-[0.6rem]">you</span>}
          </Link>
        );
      })}
    </nav>
  );
}
