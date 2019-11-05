var cookieName = "GiantSwarmPrivacy";
var cookiePath = "/";


// when not on 'localhost', make this a domain-wide cookie
// even when on blog, docs etc. subdomain.
var cookieDomain = (location.hostname == "localhost" ? "localhost" : "giantswarm.io");
var cookieSecure = (location.protocol == "https:");

/*\
|*|
|*|  :: cookies.js ::
|*|
|*|  A complete cookies reader/writer framework with full unicode support.
|*|
|*|  Revision #3 - July 13th, 2017
|*|
|*|  https://developer.mozilla.org/en-US/docs/Web/API/document.cookie
|*|  https://developer.mozilla.org/User:fusionchess
|*|  https://github.com/madmurphy/cookies.js
|*|
|*|  This framework is released under the GNU Public License, version 3 or later.
|*|  http://www.gnu.org/licenses/gpl-3.0-standalone.html
|*|
|*|  Syntaxes:
|*|
|*|  * docCookies.setItem(name, value[, end[, path[, domain[, secure]]]])
|*|  * docCookies.getItem(name)
|*|  * docCookies.removeItem(name[, path[, domain]])
|*|  * docCookies.hasItem(name)
|*|  * docCookies.keys()
|*|
\*/
var docCookies = {
  getItem: function (sKey) {
    if (!sKey) { return null; }
    return decodeURIComponent(document.cookie.replace(new RegExp("(?:(?:^|.*;)\\s*" + encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*([^;]*).*$)|^.*$"), "$1")) || null;
  },
  setItem: function (sKey, sValue, vEnd, sPath, sDomain, bSecure) {
    if (!sKey || /^(?:expires|max\-age|path|domain|secure)$/i.test(sKey)) { return false; }
    var sExpires = "";
    if (vEnd) {
      switch (vEnd.constructor) {
        case Number:
          sExpires = vEnd === Infinity ? "; expires=Fri, 31 Dec 9999 23:59:59 GMT" : "; max-age=" + vEnd;
          /*
          Note: Despite officially defined in RFC 6265, the use of `max-age` is not compatible with any
          version of Internet Explorer, Edge and some mobile browsers. Therefore passing a number to
          the end parameter might not work as expected. A possible solution might be to convert the the
          relative time to an absolute time. For instance, replacing the previous line with:
          */
          /*
          sExpires = vEnd === Infinity ? "; expires=Fri, 31 Dec 9999 23:59:59 GMT" : "; expires=" + (new Date(vEnd * 1e3 + Date.now())).toUTCString();
          */
          break;
        case String:
          sExpires = "; expires=" + vEnd;
          break;
        case Date:
          sExpires = "; expires=" + vEnd.toUTCString();
          break;
      }
    }
    document.cookie = encodeURIComponent(sKey) + "=" + encodeURIComponent(sValue) + sExpires + (sDomain ? "; domain=" + sDomain : "") + (sPath ? "; path=" + sPath : "") + (bSecure ? "; secure" : "");
    return true;
  },
  removeItem: function (sKey, sPath, sDomain) {
    if (!this.hasItem(sKey)) { return false; }
    document.cookie = encodeURIComponent(sKey) + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT" + (sDomain ? "; domain=" + sDomain : "") + (sPath ? "; path=" + sPath : "");
    return true;
  },
  hasItem: function (sKey) {
    if (!sKey || /^(?:expires|max\-age|path|domain|secure)$/i.test(sKey)) { return false; }
    return (new RegExp("(?:^|;\\s*)" + encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=")).test(document.cookie);
  },
  keys: function () {
    var aKeys = document.cookie.replace(/((?:^|\s*;)[^\=]+)(?=;|$)|^\s*|\s*(?:\=[^;]*)?(?:\1|$)/g, "").split(/\s*(?:\=[^;]*)?;\s*/);
    for (var nLen = aKeys.length, nIdx = 0; nIdx < nLen; nIdx++) { aKeys[nIdx] = decodeURIComponent(aKeys[nIdx]); }
    return aKeys;
  }
};

/**
 * Reads the user's privacy preferences from the cookie, if given,
 * writes them to the global variable, and returns true if settings
 * are given or false if they are not.
 */
function readPrivacyPreferences() {
  var cookie = docCookies.getItem(cookieName);
  
  if (cookie !== null) {
    window.GiantSwarmPrivacy = JSON.parse(cookie);
    return true;
  }

  return false;
}

/**
 * Will allow the user to decline the use of third party resources and tracking.
 * Stores the information long-term in a domain cookie.
 * 
 * If the cookie was available already, stores the cookie's data in a global
 * variable window.GiantSwarmPrivacy.
 */
function requestConsent() {
  var hasPrefs = readPrivacyPreferences();
  if (!hasPrefs) {
    showConsentDialog();
    return;
  }
}

/**
 * The user has accepted third party resources and tracking.
 * Store this information in the cookie.
 */
function handleConsentAccept() {
  var value = {"consent": true};
  var expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

  window.GiantSwarmPrivacy = value;
  docCookies.setItem(cookieName, JSON.stringify(value), expiry, cookiePath, cookieDomain, cookieSecure);

  $('#consent_dialog').remove();

  return false;
}

/**
 * The user has expressed that she/he does NOT want third party
 * cookies or tracking. Store this as session cookie,
 * and reload the page.
 */
function handleConsentDecline() {
  var value = {"consent": false};
  var expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

  docCookies.setItem(cookieName, JSON.stringify(value), expiry, cookiePath, cookieDomain, cookieSecure);

  $('#consent_dialog').hide();

  // reload the page to enforce rebuild without tracking resources
  location.reload();

  return false;
}

function showConsentDialog() {
  $('#consent_dialog .accept').click(handleConsentAccept);
  $('#consent_dialog .decline').click(handleConsentDecline);
  $('#consent_dialog').show();
}

/**
 * Add tracking to the page, if user has not declined
 */
function addTracking() {
  // exit early if consent declined
  if (typeof window.GiantSwarmPrivacy !== "undefined" && window.GiantSwarmPrivacy.consent === false) return;

  // Google Analytics
  (function(i, s, o, g, r, a, m){
    i['GoogleAnalyticsObject'] = r;
    i[r] = i[r] || function(){
      (i[r].q = i[r].q || []).push(arguments)
    }, i[r].l=1*new Date();
    a = s.createElement(o), m = s.getElementsByTagName(o)[0];
    a.async = 1;
    a.src = g;
    m.parentNode.insertBefore(a,m);
  })(window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga');
  ga('create', window.GiantSwarmGoogleAnalyticsAccount, 'auto');
  ga('set', 'anonymizeIp', true);
  ga('send', 'pageview');

  // Hubspot  
  $('body').append('<script type="text/javascript" id="hs-script-loader" async defer src="//js.hs-scripts.com/'+ window.GiantSwarmHubspotAccount +'.js"></script>');

  // Google Adwords
  $('body').append('<script async src="https://www.googletagmanager.com/gtag/js?id=AW-959283149"></script>');
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-959283149');
  // End Google Adwords
}

$( document ).ready(function() {
  // ask for consent if not yet done
  // and set privacy settings.
  // Caution: This must happen before relying on privacy settings!
  requestConsent();

  // add page tracking (unless disallowed)
  addTracking();
});
