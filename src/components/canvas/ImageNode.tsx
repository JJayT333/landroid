/**
 * Canvas image node. Renders a content-addressed asset (referenced by hash)
 * via the asset-URL cache. Resizable with aspect-ratio lock; the binary lives
 * in the canvasAssets store, so the node itself carries only a hash + size.
 */
import { memo } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { ImageNodeData } from '../../types/flowchart';
import { useCanvasAssetUrl } from './canvas-asset-url-cache';
import CanvasNodeToolbar from './CanvasNodeToolbar';

function ImageNodeComponent({ id, data, selected, width, height }: NodeProps & { data: ImageNodeData }) {
  const imageData = data as ImageNodeData;
  const { assetHash, aspectRatio, alt } = imageData;
  const url = useCanvasAssetUrl(assetHash);
  // NodeResizer drives node.width/height; fall back to the initial data size.
  const w = typeof width === 'number' ? width : imageData.width;
  const h = typeof height === 'number' ? height : imageData.height;

  return (
    <div style={{ width: w, height: h }} className="relative">
      <CanvasNodeToolbar nodeId={id} isVisible={!!selected} />
      <NodeResizer
        isVisible={selected}
        minWidth={40}
        minHeight={40}
        keepAspectRatio={!!aspectRatio}
        lineClassName="!border-leather"
        handleClassName="!bg-leather !w-2 !h-2"
      />
      <Handle type="target" position={Position.Top} className="!bg-leather !w-2 !h-2" />

      <div
        className={`w-full h-full overflow-hidden rounded-sm border ${
          selected ? 'border-leather' : 'border-ledger-line'
        }`}
      >
        {url ? (
          <img
            src={url}
            alt={alt ?? 'Canvas image'}
            draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-parchment-dark text-ink-light text-xs">
            Image unavailable
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-leather !w-2 !h-2" />
    </div>
  );
}

export default memo(ImageNodeComponent);
