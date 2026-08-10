import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Trash2, Save, UserPlus, RotateCcw, AlertTriangle, Plus, X, Wifi, Zap, Flame, ShieldCheck } from 'lucide-react';
import { generateId } from '../utils/format';
import type { Room, SharedGroceryItem, ACType, GasType, ConsumerStatus } from '../types';
import { CURRENCIES } from '../types';

export default function SettingsScreen() {
  const { state, updateSettings, addRoommate, removeRoommate, updateRoommate, updateRoom, removeRoom, addSharedGrocery, removeSharedGrocery, resetAll } = useApp();
  const [editingName, setEditingName] = useState('');
  const [editingRoom, setEditingRoom] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [saved, setSaved] = useState(false);
  const [electricityRate, setElectricityRate] = useState(String(state.settings.electricityRate));
  const [waterRate, setWaterRate] = useState(String(state.settings.waterRate));
  const [gasRate, setGasRate] = useState(String(state.settings.gasRate));
  const [gasType, setGasType] = useState<GasType>(state.settings.gasType);
  const [gasCylinderRate, setGasCylinderRate] = useState(String(state.settings.gasCylinderRate));
  const [consumerStatus, setConsumerStatus] = useState<ConsumerStatus>(state.settings.consumerStatus ?? 'protected');
  const [groupName, setGroupName] = useState(state.settings.groupName);
  const [newGroceryName, setNewGroceryName] = useState('');

  const handleSaveRates = () => {
    updateSettings({
      electricityRate: parseFloat(electricityRate) || 50,
      waterRate: parseFloat(waterRate) || 10,
      gasRate: parseFloat(gasRate) || 50,
      gasType,
      gasCylinderRate: parseFloat(gasCylinderRate) || 0,
      consumerStatus,
      groupName: groupName.trim() || state.settings.groupName,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAddRoommate = () => {
    const name = editingName.trim();
    if (!name || !editingRoom) return;
    addRoommate(name, editingRoom);
    setEditingName('');
  };

  const handleRemoveRoommate = (id: string) => {
    if (state.settings.roommates.length <= 2) return;
    removeRoommate(id);
  };

  const handleToggleSharing = (roommateId: string, value: boolean) => {
    const rm = state.settings.roommates.find((r) => r.id === roommateId);
    if (rm) {
      updateRoommate({ ...rm, sharedGroceriesOptIn: value });
    }
  };

  const handleToggleWiFi = (roommateId: string, value: boolean) => {
    const rm = state.settings.roommates.find((r) => r.id === roommateId);
    if (rm) {
      updateRoommate({ ...rm, wifiShared: value });
    }
  };

  const handleRoomChange = (room: Room) => {
    updateRoom(room);
  };

  const handleAddGroceryItem = () => {
    const name = newGroceryName.trim();
    if (!name) return;
    const item: SharedGroceryItem = {
      id: generateId(),
      name,
      category: 'groceries',
    };
    addSharedGrocery(item);
    setNewGroceryName('');
  };

  const handleReset = () => {
    resetAll();
    setShowReset(false);
  };

  /* ── Helpers ── */
  const currency = CURRENCIES[state.settings.currency];
  const sharingCount = state.settings.roommates.filter((r) => r.sharedGroceriesOptIn).length;

  return (
    <div className="px-4 pt-4 pb-32 max-w-lg mx-auto">
      <h2 className="font-heading text-xl font-bold text-green-900 mb-5">Settings</h2>

      <div className="space-y-5">
        {/* ═══ FLAT INFO ═══ */}
        <section className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs font-medium text-foreground/60 uppercase tracking-wider mb-3">Flat Info</p>
          <label className="text-xs text-foreground/60 block mb-1">Name</label>
          <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)}
            className="w-full px-4 py-2.5 bg-muted rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-green-900 text-sm" maxLength={40} />
          <div className="mt-3">
            <label className="text-xs text-foreground/60 block mb-1">Currency</label>
            <p className="text-sm text-green-900 font-medium">{currency.symbol} {state.settings.currency}</p>
          </div>
        </section>

        {/* ═══ ROOMS ═══ */}
        <section className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs font-medium text-foreground/60 uppercase tracking-wider mb-3">Rooms</p>
          <p className="text-xs text-foreground/50 mb-4">Room names and rent weightage. Configure AC specs below in Utilities.</p>
          <div className="space-y-3">
            {state.settings.rooms.map((room) => (
              <div key={room.id} className="bg-muted rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <input type="text" value={room.name}
                    onChange={(e) => handleRoomChange({ ...room, name: e.target.value })}
                    className="font-medium text-green-900 text-sm bg-transparent border-b border-transparent focus:border-primary outline-none flex-1" />
                  <button onClick={() => removeRoom(room.id)}
                    className="text-foreground/40 hover:text-destructive transition-all cursor-pointer" aria-label="Remove room">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  <div>
                    <label className="text-[10px] text-foreground/50 uppercase tracking-wider block mb-1">Rent Weight</label>
                    <input type="number" value={room.rentWeightage}
                      onChange={(e) => handleRoomChange({ ...room, rentWeightage: parseFloat(e.target.value) || 1 })}
                      className="w-full px-2 py-1.5 bg-white rounded-lg text-xs text-green-900 border border-border outline-none focus:border-primary tabular-nums" step="0.5" min="0" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ UTILITIES & APPLIANCES ═══ */}
        <section className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs font-medium text-foreground/60 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-primary" />
            Utilities &amp; Appliances
          </p>
          <p className="text-xs text-foreground/50 mb-4">Configure AC, electricity rates, and gas options</p>

          {/* ── Electricity Rate ── */}
          <div className="mb-4">
            <RateInput label="Electricity Rate (per kWh)" value={electricityRate} onChange={setElectricityRate} unit={`${currency.symbol}/kWh`} />
          </div>

          {/* ── IESCO Consumer Status ── */}
          <div className="mb-4 border-t border-border pt-4">
            <p className="text-xs font-medium text-foreground/70 mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              IESCO Consumer Status
            </p>
            <p className="text-[10px] text-foreground/50 mb-2">Determines which tariff slab rates apply when calculating the monthly electricity bill from meter units.</p>
            <div className="flex gap-2">
              <button onClick={() => setConsumerStatus('protected')}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  consumerStatus === 'protected'
                    ? 'bg-primary text-white shadow-card'
                    : 'bg-white border border-border text-foreground hover:border-primary'
                }`}>
                Protected
              </button>
              <button onClick={() => setConsumerStatus('unprotected')}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  consumerStatus === 'unprotected'
                    ? 'bg-primary text-white shadow-card'
                    : 'bg-white border border-border text-foreground hover:border-primary'
                }`}>
                Un-Protected
              </button>
            </div>
          </div>

          {/* ── Per-Room AC Configuration ── */}
          <p className="text-xs font-medium text-foreground/70 mb-2">AC Configuration per Room</p>
          <div className="space-y-3 mb-4">
            {state.settings.rooms.length === 0 ? (
              <p className="text-xs text-foreground/40 text-center py-3">No rooms yet</p>
            ) : (
              state.settings.rooms.map((room) => (
                <div key={room.id} className="bg-muted rounded-xl p-3 space-y-2.5">
                  <p className="text-xs font-medium text-green-900">{room.name}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-foreground/50 uppercase tracking-wider block mb-0.5">AC Type</label>
                      <select value={room.acType}
                        onChange={(e) => handleRoomChange({ ...room, acType: e.target.value as ACType })}
                        className="w-full px-1.5 py-1.5 bg-white rounded-lg text-xs text-green-900 border border-border outline-none focus:border-primary">
                        <option value="inverter">Inverter</option>
                        <option value="non_inverter">Non-Inverter</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-foreground/50 uppercase tracking-wider block mb-0.5">Tonnage</label>
                      <select value={room.tonnage}
                        onChange={(e) => handleRoomChange({ ...room, tonnage: parseFloat(e.target.value) || 1.5 })}
                        className="w-full px-1.5 py-1.5 bg-white rounded-lg text-xs text-green-900 border border-border outline-none focus:border-primary">
                        <option value={1}>1 Ton</option>
                        <option value={1.5}>1.5 Ton</option>
                        <option value={2}>2 Ton</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-foreground/50 uppercase tracking-wider block mb-0.5">AC Count</label>
                      <input type="number" value={room.acCount}
                        onChange={(e) => handleRoomChange({ ...room, acCount: parseInt(e.target.value) || 0 })}
                        className="w-full px-1.5 py-1.5 bg-white rounded-lg text-xs text-green-900 border border-border outline-none focus:border-primary tabular-nums" min="0" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-foreground/50 uppercase tracking-wider block mb-0.5">Connection Phase (fixed charge)</label>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleRoomChange({ ...room, connectionPhase: 'single' })}
                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                          (room.connectionPhase ?? 'single') === 'single'
                            ? 'bg-primary text-white'
                            : 'bg-white border border-border text-foreground hover:border-primary'
                        }`}>
                        Single-phase · Rs75/mo
                      </button>
                      <button onClick={() => handleRoomChange({ ...room, connectionPhase: 'three-phase' })}
                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                          room.connectionPhase === 'three-phase'
                            ? 'bg-primary text-white'
                            : 'bg-white border border-border text-foreground hover:border-primary'
                        }`}>
                        Three-phase · Rs150/mo
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Water Rate ── */}
          <div className="mb-4">
            <RateInput label="Water Rate (per unit)" value={waterRate} onChange={setWaterRate} unit={`${currency.symbol}/unit`} />
          </div>

          {/* ── Gas Utility Options ── */}
          <div className="border-t border-border pt-4 mt-4">
            <p className="text-xs font-medium text-foreground/70 mb-2 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              Gas Utility
            </p>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setGasType('pipeline')}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  gasType === 'pipeline'
                    ? 'bg-primary text-white shadow-card'
                    : 'bg-white border border-border text-foreground hover:border-primary'
                }`}>
                Pipeline Gas (Sui Gas)
              </button>
              <button onClick={() => setGasType('cylinder')}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  gasType === 'cylinder'
                    ? 'bg-primary text-white shadow-card'
                    : 'bg-white border border-border text-foreground hover:border-primary'
                }`}>
                Gas Cylinder
              </button>
            </div>

            {gasType === 'pipeline' ? (
              <div>
                <RateInput label="Pipeline Gas Rate" value={gasRate} onChange={setGasRate} unit={`${currency.symbol}/unit`} />
                <p className="text-[10px] text-foreground/50 mt-1">Standard shared bill split — each roommate pays an equal share of the total gas bill.</p>
              </div>
            ) : (
              <div>
                <RateInput label="Cylinder Refill Cost" value={gasCylinderRate} onChange={setGasCylinderRate} unit={`${currency.symbol}/refill`} />
                <p className="text-[10px] text-foreground/50 mt-1">Each refill cost is split equally among all roommates. Enter the price per cylinder refill.</p>
              </div>
            )}
          </div>

          <button onClick={handleSaveRates}
            className="w-full mt-4 bg-primary text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-primary-hover active:scale-[0.97] transition-all cursor-pointer text-sm">
            <Save className="w-4 h-4" /> <span>{saved ? 'Saved!' : 'Save Utilities'}</span>
          </button>
        </section>

        {/* ═══ SHARED GROCERIES ═══ */}
        <section className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs font-medium text-foreground/60 uppercase tracking-wider mb-1">Shared Groceries</p>
          <p className="text-xs text-foreground/50 mb-4">
            Items you buy together. Only roommates marked as "Sharing" split these costs. ({sharingCount}/{state.settings.roommates.length} sharing)
          </p>

          <div className="space-y-2 mb-4">
            {state.settings.sharedGroceries.length === 0 ? (
              <p className="text-xs text-foreground/40 text-center py-6">No shared groceries added yet.</p>
            ) : (
              state.settings.sharedGroceries.map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-muted rounded-xl px-3 py-2">
                  <span className="text-sm text-green-900">{item.name}</span>
                  <button onClick={() => removeSharedGrocery(item.id)}
                    className="text-foreground/40 hover:text-destructive transition-all cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-2">
            <input type="text" value={newGroceryName} onChange={(e) => setNewGroceryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddGroceryItem()}
              placeholder="e.g. Milk, Bread, Eggs"
              className="flex-1 px-3 py-2 bg-muted rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-green-900 placeholder:text-foreground/40 text-sm"
              maxLength={40} />
            <button onClick={handleAddGroceryItem}
              className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary-hover active:scale-[0.97] transition-all cursor-pointer shrink-0"
              aria-label="Add item">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* ═══ ROOMMATE SHARING MATRIX ═══ */}
        <section className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs font-medium text-foreground/60 uppercase tracking-wider mb-1">Sharing Preferences</p>
          <p className="text-xs text-foreground/50 mb-4">Who splits shared groceries? Toggle each roommate's status below.</p>

          {state.settings.roommates.length === 0 ? (
            <p className="text-xs text-foreground/40">No roommates yet</p>
          ) : (
            <div className="space-y-2">
              {state.settings.roommates.map((rm) => {
                const room = state.settings.rooms.find((r) => r.id === rm.roomId);
                return (
                  <div key={rm.id} className="flex flex-col bg-muted rounded-xl px-3 py-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ backgroundColor: rm.color || '#1B7A4D' }}>
                          {rm.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-green-900">{rm.name}</span>
                          {room && <span className="text-[10px] text-foreground/50 ml-1">{room.name}</span>}
                        </div>
                      </div>
                      {state.settings.roommates.length > 2 && (
                        <button onClick={() => handleRemoveRoommate(rm.id)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
                          aria-label={`Remove ${rm.name}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pl-8">
                      {/* Groceries Sharing Toggle */}
                      <button onClick={() => handleToggleSharing(rm.id, !rm.sharedGroceriesOptIn)}
                        className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium transition-all cursor-pointer ${
                          rm.sharedGroceriesOptIn
                            ? 'bg-accent/15 text-accent'
                            : 'bg-white text-foreground/50 border border-border'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${rm.sharedGroceriesOptIn ? 'bg-accent' : 'bg-foreground/30'}`} />
                        {rm.sharedGroceriesOptIn ? 'Sharing' : 'Not Sharing'}
                      </button>

                      {/* WiFi Sharing Toggle */}
                      <button onClick={() => handleToggleWiFi(rm.id, !rm.wifiShared)}
                        className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium transition-all cursor-pointer ${
                          rm.wifiShared
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-white text-foreground/50 border border-border'
                        }`}
                      >
                        <Wifi className={`w-3 h-3 ${rm.wifiShared ? 'text-blue-700' : 'text-foreground/30'}`} />
                        <span>{rm.wifiShared ? 'WiFi: Sharing' : 'WiFi: Not Sharing'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add roommate inline */}
          {state.settings.roommates.length < 6 && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
              <input type="text" value={editingName} onChange={(e) => setEditingName(e.target.value)}
                placeholder="New roommate name"
                className="flex-1 px-3 py-2 bg-muted rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-green-900 placeholder:text-foreground/40 text-sm"
                maxLength={25} />
              <select value={editingRoom} onChange={(e) => setEditingRoom(e.target.value)}
                className="px-2 py-2 bg-muted rounded-xl border border-border text-xs text-green-900 outline-none focus:border-primary">
                <option value="">Room</option>
                {state.settings.rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <button onClick={handleAddRoommate}
                className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary-hover active:scale-[0.97] transition-all cursor-pointer shrink-0"
                aria-label="Add roommate">
                <UserPlus className="w-4 h-4" />
              </button>
            </div>
          )}
        </section>

        {/* ═══ DANGER ZONE ═══ */}
        <section className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs font-medium text-foreground/60 uppercase tracking-wider mb-2">Danger Zone</p>
          <p className="text-xs text-foreground/50 mb-3">This will delete all data. Cannot be undone.</p>
          {!showReset ? (
            <button onClick={() => setShowReset(true)}
              className="w-full bg-destructive/10 text-destructive font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-destructive/20 active:scale-[0.97] transition-all cursor-pointer text-sm">
              <RotateCcw className="w-4 h-4" /> <span>Reset All Data</span>
            </button>
          ) : (
            <div className="space-y-2 animate-fade-slide-in">
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-xl px-4 py-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0" /> <span>Are you sure?</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowReset(false)} className="flex-1 bg-muted text-foreground font-medium py-2 rounded-xl hover:bg-border transition-all cursor-pointer text-sm">Cancel</button>
                <button onClick={handleReset} className="flex-1 bg-destructive text-white font-medium py-2 rounded-xl hover:opacity-90 transition-all cursor-pointer text-sm">Delete Everything</button>
              </div>
            </div>
          )}
        </section>

        <div className="text-center py-4">
          <p className="text-xs text-foreground/40">Fair Share v3.0</p>
          <p className="text-xs text-foreground/30 mt-0.5">Synced with cloud</p>
        </div>
      </div>
    </div>
  );
}

function RateInput({ label, value, onChange, unit }: { label: string; value: string; onChange: (v: string) => void; unit: string }) {
  return (
    <div>
      <label className="text-sm text-foreground block mb-1">{label}</label>
      <div className="relative">
        <input type="number" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2 bg-muted rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-green-900 text-sm tabular-nums" step="0.5" min="0" />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/50 text-xs">{unit}</span>
      </div>
    </div>
  );
}