import { Route, Routes, useLocation, useParams } from "react-router-dom";
import Nav from "./components/Nav";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import ProfileEditor from "./pages/ProfileEditor";
import Room from "./pages/Room";
import { useTranslation } from "./i18n/useTranslation";

/**
 * Farkli bir odaya geciste bileseni yeniden kurar. Ayni bilesen kaldiginda
 * eski socket/peer'lar yeni odaya tasinir, bu da oda karisimina yol acardi.
 */
function RoomRoute() {
  const { id = "" } = useParams();
  return <Room key={id} />;
}

export default function App() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const inRoom = pathname.startsWith("/room/");

  return (
    <div className={`app ${inRoom ? "app--room" : ""}`}>
      {/* Klavye kullanicilari icin: menuyu atlayip icerige git */}
      <a href="#icerik" className="skip-link">
        {t("app.skipToContent")}
      </a>
      {!inRoom && <Nav />}
      <main id="icerik" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<ProfileEditor />} />
          <Route path="/room/:id" element={<RoomRoute />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </main>
    </div>
  );
}
