import { describe, expect, it } from 'vitest';
import { getSiteContentFlags } from './siteContent';

// "a nav link (or a whole page) only appears when the owner has both
// turned it on AND filled in real content, not one without the other" -
// the two real failure modes worth checking are a toggle turned on with
// nothing behind it (a blank About page/nav link) and content that
// exists but is toggled off.
function business(overrides: Partial<Parameters<typeof getSiteContentFlags>[0]> = {}) {
  return {
    about_text: null,
    gallery_urls: null,
    contact_phone: null,
    contact_email: null,
    instagram_url: null,
    facebook_url: null,
    show_about: false,
    show_gallery: false,
    show_contact: false,
    ...overrides,
  };
}

describe('getSiteContentFlags', () => {
  it('showAbout is false when toggled on but no about_text is set - never show a blank page', () => {
    const result = getSiteContentFlags(business({ show_about: true, about_text: null }));
    expect(result.showAbout).toBe(false);
  });

  it('showAbout is false when there is real text but the owner has it toggled off', () => {
    const result = getSiteContentFlags(business({ show_about: false, about_text: 'We are a salon.' }));
    expect(result.showAbout).toBe(false);
  });

  it('showAbout is true only when both toggled on AND real text exists', () => {
    const result = getSiteContentFlags(business({ show_about: true, about_text: 'We are a salon.' }));
    expect(result.showAbout).toBe(true);
  });

  it('parses gallery_urls into a trimmed, blank-line-filtered list of image urls', () => {
    const result = getSiteContentFlags(business({ gallery_urls: '  https://x/1.jpg  \n\nhttps://x/2.jpg\n' }));
    expect(result.galleryImages).toEqual(['https://x/1.jpg', 'https://x/2.jpg']);
  });

  it('showGallery requires the toggle on AND at least one real image', () => {
    expect(getSiteContentFlags(business({ show_gallery: true, gallery_urls: null })).showGallery).toBe(false);
    expect(getSiteContentFlags(business({ show_gallery: false, gallery_urls: 'https://x/1.jpg' })).showGallery).toBe(false);
    expect(getSiteContentFlags(business({ show_gallery: true, gallery_urls: 'https://x/1.jpg' })).showGallery).toBe(true);
  });

  it('showContact is true when toggled on and ANY one contact field is filled in, not all of them', () => {
    expect(getSiteContentFlags(business({ show_contact: true, instagram_url: 'https://instagram.com/x' })).showContact).toBe(true);
  });

  it('showContact is false when toggled on but every contact field is empty', () => {
    expect(getSiteContentFlags(business({ show_contact: true })).showContact).toBe(false);
  });
});
