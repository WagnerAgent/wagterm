import React, { useState } from 'react';
import { Dithering } from '@paper-design/shaders-react';
import WagtermLogo from '../../assets/wagterm_logo.svg';
import WagtermIcon from '../../assets/wagterm_icon.svg';

type DitheringShape = 'simplex' | 'warp' | 'dots' | 'wave' | 'ripple' | 'swirl' | 'sphere';
type DitheringType = 'random' | '2x2' | '4x4' | '8x8';

const DitheringLogoDemo = () => {
  const [shape, setShape] = useState<DitheringShape>('simplex');
  const [type, setType] = useState<DitheringType>('4x4');
  const [size, setSize] = useState(1);
  const [speed, setSpeed] = useState(0.05);
  const [scale, setScale] = useState(2.0);
  const [colorBack, setColorBack] = useState('#cccccc');
  const [colorFront, setColorFront] = useState('#ffffff');
  const [opacity, setOpacity] = useState(1.0);

  const shapes: DitheringShape[] = ['simplex', 'warp', 'dots', 'wave', 'ripple', 'swirl', 'sphere'];
  const types: DitheringType[] = ['random', '2x2', '4x4', '8x8'];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Wagterm Logo Dithering Effect</h1>
      <p className="text-muted-foreground">The dithering pattern fills the logo shape - the letters and icon act as masks.</p>

      {/* Controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-card rounded-lg border border-border">
        <div>
          <label className="block text-sm font-medium mb-1">Pattern</label>
          <select
            value={shape}
            onChange={(e) => setShape(e.target.value as DitheringShape)}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
          >
            {shapes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Dither Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as DitheringType)}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
          >
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Pixel Size ({size})</label>
          <input
            type="range"
            min="1"
            max="10"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Speed ({speed.toFixed(2)})</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Scale ({scale.toFixed(2)})</label>
          <input
            type="range"
            min="0.1"
            max="4"
            step="0.1"
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Background</label>
          <input
            type="color"
            value={colorBack}
            onChange={(e) => setColorBack(e.target.value)}
            className="w-full h-9 rounded-md cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Foreground</label>
          <input
            type="color"
            value={colorFront}
            onChange={(e) => setColorFront(e.target.value)}
            className="w-full h-9 rounded-md cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Opacity ({opacity.toFixed(2)})</label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* Main Demo - Full Logo with Dithering Fill */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Full Logo with Dithering Fill</h3>
        <div className="relative w-[355px] h-[88px] rounded-lg overflow-hidden border border-border bg-background">
          <div
            className="absolute inset-0"
            style={{
              WebkitMaskImage: `url(${WagtermLogo})`,
              maskImage: `url(${WagtermLogo})`,
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskPosition: 'center'
            }}
          >
            <Dithering
              style={{ width: '100%', height: '100%', opacity }}
              colorBack={colorBack}
              colorFront={colorFront}
              shape={shape}
              type={type}
              size={size}
              speed={speed}
              scale={scale}
            />
          </div>
        </div>
      </div>

      {/* Icon Only */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Icon Only</h3>
        <div className="flex gap-6">
          {/* Small */}
          <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border bg-background">
            <div
              className="absolute inset-0"
              style={{
                WebkitMaskImage: `url(${WagtermIcon})`,
                maskImage: `url(${WagtermIcon})`,
                WebkitMaskSize: '70%',
                maskSize: '70%',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center'
              }}
            >
              <Dithering
                style={{ width: '100%', height: '100%', opacity }}
                colorBack={colorBack}
                colorFront={colorFront}
                shape={shape}
                type={type}
                size={size}
                speed={speed}
                scale={scale}
              />
            </div>
          </div>

          {/* Medium */}
          <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border bg-background">
            <div
              className="absolute inset-0"
              style={{
                WebkitMaskImage: `url(${WagtermIcon})`,
                maskImage: `url(${WagtermIcon})`,
                WebkitMaskSize: '70%',
                maskSize: '70%',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center'
              }}
            >
              <Dithering
                style={{ width: '100%', height: '100%', opacity }}
                colorBack={colorBack}
                colorFront={colorFront}
                shape={shape}
                type={type}
                size={size}
                speed={speed}
                scale={scale}
              />
            </div>
          </div>

          {/* Large */}
          <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-border bg-background">
            <div
              className="absolute inset-0"
              style={{
                WebkitMaskImage: `url(${WagtermIcon})`,
                maskImage: `url(${WagtermIcon})`,
                WebkitMaskSize: '70%',
                maskSize: '70%',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center'
              }}
            >
              <Dithering
                style={{ width: '100%', height: '100%', opacity }}
                colorBack={colorBack}
                colorFront={colorFront}
                shape={shape}
                type={type}
                size={size}
                speed={speed}
                scale={scale}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Preview */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Sidebar Preview</h3>
        <div className="w-60 border border-border rounded-lg bg-card p-6">
          <div className="relative h-10">
            <div
              className="absolute inset-0"
              style={{
                WebkitMaskImage: `url(${WagtermLogo})`,
                maskImage: `url(${WagtermLogo})`,
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'left center',
                maskPosition: 'left center'
              }}
            >
              <Dithering
                style={{ width: '100%', height: '100%', opacity }}
                colorBack={colorBack}
                colorFront={colorFront}
                shape={shape}
                type={type}
                size={size}
                speed={speed}
                scale={scale}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Presets */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Soft & Readable Presets</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setShape('simplex'); setType('4x4'); setSize(1); setSpeed(0.05); setScale(2); setColorBack('#cccccc'); setColorFront('#ffffff'); setOpacity(1); }}
            className="px-3 py-1.5 text-xs bg-card border border-border rounded-md hover:bg-accent"
          >
            Subtle White
          </button>
          <button
            onClick={() => { setShape('warp'); setType('4x4'); setSize(1); setSpeed(0.03); setScale(1.5); setColorBack('#e0e0e0'); setColorFront('#ffffff'); setOpacity(1); }}
            className="px-3 py-1.5 text-xs bg-card border border-border rounded-md hover:bg-accent"
          >
            Soft Glow
          </button>
          <button
            onClick={() => { setShape('simplex'); setType('8x8'); setSize(1); setSpeed(0.02); setScale(3); setColorBack('#b8b8b8'); setColorFront('#f5f5f5'); setOpacity(0.9); }}
            className="px-3 py-1.5 text-xs bg-card border border-border rounded-md hover:bg-accent"
          >
            Gentle
          </button>
          <button
            onClick={() => { setShape('wave'); setType('4x4'); setSize(1); setSpeed(0.04); setScale(2); setColorBack('#d4e5f7'); setColorFront('#ffffff'); setOpacity(1); }}
            className="px-3 py-1.5 text-xs bg-card border border-border rounded-md hover:bg-accent"
          >
            Ice
          </button>
          <button
            onClick={() => { setShape('dots'); setType('4x4'); setSize(1); setSpeed(0.08); setScale(1.2); setColorBack('#c9c9c9'); setColorFront('#ffffff'); setOpacity(0.85); }}
            className="px-3 py-1.5 text-xs bg-card border border-border rounded-md hover:bg-accent"
          >
            Minimal
          </button>
          <button
            onClick={() => { setShape('simplex'); setType('4x4'); setSize(1); setSpeed(0); setScale(2); setColorBack('#dddddd'); setColorFront('#ffffff'); setOpacity(1); }}
            className="px-3 py-1.5 text-xs bg-card border border-border rounded-md hover:bg-accent"
          >
            Static
          </button>
        </div>
        <h3 className="text-sm font-medium text-muted-foreground mt-4">Bold Presets</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setShape('warp'); setType('4x4'); setSize(2); setSpeed(0.3); setScale(1); setColorBack('#0a0a0a'); setColorFront('#ffffff'); setOpacity(1); }}
            className="px-3 py-1.5 text-xs bg-card border border-border rounded-md hover:bg-accent"
          >
            Classic B&W
          </button>
          <button
            onClick={() => { setShape('simplex'); setType('8x8'); setSize(2); setSpeed(0.15); setScale(0.8); setColorBack('#001100'); setColorFront('#00ff88'); setOpacity(1); }}
            className="px-3 py-1.5 text-xs bg-card border border-border rounded-md hover:bg-accent"
          >
            Matrix
          </button>
          <button
            onClick={() => { setShape('wave'); setType('4x4'); setSize(2); setSpeed(0.1); setScale(1.5); setColorBack('#0a1a2e'); setColorFront('#00b3ff'); setOpacity(1); }}
            className="px-3 py-1.5 text-xs bg-card border border-border rounded-md hover:bg-accent"
          >
            Ocean
          </button>
          <button
            onClick={() => { setShape('swirl'); setType('2x2'); setSize(1); setSpeed(0.08); setScale(2); setColorBack('#1a1500'); setColorFront('#ffd700'); setOpacity(1); }}
            className="px-3 py-1.5 text-xs bg-card border border-border rounded-md hover:bg-accent"
          >
            Gold
          </button>
        </div>
      </div>

      {/* Config Output */}
      <div className="p-4 bg-card rounded-lg border border-border">
        <h3 className="text-sm font-medium mb-2">Current Configuration</h3>
        <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
{`<Dithering
  style={{ opacity: ${opacity} }}
  colorBack="${colorBack}"
  colorFront="${colorFront}"
  shape="${shape}"
  type="${type}"
  size={${size}}
  speed={${speed}}
  scale={${scale}}
/>`}
        </pre>
      </div>
    </div>
  );
};

export default DitheringLogoDemo;
