/**
 * [INPUT]: 依赖 features/branding 的纯投影 helper 与生成的管理端品牌 DTO。
 * [OUTPUT]: 锁定发布请求只提交白名单字段、空白文案转 null、资产 ID 用字符串，以及全空草稿的前端预判。
 * [POS]: features/branding 的发布请求契约门禁，不启动浏览器与网络。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest';
import type { BrandingBrandingAdminAsset } from '@/api/generated/types.gen';
import { isBrandingDraftEmpty, publishBody } from './branding-management-page';
import type { BrandingDraft } from './branding-editors';

function asset(id: string): BrandingBrandingAdminAsset {
  return {
    id,
    url: `/enterprise/admin/v1/branding/assets/${id}/content`,
    sha256: 'a'.repeat(64),
    contentType: 'image/png',
    width: 512,
    height: 512,
    sizeBytes: 2048
  };
}

const empty: BrandingDraft = {
  name: '',
  shortName: '',
  headline: '',
  editionLabel: '',
  assets: { light: null, dark: null, square: null }
};

describe('publishBody', () => {
  it('keeps only white-listed fields and normalizes blank text to null', () => {
    const body = publishBody({
      ...empty,
      name: '  DSH 企业版  ',
      headline: '探索未至之境',
      editionLabel: '   ',
      assets: { light: asset('101'), dark: null, square: asset('103') }
    });
    expect(body).toEqual({
      name: 'DSH 企业版',
      shortName: null,
      logoLightAssetId: '101',
      logoDarkAssetId: null,
      logoSquareAssetId: '103',
      welcomeHeadline: '探索未至之境',
      welcomeEditionLabel: null
    });
    expect(Object.keys(body).sort()).toEqual([
      'logoDarkAssetId', 'logoLightAssetId', 'logoSquareAssetId',
      'name', 'shortName', 'welcomeEditionLabel', 'welcomeHeadline'
    ].sort());
  });

  it('detects a fully empty draft so publish stays disabled', () => {
    expect(isBrandingDraftEmpty(empty)).toBe(true);
    expect(isBrandingDraftEmpty({ ...empty, editionLabel: '预览版' })).toBe(false);
    expect(isBrandingDraftEmpty({ ...empty, assets: { ...empty.assets, dark: asset('102') } })).toBe(false);
  });
});
