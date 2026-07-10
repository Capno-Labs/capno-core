'use client';

import type { SimSnapshot } from '@/lib/engine/types';
import { map, RHYTHM_LABELS } from '@/lib/engine/types';
import { AlarmBanner } from './AlarmBanner';
import { MonitorAudio, useMonitorSoundPref } from './MonitorAudio';
import { VitalTile } from './VitalTile';
import { Waveform } from './Waveform';

interface MonitorDisplayProps {
  snapshot: SimSnapshot;
  /** Compact mode for the embedded preview inside the faculty controller. */
  compact?: boolean;
}

function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * The patient monitor. Renders purely from a SimSnapshot so it is identical
 * whether driven locally (faculty preview) or over the sync channel (student
 * display / projector).
 */
export function MonitorDisplay({ snapshot, compact = false }: MonitorDisplayProps) {
  const v = snapshot.vitals;
  const frozen = snapshot.status !== 'running';
  const [soundOn, setSoundOn] = useMonitorSoundPref();
  const alarmFor = (vital: string) =>
    snapshot.alarms.find((a) => a.vital === vital)?.level;

  // NIBP cuff mode: show the last measured reading and how stale it is.
  // nibp === null means an arterial line is in place (continuous BP + trace).
  const cuff = snapshot.nibp;
  const art = !cuff;
  const cuffAgeSec = cuff ? Math.max(0, snapshot.elapsedSec - cuff.atSec) : 0;
  const bpValue = cuff ? `${cuff.sbp}/${cuff.dbp}` : `${Math.round(v.sbp)}/${Math.round(v.dbp)}`;
  const bpMap = cuff ? map(cuff) : map(v);
  const bpSub = cuff
    ? `MAP ${bpMap} · ${formatClock(cuffAgeSec)} ago`
    : `MAP ${bpMap}`;

  // Slightly shorter traces when the ART row makes it four waveforms.
  const waveH = compact ? (art ? 'h-11' : 'h-14') : art ? 'h-16 md:h-24' : 'h-20 md:h-28';
  // Waveform + paired numeric per row; the tile column stays narrow so the
  // trace keeps most of the width.
  const traceRowCols = compact
    ? 'grid-cols-[1fr_minmax(104px,132px)]'
    : 'grid-cols-[1fr_minmax(128px,168px)] md:grid-cols-[1fr_minmax(168px,224px)]';

  return (
    <div className="flex h-full flex-col gap-2 bg-monitor-bg p-2 md:p-3">
      <MonitorAudio snapshot={snapshot} enabled={soundOn} />
      {/* Header: alarms + sound + status + clock */}
      <div className="flex items-center justify-between gap-3">
        <AlarmBanner alarms={snapshot.alarms} silenced={snapshot.alarmsSilenced} />
        <div className="flex items-center gap-3 whitespace-nowrap font-mono text-slate-300">
          <button
            onClick={() => setSoundOn(!soundOn)}
            className="rounded px-1.5 py-0.5 text-base ring-1 ring-slate-700 hover:bg-slate-800"
            title={soundOn ? 'Sound on (pulse tone + alarms)' : 'Sound off'}
            aria-label={soundOn ? 'Turn monitor sound off' : 'Turn monitor sound on'}
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
          {frozen && (
            <span className="rounded bg-slate-700 px-2 py-0.5 text-xs uppercase tracking-widest">
              {snapshot.status === 'idle' ? 'standby' : snapshot.status}
            </span>
          )}
          <span className="text-xl font-bold tabular-nums">{formatClock(snapshot.elapsedSec)}</span>
        </div>
      </div>

      {/* Main surface: each trace row pairs the waveform with its numeric
          (HR beside ECG, SpO₂ beside pleth, EtCO₂ beside the capnogram),
          like a real OR monitor; parameters without a trace sit in a
          bottom strip. */}
      <div className="relative flex flex-1 flex-col justify-around gap-2 rounded-lg bg-monitor-panel/50 p-2 ring-1 ring-monitor-grid">
        {/* CRT vignette (scanlines deliberately omitted — they moiré on projectors) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg [background:radial-gradient(ellipse_at_center,transparent_60%,rgba(0,0,0,0.28)_100%)]"
        />
        <div className={`grid items-stretch gap-2 ${traceRowCols}`}>
          <div className="min-w-0">
            <div className="flex items-baseline justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-vital-ecg">
                ECG II
              </span>
              <span className="text-xs font-mono text-vital-ecg/80">{RHYTHM_LABELS[v.rhythm]}</span>
            </div>
            <Waveform kind="ecg" color="#22e05f" hr={v.hr} rr={v.rr} spo2={v.spo2} etco2={v.etco2} rhythm={v.rhythm} frozen={frozen} heightClass={waveH} />
          </div>
          <VitalTile label="HR" value={String(Math.round(v.hr))} unit="bpm" color="text-vital-ecg" alarm={alarmFor('hr') ?? alarmFor('rhythm')} trendValue={v.hr} large={!compact} />
        </div>
        {art && (
          <div className={`grid items-stretch gap-2 ${traceRowCols}`}>
            <div className="min-w-0">
              <div className="flex items-baseline justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-vital-nibp">
                  ART
                </span>
                <span className="text-xs font-mono text-vital-nibp/80">0–170</span>
              </div>
              <Waveform kind="art" color="#f87171" hr={v.hr} rr={v.rr} spo2={v.spo2} etco2={v.etco2} sbp={v.sbp} dbp={v.dbp} rhythm={v.rhythm} frozen={frozen} heightClass={waveH} />
            </div>
            <VitalTile
              label="ART"
              value={bpValue}
              unit="mmHg"
              sub={bpSub}
              color="text-vital-nibp"
              alarm={alarmFor('sbp') ?? alarmFor('dbp')}
              trendValue={v.sbp}
            />
          </div>
        )}
        <div className={`grid items-stretch gap-2 ${traceRowCols}`}>
          <div className="min-w-0">
            <span className="px-1 text-xs font-bold uppercase tracking-wider text-vital-spo2">
              Pleth
            </span>
            <Waveform kind="pleth" color="#38bdf8" hr={v.hr} rr={v.rr} spo2={v.spo2} etco2={v.etco2} rhythm={v.rhythm} frozen={frozen} heightClass={waveH} />
          </div>
          <VitalTile label="SpO₂" value={String(Math.round(v.spo2))} unit="%" color="text-vital-spo2" alarm={alarmFor('spo2')} trendValue={v.spo2} large={!compact} />
        </div>
        <div className={`grid items-stretch gap-2 ${traceRowCols}`}>
          <div className="min-w-0">
            <span className="px-1 text-xs font-bold uppercase tracking-wider text-vital-etco2">
              CO₂
            </span>
            <Waveform kind="capno" color="#facc15" hr={v.hr} rr={v.rr} spo2={v.spo2} etco2={v.etco2} rhythm={v.rhythm} capnoShape={v.capnoShape} frozen={frozen} heightClass={waveH} />
          </div>
          <VitalTile
            label="EtCO₂"
            value={String(Math.round(v.etco2))}
            unit="mmHg"
            sub={`RR ${Math.round(v.rr)}/min`}
            color="text-vital-etco2"
            alarm={alarmFor('etco2') ?? alarmFor('rr')}
            trendValue={v.etco2}
          />
        </div>

        {/* Parameters without a trace (BP moves up beside its waveform in art mode) */}
        <div className={`grid gap-2 ${art ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {cuff && (
            <VitalTile
              label="NIBP"
              value={bpValue}
              unit="mmHg"
              sub={bpSub}
              color="text-vital-nibp"
              alarm={alarmFor('sbp') ?? alarmFor('dbp')}
              trendValue={cuff.sbp}
            />
          )}
          <VitalTile label="Temp" value={v.temp.toFixed(1)} unit="°C" color="text-vital-temp" alarm={alarmFor('temp')} trendValue={v.temp} />
          <VitalTile
            label="SEV"
            value={v.agentEt.toFixed(1)}
            unit="% Et"
            sub={`Fi ${v.agentFi.toFixed(1)} · Depth ${Math.round(v.depth)}`}
            color="text-vital-agent"
            trendValue={v.agentEt}
          />
        </div>
      </div>
    </div>
  );
}
