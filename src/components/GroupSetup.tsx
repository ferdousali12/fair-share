import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getRoommateColor, generateId } from '../utils/format';
import { CURRENCIES } from '../types';
import type { CurrencyCode } from '../types';
import { UserPlus, ArrowRight, ArrowLeft, Home } from 'lucide-react';

type SetupStep = 'currency' | 'roommates';

export default function GroupSetup() {
  const { completeSetup } = useApp();
  const [step, setStep] = useState<SetupStep>('currency');
  const [groupName, setGroupName] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('PKR');
  const [roommateNames, setRoommateNames] = useState<string[]>(['', '']);
  const [error, setError] = useState('');

  const addRoommateField = () => {
    if (roommateNames.length < 6) {
      setRoommateNames([...roommateNames, '']);
    }
  };

  const updateName = (index: number, name: string) => {
    const updated = [...roommateNames];
    updated[index] = name;
    setRoommateNames(updated);
  };

  const removeField = (index: number) => {
    if (roommateNames.length > 2) {
      setRoommateNames(roommateNames.filter((_, i) => i !== index));
    }
  };

  const handleNext = () => {
    setError('');
    if (step === 'currency') {
      if (!groupName.trim()) {
        setError('Please name your flat');
        return;
      }
      setStep('roommates');
    }
  };

  const handlePrev = () => {
    setError('');
    if (step === 'roommates') setStep('currency');
  };

  const handleSubmit = () => {
    setError('');

    const validNames = roommateNames
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (validNames.length < 2) {
      setError('Add at least 2 roommates');
      return;
    }

    // Create a single default room — AC config is done in Settings
    const defaultRoom = {
      id: generateId(),
      name: 'Room 1',
      acType: 'inverter' as const,
      tonnage: 1.5,
      acCount: 1,
      rentWeightage: 1,
      connectionPhase: 'single' as const,
    };

    const createdRoommates = validNames.map((name, i) => ({
      id: generateId(),
      name,
      color: getRoommateColor(i),
      roomId: defaultRoom.id,
      sharedGroceriesOptIn: false,
      wifiShared: false,
    }));

    completeSetup({
      groupName: groupName.trim(),
      currency,
      rooms: [defaultRoom],
      roommates: createdRoommates,
      sharedGroceries: [],
      electricityRate: 50,
      waterRate: 10,
      gasRate: 50,
      gasType: 'pipeline',
      gasCylinderRate: 0,
      splitRules: {
        rent: 'equal',
        utilities: 'usage',
        groceries: 'equal',
      },
      consumerStatus: 'protected',
    });
  };

  return (
    <div className="min-h-screen bg-background px-5 py-8 flex flex-col">
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(['currency', 'roommates'] as SetupStep[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === s ? 'bg-primary text-white' : 
                (step === 'roommates' && i === 0) ? 'bg-primary/30 text-primary' : 'bg-muted text-foreground/40'
              }`}>
                {i + 1}
              </div>
              {i < 1 && <div className={`w-8 h-0.5 rounded transition-all ${step === 'roommates' ? 'bg-primary/30' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Home className="w-8 h-8 text-primary" />
          </div>
          {step === 'currency' && (
            <>
              <h1 className="font-heading text-2xl font-bold text-green-900">Name Your Flat</h1>
              <p className="text-foreground mt-2 text-sm">Pick a name and currency for your group</p>
            </>
          )}
          {step === 'roommates' && (
            <>
              <h1 className="font-heading text-2xl font-bold text-green-900">Add Roommates</h1>
              <p className="text-foreground mt-2 text-sm">Who lives here?</p>
            </>
          )}
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-xl mb-4 animate-fade-slide-in">
            {error}
          </div>
        )}

        {step === 'currency' && (
          <>
            <div className="mb-6">
              <label className="text-sm font-medium text-green-900 mb-1.5 block">Flat / Group Name</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder='e.g. "Sunrise Apartments"'
                className="w-full px-4 py-3 bg-white rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-green-900 placeholder:text-foreground/40 text-sm"
                maxLength={40}
              />
            </div>
            <div className="mb-6">
              <label className="text-sm font-medium text-green-900 mb-1.5 block">Currency</label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
                  <button
                    key={code}
                    onClick={() => setCurrency(code)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                      currency === code
                        ? 'bg-primary text-white shadow-card'
                        : 'bg-white border border-border text-foreground hover:border-primary'
                    }`}
                  >
                    <span className="block text-base">{CURRENCIES[code].symbol}</span>
                    <span className="text-[10px]">{code}</span>
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleNext}
              className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-primary-hover active:scale-[0.97] transition-all cursor-pointer shadow-card"
            >
              <span>Next — Roommates</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}

        {step === 'roommates' && (
          <>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-green-900">Roommates</label>
                <span className="text-xs text-foreground">{roommateNames.length}/6</span>
              </div>
              <div className="space-y-2.5">
                {roommateNames.map((name, i) => (
                  <div key={i} className="flex items-center gap-2 animate-fade-slide-in" style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                      style={{ backgroundColor: getRoommateColor(i) }}>
                      {name ? name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <input type="text" value={name} onChange={(e) => updateName(i, e.target.value)}
                      placeholder={`Roommate ${i + 1}`}
                      className="flex-1 px-4 py-2.5 bg-white rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-green-900 placeholder:text-foreground/40 text-sm"
                      maxLength={25} />
                    {roommateNames.length > 2 && (
                      <button onClick={() => removeField(i)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer shrink-0"
                        aria-label={`Remove roommate ${i + 1}`}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {roommateNames.length < 6 && (
                <button onClick={addRoommateField}
                  className="mt-2.5 flex items-center gap-2 text-sm text-accent hover:text-primary transition-all cursor-pointer px-1 py-1.5">
                  <UserPlus className="w-4 h-4" /> <span>Add roommate</span>
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={handlePrev}
                className="flex-1 bg-white border border-border text-foreground font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-muted active:scale-[0.97] transition-all cursor-pointer">
                <ArrowLeft className="w-4 h-4" /> <span>Back</span>
              </button>
              <button onClick={handleSubmit}
                className="flex-[2] bg-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primary-hover active:scale-[0.97] transition-all cursor-pointer shadow-card">
                <span>Create Flat</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        <p className="text-center text-xs text-foreground/50 mt-6">
          2–6 roommates &bull; Data stays on your device
        </p>
      </div>
    </div>
  );
}