(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LANDroidDropboxIntegration = factory();
  }
})(typeof self !== 'undefined' ? self : globalThis, function () {
  const DROPBOX_FEATURE_FLAG_KEY = 'landroid:feature:dropboxAttachments';

  function isDropboxFeatureEnabled() {
    try {
      return localStorage.getItem(DROPBOX_FEATURE_FLAG_KEY) === '1';
    } catch (_error) {
      return false;
    }
  }

  function normalizeAttachmentMetadata(attachment) {
    if (!attachment || typeof attachment !== 'object') return null;

    const normalized = {
      dropbox_file_id: attachment.dropbox_file_id || attachment.file_id || null,
      dropbox_path_display: attachment.dropbox_path_display || attachment.path_display || null,
      rev: attachment.rev || null,
      shared_link: attachment.shared_link || null,
    };

    if (!normalized.dropbox_file_id && !normalized.dropbox_path_display && !normalized.rev && !normalized.shared_link) {
      return null;
    }

    return normalized;
  }

  return {
    DROPBOX_FEATURE_FLAG_KEY,
    isDropboxFeatureEnabled,
    normalizeAttachmentMetadata,
  };
});
