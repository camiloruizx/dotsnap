import Konva from 'konva';
import { REDACT_FILL, fontStack, type Annotation } from './model';
import { renderRedaction } from './redaction';

/** Único constructor de nodos: lo usan la vista y la exportación, para que ambas dibujen igual. */
export function createNode(a: Annotation, source: ImageBitmap): Konva.Shape {
  const common = { id: a.id, name: 'annotation' };
  switch (a.type) {
    case 'arrow':
      return new Konva.Arrow({
        ...common,
        points: [a.x1, a.y1, a.x2, a.y2],
        stroke: a.color,
        fill: a.color,
        strokeWidth: a.strokeWidth,
        pointerLength: a.strokeWidth * 4,
        pointerWidth: a.strokeWidth * 4,
        lineCap: 'round',
        lineJoin: 'round',
        hitStrokeWidth: Math.max(a.strokeWidth, 18),
      });
    case 'rect':
      return new Konva.Rect({
        ...common,
        x: a.x,
        y: a.y,
        width: a.width,
        height: a.height,
        stroke: a.color,
        strokeWidth: a.strokeWidth,
        hitStrokeWidth: Math.max(a.strokeWidth, 14),
        cornerRadius: 0,
      });
    case 'text':
      return new Konva.Text({
        ...common,
        x: a.x,
        y: a.y,
        text: a.text,
        fontSize: a.fontSize,
        fontFamily: fontStack(a.fontFamily),
        lineHeight: 1.2,
        fill: a.color,
      });
    case 'redact':
      if (a.mode !== 'solid' && a.width >= 1 && a.height >= 1)
        return new Konva.Image({
          ...common,
          x: a.x,
          y: a.y,
          width: a.width,
          height: a.height,
          image: renderRedaction(source, a, a.mode),
          opacity: 1,
        });
      return new Konva.Rect({
        ...common,
        x: a.x,
        y: a.y,
        width: a.width,
        height: a.height,
        fill: REDACT_FILL,
        opacity: 1,
      });
  }
}
