import { useState } from 'react'
import { CanvasMorph } from './CanvasMorph'

export const App = (): React.ReactElement => {
  const [animating, setAnimating] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [manualT, setManualT] = useState(0.5)
  const [seed, setSeed] = useState(0)
  const [splitRatio, setSplitRatio] = useState(0.5)
  const [splitOffset, setSplitOffset] = useState(0)
  const [showSplit, setShowSplit] = useState(true)
  const [showEndpoints, setShowEndpoints] = useState(true)

  return (
    <main style={{ padding: 24, maxWidth: 820, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 8px' }}>bezier-kit: canvas-morph</h1>
      <p style={{ color: '#9aa1ae', marginTop: 0 }}>
        A React + Canvas 2D sample that interpolates two randomly generated <code>BezierPath</code>s with{' '}
        <code>createPathInterpolator</code> and visualizes an arc-length split via <code>createPathSplitter</code> at
        the same time. The two halves are offset vertically to separate them visually.
      </p>

      <CanvasMorph
        animating={animating}
        speed={speed}
        manualT={manualT}
        seed={seed}
        splitRatio={splitRatio}
        splitOffset={splitOffset}
        showSplit={showSplit}
        showEndpoints={showEndpoints}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 16,
          marginTop: 16,
          padding: 16,
          background: '#141821',
          borderRadius: 12,
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, gridColumn: 'span 2' }}>
          <input type="checkbox" checked={animating} onChange={(e) => setAnimating(e.target.checked)} />
          <span>
            <strong>Animate</strong> (uncheck to drive <code>t</code> manually)
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
            Morph <code>t</code>: <code>{manualT.toFixed(3)}</code>
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
            Split offset: <code>{splitOffset.toFixed(0)}px</code>
          </span>
          <input
            type="range"
            min="0"
            max="160"
            step="1"
            value={splitOffset}
            onChange={(e) => setSplitOffset(Number(e.target.value))}
            disabled={!showSplit}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={showSplit} onChange={(e) => setShowSplit(e.target.checked)} />
          <span>
            Split path with <code>createPathSplitter</code>
          </span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={showEndpoints}
            onChange={(e) => setShowEndpoints(e.target.checked)}
            disabled={!showSplit}
          />
          <span>Highlight split point</span>
        </label>

        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          style={{
            gridColumn: 'span 2',
            padding: '10px 16px',
            background: '#4ecdc4',
            color: '#101319',
            border: 'none',
            borderRadius: 8,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Randomize paths
        </button>
      </div>

      <div style={{ marginTop: 16, color: '#707684', fontSize: 13, lineHeight: 1.6 }}>
        <div>
          <span style={{ color: '#4ecdc4' }}>■</span> from (faded) / <span style={{ color: '#f9a826' }}>■</span> to
          (faded) / <span style={{ color: '#e94560' }}>■</span> split first half /{' '}
          <span style={{ color: '#5bc0be' }}>■</span> split second half
        </div>
        <div>
          Segment counts are also random (3–8). <code>matchSegmentCount</code> equalizes them automatically, so{' '}
          <strong>you can interpolate paths with different segment counts</strong>.
        </div>
        <div>
          Split offset shifts each half vertically by half of the offset value (total separation equals the offset).
        </div>
      </div>
    </main>
  )
}
