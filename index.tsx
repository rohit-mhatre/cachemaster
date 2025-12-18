
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, Database, Trash2, Zap, Terminal as TerminalIcon, Server, RefreshCw, Play, Pause, Settings, BarChart3, Cpu } from 'lucide-react';

// --- API CLIENT FOR BACKEND CACHE ---

const API_BASE = 'http://localhost:3000/api';

interface CacheItem {
  key: string;
  value: any;
  ttl?: number; // TTL in milliseconds from now
  created?: number;
  accessCount?: number;
  lastAccessed?: number;
}

interface CacheStats {
  totalKeys: number;
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsage: number;
  evictions: number;
  expirations: number;
  opsPerSecond: number;
}

class CacheAPI {
  private baseURL: string;

  constructor(baseURL: string = API_BASE) {
    this.baseURL = baseURL;
  }

  async get(key: string): Promise<any | null> {
    try {
      const response = await fetch(`${this.baseURL}/get/${encodeURIComponent(key)}`);
      const data = await response.json();
      return data.exists ? data.value : null;
    } catch (error) {
      console.error('GET error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const body: any = { key, value };
      if (ttl) body.ttl = ttl;

      const response = await fetch(`${this.baseURL}/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('SET error:', error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/delete/${encodeURIComponent(key)}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('DELETE error:', error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/exists/${encodeURIComponent(key)}`);
      const data = await response.json();
      return data.exists;
    } catch (error) {
      console.error('EXISTS error:', error);
      return false;
    }
  }

  async increment(key: string, amount: number = 1): Promise<number | null> {
    try {
      const response = await fetch(`${this.baseURL}/increment/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      const data = await response.json();
      return data.success ? data.value : null;
    } catch (error) {
      console.error('INCREMENT error:', error);
      return null;
    }
  }

  async clear(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/stats/reset`, {
        method: 'POST'
      });
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('CLEAR error:', error);
      return false;
    }
  }

  async getStats(): Promise<CacheStats | null> {
    try {
      const response = await fetch(`${this.baseURL}/stats`);
      return await response.json();
    } catch (error) {
      console.error('STATS error:', error);
      return null;
    }
  }

  async getKeys(limit: number = 100, offset: number = 0): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseURL}/keys?limit=${limit}&offset=${offset}`);
      const data = await response.json();
      return data.keys || [];
    } catch (error) {
      console.error('KEYS error:', error);
      return [];
    }
  }

  async getAllItems(): Promise<CacheItem[]> {
    try {
      const keys = await this.getKeys(1000); // Get up to 1000 keys
      const items: CacheItem[] = [];

      for (const key of keys.slice(0, 64)) { // Limit to 64 for UI
        const value = await this.get(key);
        if (value !== null) {
          items.push({
            key,
            value,
            // Mock additional properties for UI
            created: Date.now() - Math.random() * 60000,
            accessCount: Math.floor(Math.random() * 10) + 1,
            lastAccessed: Date.now() - Math.random() * 30000,
            ttl: 0
          });
        }
      }

      return items;
    } catch (error) {
      console.error('GET ALL ITEMS error:', error);
      return [];
    }
  }
}

// --- COMPONENTS ---

const Sparkline = ({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) => {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((val - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full overflow-hidden" style={{ height: `${height}px` }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path
          d={`M0,100 L${points} L100,100 Z`}
          fill={color}
          opacity="0.2"
        />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
};

const Terminal = ({ 
  logs, 
  onCommand 
}: { 
  logs: string[]; 
  onCommand: (cmd: string) => void 
}) => {
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onCommand(input);
      setInput('');
    }
  };

  return (
    <div className="glass-panel rounded-lg flex flex-col h-full overflow-hidden font-mono text-xs border border-gray-800">
      <div className="bg-gray-900/50 px-4 py-2 border-b border-gray-800 flex items-center gap-2">
        <TerminalIcon size={14} className="text-gray-400" />
        <span className="text-gray-400 font-bold">TERMINAL</span>
      </div>
      <div className="flex-1 p-4 overflow-y-auto space-y-1 bg-black/40">
        {logs.map((log, i) => (
          <div key={i} className={`${log.startsWith('>') ? 'text-yellow-500' : 'text-gray-300'} break-all`}>
            {log}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="p-2 bg-gray-900/80 border-t border-gray-800 flex items-center gap-2">
        <span className="text-green-500 animate-pulse">➜</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-transparent border-none outline-none text-gray-200 w-full placeholder-gray-600"
          placeholder="Try: SET user john or GET user"
          spellCheck={false}
        />
      </div>
    </div>
  );
};

const MemoryBlock = ({ item, isNew }: { item: CacheItem; isNew: boolean }) => {
  const now = Date.now();
  const isExpired = item.ttl > 0 && now > item.ttl;
  
  // Heat calculation: More recent access = brighter
  const age = now - item.lastAccessed;
  const heat = Math.max(0, 1 - age / 5000); // Cools down over 5 seconds
  
  let bg = 'bg-gray-800';
  let border = 'border-gray-700';

  if (isExpired) {
    bg = 'bg-red-900/30';
    border = 'border-red-900';
  } else if (heat > 0.5) {
    bg = 'bg-emerald-500/20';
    border = 'border-emerald-500';
  } else if (heat > 0) {
    bg = 'bg-cyan-900/30';
    border = 'border-cyan-700';
  }

  return (
    <div className={`relative group w-full aspect-square rounded-sm border ${border} ${bg} transition-all duration-300 hover:scale-105 cursor-pointer overflow-hidden`}>
      <div className="absolute inset-0 flex flex-col items-center justify-center p-1">
        <span className="text-[10px] font-mono text-gray-400 truncate w-full text-center">{item.key}</span>
        <span className="text-[9px] font-mono text-gray-500">{item.value.toString().slice(0,6)}</span>
      </div>
      {/* Tooltip */}
      <div className="absolute opacity-0 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 bg-black border border-gray-700 p-2 text-[10px] text-gray-300 rounded z-50 pointer-events-none">
        <div>Key: {item.key}</div>
        <div>Val: {JSON.stringify(item.value)}</div>
        <div>Acc: {item.accessCount}</div>
        <div>TTL: {item.ttl ? Math.ceil((item.ttl - now)/1000) + 's' : '∞'}</div>
      </div>
    </div>
  );
};

const App = () => {
  const [engine] = useState(() => new CacheAPI());
  const [items, setItems] = useState<CacheItem[]>([]);
  const [stats, setStats] = useState<CacheStats>({ totalKeys: 0, hits: 0, misses: 0, hitRate: 0, memoryUsage: 0, evictions: 0, expirations: 0, opsPerSecond: 0 });
  const [logs, setLogs] = useState<string[]>(['> Connected to Cache API. Ready.']);
  const [opsHistory, setOpsHistory] = useState<number[]>(new Array(20).fill(0));
  const [autoRun, setAutoRun] = useState(false);
  const [policy, setPolicy] = useState<EvictionPolicy>('LRU');
  const [capacity, setCapacity] = useState(1000); // Use backend capacity

  // Ref for intervals
  const stressTestRef = useRef<number | null>(null);

  const updateUI = useCallback(async () => {
    try {
      const [itemsData, statsData] = await Promise.all([
        engine.getAllItems(),
        engine.getStats()
      ]);
      setItems(itemsData || []);
      if (statsData) setStats(statsData);
    } catch (error) {
      console.error('UI update error:', error);
    }
  }, [engine]);

  const log = (msg: string) => {
    setLogs(prev => [...prev.slice(-50), msg]);
  };

  const executeCommand = async (cmdStr: string) => {
    const parts = cmdStr.trim().split(' ');
    const cmd = parts[0].toUpperCase();
    const args = parts.slice(1);

    log(`> ${cmdStr}`);

    try {
      switch (cmd) {
        case 'SET':
          if (args.length < 2) throw new Error('Usage: SET key value [ttl]');
          const setSuccess = await engine.set(args[0], args[1], args[2] ? parseInt(args[2]) : 0);
          log(setSuccess ? `OK: Set ${args[0]} = ${args[1]}` : 'ERROR: Set failed');
          break;
        case 'GET':
          if (args.length < 1) throw new Error('Usage: GET key');
          const val = await engine.get(args[0]);
          log(val !== null ? `VALUE: ${val}` : 'NULL (Miss)');
          break;
        case 'DEL':
          const delSuccess = await engine.delete(args[0]);
          log(delSuccess ? `Deleted ${args[0]}` : 'Key not found');
          break;
        case 'EXISTS':
          if (args.length < 1) throw new Error('Usage: EXISTS key');
          const exists = await engine.exists(args[0]);
          log(exists ? 'TRUE' : 'FALSE');
          break;
        case 'INCR':
          if (args.length < 1) throw new Error('Usage: INCR key [amount]');
          const newValue = await engine.increment(args[0], args[1] ? parseInt(args[1]) : 1);
          log(newValue !== null ? `VALUE: ${newValue}` : 'ERROR: Increment failed');
          break;
        case 'CLEAR':
          const clearSuccess = await engine.clear();
          log(clearSuccess ? 'Cache Cleared' : 'Clear failed');
          break;
        case 'STATS':
          const statsData = await engine.getStats();
          log(statsData ? JSON.stringify(statsData, null, 2) : 'Stats unavailable');
          break;
        case 'KEYS':
          const keys = await engine.getKeys(20);
          log(`Keys: ${keys.join(', ')}`);
          break;
        default:
          log(`Unknown command: ${cmd}`);
          log('Available: SET, GET, DEL, EXISTS, INCR, CLEAR, STATS, KEYS');
      }
      updateUI();
    } catch (e: any) {
      log(`ERROR: ${e.message}`);
    }
  };

  // Telemetry Loop
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const statsData = await engine.getStats();
        if (statsData) {
          const currentOps = statsData.hits + statsData.misses;
          setOpsHistory(prev => {
            const newHistory = [...prev.slice(1), currentOps - (prev['lastTotal'] || 0)];
            (newHistory as any)['lastTotal'] = currentOps;
            return newHistory;
          });
          setStats(statsData);
        }
        // Update items periodically
        const itemsData = await engine.getAllItems();
        setItems(itemsData || []);
      } catch (error) {
        console.error('Telemetry error:', error);
      }
    }, 2000); // Update less frequently for API calls

    return () => clearInterval(interval);
  }, [engine]);

  // Auto Stress Test
  useEffect(() => {
    if (autoRun) {
      stressTestRef.current = window.setInterval(async () => {
        try {
          // Simulate burst traffic (lighter for API calls)
          const operations = [];
          for (let i = 0; i < 3; i++) {
            const r = Math.random();
            const key = `stress_${Math.floor(Math.random() * 1000)}`;

            if (r < 0.6) { // 60% Writes
              operations.push(engine.set(key, Math.floor(Math.random() * 1000), Math.random() > 0.8 ? 5 : 0));
            } else if (r < 0.9) { // 30% Reads
              operations.push(engine.get(key));
            } else { // 10% Deletes
              operations.push(engine.delete(key));
            }
          }

          await Promise.all(operations);
          updateUI();
        } catch (error) {
          console.error('Stress test error:', error);
        }
      }, 500); // Slower for API calls
    } else {
      if (stressTestRef.current) clearInterval(stressTestRef.current);
    }
    return () => { if (stressTestRef.current) clearInterval(stressTestRef.current); };
  }, [autoRun, engine, updateUI]);

  const handlePolicyChange = (p: EvictionPolicy) => {
    setPolicy(p);
    log(`Note: Eviction policy is controlled by backend API`);
    log(`Current policy display updated to: ${p}`);
  };

  const handleCapacityChange = (c: number) => {
    setCapacity(c);
    log(`Note: Cache capacity is controlled by backend API`);
    log(`Current capacity display updated to: ${c}`);
  };

  const hitRate = stats.hitRate ? stats.hitRate.toFixed(1) : '0.0';
  const memoryUsagePercent = stats.memoryUsage ? Math.min((stats.memoryUsage / (512 * 1024 * 1024)) * 100, 100) : 0;

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 p-4 md:p-6 font-sans selection:bg-[#00ff9d] selection:text-black flex flex-col gap-6">
      
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white flex items-center gap-2">
            <Server className="text-[#00ff9d]" />
            CACHEMASTER <span className="text-[#00ff9d]">API</span>
          </h1>
          <p className="text-xs text-gray-500 font-mono mt-1">HIGH-PERFORMANCE CACHE API // VISUAL INTERFACE</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="bg-gray-900 px-3 py-1 rounded border border-gray-800 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${autoRun ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-xs font-mono text-gray-400">{autoRun ? 'LIVE TRAFFIC' : 'STANDBY'}</span>
           </div>
           <button 
             onClick={() => window.location.reload()}
             className="p-2 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-white"
           >
             <RefreshCw size={18} />
           </button>
        </div>
      </header>

      {/* MAIN DASHBOARD GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* LEFT: CONTROLS & TERMINAL */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          
          {/* Control Panel */}
          <div className="glass-panel p-5 rounded-xl space-y-6">
             <div className="flex items-center gap-2 text-[#00b8ff] mb-2">
               <Settings size={16} />
               <h3 className="text-sm font-bold tracking-wider">CONFIGURATION</h3>
             </div>

             <div className="space-y-3">
               <label className="text-xs font-mono text-gray-500">EVICTION POLICY</label>
               <div className="grid grid-cols-3 gap-1 bg-gray-900 p-1 rounded">
                 {(['LRU', 'LFU', 'FIFO'] as EvictionPolicy[]).map((p) => (
                   <button
                     key={p}
                     onClick={() => handlePolicyChange(p)}
                     className={`text-xs py-1.5 rounded font-bold transition-all ${
                       policy === p 
                         ? 'bg-[#00b8ff] text-black shadow-[0_0_10px_rgba(0,184,255,0.5)]' 
                         : 'text-gray-500 hover:text-gray-300'
                     }`}
                   >
                     {p}
                   </button>
                 ))}
               </div>
             </div>

             <div className="space-y-3">
               <div className="flex justify-between">
                 <label className="text-xs font-mono text-gray-500">MAX CAPACITY</label>
                 <span className="text-xs font-mono text-[#00ff9d]">{capacity} ITEMS</span>
               </div>
               <input
                 type="range"
                 min="16"
                 max="256"
                 step="16"
                 value={capacity}
                 onChange={(e) => handleCapacityChange(parseInt(e.target.value))}
                 className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#00ff9d]"
               />
             </div>

             <div className="pt-4 border-t border-gray-800 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setAutoRun(!autoRun)}
                  className={`flex items-center justify-center gap-2 py-2 rounded text-xs font-bold border transition-all ${
                    autoRun 
                      ? 'border-red-500 text-red-500 bg-red-500/10 hover:bg-red-500/20' 
                      : 'border-[#00ff9d] text-[#00ff9d] bg-[#00ff9d]/10 hover:bg-[#00ff9d]/20'
                  }`}
                >
                  {autoRun ? <Pause size={14}/> : <Play size={14}/>}
                  {autoRun ? 'STOP LOAD' : 'START LOAD'}
                </button>
                <button
                  onClick={async () => {
                    try {
                      const success = await engine.clear();
                      log(success ? 'Cache statistics reset' : 'Reset failed');
                      updateUI();
                    } catch (error) {
                      log('Reset error');
                    }
                  }}
                  className="flex items-center justify-center gap-2 py-2 rounded text-xs font-bold border border-gray-700 text-gray-400 hover:border-white hover:text-white transition-all"
                >
                  <Trash2 size={14}/>
                  RESET STATS
                </button>
             </div>
          </div>

          {/* Terminal */}
          <div className="flex-1 min-h-[300px]">
            <Terminal logs={logs} onCommand={executeCommand} />
          </div>

        </div>

        {/* CENTER: MEMORY VISUALIZATION */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <div className="glass-panel p-1 rounded-xl h-full flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00ff9d] via-[#00b8ff] to-[#ff0055] opacity-50" />
            
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/80">
               <div className="flex items-center gap-2">
                 <Cpu size={16} className="text-[#ff0055]" />
                 <h3 className="text-sm font-bold tracking-wider text-gray-200">MEMORY MAP</h3>
               </div>
               <div className="flex gap-4 text-[10px] font-mono text-gray-500">
                 <span className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500/50 border border-emerald-500 rounded-sm"></div>HOT</span>
                 <span className="flex items-center gap-1"><div className="w-2 h-2 bg-cyan-900/50 border border-cyan-700 rounded-sm"></div>COLD</span>
                 <span className="flex items-center gap-1"><div className="w-2 h-2 bg-gray-800 border border-gray-700 rounded-sm"></div>EMPTY</span>
               </div>
            </div>

            <div className="flex-1 p-4 bg-black/60 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 content-start">
                {/* Render Items */}
                {items.map((item) => (
                  <MemoryBlock key={item.key} item={item} isNew={false} />
                ))}
                {/* Render Empty Slots */}
                {Array.from({ length: Math.max(0, capacity - items.length) }).map((_, i) => (
                   <div key={`empty-${i}`} className="aspect-square border border-dashed border-gray-800 rounded-sm bg-gray-900/20" />
                ))}
              </div>
            </div>
            
            {/* Memory Footer Stats */}
            <div className="p-3 bg-gray-900/80 border-t border-gray-800 flex justify-between text-xs font-mono text-gray-400">
               <span>USED: {items.length}</span>
               <span>FREE: {capacity - items.length}</span>
               <span>FRAG: 0%</span>
            </div>
          </div>
        </div>

        {/* RIGHT: METRICS */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          
          {/* OPS/SEC CARD */}
          <div className="glass-panel p-5 rounded-xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-xs font-bold text-gray-500 tracking-wider">THROUGHPUT</h4>
                <div className="text-3xl font-black text-white mt-1 font-mono">
                  {opsHistory[opsHistory.length - 1] || 0} <span className="text-sm text-gray-600 font-sans font-normal">ops/s</span>
                </div>
              </div>
              <Activity className="text-[#00ff9d]" size={20} />
            </div>
            <Sparkline data={opsHistory} color="#00ff9d" />
          </div>

          {/* HIT RATE CARD */}
          <div className="glass-panel p-5 rounded-xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-xs font-bold text-gray-500 tracking-wider">HIT RATE</h4>
                <div className="text-3xl font-black text-white mt-1 font-mono">
                  {hitRate}%
                </div>
              </div>
              <Zap className="text-[#ff0055]" size={20} />
            </div>
            <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden mb-2">
              <div className="bg-[#ff0055] h-full transition-all duration-500" style={{ width: `${parseFloat(hitRate)}%` }} />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-gray-500">
              <span>HITS: {stats.hits}</span>
              <span>MISS: {stats.misses}</span>
            </div>
          </div>

          {/* MEMORY USAGE CARD */}
          <div className="glass-panel p-5 rounded-xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-xs font-bold text-gray-500 tracking-wider">MEMORY LOAD</h4>
                <div className="text-3xl font-black text-white mt-1 font-mono">
                  {Math.round(memoryUsagePercent)}%
                </div>
              </div>
              <Database className="text-[#00b8ff]" size={20} />
            </div>
            <div className="w-full bg-gray-800 h-32 relative rounded border border-gray-800 overflow-hidden flex items-end gap-1 p-1">
               {/* Simple bar viz of items */}
               {items.slice(0, 20).map((_, i) => (
                 <div key={i} className="flex-1 bg-[#00b8ff] opacity-50" style={{ height: `${Math.random() * 80 + 20}%` }}></div>
               ))}
            </div>
            <div className="mt-2 text-[10px] font-mono text-gray-500 text-right">
              EVICTIONS: {stats.evictions}
            </div>
          </div>

          {/* Key Stats */}
          <div className="glass-panel p-4 rounded-xl space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">OPS/SEC</span>
              <span className="font-mono text-[#ffee00]">{stats.opsPerSecond || 0}</span>
            </div>
             <div className="flex justify-between text-xs">
              <span className="text-gray-500">KEYS</span>
              <span className="font-mono text-white">{stats.totalKeys}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">MEMORY</span>
              <span className="font-mono text-[#00ff9d]">{Math.round(stats.memoryUsage / 1024 / 1024) || 0}MB</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
