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

function ImageNodeComponent({ id, data, selected }: NodeProps & { data: ImageNodeData }) {
  const imageData = data as ImageNodeData;
  const { assetHash, width, height, aspectRatio, alt } = imageData;
  const url = useCanvasAssetUrl(assetHash);

  return (
    <div style={{ width, height }} className="relative">
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
