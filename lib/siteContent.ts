// Shared "does this section actually have anything to show" logic — a nav
// link (or a whole page) only appears when the owner has both turned it on
// AND filled in real content, not one without the other.
export function getSiteContentFlags(business: {
  about_text: string | null;
  gallery_urls: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  show_about: boolean;
  show_gallery: boolean;
  show_contact: boolean;
}) {
  const galleryImages = (business.gallery_urls ?? '')
    .split('\n')
    .map((u) => u.trim())
    .filter(Boolean);

  const hasContact = Boolean(
    business.contact_phone || business.contact_email || business.instagram_url || business.facebook_url
  );

  return {
    galleryImages,
    showAbout: business.show_about && Boolean(business.about_text),
    showGallery: business.show_gallery && galleryImages.length > 0,
    showContact: business.show_contact && hasContact,
  };
}
