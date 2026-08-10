import { Home, PieChart, Settings } from 'lucide-react';
import type { ViewType } from '../types';

interface NavigationProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
}

export default function Navigation({ currentView, onNavigate }: NavigationProps) {
  const tabs: { id: ViewType; label: string; icon: typeof Home }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'split', label: 'Split', icon: PieChart },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border safe-area-bottom z-40">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`flex flex-col items-center gap-0.5 py-2 px-4 rounded-xl transition-all cursor-pointer ${
                isActive
                  ? 'text-primary'
                  : 'text-foreground/50 hover:text-foreground/80'
              }`}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}