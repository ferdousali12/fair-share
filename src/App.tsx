import { useState, useCallback } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import SplashScreen from './components/SplashScreen';
import GroupSetup from './components/GroupSetup';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import SplitScreen from './components/SplitScreen';
import Settings from './components/Settings';
import type { ViewType } from './types';

function AppContent() {
  const { state } = useApp();
  const [showSplash, setShowSplash] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (!state.isSetupComplete || state.settings.roommates.length === 0) {
    return <GroupSetup />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main content area */}
      <main className="animate-page-enter">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'split' && <SplitScreen />}
        {currentView === 'settings' && <Settings />}
      </main>

      {/* Navigation */}
      <Navigation currentView={currentView} onNavigate={setCurrentView} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}