import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findDropZone, type Rect } from './drop-zone.ts';

// İki kutu yan yana, aralarında 8 piksel boşluk var.
const zones = new Map<string, Rect>([
  ['cell-0', { x: 0, y: 0, width: 80, height: 80 }],
  ['cell-1', { x: 88, y: 0, width: 80, height: 80 }],
]);

describe('bırakma alanı', () => {
  it('yumurtanın ortası kutunun içindeyse o kutu seçilir', () => {
    assert.equal(findDropZone(zones, 120, 40), 'cell-1');
  });

  it('kutular arasındaki boşluğa bırakılınca en yakın kutu seçilir', () => {
    assert.equal(findDropZone(zones, 86, 40), 'cell-1');
    assert.equal(findDropZone(zones, 82, 40), 'cell-0');
  });

  it('kutunun biraz dışına bırakılınca yine o kutu seçilir', () => {
    assert.equal(findDropZone(zones, 120, 110), 'cell-1');
  });

  it('hiçbir kutuya yakın değilse null döner', () => {
    assert.equal(findDropZone(zones, 120, 200), null);
  });
});
