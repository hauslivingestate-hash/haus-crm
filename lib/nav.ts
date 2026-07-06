export interface NavItem {
  href: string;
  label: string;
  icon: string; // inline svg path data (24x24, stroke)
}

export const NAV: NavItem[] = [
  { href: "/",          label: "แดชบอร์ด", icon: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" },
  { href: "/pipeline",  label: "ไปป์ไลน์",  icon: "M4 6h16M4 12h10M4 18h6" },
  { href: "/leads",     label: "Lead",     icon: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13A4 4 0 0119 7" },
  { href: "/listings",  label: "ทรัพย์",    icon: "M3 9.5L12 3l9 6.5M5 8.5V21h14V8.5M9 21v-6h6v6" },
  { href: "/styleguide", label: "Styleguide", icon: "M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" },
];
