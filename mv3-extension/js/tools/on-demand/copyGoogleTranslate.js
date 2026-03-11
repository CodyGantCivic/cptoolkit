// CSP FIX: Removed inline script injection - just use direct console.log
console.log("[CPToolbox] Google Translate Script Copied to Clipboard");

var MobileGoogleTranslateScript = `
<!----------Google Translate (Mobile Friendly)--------->

<style>
  #google-translate-container {
    float: right;
    padding: 3px 5px 0px 0px;
    position: fixed; 
    bottom: 16px; 
    right: 10px; 
    z-index: 5;
  }
  
  .goog-te-combo, .goog-te-banner *, .goog-te-ftab *, .goog-te-menu *, .goog-te-menu2 *, .goog-te-balloon * {
    font-family: arial;
    font-size: 10pt;
    background-image: url("https://www.gstatic.com/images/branding/product/2x/translate_24dp.png");
    background-position: 5px 5px;
    background-size: 18px;
    background-repeat: no-repeat;
    text-indent: 16px;
    background-color: #fff;
    color: #000 !important;
  }
  
  .goog-logo-link {
    display: none !important;
  }
  
  .goog-te-gadget {
    color: transparent !important;
  }
  
  .goog-te-gadget .goog-te-combo {
    margin: 2px 0 !important;
    border-radius: 15px !important;
    }
  
  .goog-te-combo{
    border: 1px solid !important;
    border-color: #bcc9d7 #96a3b1 #96a3b1 #bcc9d7 !important;
    border-radius: 50px !important;
    height:31px !important;
    padding: 0 1px 0 .25rem !important;
                width: 156px;
  }

  #launcher-wrapper {
    bottom: 50px !important;
  }

</style>

<div id="google-translate-container">
  <div id="google_translate_element">
  </div>
</div>

<script>

  function googleTranslateElementInit() {
    new google.translate.TranslateElement({ pageLanguage: "en" }, "google_translate_element");
    // begin accessibility compliance
    $('img.goog-te-gadget-icon').attr('alt','Google Translate');
    $('div#goog-gt-tt div.logo img').attr('alt','translate');
    $('div#goog-gt-tt .original-text').css('text-align','left');
    $('.goog-te-gadget-simple .goog-te-menu-value span').css('color','#000000');
    $('.goog-te-combo').attr('aria-label','google translate languages');
    $('svg.goog-te-spinner').attr('title','Google Translate Spinner');
    $('.goog-te-gadget-simple .goog-te-menu-value span').css('color','#000000');
  }

  $(function() {
    $.getScript("//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit");
  });

</script>

<!--------------End Google Translate----------------->
`;

// Use modern clipboard API with fallback
if (navigator.clipboard && navigator.clipboard.writeText) {
  navigator.clipboard.writeText(MobileGoogleTranslateScript).then(function() {
    alert("[CPToolbox] Google Translate Script Copied to Clipboard");
  }).catch(function() {
    fallbackCopy(MobileGoogleTranslateScript);
  });
} else {
  fallbackCopy(MobileGoogleTranslateScript);
}

function fallbackCopy(text) {
  var input = document.createElement("textarea");
  input.style.position = "fixed";
  input.style.opacity = 0;
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand("Copy");
  document.body.removeChild(input);
  alert("[CPToolbox] Google Translate Script Copied to Clipboard");
}
