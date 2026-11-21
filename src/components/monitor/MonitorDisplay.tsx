'use client';

import { useEffect, useRef } from 'react';
import type { SimSnapshot } from '@/lib/engine/types';
import {
  AGENT_TAGS,
  formatStMm,
  map,
  minuteVentilation,
  PVC_FREQUENCY_EVERY_N,
  RHYTHM_LABELS,
} from '@/lib/engine/types';
import { AlarmBanner } from './AlarmBanner';
import { BeatClock } from './beatClock';
import { MonitorAudio, useSoundLevel } from './MonitorAudio';
import { unlockMonitorAudio, useMonitorAudioRunning } from './monitorAudioContext';
import { nextSoundLevel, type SoundLevel, type SoundRole } from './soundPref';
import { VitalTile } from './VitalTile';
import { Waveform } from './Waveform';
import { cuffReadingFailed, displayAlarms, NO_READING, oximeterHasSignal, stIsMeasurable } from './readouts';
import { capnoScaleMax } from './waveforms';

interface MonitorDisplayProps {
  snapshot: SimSnapshot;
  /** Compact mode for the embedded preview inside the faculty controller. */
  compact?: boolean;
  /** Hidden on the student monitor — learners read the rhythm from the trace. */
  showRhythmLabel?: boolean;
  /**
   * Which monitor this is, for the sound default: the student `display`
   * starts with sound on, the faculty `preview` (the default) with it off.
   */
  soundRole?: SoundRole;
}

