'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SettingsNav() {
  const pathname = usePathname();

  const links = [
    {
      name: 'Profile Settings',
      href: '/settings',
      isActive: pathname === '/settings',
    },
    {
      name: 'Workspace Settings',
      href: '/settings/workspace',
      isActive: pathname === '/settings/workspace',
    },
    {
      name: 'Team & Members',
      href: '/settings/team',
      isActive: pathname === '/settings/team',
    },
  ];

  return (
    <nav className="px-3 space-y-1 mt-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`w-full font-bold text-[14px] rounded-[10px] px-3 py-2.5 flex items-center gap-3 transition-colors ${
            link.isActive 
              ? 'text-[hsl(var(--foreground))] bg-[#f3f4f6]' 
              : 'text-[hsl(var(--muted))] hover:bg-[#f3f4f6] hover:text-[hsl(var(--foreground))]'
          }`}
        >
          {link.name}
        </Link>
      ))}
    </nav>
  );
}
