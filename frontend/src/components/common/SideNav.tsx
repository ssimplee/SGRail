import { NavLink } from "react-router-dom";
import { Map, Navigation, Users, MessageSquare, User, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Desktop side navigation rail (>= 768px viewport).
 * Displays 5 nav items vertically with icons and labels: Map, Route, Community, AI, Profile.
 * Uses react-router-dom NavLink for navigation with active route highlighting.
 *
 * Validates: Requirements 29.1, 28.6
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

export function SideNav() {
  const { t } = useTranslation();

  return (
    <nav
      className="fixed left-0 top-0 bottom-0 z-50 w-20 bg-white border-r border-gray-200 flex flex-col"
      aria-label="Main navigation"
    >
      {/* App logo area */}
      <div className="flex items-center justify-center h-16 border-b border-gray-100">
        <span className="text-lg font-bold text-red-600">SG</span>
      </div>

      {/* Nav items */}
      <ul className="flex-1 flex flex-col items-center gap-1 py-4">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-xl transition-colors ${
                  isActive
                    ? "bg-red-50 text-red-600"
                    : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
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