const SOUND_ICON: Record<SoundLevel, string> = { off: '🔇', low: '🔉', full: '🔊' };
const SOUND_TITLE: Record<SoundLevel, string> = {
  off: 'Sound off — tap to turn on',
  low: 'Sound low (pulse tone + alarms) — tap to turn off',
  full: 'Sound on (pulse tone + alarms) — tap to turn down',
};

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
export function MonitorDisplay({
  snapshot,
  compact = false,
  showRhythmLabel = true,
  soundRole = 'preview',
}: MonitorDisplayProps) {
  const v = snapshot.vitals;
  const frozen = snapshot.status !== 'running';
  const [soundLevel, setSoundLevel] = useSoundLevel(soundRole);
  // Sound is wanted but the browser has not been allowed to play it yet (a
  // monitor opened from a link, or reloaded): the first tap or key press
  // anywhere unlocks it, and the button says so meanwhile.
  const audioRunning = useMonitorAudioRunning();
  const soundLocked = soundLevel !== 'off' && !audioRunning;
  useEffect(() => {
    if (!soundLocked) return;
    window.addEventListener('pointerdown', unlockMonitorAudio);
    window.addEventListener('keydown', unlockMonitorAudio);
    return () => {
      window.removeEventListener('pointerdown', unlockMonitorAudio);
      window.removeEventListener('keydown', unlockMonitorAudio);
    };
  }, [soundLocked]);

  // One heartbeat clock per monitor: the ECG, pleth, arterial trace and the
  // pulse tone all read the same beats, so they stay locked together.
  const clockRef = useRef<BeatClock | null>(null);
  clockRef.current ??= new BeatClock(Date.now());
  const clock = clockRef.current;
  clock.setInput({
    hr: v.hr,
    rr: v.rr,
    rhythm: v.rhythm,
    pvcEveryN: PVC_FREQUENCY_EVERY_N[v.pvcFrequency ?? 'occasional'],
    frozen,
  });

  const alarmFor = (vital: string) =>
    snapshot.alarms.find((a) => a.vital === vital)?.level;

  // A monitor counts heart rate from the beats it detects, so the number
  // wanders by a beat or so in sinus rhythm and more in AF. Display only:
  // alarms and the trend arrow still follow the instructor's value.
  const shownHr = Math.round(v.hr * clock.measuredRate());

  // ST-segment level, as a monitor's ST analysis prints it under the heart
  // rate — only while there are complexes it could measure one on.
  const stReadable = stIsMeasurable(v.rhythm);
  const stSub = stReadable ? `ST II ${formatStMm(v.ecg?.stMm ?? 0)}` : `ST II ${NO_READING}`;
  const stV5 = stReadable ? formatStMm(v.ecg?.stV5Mm ?? 0) : NO_READING;

  // With no pulse there is nothing for the oximeter to read: the tile shows
  // dashes rather than whatever saturation the scenario holds underneath.
  const noPulse = !oximeterHasSignal(v);

  // NIBP cuff mode: show the last measured reading and how stale it is.
  // nibp === null means an arterial line is in place (continuous BP + trace).
  const cuff = snapshot.nibp;
  const art = !cuff;
  const cuffAgeSec = cuff ? Math.max(0, snapshot.elapsedSec - cuff.atSec) : 0;
  // A cuff cycle with no pressure to find is a failed reading, not 0/0.
  const cuffFailed = cuffReadingFailed(cuff);
  const bpValue = cuffFailed
    ? `${NO_READING}/${NO_READING}`
    : cuff
      ? `${cuff.sbp}/${cuff.dbp}`
      : `${Math.round(v.sbp)}/${Math.round(v.dbp)}`;
  const bpMap = cuff ? map(cuff) : map(v);
  const bpSub = cuffFailed
    ? `no reading · ${formatClock(cuffAgeSec)} ago`
    : cuff
      ? `MAP ${bpMap} · ${formatClock(cuffAgeSec)} ago`
      : `MAP ${bpMap}`;

  // The banner names the lost signal instead of quoting a number the tile
  // no longer shows. Levels are untouched.
  const shownAlarms = displayAlarms(snapshot.alarms, v, cuff);

  // Anesthesia-machine readings, when the monitor shows them: the engine
  // sends every field, already rounded and in order.
  const vent =
    v.vent && v.vent.pip !== undefined ? (v.vent as Required<NonNullable<typeof v.vent>>) : null;
  const agent = snapshot.gas?.agent ?? v.agent ?? 'sevoflurane';
  const mac = snapshot.gas?.mac;

  // A second ECG lead, when the monitor has one.
  const v5 = snapshot.v5Lead === true;
  // Traces get shorter as rows are added: ECG, pleth and CO₂ always, plus the
  // arterial line and the V5 lead when present.
  const traceRows = 3 + (art ? 1 : 0) + (v5 ? 1 : 0);
  const waveH = compact
    ? ['h-14', 'h-11', 'h-9'][traceRows - 3]
    : ['h-20 md:h-28', 'h-16 md:h-24', 'h-14 md:h-20'][traceRows - 3];
  // Waveform + paired numeric per row; the tile column stays narrow so the
  // trace keeps most of the width.
  const traceRowCols = compact
    ? 'grid-cols-[1fr_minmax(104px,132px)]'
    : 'grid-cols-[1fr_minmax(128px,168px)] md:grid-cols-[1fr_minmax(168px,224px)]';

  return (
    <div className="flex h-full flex-col gap-2 bg-monitor-bg p-2 md:p-3">
      <MonitorAudio snapshot={snapshot} level={soundLevel} clock={clock} />
      {/* Header: alarms + sound + status + clock */}
      <div className="flex items-center justify-between gap-3">
        <AlarmBanner alarms={shownAlarms} silenced={snapshot.alarmsSilenced} />
        <div className="flex items-center gap-3 whitespace-nowrap font-mono text-[#dce3d9]">
          <button
            onClick={() => {
              // While locked, the tap that reaches this button is the unlock
              // itself — don't also change the level out from under it.
              if (soundLocked) unlockMonitorAudio();
              else setSoundLevel(nextSoundLevel(soundLevel));
            }}
            className={`rounded px-1.5 py-0.5 text-base ring-1 ring-monitor-grid hover:bg-monitor-panel ${
              soundLocked ? 'motion-safe:animate-pulse' : ''
            }`}
            title={soundLocked ? 'Tap anywhere to start sound' : SOUND_TITLE[soundLevel]}
            aria-label={soundLocked ? 'Start monitor sound' : `Monitor ${SOUND_TITLE[soundLevel].toLowerCase()}`}
          >
            {soundLocked ? (
              <span className="text-xs font-bold uppercase tracking-wider">🔈 tap for sound</span>
            ) : (
              SOUND_ICON[soundLevel]
            )}
          </button>
          {frozen && (
            <span className="rounded bg-[#293027] px-2 py-0.5 text-xs uppercase tracking-widest">
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
              {showRhythmLabel && (
                <span className="text-xs font-mono text-vital-ecg/80">{RHYTHM_LABELS[v.rhythm]}</span>
              )}
            </div>
            <Waveform kind="ecg" clock={clock} color="#73ef82" hr={v.hr} rr={v.rr} spo2={v.spo2} etco2={v.etco2} rhythm={v.rhythm} pvcFrequency={v.pvcFrequency} ecg={v.ecg} frozen={frozen} heightClass={waveH} />
          </div>
          <VitalTile label="HR" value={String(shownHr)} unit="bpm" sub={stSub} color="text-vital-ecg" alarm={alarmFor('hr') ?? alarmFor('rhythm')} trendValue={v.hr} large={!compact} />
        </div>
        {v5 && (
          <div className={`grid items-stretch gap-2 ${traceRowCols}`}>
            <div className="min-w-0">
              <span className="px-1 text-xs font-bold uppercase tracking-wider text-vital-ecg">
                ECG V5
              </span>
              <Waveform kind="ecg" lead="V5" clock={clock} color="#73ef82" hr={v.hr} rr={v.rr} spo2={v.spo2} etco2={v.etco2} rhythm={v.rhythm} pvcFrequency={v.pvcFrequency} ecg={v.ecg} frozen={frozen} heightClass={waveH} />
            </div>
            <VitalTile label="ST V5" value={stV5} unit="mm" color="text-vital-ecg" />
          </div>
        )}
        {art && (
          <div className={`grid items-stretch gap-2 ${traceRowCols}`}>
            <div className="min-w-0">
              <div className="flex items-baseline justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-vital-nibp">
                  ART
                </span>
                <span className="text-xs font-mono text-vital-nibp/80">0–170</span>
              </div>
              <Waveform kind="art" clock={clock} pulseless={noPulse} color="#f87171" hr={v.hr} rr={v.rr} spo2={v.spo2} etco2={v.etco2} sbp={v.sbp} dbp={v.dbp} rhythm={v.rhythm} frozen={frozen} heightClass={waveH} />
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
            <Waveform kind="pleth" clock={clock} pulseless={noPulse} color="#38bdf8" hr={v.hr} rr={v.rr} spo2={v.spo2} etco2={v.etco2} rhythm={v.rhythm} frozen={frozen} heightClass={waveH} />
          </div>
          <VitalTile label="SpO₂" value={noPulse ? NO_READING : String(Math.round(v.spo2))} unit="%" color="text-vital-spo2" alarm={alarmFor('spo2')} trendValue={noPulse ? undefined : v.spo2} large={!compact} />
        </div>
        <div className={`grid items-stretch gap-2 ${traceRowCols}`}>
          <div className="min-w-0">
            <div className="flex items-baseline justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-vital-etco2">
                CO₂
              </span>
              <span className="text-xs font-mono text-vital-etco2/80">0–{capnoScaleMax(v.etco2)}</span>
            </div>
            <Waveform kind="capno" color="#facc15" hr={v.hr} rr={v.rr} spo2={v.spo2} etco2={v.etco2} rhythm={v.rhythm} capnoShape={v.capnoShape} fico2={v.fico2} frozen={frozen} heightClass={waveH} />
          </div>
          <VitalTile
            label="EtCO₂"
            value={String(Math.round(v.etco2))}
            unit="mmHg"
            sub={`RR ${Math.round(v.rr)}/min · Fi\u00a0${Math.round(v.fico2 ?? 0)}`}
            color="text-vital-etco2"
            alarm={alarmFor('etco2') ?? alarmFor('rr')}
            trendValue={v.etco2}
          />
        </div>

        {/* Parameters without a trace (BP moves up beside its waveform in art
            mode). The strip fits as many tiles per row as it has room for —
            each wide enough for a blood pressure — so the machine readings
            wrap to a second row on a narrow display instead of squeezing it. */}
        <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]">
          {cuff && (
            <VitalTile
              label="NIBP"
              value={bpValue}
              unit="mmHg"
              sub={bpSub}
              color="text-vital-nibp"
              alarm={alarmFor('sbp') ?? alarmFor('dbp')}
              trendValue={cuffFailed ? undefined : cuff.sbp}
            />
          )}
          <VitalTile label="Temp" value={v.temp.toFixed(1)} unit="°C" color="text-vital-temp" alarm={alarmFor('temp')} trendValue={v.temp} />
          <VitalTile
            label={AGENT_TAGS[agent]}
            value={v.agentEt.toFixed(1)}
            unit="% Et"
            sub={`Fi ${v.agentFi.toFixed(1)}${mac === undefined ? '' : ` · MAC ${mac.toFixed(1)}`} · Depth ${Math.round(v.depth)}`}
            color="text-vital-agent"
            trendValue={v.agentEt}
          />
          {vent && (
            <>
              <VitalTile
                label="Paw"
                value={String(vent.pip)}
                unit="cmH₂O"
                sub={`Pplat ${vent.pplat} · PEEP ${vent.peep}`}
                color="text-monitor-ink"
                alarm={alarmFor('paw')}
                trendValue={vent.pip}
              />
              <VitalTile
                label="VT"
                value={String(vent.vt)}
                unit="mL"
                sub={`MV ${minuteVentilation(vent.vt, v.rr).toFixed(1)} L/min`}
                color="text-monitor-ink"
                alarm={alarmFor('vt')}
                trendValue={vent.vt}
              />
              <VitalTile
                label="O₂"
                value={String(vent.fio2)}
                unit="% Fi"
                color="text-monitor-ink"
                alarm={alarmFor('fio2')}
                trendValue={vent.fio2}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
