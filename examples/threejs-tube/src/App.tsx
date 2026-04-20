import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useState } from 'react'
import { MorphingTube } from './Scene'

export const App = (): React.ReactElement => {
  const [seed, setSeed] = useState(0)
  const [animating, setAnimating] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [manualT, setManualT] = useState(0.5)
  const [splitRatio, setSplitRatio] = useState(0.5)
  const [splitOffset, setSplitOffset] = useState(0)
  const [showSplit, setShowSplit] = useState(true)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <Canvas camera={{ position: [0, 2, 8], fov: 45 }}>
        <color attach="background" args={['#0b0d12']} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <MorphingTube
          seed={seed}
          animating={animating}
          speed={speed}
          manualT={manualT}
          splitRatio={splitRatio}
          splitOffset={splitOffset}
          showSplit={showSplit}
        />
        <OrbitControls enablePan={false} />
      </Canvas>

      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 1,
          maxWidth: 360,
          color: '#eaeaea',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <h1 style={{ margin: '0 0 4px', fontSize: 18 }}>bezier-kit: threejs-tube</h1>
        <p style={{ margin: 0, color: '#9aa1ae', fontSize: 13 }}>
          Build a curve from random 3D points with <code>fromCatmullRom</code>, morph it with{' '}
          <code>createPathInterpolator</code>, and render halves from <code>createPathSplitter</code> as a color-coded
          tube.
        </p>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 1,
          width: 280,
          color: '#eaeaea',
          background: 'rgba(20, 24, 33, 0.9)',
          padding: 16,
          borderRadius: 12,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: 13,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={animating} onChange={(e) => setAnimating(e.target.checked)} />
          <span>
            <strong>Animate</strong>
          </span>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>
            Speed: <code>{speed.toFixed(2)}x</code>
          </span>
          <input
            type="range"
            min="0"
            max="3"
            step="0.05"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            disabled={!animating}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>
            Manual <code>t</code>: <code>{manualT.toFixed(3)}</code>
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={manualT}
            onChange={(e) => setManualT(Number(e.target.value))}
            disabled={animating}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>
            Split <code>ratio</code>: <code>{splitRatio.toFixed(3)}</code>
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={splitRatio}
            onChange={(e) => setSplitRatio(Number(e.target.value))}
            disabled={!showSplit}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>
            Split offset: <code>{splitOffset.toFixed(2)}</code>
          </span>
          <input
            type="range"
            min="0"
            max="3"
            step="0.01"
            value={splitOffset}
            onChange={(e) => setSplitOffset(Number(e.target.value))}
            disabled={!showSplit}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={showSplit} onChange={(e) => setShowSplit(e.target.checked)} />
          <span>
            Split with <code>createPathSplitter</code>
          </span>
        </label>

        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          style={{
            padding: '10px 16px',
            background: '#4ecdc4',
            color: '#101319',
            border: 'none',
            borderRadius: 8,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Randomize
        </button>

        <div style={{ color: '#8b92a4', lineHeight: 1.6 }}>
          <div>
            <span style={{ color: '#e94560' }}>■</span> split first half / <span style={{ color: '#5bc0be' }}>■</span>{' '}
            split second half / <span style={{ color: '#66d9ef' }}>■</span> unsplit
          </div>
          <div>Drag to orbit · Scroll to zoom</div>
        </div>
      </div>
    </div>
  )
}
