import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Sliders, 
  Sparkles, 
  CloudRain, 
  Waves, 
  Activity, 
  Flame, 
  Moon, 
  Wind,
  Compass,
  Smile,
  Timer,
  Check,
  RefreshCw,
  Bell
} from 'lucide-react';

interface SoundscapeProps {
  pomodoroRunning: boolean;
  timerMode: 'focus' | 'short' | 'long';
}

interface ChannelState {
  id: string;
  name: string;
  icon: React.ReactNode;
  enabled: boolean;
  volume: number; // 0 to 100
  paramValue: number; // 0 to 100
  paramName: string;
}

export const Soundscapes: React.FC<SoundscapeProps> = ({ pomodoroRunning, timerMode }) => {
  // Soundscape State
  const [isPlaying, setIsPlaying] = useState(false);
  const [masterVolume, setMasterVolume] = useState(80); // 0 to 100
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [autoPlayWithPomodoro, setAutoPlayWithPomodoro] = useState(true);

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Channels State
  const [channels, setChannels] = useState<ChannelState[]>([
    { id: 'rain', name: 'Gentle Rain', icon: <CloudRain className="h-4 w-4" />, enabled: false, volume: 50, paramValue: 40, paramName: 'Rain Intensity' },
    { id: 'ocean', name: 'Deep Ocean Waves', icon: <Waves className="h-4 w-4" />, enabled: false, volume: 40, paramValue: 30, paramName: 'Breathing Rate' },
    { id: 'zen', name: 'Zen Singing Bowls', icon: <Bell className="h-4 w-4" />, enabled: false, volume: 30, paramValue: 50, paramName: 'Strike Interval' },
    { id: 'binaural', name: 'Binaural Beats', icon: <Activity className="h-4 w-4" />, enabled: false, volume: 25, paramValue: 10, paramName: 'Beat (Alpha/Theta)' },
    { id: 'drone', name: 'Cosmic Deep Drone', icon: <Compass className="h-4 w-4" />, enabled: false, volume: 35, paramValue: 60, paramName: 'Resonance' },
    { id: 'wind', name: 'Forest Wind', icon: <Wind className="h-4 w-4" />, enabled: false, volume: 30, paramValue: 40, paramName: 'Turbulence' },
  ]);

  // Audio Nodes Refs (for dynamic updates)
  const rainGainNode = useRef<GainNode | null>(null);
  const rainFilterNode = useRef<BiquadFilterNode | null>(null);
  const rainTimerRef = useRef<NodeJS.Timeout | null>(null);

  const oceanGainNode = useRef<GainNode | null>(null);
  const oceanLfoNode = useRef<OscillatorNode | null>(null);

  const zenGainNode = useRef<GainNode | null>(null);
  const zenIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const binauralGainNode = useRef<GainNode | null>(null);
  const binauralOscLeft = useRef<OscillatorNode | null>(null);
  const binauralOscRight = useRef<OscillatorNode | null>(null);

  const droneGainNode = useRef<GainNode | null>(null);
  const droneOscs = useRef<OscillatorNode[]>([]);
  const droneFilterNode = useRef<BiquadFilterNode | null>(null);

  const windGainNode = useRef<GainNode | null>(null);
  const windLfoNode = useRef<OscillatorNode | null>(null);
  const windFilterNode = useRef<BiquadFilterNode | null>(null);

  // Initialize Audio Context on user gesture
  const initAudio = () => {
    if (audioCtxRef.current) return audioCtxRef.current;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.error('Web Audio API not supported in this browser');
      return null;
    }

    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    // Master Analyser and Gain
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(masterVolume / 100, ctx.currentTime);
    masterGainRef.current = masterGain;

    // Connect master pipeline
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);

    return ctx;
  };

  // Helper: Create a White Noise Buffer
  const createNoiseBuffer = (ctx: AudioContext) => {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  };

  // Start sound generation for a channel
  const startChannelAudio = (id: string, ctx: AudioContext, masterG: GainNode) => {
    if (!ctx) return;

    try {
      if (id === 'rain') {
        // Rain Synth (White Noise + Bandpass Filter + Random Droplet Modulator)
        const rainGain = ctx.createGain();
        const chan = channels.find(c => c.id === 'rain')!;
        rainGain.gain.setValueAtTime((chan.volume / 100) * chan.enabled, ctx.currentTime);
        rainGain.connect(masterG);
        rainGainNode.current = rainGain;

        // Rumble/Base rain
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = createNoiseBuffer(ctx);
        noiseSource.loop = true;

        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(350, ctx.currentTime);

        noiseSource.connect(lowpass);
        lowpass.connect(rainGain);
        noiseSource.start();

        // Droplets pitter-patter generator using interval
        const triggerDroplet = () => {
          if (!isPlaying || !channels.find(c => c.id === 'rain')?.enabled) return;
          
          const dropletOsc = ctx.createOscillator();
          const dropletGain = ctx.createGain();
          
          dropletOsc.type = 'sine';
          // Higher frequency for sharp patter, parameterized by Intensity
          const intensity = channels.find(c => c.id === 'rain')?.paramValue || 50;
          const pitch = 800 + Math.random() * 1200 + (intensity * 4);
          
          dropletOsc.frequency.setValueAtTime(pitch, ctx.currentTime);
          
          dropletGain.gain.setValueAtTime(0, ctx.currentTime);
          dropletGain.gain.linearRampToValueAtTime(0.02 + (intensity / 1000), ctx.currentTime + 0.01);
          dropletGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15 + (Math.random() * 0.1));
          
          dropletOsc.connect(dropletGain);
          dropletGain.connect(rainGain);
          
          dropletOsc.start();
          dropletOsc.stop(ctx.currentTime + 0.3);
          
          // Reschedule next droplet
          const nextTime = 40 + (100 - intensity) * 3 + Math.random() * 80;
          rainTimerRef.current = setTimeout(triggerDroplet, nextTime);
        };

        triggerDroplet();
      }

      else if (id === 'ocean') {
        // Ocean Surf: Brown Noise + Bandpass Filter modulated by a very slow sinusoidal LFO
        const oceanGain = ctx.createGain();
        const chan = channels.find(c => c.id === 'ocean')!;
        oceanGain.gain.setValueAtTime((chan.volume / 100) * chan.enabled, ctx.currentTime);
        oceanGain.connect(masterG);
        oceanGainNode.current = oceanGain;

        // Brown noise source
        const noiseSource = ctx.createBufferSource();
        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          // Brownian noise filter approximation
          data[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = data[i];
          data[i] *= 3.5; // compensation volume boost
        }
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        const oceanFilter = ctx.createBiquadFilter();
        oceanFilter.type = 'lowpass';
        oceanFilter.frequency.setValueAtTime(280, ctx.currentTime);

        // Modulate volume using a slow LFO oscillator to simulate waves
        const waveLfo = ctx.createOscillator();
        const waveLfoGain = ctx.createGain();
        
        // Breathing rate param controls LFO speed: 0.04Hz to 0.16Hz
        const speedParam = chan.paramValue;
        const lfoFrequency = 0.04 + (speedParam / 100) * 0.12;
        
        waveLfo.frequency.setValueAtTime(lfoFrequency, ctx.currentTime);
        waveLfoGain.gain.setValueAtTime(0.4, ctx.currentTime); // Amplitude of volume modulation

        // We map the LFO output directly to the gain parameter of another GainNode
        const lfoControlledGain = ctx.createGain();
        lfoControlledGain.gain.setValueAtTime(0.5, ctx.currentTime); // Baseline volume offset

        // Hook LFO up to modulate the gain node
        waveLfo.connect(waveLfoGain);
        waveLfoGain.connect(lfoControlledGain.gain);

        // Signal route: Noise -> Lowpass -> ModulatedGain -> ChannelGain -> MasterGain
        noiseSource.connect(oceanFilter);
        oceanFilter.connect(lfoControlledGain);
        lfoControlledGain.connect(oceanGain);

        waveLfo.start();
        noiseSource.start();

        oceanLfoNode.current = waveLfo;
      }

      else if (id === 'zen') {
        // Tibetan Bowls / Chimes
        const zenGain = ctx.createGain();
        const chan = channels.find(c => c.id === 'zen')!;
        zenGain.gain.setValueAtTime((chan.volume / 100) * chan.enabled, ctx.currentTime);
        zenGain.connect(masterG);
        zenGainNode.current = zenGain;

        const triggerBowlStrike = () => {
          if (!isPlaying || !channels.find(c => c.id === 'zen')?.enabled) return;

          // Fundamental + Overtones for metallic ringing bowl
          const fundFreq = 144 + Math.random() * 40; // ~ D3 to F3
          const overtones = [1.0, 1.5, 2.2, 2.76, 3.42, 4.12];
          const volumes = [0.8, 0.4, 0.25, 0.15, 0.08, 0.04];
          const decays = [8.0, 6.0, 4.5, 3.0, 2.0, 1.2]; // seconds

          overtones.forEach((ratio, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(fundFreq * ratio, ctx.currentTime);

            gain.gain.setValueAtTime(0, ctx.currentTime);
            // Quick strike, then long decay
            gain.gain.linearRampToValueAtTime(volumes[idx] * 0.15, ctx.currentTime + 0.08);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + decays[idx]);

            osc.connect(gain);
            gain.connect(zenGain);

            osc.start();
            osc.stop(ctx.currentTime + decays[idx] + 0.5);
          });

          // Reschedule based on Strike Interval param: 10s to 60s
          const intervalParam = channels.find(c => c.id === 'zen')?.paramValue || 50;
          const seconds = 12 + (100 - intervalParam) * 0.48; // maps 0-100 to 60s - 12s
          
          zenIntervalRef.current = setTimeout(triggerBowlStrike, seconds * 1000);
        };

        // First strike after a short delay
        zenIntervalRef.current = setTimeout(triggerBowlStrike, 1500);
      }

      else if (id === 'binaural') {
        // Binaural beats: 150Hz in left ear, (150 + diff)Hz in right ear
        const binauralGain = ctx.createGain();
        const chan = channels.find(c => c.id === 'binaural')!;
        binauralGain.gain.setValueAtTime((chan.volume / 100) * chan.enabled, ctx.currentTime);
        binauralGain.connect(masterG);
        binauralGainNode.current = binauralGain;

        const carrierPitch = 120 + (chan.paramValue * 1.5); // 120Hz to 270Hz carrier

        // We choose target frequency based on typical selection
        // Let's use 10Hz (Alpha) for general focus, but allow customizing
        const beatDiff = chan.paramValue < 25 ? 6 : chan.paramValue < 50 ? 10 : chan.paramValue < 75 ? 15 : 40; 
        // 6Hz (Theta), 10Hz (Alpha), 15Hz (Beta), 40Hz (Gamma)

        // Left Ear Oscillator
        const oscLeft = ctx.createOscillator();
        const gainLeft = ctx.createGain();
        const pannerLeft = ctx.createStereoPanner();
        
        oscLeft.type = 'sine';
        oscLeft.frequency.setValueAtTime(carrierPitch, ctx.currentTime);
        pannerLeft.pan.setValueAtTime(-1, ctx.currentTime);
        
        oscLeft.connect(gainLeft);
        gainLeft.connect(pannerLeft);
        pannerLeft.connect(binauralGain);

        // Right Ear Oscillator
        const oscRight = ctx.createOscillator();
        const gainRight = ctx.createGain();
        const pannerRight = ctx.createStereoPanner();
        
        oscRight.type = 'sine';
        oscRight.frequency.setValueAtTime(carrierPitch + beatDiff, ctx.currentTime);
        pannerRight.pan.setValueAtTime(1, ctx.currentTime);
        
        oscRight.connect(gainRight);
        gainRight.connect(pannerRight);
        pannerRight.connect(binauralGain);

        oscLeft.start();
        oscRight.start();

        binauralOscLeft.current = oscLeft;
        binauralOscRight.current = oscRight;
      }

      else if (id === 'drone') {
        // Cosmic Drone: Multiple low detuned triangles filtered through a lowpass
        const droneGain = ctx.createGain();
        const chan = channels.find(c => c.id === 'drone')!;
        droneGain.gain.setValueAtTime((chan.volume / 100) * chan.enabled, ctx.currentTime);
        droneGain.connect(masterG);
        droneGainNode.current = droneGain;

        const droneFilter = ctx.createBiquadFilter();
        droneFilter.type = 'lowpass';
        droneFilter.frequency.setValueAtTime(180, ctx.currentTime);
        
        // Custom resonance mapping: Q parameter 1 to 15
        const qVal = 1 + (chan.paramValue / 100) * 14;
        droneFilter.Q.setValueAtTime(qVal, ctx.currentTime);
        droneFilterNode.current = droneFilter;

        // Sub-fundamental chord: C2 (65.4Hz), G2 (98.0Hz), C3 (130.8Hz)
        const notes = [65.4, 98.0, 130.8, 196.0];
        const oscs: OscillatorNode[] = [];

        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const oscGain = ctx.createGain();
          
          osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
          // Detune slightly for chorusing effect
          const detuneAmount = (Math.random() * 2 - 1) * 6;
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          osc.detune.setValueAtTime(detuneAmount, ctx.currentTime);

          // Apply slight individual low-frequency volume drift
          oscGain.gain.setValueAtTime(0.25 - (idx * 0.05), ctx.currentTime);

          osc.connect(oscGain);
          oscGain.connect(droneFilter);

          osc.start();
          oscs.push(osc);
        });

        droneFilter.connect(droneGain);
        droneOscs.current = oscs;
      }

      else if (id === 'wind') {
        // Forest Wind: Lowpass Filtered white noise modulated with random parameters
        const windGain = ctx.createGain();
        const chan = channels.find(c => c.id === 'wind')!;
        windGain.gain.setValueAtTime((chan.volume / 100) * chan.enabled, ctx.currentTime);
        windGain.connect(masterG);
        windGainNode.current = windGain;

        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = createNoiseBuffer(ctx);
        noiseSource.loop = true;

        const windFilter = ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.setValueAtTime(450, ctx.currentTime);
        windFilter.Q.setValueAtTime(1.5, ctx.currentTime);
        windFilterNode.current = windFilter;

        // Modulate bandpass frequency slowly for whistling effect
        const windLfo = ctx.createOscillator();
        const windLfoGain = ctx.createGain();
        
        // Turbulence maps to LFO rate and depth
        const turbParam = chan.paramValue;
        const lfoSpeed = 0.05 + (turbParam / 100) * 0.15;
        const lfoDepth = 150 + (turbParam / 100) * 200;

        windLfo.frequency.setValueAtTime(lfoSpeed, ctx.currentTime);
        windLfoGain.gain.setValueAtTime(lfoDepth, ctx.currentTime);

        windLfo.connect(windLfoGain);
        windLfoGain.connect(windFilter.frequency); // directly modulates bandpass frequency

        noiseSource.connect(windFilter);
        windFilter.connect(windGain);

        windLfo.start();
        noiseSource.start();

        windLfoNode.current = windLfo;
      }
    } catch (err) {
      console.error(`Error starting audio for channel ${id}:`, err);
    }
  };

  // Stop sound generation for a channel
  const stopChannelAudio = (id: string) => {
    try {
      if (id === 'rain') {
        if (rainTimerRef.current) clearTimeout(rainTimerRef.current);
        if (rainGainNode.current) {
          rainGainNode.current.disconnect();
          rainGainNode.current = null;
        }
      } else if (id === 'ocean') {
        if (oceanLfoNode.current) {
          oceanLfoNode.current.stop();
          oceanLfoNode.current = null;
        }
        if (oceanGainNode.current) {
          oceanGainNode.current.disconnect();
          oceanGainNode.current = null;
        }
      } else if (id === 'zen') {
        if (zenIntervalRef.current) clearTimeout(zenIntervalRef.current);
        if (zenGainNode.current) {
          zenGainNode.current.disconnect();
          zenGainNode.current = null;
        }
      } else if (id === 'binaural') {
        if (binauralOscLeft.current) {
          binauralOscLeft.current.stop();
          binauralOscLeft.current = null;
        }
        if (binauralOscRight.current) {
          binauralOscRight.current.stop();
          binauralOscRight.current = null;
        }
        if (binauralGainNode.current) {
          binauralGainNode.current.disconnect();
          binauralGainNode.current = null;
        }
      } else if (id === 'drone') {
        if (droneOscs.current.length > 0) {
          droneOscs.current.forEach(osc => {
            try { osc.stop(); } catch(e){}
          });
          droneOscs.current = [];
        }
        if (droneGainNode.current) {
          droneGainNode.current.disconnect();
          droneGainNode.current = null;
        }
        if (droneFilterNode.current) {
          droneFilterNode.current.disconnect();
          droneFilterNode.current = null;
        }
      } else if (id === 'wind') {
        if (windLfoNode.current) {
          try { windLfoNode.current.stop(); } catch(e){}
          windLfoNode.current = null;
        }
        if (windGainNode.current) {
          windGainNode.current.disconnect();
          windGainNode.current = null;
        }
        if (windFilterNode.current) {
          windFilterNode.current.disconnect();
          windFilterNode.current = null;
        }
      }
    } catch (e) {
      console.warn(`Clean up warning for ${id}:`, e);
    }
  };

  // Global Start / Pause toggle
  const handleTogglePlay = () => {
    if (isPlaying) {
      // Pause
      setIsPlaying(false);
      channels.forEach(ch => stopChannelAudio(ch.id));
      if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
        audioCtxRef.current.suspend();
      }
    } else {
      // Start
      const ctx = initAudio();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      setIsPlaying(true);
      setActivePreset(null);

      // Start any channel that is already enabled
      channels.forEach(ch => {
        if (ch.enabled && masterGainRef.current) {
          startChannelAudio(ch.id, ctx, masterGainRef.current);
        }
      });
    }
  };

  // Toggle single channel
  const handleToggleChannel = (id: string) => {
    setChannels(prev => prev.map(ch => {
      if (ch.id === id) {
        const nextEnabled = !ch.enabled;
        
        if (isPlaying) {
          if (nextEnabled) {
            const ctx = audioCtxRef.current || initAudio();
            if (ctx && masterGainRef.current) {
              startChannelAudio(id, ctx, masterGainRef.current);
            }
          } else {
            stopChannelAudio(id);
          }
        }
        
        return { ...ch, enabled: nextEnabled };
      }
      return ch;
    }));
    setActivePreset(null);
  };

  // Update volume parameter of channel
  const handleVolumeChange = (id: string, vol: number) => {
    setChannels(prev => prev.map(ch => {
      if (ch.id === id) {
        // Apply volume changes instantly
        const targetNode = getGainNodeForChannel(id);
        if (targetNode && audioCtxRef.current) {
          const actualG = (vol / 100) * (ch.enabled ? 1 : 0);
          targetNode.gain.setValueAtTime(actualG, audioCtxRef.current.currentTime);
        }
        return { ...ch, volume: vol };
      }
      return ch;
    }));
  };

  // Update channel secondary parameter
  const handleParamValueChange = (id: string, val: number) => {
    setChannels(prev => prev.map(ch => {
      if (ch.id === id) {
        // Apply parameterized adjustments to running nodes
        const ctx = audioCtxRef.current;
        if (ctx) {
          if (id === 'ocean' && oceanLfoNode.current) {
            const lfoFrequency = 0.04 + (val / 100) * 0.12;
            oceanLfoNode.current.frequency.setValueAtTime(lfoFrequency, ctx.currentTime);
          } else if (id === 'binaural' && binauralOscLeft.current && binauralOscRight.current) {
            const carrierPitch = 120 + (val * 1.5);
            const beatDiff = val < 25 ? 6 : val < 50 ? 10 : val < 75 ? 15 : 40; 
            binauralOscLeft.current.frequency.setValueAtTime(carrierPitch, ctx.currentTime);
            binauralOscRight.current.frequency.setValueAtTime(carrierPitch + beatDiff, ctx.currentTime);
          } else if (id === 'drone' && droneFilterNode.current) {
            const qVal = 1 + (val / 100) * 14;
            droneFilterNode.current.Q.setValueAtTime(qVal, ctx.currentTime);
          } else if (id === 'wind' && windLfoNode.current) {
            const lfoSpeed = 0.05 + (val / 100) * 0.15;
            windLfoNode.current.frequency.setValueAtTime(lfoSpeed, ctx.currentTime);
          }
        }
        return { ...ch, paramValue: val };
      }
      return ch;
    }));
  };

  // Helper mapping to correct gain node
  const getGainNodeForChannel = (id: string) => {
    switch (id) {
      case 'rain': return rainGainNode.current;
      case 'ocean': return oceanGainNode.current;
      case 'zen': return zenGainNode.current;
      case 'binaural': return binauralGainNode.current;
      case 'drone': return droneGainNode.current;
      case 'wind': return windGainNode.current;
      default: return null;
    }
  };

  // Presets mapping
  const presets = [
    {
      id: 'deep-work',
      name: 'Deep Work isolation',
      desc: 'Alpha Binaural Beats + Cosmic Deep Drone to block environmental distractions.',
      channels: [
        { id: 'binaural', enabled: true, volume: 30, paramValue: 40 }, // Alpha beats
        { id: 'drone', enabled: true, volume: 45, paramValue: 50 },
        { id: 'rain', enabled: false, volume: 40, paramValue: 30 },
        { id: 'ocean', enabled: false, volume: 30, paramValue: 30 },
        { id: 'zen', enabled: false, volume: 30, paramValue: 50 },
        { id: 'wind', enabled: false, volume: 30, paramValue: 40 }
      ]
    },
    {
      id: 'creative-flow',
      name: 'Creative Sanctuary',
      desc: 'Theta brainwave entrainment combined with Gentle Rain patters.',
      channels: [
        { id: 'binaural', enabled: true, volume: 20, paramValue: 15 }, // Theta beats
        { id: 'rain', enabled: true, volume: 60, paramValue: 65 },
        { id: 'drone', enabled: false, volume: 35, paramValue: 60 },
        { id: 'ocean', enabled: false, volume: 30, paramValue: 30 },
        { id: 'zen', enabled: false, volume: 30, paramValue: 50 },
        { id: 'wind', enabled: false, volume: 30, paramValue: 40 }
      ]
    },
    {
      id: 'nature-zen',
      name: 'Ocean Zen Temple',
      desc: 'Ocean Wave breathing cycles paired with periodic Tibetan bell strikes.',
      channels: [
        { id: 'ocean', enabled: true, volume: 55, paramValue: 30 },
        { id: 'zen', enabled: true, volume: 40, paramValue: 60 },
        { id: 'binaural', enabled: false, volume: 25, paramValue: 10 },
        { id: 'rain', enabled: false, volume: 50, paramValue: 40 },
        { id: 'drone', enabled: false, volume: 35, paramValue: 60 },
        { id: 'wind', enabled: false, volume: 30, paramValue: 40 }
      ]
    },
    {
      id: 'forest-focus',
      name: 'Forest Whispers',
      desc: 'Ethereal Forest Wind and subtle gentle rainfall triggers.',
      channels: [
        { id: 'wind', enabled: true, volume: 50, paramValue: 45 },
        { id: 'rain', enabled: true, volume: 35, paramValue: 30 },
        { id: 'ocean', enabled: false, volume: 40, paramValue: 30 },
        { id: 'zen', enabled: false, volume: 30, paramValue: 50 },
        { id: 'binaural', enabled: false, volume: 25, paramValue: 10 },
        { id: 'drone', enabled: false, volume: 35, paramValue: 60 }
      ]
    }
  ];

  // Apply preset
  const handleApplyPreset = (presetId: string) => {
    const selectedPreset = presets.find(p => p.id === presetId)!;
    setActivePreset(presetId);

    const ctx = audioCtxRef.current || initAudio();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    setIsPlaying(true);

    // Update channels
    setChannels(prev => prev.map(ch => {
      const pCh = selectedPreset.channels.find(pc => pc.id === ch.id)!;
      
      // Handle actual synthesis nodes startup or stopping
      if (pCh.enabled) {
        // Stop first to ensure clean state
        stopChannelAudio(ch.id);
        if (masterGainRef.current) {
          startChannelAudio(ch.id, ctx, masterGainRef.current);
        }
      } else {
        stopChannelAudio(ch.id);
      }

      return {
        ...ch,
        enabled: pCh.enabled,
        volume: pCh.volume,
        paramValue: pCh.paramValue
      };
    }));
  };

  // Master Volume controller
  const handleMasterVolumeChange = (vol: number) => {
    setMasterVolume(vol);
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setValueAtTime(vol / 100, audioCtxRef.current.currentTime);
    }
  };

  // Visualizer Animation Loop
  const drawVisualizer = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const renderFrame = () => {
      if (!isPlaying) {
        // Draw static baseline
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        return;
      }

      animationFrameRef.current = requestAnimationFrame(renderFrame);
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw aesthetic dark wave visualizer
      ctx.lineWidth = 2.5;
      
      // Gradient for waves
      const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
      grad.addColorStop(0, '#60A5FA'); // blue-400
      grad.addColorStop(0.5, '#3B82F6'); // blue-500
      grad.addColorStop(1, '#1D4ED8'); // blue-700
      ctx.strokeStyle = grad;

      ctx.beginPath();
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Draw smooth ambient particles for deep-focus aesthetic
      ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    renderFrame();
  };

  // Sync with active Pomodoro blocks
  useEffect(() => {
    if (!autoPlayWithPomodoro) return;

    if (pomodoroRunning && timerMode === 'focus' && !isPlaying) {
      // Auto-start focus preset (e.g. deep-work)
      handleApplyPreset('deep-work');
    } else if (!pomodoroRunning && isPlaying) {
      // Pause
      handleTogglePlay();
    }
  }, [pomodoroRunning, timerMode]);

  // Handle active rendering trigger
  useEffect(() => {
    if (isPlaying) {
      drawVisualizer();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.beginPath();
          ctx.moveTo(0, canvas.height / 2);
          ctx.lineTo(canvas.width, canvas.height / 2);
          ctx.strokeStyle = '#94A3B8';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      channels.forEach(ch => stopChannelAudio(ch.id));
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch(e){}
      }
    };
  }, []);

  return (
    <div className="space-y-6 animate-fade-in" id="soundscape-workspace">
      
      {/* Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-100/30 dark:bg-blue-900/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
              <Sliders className="h-4 w-4" />
            </span>
            <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">Focused Ambient Soundscapes</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Synthesize custom, uninterrupted cognitive isolation fields. Custom-engineered dynamic noise, brainwave beat entrainments, and physical oscillators.
          </p>
        </div>
      </div>

      {/* Main Control Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Playback Controls & Visualizer */}
        <div className="lg:col-span-1 bg-slate-950 text-white rounded-3xl p-5 border border-slate-800 flex flex-col justify-between space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-900/20 rounded-full blur-xl pointer-events-none"></div>
          
          <div className="space-y-4 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-black tracking-widest text-blue-400">Audio Pipeline</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isPlaying ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-400'}`}>
                {isPlaying ? 'ACTIVE GENERATION' : 'STANDBY'}
              </span>
            </div>

            {/* Visualizer Canvas */}
            <div className="h-24 bg-slate-900/60 rounded-2xl border border-slate-850 flex items-center justify-center p-3 relative overflow-hidden">
              <canvas 
                ref={canvasRef} 
                width={300} 
                height={80} 
                className="w-full h-full"
              />
              {!isPlaying && (
                <div className="absolute text-[10px] text-slate-500 font-medium italic">
                  Press Play to trigger soundscape visualizer
                </div>
              )}
            </div>

            {/* Master Controls */}
            <div className="flex items-center gap-4 py-2">
              <button
                onClick={handleTogglePlay}
                className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-md ${
                  isPlaying 
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-950/20' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-950/20'
                }`}
                aria-label={isPlaying ? "Pause Soundscape" : "Play Soundscape"}
              >
                {isPlaying ? <Pause className="h-6 w-6 stroke-[2.5]" /> : <Play className="h-6 w-6 fill-white ml-0.5" />}
              </button>

              <div className="flex-1 space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-400">
                  <span className="flex items-center gap-1">
                    {masterVolume === 0 ? <VolumeX className="h-3.5 w-3.5 text-rose-400" /> : <Volume2 className="h-3.5 w-3.5 text-blue-400" />}
                    Master Gain
                  </span>
                  <span className="font-mono">{masterVolume}%</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="100"
                  value={masterVolume}
                  onChange={(e) => handleMasterVolumeChange(parseInt(e.target.value))}
                  className="w-full accent-blue-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer appearance-none"
                />
              </div>
            </div>
          </div>

          {/* Pomodoro Linkage Checkbox */}
          <div className="p-3.5 bg-slate-900 border border-slate-850 rounded-2xl space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input 
                type="checkbox"
                checked={autoPlayWithPomodoro}
                onChange={(e) => setAutoPlayWithPomodoro(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-blue-500 focus:ring-blue-500 bg-slate-950"
              />
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold text-slate-200 block">Link to Pomodoro Focus blocks</span>
                <p className="text-[9px] text-slate-500 leading-normal">
                  Automatically ignite the **Deep Work** audio shield when you initiate an advisor-catalog focus cycle.
                </p>
              </div>
            </label>
          </div>

        </div>

        {/* Bento Grid: Presets & Channels */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Preset Buttons */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block">Focus State Presets</span>
            <div className="grid grid-cols-2 gap-2.5">
              {presets.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleApplyPreset(p.id)}
                  className={`p-3 text-left rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                    activePreset === p.id 
                      ? 'bg-blue-50/70 border-blue-300 dark:bg-blue-950/20 dark:border-blue-900/60 shadow-3xs' 
                      : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700'
                  }`}
                >
                  {activePreset === p.id && (
                    <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-500"></div>
                  )}
                  <h4 className={`text-xs font-bold ${activePreset === p.id ? 'text-blue-700 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>
                    {p.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {p.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Individual Channel Sliders */}
          <div className="space-y-3">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block">Synthesizer Mixer Channels</span>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {channels.map((chan) => (
                <div 
                  key={chan.id}
                  className={`p-4 rounded-2xl border transition-all space-y-3 ${
                    chan.enabled 
                      ? 'bg-white border-blue-200 dark:bg-slate-900 dark:border-blue-900/50 shadow-3xs' 
                      : 'bg-slate-50/50 border-slate-200 dark:bg-slate-900/40 dark:border-slate-850 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`p-1.5 rounded-lg ${chan.enabled ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-600' : 'bg-slate-200/50 text-slate-500 dark:bg-slate-800'}`}>
                        {chan.icon}
                      </span>
                      <span className={`text-xs font-bold ${chan.enabled ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                        {chan.name}
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleChannel(chan.id)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        chan.enabled 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                          : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {chan.enabled ? 'Enabled ✓' : 'Muted'}
                    </button>
                  </div>

                  {/* Volume Sliders */}
                  {chan.enabled && (
                    <div className="space-y-2.5 animate-slide-down">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-medium text-slate-400">
                          <span>Channel Gain</span>
                          <span className="font-mono">{chan.volume}%</span>
                        </div>
                        <input 
                          type="range"
                          min="0"
                          max="100"
                          value={chan.volume}
                          onChange={(e) => handleVolumeChange(chan.id, parseInt(e.target.value))}
                          className="w-full accent-blue-500 bg-slate-200 dark:bg-slate-800 h-1 rounded-lg cursor-pointer appearance-none"
                        />
                      </div>

                      {/* Unique Modulation Parameter Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-medium text-slate-400">
                          <span>{chan.paramName}</span>
                          <span className="font-mono">{chan.paramValue}%</span>
                        </div>
                        <input 
                          type="range"
                          min="0"
                          max="100"
                          value={chan.paramValue}
                          onChange={(e) => handleParamValueChange(chan.id, parseInt(e.target.value))}
                          className="w-full accent-blue-500 bg-slate-200 dark:bg-slate-800 h-1 rounded-lg cursor-pointer appearance-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
