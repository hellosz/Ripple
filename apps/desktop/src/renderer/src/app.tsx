import type { ReactElement } from 'react';
import { AppProvider, useAppStore, useStore } from './store.js';
import { Sidebar } from './components/sidebar.js';
import { Toolbar } from './components/toolbar.js';
import { StatusBar } from './components/status-bar.js';
import { Toast } from './components/toast.js';
import { UpdateBanner } from './components/update-banner.js';
import { SkillListView } from './views/skill-list.js';
import { MarketView } from './views/market.js';
import { UpdatesView } from './views/updates.js';
import { SettingsView } from './views/settings.js';
import { GateView } from './views/gate.js';
import { SyncModal } from './modals/sync-modal.js';
import { HistoryModal } from './modals/history-modal.js';
import { LoginModal } from './modals/login-modal.js';

function Content(): ReactElement {
  const { view, loggedIn } = useStore();
  if (view.kind === 'market') return loggedIn ? <MarketView /> : <GateView kind="market" />;
  if (view.kind === 'updates') return loggedIn ? <UpdatesView /> : <GateView kind="updates" />;
  if (view.kind === 'settings') return <SettingsView />;
  return <SkillListView />;
}

function Shell(): ReactElement {
  const store = useStore();
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: '#faf9f2',
        color: '#374151',
        fontFamily: "'Noto Sans SC',system-ui,sans-serif",
        minHeight: 0,
      }}
    >
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <UpdateBanner />
        <Toolbar />
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '18px 20px' }}>
          <Content />
        </div>
        <StatusBar />
      </div>
      <SyncModal />
      <HistoryModal />
      {store.loginOpen && <LoginModal />}
      <Toast />
    </div>
  );
}

export function App(): ReactElement {
  const store = useAppStore();
  return (
    <AppProvider value={store}>
      <Shell />
    </AppProvider>
  );
}
