if ($($(".widgetCustomHtml").find("textarea")[0]).length) {
  $($(".widgetCustomHtml").find("textarea")[0]).text(`\
<style>
  /* CP icon */
  .cpBylineIconTS {
    color: #fff;
  }
  /* CP Text */
  .cpBylineTextTS,
  .cpBylineTextTS a:link {
    color: #fff;
  }

  .cpBylineTS {
    text-align: center;
  }
  
  .cpBylineIconTS {
    fill: currentColor;
    width: 39px;
    height: 26px;
    display: inline;
    vertical-align: middle;
  }
</style>

<div class="widgetItem cpBylineTS">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="cpBylineIconTS">
    <path class="c" d="M73.4,23.2h-19v16.7h19c2.8,0,5,2.2,5,5c0,2.8-2.2,5-5,5h-19v28.4h5.5l11.3-11.7h2.2c11.9,0,21.6-9.7,21.6-21.6C95,33,85.3,23.2,73.4,23.2"/>
    <path class="p" d="M45.8,66.5H26.6C14.7,66.5,5,56.8,5,44.9C5,33,14.7,23.2,26.6,23.2h19.1v16.7H26.6c-2.8,0-5,2.2-5,5c0,2.8,2.2,5,5,5h19.1V66.5z"/>
  </svg>
  <span class="cpBylineTextTS">Government Websites by <a href="https://connect.civicplus.com/referral">CivicPlus&reg;</a></span>
</div>
`);

  setTimeout(function() {
    $(".saveCustomHtmlContent").click();
  }, 500);
} else {
  alert(
    "You must place a Custom HTML widget where you would like the byline to appear. Once the widget is placed, run this tool again to insert the code."
  );
}
