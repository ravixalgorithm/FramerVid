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
      name: 'Plans & Billing',
      href: '/settings/billing',
      isActive: pathname === '/settings/billing',
    },
    {
      name: 'Team & Members',
      href: '/settings/team',
      isActive: pathname === '/settings/team',
    },
  ];

  return (
    <nav className="flex flex-row gap-1 overflow-x-auto pb-4 md:flex-col md:pb-0">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`detail-tab flex-1 whitespace-nowrap md:flex-initial ${
            link.isActive ? 'detail-tab-active' : 'detail-tab-idle'
          }`}
        >
          {link.name}
        </Link>
      ))}
    </nav>
  );
}
