import React, { useState } from 'react';
import { X } from 'lucide-react';
import { SandboxAction } from '../game/sandbox';

interface SandboxConsoleProps {
  onExecute: (cmd: string) => SandboxAction;
  onClose: () => void;
}

const QUICK_COMMANDS = [
  'teleport pokhara',
  'teleport himalaya',
  'teleport terai',
  'teleport village',
  'time sunset',
  'time night',
  'weather rain',
  'weather mist',
  'weather sunny',
  'refuel',
  'repair',
  'money 50000',
];

export const SandboxConsole: React.FC<SandboxConsoleProps> = ({ onExecute, onClose }) => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<Array<{ cmd: string; reply: string; ok: boolean }>>([
    {
      cmd: 'help',
      reply:
        'Sandbox ready. Try: spawn <bike> | weather <sunny|rain|mist> | time <sunrise|morning|sunset|night> | teleport <kathmandu|pokhara|terai|village|himalaya> | refuel | money <amt>',
      ok: true,
    },
  ]);

  const runCommand = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const res = onExecute(trimmed);
    setHistory((prev) => [
      ...prev.slice(-8),
      { cmd: trimmed, reply: res.message, ok: res.type !== 'error' },
    ]);
    setInput('');
  };

  return (
    <div className="absolute inset-0 z-30 bg-stone-950/80 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-2xl max-h-[92%] overflow-y-auto bg-stone-950 border border-stone-700 rounded-xl p-4 sm:p-5 shadow-2xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-amber-400">
            Sandbox Command Console
          </h2>
          <button
            type="button"
            aria-label="Close Sandbox Console"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Preset Chips */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_COMMANDS.map((cmd) => (
            <button
              key={cmd}
              type="button"
              onClick={() => runCommand(cmd)}
              className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 text-xs font-telemetry text-stone-200 cursor-pointer"
            >
              {cmd}
            </button>
          ))}
        </div>

        {/* Log Output */}
        <div className="bg-stone-900 border border-stone-800 rounded-lg p-3 h-40 overflow-y-auto flex flex-col gap-1.5 font-telemetry text-xs">
          {history.map((item, idx) => (
            <div key={idx}>
              <div className="text-stone-400">&gt; {item.cmd}</div>
              <div className={item.ok ? 'text-emerald-400' : 'text-red-400'}>{item.reply}</div>
            </div>
          ))}
        </div>

        {/* Command Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runCommand(input);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }
            }}
            placeholder="Type command (e.g. teleport pokhara, weather rain, money 25000)..."
            aria-label="Sandbox Command Input"
            autoFocus
            className="flex-1 px-3 py-2 rounded-lg bg-stone-900 border border-stone-700 text-stone-100 font-telemetry text-sm focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-sm cursor-pointer"
          >
            Execute
          </button>
        </form>
      </div>
    </div>
  );
};
