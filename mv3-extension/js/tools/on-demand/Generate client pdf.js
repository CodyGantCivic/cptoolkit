(function generatePDF() {
  $(document).ready(function() {
    function createClientPDF() {
      let pdf = window.open("", "clientSpecPDF", "width=850,height=1100,scrollbars=1,resizable=1");

      //Create Document
      let clientSpecPDF = pdf.document.createElement("div");
      clientSpecPDF.id = "clientPDF";

      // Title window
      let windowTitle = document.title.split("|")[0] + " - Design Specification";
      let pdfTitle = document.createElement("title");
      pdfTitle.innerHTML = windowTitle;
      clientSpecPDF.appendChild(pdfTitle);

      //Title Document
      let clientSpecTitle = pdf.document.createElement("h1");
      clientSpecTitle.setAttribute("contenteditable", "true");
      let clientName = document.title.replace(/'/gi, "").split("-")[0];
      clientName = clientName.split("|")[0];
      clientSpecTitle.textContent = clientName;
      clientSpecPDF.appendChild(clientSpecTitle);

      // Add link to webpage
      let clientUrl = pdf.document.createElement("a");
      clientUrl.setAttribute("href", document.location.href);
      clientUrl.textContent = "Link to client website...";
      //clientSpecPDF.appendChild(clientUrl);

      //Add Section Header
      let clientColors = pdf.document.createElement("h2");
      clientColors.textContent = "Colors";
      clientColors.setAttribute("contenteditable", "true");
      clientSpecPDF.appendChild(clientColors);

      //Required Functions
      function RGBToHex(r, g, b) {
        var bin = (r << 16) | (g << 8) | b;
        return (function(h) {
          return new Array(7 - h.length).join("0") + h;
        })(bin.toString(16).toUpperCase());
      }

      function allowDrop(ev) {
        ev.preventDefault();
      }

      function drag(ev) {
        ev.dataTransfer.setData("text", ev.target.id);
        console.log("dragging");
      }

      function drop(ev) {
        ev.preventDefault();
        var data = ev.dataTransfer.getData("text");
        ev.target.appendChild(document.getElementById(data));
        console.log("dropped");
      }

      //Add colors
      let clientColor1 = document.createElement("div");
      clientColor1.classList += "color";
      let clientColor1Selector = $("h1");
      console.log(clientColor1Selector);
      if (clientColor1Selector.css("color") == undefined) {
        clientColor1Selector = $("h3");
      }
      let clientColor1Circle = document.createElement("div");
      clientColor1Circle.style.backgroundColor = clientColor1Selector.css("color");
      clientColor1Circle.classList += "colorCircle";
      let clientColor1RBG = document.createElement("p");
      clientColor1RBG.textContent = clientColor1Selector.css("color");
      let clientColor1HEX = document.createElement("p");
      let clientColor1RGBNum = clientColor1Selector
        .css("color")
        .split("(")[1]
        .split(")")[0]
        .split(",");
      clientColor1HEX.textContent = "#" + RGBToHex(clientColor1RGBNum[0], clientColor1RGBNum[1], clientColor1RGBNum[2]);
      let clientColor1Desc = document.createElement("p");
      clientColor1Desc.style.fontWeight = "bold";
      clientColor1Desc.textContent = "Heading Color";
      clientColor1.appendChild(clientColor1Circle);
      clientColor1.appendChild(clientColor1Desc);
      clientColor1.appendChild(clientColor1HEX);
      clientColor1.appendChild(clientColor1RBG);
      clientSpecPDF.appendChild(clientColor1);

      let clientColor2 = document.createElement("div");
      clientColor2.classList += "color";
      let clientColor2Circle = document.createElement("div");
      let clientColor2Selector = $("#moduleContent p");
      console.log(clientColor2Selector);
      if (clientColor2Selector.css("color") == undefined) {
        clientColor2Selector = $("p");
      }
      console.log(clientColor2Selector);
      if (clientColor2Selector.css("color") == undefined) {
        clientColor2Selector = $("body");
      }
      clientColor2Circle.style.backgroundColor = clientColor2Selector.css("color");
      clientColor2Circle.classList += "colorCircle";
      let clientColor2RBG = document.createElement("p");
      clientColor2RBG.textContent = clientColor2Selector.css("color");
      let clientColor2HEX = document.createElement("p");
      let clientColor2RGBNum = clientColor2Selector
        .css("color")
        .split("(")[1]
        .split(")")[0]
        .split(",");
      clientColor2HEX.textContent = "#" + RGBToHex(clientColor2RGBNum[0], clientColor2RGBNum[1], clientColor2RGBNum[2]);
      let clientColor2Desc = document.createElement("p");
      clientColor2Desc.style.fontWeight = "bold";
      clientColor2Desc.textContent = "Text Color";
      clientColor2.appendChild(clientColor2Circle);
      clientColor2.appendChild(clientColor2Desc);
      clientColor2.appendChild(clientColor2HEX);
      clientColor2.appendChild(clientColor2RBG);
      clientSpecPDF.appendChild(clientColor2);

      let clientColor3 = document.createElement("div");
      clientColor3.classList += "color";
      let clientColor3Circle = document.createElement("div");
      let clientColor3Selector = $("#moduleContent a");
      console.log(clientColor3Selector);
      if (clientColor3Selector.css("color") == undefined) {
        clientColor3Selector = $("a");
      }
      console.log(clientColor3Selector);
      clientColor3Circle.style.backgroundColor = clientColor3Selector.css("color");
      clientColor3Circle.classList += "colorCircle";
      let clientColor3RBG = document.createElement("p");
      clientColor3RBG.textContent = clientColor3Selector.css("color");
      let clientColor3HEX = document.createElement("p");
      let clientColor3RGBNum = clientColor3Selector
        .css("color")
        .split("(")[1]
        .split(")")[0]
        .split(",");
      clientColor3HEX.textContent = "#" + RGBToHex(clientColor3RGBNum[0], clientColor3RGBNum[1], clientColor3RGBNum[2]);
      let clientColor3Desc = document.createElement("p");
      clientColor3Desc.style.fontWeight = "bold";
      clientColor3Desc.textContent = "Link Color";
      clientColor3.appendChild(clientColor3Circle);
      clientColor3.appendChild(clientColor3Desc);
      clientColor3.appendChild(clientColor3HEX);
      clientColor3.appendChild(clientColor3RBG);
      clientSpecPDF.appendChild(clientColor3);

      //Add Section Header
      let clientFonts = pdf.document.createElement("h2");
      clientFonts.textContent = "Typefaces";
      clientFonts.setAttribute("contenteditable", "true");
      clientSpecPDF.appendChild(clientFonts);

      //Add Fonts
      let clientFontH3Name = $("h3")
        .css("font-family")
        .replace(/['"]+/g, "")
        .replace(" ", "+");
      let clientFontH3NamePlain = $("h3")
        .css("font-family")
        .replace(/['"]+/g, "");
      let clientFontH3Code = document.createElement("link");
      clientFontH3Code.setAttribute("rel", "stylesheet");
      clientFontH3Code.setAttribute("href", "https://fonts.googleapis.com/css?family=" + clientFontH3Name);
      clientSpecPDF.appendChild(clientFontH3Code);
      let clientFontH3 = document.createElement("H3");
      clientFontH3.textContent = clientFontH3NamePlain;
      clientFontH3.style.fontFamily = $("h3").css("font-family");
      clientFontH3.style.float = "left";
      clientFontH3.classList += "fontSize";
      clientSpecPDF.appendChild(clientFontH3);

      //Add Fonts
      let clientFontAName = $("a")
        .css("font-family")
        .replace(/['"]+/g, "")
        .replace(" ", "+");
      let clientFontANamePlain = $("a")
        .css("font-family")
        .replace(/['"]+/g, "");
      let clientFontACode = document.createElement("link");
      clientFontACode.setAttribute("rel", "stylesheet");
      clientFontACode.setAttribute("href", "https://fonts.googleapis.com/css?family=" + clientFontAName);
      clientSpecPDF.appendChild(clientFontACode);
      let clientFontA = document.createElement("H3");
      clientFontA.textContent = clientFontANamePlain;
      clientFontA.style.fontFamily = $("a").css("font-family");
      clientFontA.style.float = "left";
      clientFontA.classList += "fontSize";
      clientSpecPDF.appendChild(clientFontA);

      //Add Section Header
      let clientImageSizes = pdf.document.createElement("h2");
      clientImageSizes.textContent = "Website Image Sizes";
      clientImageSizes.setAttribute("contenteditable", "true");
      clientImageSizes.style.clear = "both";
      clientSpecPDF.appendChild(clientImageSizes);

      //Add Banner Dimensions
      $(".bannerObject img:first-child").each(function() {
        if ($($(this)[0].parentNode.parentNode).hasClass("logo") == true) {
          var imageSrc = $(this)[0].src;

          var image = new Image();
          image.src = imageSrc;

          var width = image.width,
            height = image.height;

          console.log("Logo Dimensions: " + width + "x" + height);

          let clientLogoContainer = document.createElement("div");
          clientLogoContainer.classList += "imageSize";

          let clientLogoImg = document.createElement("img");
          clientLogoImg.src = imageSrc;
          clientLogoImg.style.maxWidth = "50px";
          clientLogoImg.style.maxHeight = "50px";
          clientLogoImg.style.marginBottom = ".6em";
          clientLogoImg.style.filter = "drop-shadow(1px 1px 1px #A0A0A0)";

          let clientLogoHeader = document.createElement("h3");
          clientLogoHeader.textContent = "Logo";
          clientLogoHeader.setAttribute("contenteditable", "true");

          let clientLogo = document.createElement("p");
          clientLogo.textContent = width + " x " + height;
          clientLogo.setAttribute("contenteditable", "true");

          clientLogoContainer.appendChild(clientLogoImg);
          clientLogoContainer.appendChild(clientLogo);
          clientLogoContainer.appendChild(clientLogoHeader);

          clientSpecPDF.appendChild(clientLogoContainer);
        } else {
          var imageSrc = $(this)[0].src;

          var image = new Image();
          image.src = imageSrc;

          var width = image.width,
            height = image.height;

          console.log("Banner Image Dimensions: Width:" + width + "px, Height: " + height + "px");

          let clientBannerContainer = document.createElement("div");
          clientBannerContainer.classList += "imageSize";

          let clientBannerImg = document.createElement("img");
          clientBannerImg.src = imageSrc;
          clientBannerImg.style.maxWidth = "50px";
          clientBannerImg.style.maxHeight = "50px";
          clientBannerImg.style.marginBottom = ".6em";
          clientBannerImg.style.filter = "drop-shadow(1px 1px 1px #A0A0A0)";

          let clientBannerHeader = document.createElement("h3");
          clientBannerHeader.textContent = "Banner Image";
          clientBannerHeader.setAttribute("contenteditable", "true");

          let clientBanner = document.createElement("p");
          clientBanner.textContent = width + " x " + height;
          clientBanner.setAttribute("contenteditable", "true");

          clientBannerContainer.appendChild(clientBannerImg);
          clientBannerContainer.appendChild(clientBanner);
          clientBannerContainer.appendChild(clientBannerHeader);
          clientSpecPDF.appendChild(clientBannerContainer);
        }
      });

      //Graphic Links
      $("a.fancyButton").each(function() {
        var imageSrc = $(this)
          .css("background-image")
          .replace(/url\((['"])?(.*?)\1\)/gi, "$2")
          .split(",")[0];

        var image = new Image();
        image.src = imageSrc;
        if (imageSrc == "none") {
          imageSrc = $(this)
            .find(".text")
            .css("background-image")
            .replace(/url\((['"])?(.*?)\1\)/gi, "$2")
            .split(",")[0];
        }

        var width = image.width,
          height = image.height;

        console.log("Graphic Link Dimensions: width =" + width + ", height = " + height);

        let clientGraphicButtonContainer = document.createElement("div");
        clientGraphicButtonContainer.classList += "imageSize";

        let clientGraphicButtonImg = document.createElement("img");
        clientGraphicButtonImg.src = imageSrc;
        clientGraphicButtonImg.style.maxWidth = "50px";
        clientGraphicButtonImg.style.maxHeight = "50px";
        clientGraphicButtonImg.style.marginBottom = ".6em";
        clientGraphicButtonImg.style.filter = "drop-shadow(1px 1px 1px #A0A0A0)";

        let clientGraphicButtonsHeader = document.createElement("h3");
        clientGraphicButtonsHeader.textContent = "Graphic Button Icon";
        clientGraphicButtonsHeader.setAttribute("contenteditable", "true");

        let clientGraphicButtons = document.createElement("p");
        clientGraphicButtons.textContent = width + " x " + height;
        clientGraphicButtons.setAttribute("contenteditable", "true");

        clientGraphicButtonContainer.appendChild(clientGraphicButtonImg);
        clientGraphicButtonContainer.appendChild(clientGraphicButtons);
        clientGraphicButtonContainer.appendChild(clientGraphicButtonsHeader);
        clientSpecPDF.appendChild(clientGraphicButtonContainer);
      });

      $("img.graphicButtonLink").each(function() {
        var imageSrc = $(this)[0].src;

        var image = new Image();
        image.src = imageSrc;

        var width = image.width,
          height = image.height;

        console.log("Graphic Link Dimensions: width =" + width + ", height = " + height);

        let clientRolloverButtonContainer = document.createElement("div");
        clientRolloverButtonContainer.classList += "imageSize";

        let clientRolloverImg = document.createElement("img");
        clientRolloverImg.src = imageSrc;
        clientRolloverImg.style.maxWidth = "50px";
        clientRolloverImg.style.maxHeight = "50px";
        clientRolloverImg.style.marginBottom = ".6em";
        clientRolloverImg.style.filter = "drop-shadow(1px 1px 1px #A0A0A0)";

        let clientRolloverButtonsHeader = document.createElement("h3");
        clientRolloverButtonsHeader.textContent = "Graphic Button Icon";
        clientRolloverButtonsHeader.setAttribute("contenteditable", "true");

        let clientRolloverButtons = document.createElement("p");
        clientRolloverButtons.textContent = width + " x " + height;
        clientRolloverButtons.setAttribute("contenteditable", "true");

        clientRolloverButtonContainer.appendChild(clientRolloverImg);
        clientRolloverButtonContainer.appendChild(clientRolloverButtons);
        clientRolloverButtonContainer.appendChild(clientRolloverButtonsHeader);
        clientSpecPDF.appendChild(clientRolloverButtonContainer);
      });

      //News Flash
      $(".widgetNewsFlash .widgetItem:first-child a img").each(function() {
        let imageSrc = $(this)[0].src;

        var image = new Image();
        image.src = imageSrc;

        var width = image.width,
          height = image.height;

        console.log("News Flash Image Dimensions: " + width + " x " + height);
        if (image.width > 1 && image.height > 1) {
          let clientNewsContainer = document.createElement("div");
          clientNewsContainer.classList += "imageSize";

          let clientNewsImg = document.createElement("img");
          clientNewsImg.src = imageSrc;
          clientNewsImg.style.maxWidth = "50px";
          clientNewsImg.style.maxHeight = "50px";
          clientNewsImg.style.marginBottom = ".6em";
          clientNewsImg.style.filter = "drop-shadow(1px 1px 1px #A0A0A0)";

          let clientNewsHeader = document.createElement("h3");
          clientNewsHeader.textContent = "News Image";
          clientNewsHeader.setAttribute("contenteditable", "true");

          let clientNews = document.createElement("p");
          clientNews.textContent = width + " x " + height;
          clientNews.setAttribute("contenteditable", "true");
          clientNewsContainer.appendChild(clientNewsImg);
          clientNewsContainer.appendChild(clientNews);
          clientNewsContainer.appendChild(clientNewsHeader);
          clientSpecPDF.appendChild(clientNewsContainer);
        }
      });

      //All Images
      $("img").each(function() {
        let imageSrc = $(this)[0].src;

        var image = new Image();
        image.src = imageSrc;

        var width = image.width,
          height = image.height;

        console.log("Image Dimensions: " + width + " x " + height);
        if (image.width > 1 && image.height > 1) {
          let clientImgContainer = document.createElement("div");
          clientImgContainer.classList += "imageSize";

          let clientImgImg = document.createElement("img");
          clientImgImg.src = imageSrc;
          clientImgImg.style.maxWidth = "50px";
          clientImgImg.style.maxHeight = "50px";
          clientImgImg.style.marginBottom = ".6em";
          clientImgImg.style.filter = "drop-shadow(1px 1px 1px #A0A0A0)";

          let clientImgHeader = document.createElement("h3");
          clientImgHeader.textContent = "Image";
          clientImgHeader.setAttribute("contenteditable", "true");

          let clientImg = document.createElement("p");
          clientImg.textContent = width + " x " + height;
          clientImg.setAttribute("contenteditable", "true");
          clientImgContainer.appendChild(clientImgImg);
          clientImgContainer.appendChild(clientImg);
          clientImgContainer.appendChild(clientImgHeader);
          clientSpecPDF.appendChild(clientImgContainer);
        }
      });

      //Add editing buttons
      //Create remove Button
      let removeButton = pdf.document.createElement("a");
      removeButton.classList += "noPrint";
      removeButton.style.color = "red";
      removeButton.style.fontSize = ".5em";
      removeButton.style.fontStyle = "italic";
      removeButton.style.cursor = "pointer";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", function() {
        this.parentNode.style.display = "none";
      });

      // Add CSS to document
      let pdfStyles = document.createElement("div");
      let myCSS =
        "<style>@media print {.noPrint{display:none;}} .colorCircle{width:45px;height:45px;border:1px solid #efefef;border-radius:30px;margin-bottom:1.2em} .color p {font-size:.8em; line-height:.5em;} body{font-family:Lato, Arial, sans-serif;} #colophon p {max-width:65vw; font-size:.8em} #colophon {position:static; bottom:0; right:0; left:0; font-size:.8em;} h3.fontSize { text-transform:capitalize;} .fontSize {height:50px; width:27%; padding:0 2%; margin:0.6em 0 0; float:left;} .imageSize h3, .imageSize p {margin:.5em 0;} .imageSize h3 { font-size:.8em; } .imageSize p { font-size:1.2em; margin:0; } .imageSize, .color {width:27%; padding:0 2%; margin:0.6em 0 1.2em .2em; float:left; min-height: 135px; } h1 {margin:1em 0}h2{font-weight:bold;font-size:1.2em;color:#000;margin:.25em 0 .5em;text-align:center;background-color:rgba(200,200,200,1);padding:.5em 2em;clear:both;}</style>";
      pdfStyles.innerHTML = myCSS;

      //Open window with printable PDF
      pdf.document.open();
      pdf.document.write("<html><body></body></html>");
      pdf.document.body.appendChild(clientSpecPDF);

      for (let i = 1; i < pdf.document.getElementsByTagName("div").length; i++) {
        let newRemoveButton = removeButton.cloneNode("true");
        newRemoveButton.addEventListener("click", function() {
          this.parentNode.style.display = "none";
        });
        pdf.document.getElementsByTagName("div")[i].appendChild(newRemoveButton);
      }

      let clientColophon = document.createElement("div");
      clientColophon.innerHTML =
        '<div id="colophon" class="row"><div style="clear: both; margin-top: 2em;"><img src="http://cp-prep.herokuapp.com/images/cpLogo2.png" alt="CivicPlus" style="position: fixed; bottom:0; right:0;"> <h4>2019  Web Standards</h4> <p>Above are guidelines to assist you to easily update and maintain your new CivicPlus website! All image sizes dimensions are listed width x height and measured in pixels at 72ppi.</p> <p>Feel free to visit http://www.civicplus.help for further guidance or contact your Client Success Manager with any questions.</p></div></div>';
      clientSpecPDF.appendChild(clientColophon);
      pdf.document.body.appendChild(pdfStyles);
      pdf.document.close();
    }

    createClientPDF();
  });
})();
