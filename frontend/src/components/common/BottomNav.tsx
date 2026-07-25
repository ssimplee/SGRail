import { NavLink } from "react-router-dom";
import { Map, Navigation, Users, MessageSquare, User, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Mobile bottom navigation bar (< 768px viewport).
 * Displays 5 nav items with icons and labels: Map, Route, Community, AI, Profile.
 * Uses react-router-dom NavLink for navigation with active route highlighting.
 *
 * Validates: Requirements 28.1, 28.6
 */

interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", labelKey: "nav.map", icon: Map },
  { to: "/route", labelKey: "nav.route", icon: Navigation },
  { to: "/community", labelKey: "nav.community", icon: Users },
  { to: "/assistant", labelKey: "nav.ai", icon: MessageSquare },
  { to: "/profile", labelKey: "nav.profile", icon: User },
];

export function BottomNav() {
  const { t } = useTranslation();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 safe-area-bottom"
      aria-label="Main navigation"
    >
      <ul className="flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "text-red-600"
                    : "text-gray-400 hover:text-gray-600"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    size={22}
                    className={isActive ? "text-red-600" : "text-gray-400"}
                  />
                  <span
                    className={`text-[10px] font-medium leading-tight ${
                      isActive ? "text-red-600" : "text-gray-400"
                    }`}
                  >
                    {t(item.labelKey)}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
