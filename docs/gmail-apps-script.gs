/**
 * Sức Trẻ transactional mail gateway.
 * Deploy as Web app: Execute as Me; Who has access: Anyone.
 * In Project Settings > Script Properties, add GMAIL_SCRIPT_SECRET (32+ random chars).
 * Do not store secret in source code and do not share the Web app URL publicly.
 * Website Cloudflare Worker must set EMAIL_PROVIDER=gmail_script,
 * GMAIL_SCRIPT_URL=<web app /exec URL>, GMAIL_SCRIPT_SECRET=<matching secret>.
 */
function doPost(e) {
  const result = (data) => ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  try {
    if (!e || !e.postData || !e.postData.contents || e.postData.contents.length > 12000)
      return result({ok:false, error:'invalid_request'});
    const request = JSON.parse(e.postData.contents);
    const expected = PropertiesService.getScriptProperties().getProperty('GMAIL_SCRIPT_SECRET');
    if (!expected || expected.length < 32 || request.secret !== expected)
      return result({ok:false, error:'unauthorized'});
    const to = String(request.to || '').trim();
    const subject = String(request.subject || '').trim();
    const body = String(request.body || '').trim();
    const id = String(request.id || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 160 ||
        !subject || subject.length > 180 || !body || body.length > 8000 ||
        !/^[a-zA-Z0-9:_-]{8,160}$/.test(id))
      return result({ok:false, error:'invalid_message'});
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return result({ok:false, error:'busy'});
    try {
      // Google Apps Script cache is best-effort deduplication, not guaranteed exactly-once delivery.
      const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,id)
        .map(x => ('0'+(x & 255).toString(16)).slice(-2)).join('');
      const cache = CacheService.getScriptCache();
      if (cache.get(digest)) return result({ok:true, id:id});
      MailApp.sendEmail({to, subject, body, name:'CLB Sức Trẻ', noReply:false});
      cache.put(digest,'sent',21600);
      return result({ok:true,id});
    } finally {lock.releaseLock();}
  } catch (err) {
    // Never return exception details or the recipient to the caller.
    return result({ok:false, error:'delivery_failed'});
  }
}
