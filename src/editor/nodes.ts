import Konva from 'konva';
import {
  HIGHLIGHT_OPACITY,
  REDACT_FILL,
  contrastOn,
  fontStack,
  type Annotation,
} from './model';
import { renderRedaction } from './redaction';

/** Único constructor de nodos: lo usan la vista y la exportación, para que ambas dibujen igual. */
export function createNode(
  a: Annotation,
  source: ImageBitmap,
): Konva.Shape | Konva.Group {
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
    case 'line':
      return new Konva.Line({
        ...common,
        points: [a.x1, a.y1, a.x2, a.y2],
        stroke: a.color,
        strokeWidth: a.strokeWidth,
        lineCap: 'round',
        hitStrokeWidth: Math.max(a.strokeWidth, 18),
      });
    case 'ellipse':
      // Konva.Ellipse se centra; el modelo guarda la caja envolvente, así que se desplaza con offset.
      return new Konva.Ellipse({
        ...common,
        x: a.x + a.width / 2,
        y: a.y + a.height / 2,
        radiusX: Math.max(a.width / 2, 0.5),
        radiusY: Math.max(a.height / 2, 0.5),
        stroke: a.color,
        strokeWidth: a.strokeWidth,
        hitStrokeWidth: Math.max(a.strokeWidth, 14),
      });
    case 'highlight':
      return new Konva.Rect({
        ...common,
        x: a.x,
        y: a.y,
        width: a.width,
        height: a.height,
        fill: a.color,
        opacity: HIGHLIGHT_OPACITY,
      });
    case 'step': {
      const group = new Konva.Group({ ...common, x: a.x, y: a.y });
      group.add(
        new Konva.Circle({
          radius: a.radius,
          fill: a.color,
          stroke: contrastOn(a.color),
          strokeWidth: Math.max(1, a.radius / 10),
        }),
        new Konva.Text({
          text: String(a.number),
          fontSize: a.radius * (a.number > 9 ? 1.0 : 1.2),
          fontStyle: 'bold',
          fontFamily: fontStack('sans'),
          fill: contrastOn(a.color),
          width: a.radius * 2,
          height: a.radius * 2,
          offsetX: a.radius,
          offsetY: a.radius,
          align: 'center',
          verticalAlign: 'middle',
        }),
      );
      return group;
    }
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
