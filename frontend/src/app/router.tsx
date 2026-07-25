import { Routes, Route } from "react-router-dom";
import { MapPage } from "@/pages/MapPage";
import { RoutePage } from "@/pages/RoutePage";
import { CommunityPage } from "@/pages/CommunityPage";
import { AssistantPage } from "@/pages/AssistantPage";
import { ProfilePage } from "@/pages/ProfilePage";

/**
 * App routes component defining the 5 main pages:
 * - / → MapPage
 * - /route → RoutePage
 * - /community → CommunityPage
 * - /assistant → AssistantPage
 * - /profile → ProfilePage
 *
 * Must be rendered inside a BrowserRouter context (provided by App.tsx).
 *
 * Validates: Requirements 28.1, 29.1
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MapPage />} />
      <Route path="/route" element={<RoutePage />} />
      <Route path="/community" element={<CommunityPage />} />
      <Route path="/assistant" element={<AssistantPage />} />
      <Route path="/profile" element={<ProfilePage />} />
    </Routes>
  );
}
