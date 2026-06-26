import { Routes, Route, Navigate } from 'react-router-dom';

import RequireAuth   from './components/RequireAuth.jsx';
import XpToastHost   from './components/XpToastHost.jsx';
import MsgPopupHost  from './components/MsgPopup.jsx';
import BabaAssistant from './components/BabaAssistant.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';

import Landing   from './pages/Landing.jsx';
import Feed      from './pages/Feed.jsx';
import Mentors   from './pages/Mentors.jsx';
import Events    from './pages/Events.jsx';
import Resources from './pages/Resources.jsx';
import Messages  from './pages/Messages.jsx';
import Profile   from './pages/Profile.jsx';
import Saved     from './pages/Saved.jsx';
import Groups    from './pages/Groups.jsx';
import Leaderboard from './pages/Leaderboard.jsx';

export default function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <XpToastHost />
        <MsgPopupHost />
        <BabaAssistant />
        <Routes>
          <Route path="/"          element={<Landing />} />
          <Route path="/index.html" element={<Navigate to="/" replace />} />

          <Route path="/feed"      element={<RequireAuth><Feed /></RequireAuth>} />
          <Route path="/mentors"   element={<RequireAuth><Mentors /></RequireAuth>} />
          <Route path="/events"    element={<RequireAuth><Events /></RequireAuth>} />
          <Route path="/resources" element={<RequireAuth><Resources /></RequireAuth>} />
          <Route path="/messages"  element={<RequireAuth><Messages /></RequireAuth>} />
          <Route path="/profile"   element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/saved"     element={<RequireAuth><Saved /></RequireAuth>} />
          <Route path="/groups"    element={<RequireAuth><Groups /></RequireAuth>} />
          <Route path="/leaderboard" element={<RequireAuth><Leaderboard /></RequireAuth>} />

          {/* Legacy URLs from the vanilla version. */}
          <Route path="/feed.html"      element={<Navigate to="/feed"      replace />} />
          <Route path="/mentors.html"   element={<Navigate to="/mentors"   replace />} />
          <Route path="/events.html"    element={<Navigate to="/events"    replace />} />
          <Route path="/resources.html" element={<Navigate to="/resources" replace />} />
          <Route path="/messages.html"  element={<Navigate to="/messages"  replace />} />
          <Route path="/profile.html"   element={<Navigate to="/profile"   replace />} />
          <Route path="/saved.html"     element={<Navigate to="/saved"     replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </NotificationProvider>
    </ThemeProvider>
  );
}
