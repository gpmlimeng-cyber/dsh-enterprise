/**
 * [INPUT]: 依赖生成的配方上传序列化 helper 与浏览器 FormData 行为。
 * [OUTPUT]: 锁定 .dshpreset 上传保持 File 本体，metadata 以 application/json Blob 发送。
 * [POS]: features/presets 的 Spring RequestPart 契约门禁。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest';
import { serializePresetUpload } from './preset-management-page';

describe('serializePresetUpload', () => {
  it('keeps the binary artifact and optional metadata JSON part', () => {
    const artifact = new File([new Uint8Array([1, 2, 3])], 'weekly.dshpreset', { type: 'application/vnd.dsh.preset+zip' });
    const body = serializePresetUpload({
      artifact,
      metadata: { displayName: '周报整理', description: 'demo' }
    });
    expect(body.get('artifact')).toBe(artifact);
    const metadata = body.get('metadata');
    expect(metadata).toBeInstanceOf(Blob);
    expect((metadata as Blob).type).toBe('application/json');
  });

  it('omits metadata when the admin does not override manifest fields', () => {
    const artifact = new File([new Uint8Array([1])], 'a.dshpreset');
    const body = serializePresetUpload({ artifact });
    expect(body.get('metadata')).toBeNull();
    expect(body.get('artifact')).toBe(artifact);
  });
});
