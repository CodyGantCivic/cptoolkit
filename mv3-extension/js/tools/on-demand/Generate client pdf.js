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

      // Action toolbar (above the title)
      let toolbar = document.createElement("div");
      toolbar.className = "toolbar noPrint";

      let printFriendlyBtn = document.createElement("button");
      printFriendlyBtn.textContent = "Print Friendly";
      printFriendlyBtn.addEventListener("click", function() {
        var body = pdf.document.body;
        var isPrintFriendly = body.classList.toggle("print-friendly");
        printFriendlyBtn.textContent = isPrintFriendly ? "Edit Mode" : "Print Friendly";
        // Toggle contenteditable
        var editables = pdf.document.querySelectorAll("[contenteditable]");
        for (var i = 0; i < editables.length; i++) {
          editables[i].setAttribute("contenteditable", isPrintFriendly ? "false" : "true");
        }
        // Toggle draggable
        var draggables = pdf.document.querySelectorAll("[draggable]");
        for (var j = 0; j < draggables.length; j++) {
          draggables[j].setAttribute("draggable", isPrintFriendly ? "false" : "true");
        }
      });

      let downloadBtn = document.createElement("button");
      downloadBtn.textContent = "Download HTML";
      downloadBtn.addEventListener("click", function() {
        // Temporarily hide toolbar for clean export
        toolbar.style.display = "none";
        var html = "<!DOCTYPE html>" + pdf.document.documentElement.outerHTML;
        toolbar.style.display = "";
        var blob = new Blob([html], { type: "text/html" });
        var url = URL.createObjectURL(blob);
        var a = pdf.document.createElement("a");
        a.href = url;
        a.download = (clientName.trim() || "Client") + " - Design Specification.html";
        pdf.document.body.appendChild(a);
        a.click();
        pdf.document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });

      let generatePdfBtn = document.createElement("button");
      generatePdfBtn.textContent = "Generate PDF";
      generatePdfBtn.addEventListener("click", function() {
        // Hide toolbar and non-print elements for capture
        toolbar.style.display = "none";
        var noPrintEls = pdf.document.querySelectorAll(".noPrint, .noPrintColorRemove");
        for (var i = 0; i < noPrintEls.length; i++) {
          noPrintEls[i].setAttribute("data-was-visible", noPrintEls[i].style.display || "");
          noPrintEls[i].style.display = "none";
        }

        // Use the browser print API with PDF destination
        // This leverages the same @media print CSS already in place
        var originalTitle = pdf.document.title;
        pdf.document.title = (clientName.trim() || "Client") + " - Design Specification";

        pdf.window.print();

        // Restore after print dialog closes
        pdf.document.title = originalTitle;
        toolbar.style.display = "";
        for (var j = 0; j < noPrintEls.length; j++) {
          noPrintEls[j].style.display = noPrintEls[j].getAttribute("data-was-visible");
          noPrintEls[j].removeAttribute("data-was-visible");
        }
      });

      let printBtn = document.createElement("button");
      printBtn.textContent = "Print";
      printBtn.className = "primary";
      printBtn.addEventListener("click", function() {
        pdf.window.print();
      });

      toolbar.appendChild(printFriendlyBtn);
      toolbar.appendChild(downloadBtn);
      toolbar.appendChild(generatePdfBtn);
      toolbar.appendChild(printBtn);
      clientSpecPDF.appendChild(toolbar);

      // Source info bar (hidden by default, shown in print-friendly mode and @media print)
      let sourceInfo = document.createElement("div");
      sourceInfo.className = "print-source-info";
      var now = new Date();
      var dateStr = (now.getMonth() + 1) + "/" + now.getDate() + "/" + now.getFullYear();
      sourceInfo.innerHTML =
        '<span><strong>Source:</strong> ' + document.location.href + '</span>' +
        '<span><strong>Generated:</strong> ' + dateStr + '</span>';
      clientSpecPDF.appendChild(sourceInfo);

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
      function imgToDataUrl(imgEl) {
        try {
          var canvas = document.createElement("canvas");
          canvas.width = imgEl.naturalWidth || imgEl.width;
          canvas.height = imgEl.naturalHeight || imgEl.height;
          if (canvas.width === 0 || canvas.height === 0) return imgEl.src;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(imgEl, 0, 0);
          return canvas.toDataURL("image/png");
        } catch (e) {
          // Cross-origin or other canvas error — fall back to original URL
          return imgEl.src;
        }
      }

      function RGBToHex(r, g, b) {
        var bin = (r << 16) | (g << 8) | b;
        return (function(h) {
          return new Array(7 - h.length).join("0") + h;
        })(bin.toString(16).toUpperCase());
      }

      var draggedEl = null;

      function onDragStart(ev) {
        draggedEl = ev.currentTarget;
        ev.dataTransfer.effectAllowed = "move";
        setTimeout(function() { draggedEl.style.opacity = "0.4"; }, 0);
      }

      function onDragEnd(ev) {
        ev.currentTarget.style.opacity = "1";
        draggedEl = null;
        // Remove all drop indicators
        var indicators = pdf.document.querySelectorAll(".drop-indicator");
        for (var i = 0; i < indicators.length; i++) {
          indicators[i].classList.remove("drop-indicator");
        }
      }

      function onDragOver(ev) {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";
        var target = ev.currentTarget;
        if (target !== draggedEl && target.classList.contains("draggable-card")) {
          // Remove previous indicators
          var indicators = pdf.document.querySelectorAll(".drop-indicator");
          for (var i = 0; i < indicators.length; i++) {
            indicators[i].classList.remove("drop-indicator");
          }
          target.classList.add("drop-indicator");
        }
      }

      function onDragLeave(ev) {
        ev.currentTarget.classList.remove("drop-indicator");
      }

      function onDrop(ev) {
        ev.preventDefault();
        var target = ev.currentTarget;
        target.classList.remove("drop-indicator");
        if (!draggedEl || target === draggedEl) return;
        // Only reorder within the same grid container
        if (target.parentNode !== draggedEl.parentNode) return;
        var parent = target.parentNode;
        var cards = Array.prototype.slice.call(parent.querySelectorAll(".draggable-card"));
        var dragIdx = cards.indexOf(draggedEl);
        var dropIdx = cards.indexOf(target);
        if (dragIdx < dropIdx) {
          parent.insertBefore(draggedEl, target.nextSibling);
        } else {
          parent.insertBefore(draggedEl, target);
        }
      }

      //Add colors grid
      let colorsGrid = document.createElement("div");
      colorsGrid.classList += "card-grid";
      clientSpecPDF.appendChild(colorsGrid);

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
      let clientColor1Wrapper = document.createElement("div");
      clientColor1Wrapper.classList += "circleWrapper";
      let clientColor1RemoveCircle = document.createElement("a");
      clientColor1RemoveCircle.classList += "noPrintColorRemove";
      clientColor1RemoveCircle.textContent = "Remove";
      clientColor1RemoveCircle.addEventListener("click", function() { this.parentNode.style.display = "none"; });
      clientColor1Wrapper.appendChild(clientColor1RemoveCircle);
      clientColor1Wrapper.appendChild(clientColor1Circle);
      clientColor1.appendChild(clientColor1Wrapper);
      clientColor1.appendChild(clientColor1Desc);
      clientColor1.appendChild(clientColor1HEX);
      clientColor1.appendChild(clientColor1RBG);
      colorsGrid.appendChild(clientColor1);

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
      let clientColor2Wrapper = document.createElement("div");
      clientColor2Wrapper.classList += "circleWrapper";
      let clientColor2RemoveCircle = document.createElement("a");
      clientColor2RemoveCircle.classList += "noPrintColorRemove";
      clientColor2RemoveCircle.textContent = "Remove";
      clientColor2RemoveCircle.addEventListener("click", function() { this.parentNode.style.display = "none"; });
      clientColor2Wrapper.appendChild(clientColor2RemoveCircle);
      clientColor2Wrapper.appendChild(clientColor2Circle);
      clientColor2.appendChild(clientColor2Wrapper);
      clientColor2.appendChild(clientColor2Desc);
      clientColor2.appendChild(clientColor2HEX);
      clientColor2.appendChild(clientColor2RBG);
      colorsGrid.appendChild(clientColor2);

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
      let clientColor3Wrapper = document.createElement("div");
      clientColor3Wrapper.classList += "circleWrapper";
      let clientColor3RemoveCircle = document.createElement("a");
      clientColor3RemoveCircle.classList += "noPrintColorRemove";
      clientColor3RemoveCircle.textContent = "Remove";
      clientColor3RemoveCircle.addEventListener("click", function() { this.parentNode.style.display = "none"; });
      clientColor3Wrapper.appendChild(clientColor3RemoveCircle);
      clientColor3Wrapper.appendChild(clientColor3Circle);
      clientColor3.appendChild(clientColor3Wrapper);
      clientColor3.appendChild(clientColor3Desc);
      clientColor3.appendChild(clientColor3HEX);
      clientColor3.appendChild(clientColor3RBG);
      colorsGrid.appendChild(clientColor3);

      //Add Section Header
      let clientFonts = pdf.document.createElement("h2");
      clientFonts.textContent = "Typefaces";
      clientFonts.setAttribute("contenteditable", "true");
      clientSpecPDF.appendChild(clientFonts);

      //Add Fonts grid
      let fontsGrid = document.createElement("div");
      fontsGrid.classList += "card-grid card-grid-2";
      clientSpecPDF.appendChild(fontsGrid);

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
      fontsGrid.appendChild(clientFontH3Code);
      let clientFontH3Card = document.createElement("div");
      clientFontH3Card.classList += "fontCard";
      let clientFontH3Label = document.createElement("p");
      clientFontH3Label.textContent = "Heading Font";
      clientFontH3Label.style.fontWeight = "bold";
      clientFontH3Label.style.fontSize = "12px";
      clientFontH3Label.style.margin = "0 0 4px";
      clientFontH3Label.style.color = "#4a5568";
      clientFontH3Label.style.textTransform = "uppercase";
      clientFontH3Label.style.letterSpacing = "0.3px";
      let clientFontH3 = document.createElement("H3");
      clientFontH3.textContent = clientFontH3NamePlain;
      clientFontH3.style.fontFamily = $("h3").css("font-family");
      clientFontH3.classList += "fontSize";
      clientFontH3Card.appendChild(clientFontH3Label);
      clientFontH3Card.appendChild(clientFontH3);
      fontsGrid.appendChild(clientFontH3Card);

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
      fontsGrid.appendChild(clientFontACode);
      let clientFontACard = document.createElement("div");
      clientFontACard.classList += "fontCard";
      let clientFontALabel = document.createElement("p");
      clientFontALabel.textContent = "Text / Link Font";
      clientFontALabel.style.fontWeight = "bold";
      clientFontALabel.style.fontSize = "12px";
      clientFontALabel.style.margin = "0 0 4px";
      clientFontALabel.style.color = "#4a5568";
      clientFontALabel.style.textTransform = "uppercase";
      clientFontALabel.style.letterSpacing = "0.3px";
      let clientFontA = document.createElement("H3");
      clientFontA.textContent = clientFontANamePlain;
      clientFontA.style.fontFamily = $("a").css("font-family");
      clientFontA.classList += "fontSize";
      clientFontACard.appendChild(clientFontALabel);
      clientFontACard.appendChild(clientFontA);
      fontsGrid.appendChild(clientFontACard);

      //Add Section Header
      let clientImageSizes = pdf.document.createElement("h2");
      clientImageSizes.textContent = "Website Image Sizes";
      clientImageSizes.setAttribute("contenteditable", "true");
      clientSpecPDF.appendChild(clientImageSizes);

      //Add Images grid
      let imagesGrid = document.createElement("div");
      imagesGrid.classList += "card-grid";
      clientSpecPDF.appendChild(imagesGrid);

      //Add Banner Dimensions
      $(".bannerObject img:first-child").each(function() {
        var el = $(this)[0];
        var dataUrl = imgToDataUrl(el);
        var width = el.naturalWidth || el.width;
        var height = el.naturalHeight || el.height;

        if ($(el.parentNode.parentNode).hasClass("logo") == true) {
          console.log("Logo Dimensions: " + width + "x" + height);

          let clientLogoContainer = document.createElement("div");
          clientLogoContainer.classList += "imageSize";

          let clientLogoImg = document.createElement("img");
          clientLogoImg.src = dataUrl;
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

          imagesGrid.appendChild(clientLogoContainer);
        } else {
          console.log("Banner Image Dimensions: Width:" + width + "px, Height: " + height + "px");

          let clientBannerContainer = document.createElement("div");
          clientBannerContainer.classList += "imageSize";

          let clientBannerImg = document.createElement("img");
          clientBannerImg.src = dataUrl;
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
          imagesGrid.appendChild(clientBannerContainer);
        }
      });

      //Graphic Links
      $("a.fancyButton").each(function() {
        var imageSrc = $(this)
          .css("background-image")
          .replace(/url\((['"])?(.*?)\1\)/gi, "$2")
          .split(",")[0];

        if (imageSrc == "none") {
          imageSrc = $(this)
            .find(".text")
            .css("background-image")
            .replace(/url\((['"])?(.*?)\1\)/gi, "$2")
            .split(",")[0];
        }

        var image = new Image();
        image.src = imageSrc;

        var width = image.width,
          height = image.height;
        var dataUrl = imgToDataUrl(image);

        console.log("Graphic Link Dimensions: width =" + width + ", height = " + height);

        let clientGraphicButtonContainer = document.createElement("div");
        clientGraphicButtonContainer.classList += "imageSize";

        let clientGraphicButtonImg = document.createElement("img");
        clientGraphicButtonImg.src = dataUrl;
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
        imagesGrid.appendChild(clientGraphicButtonContainer);
      });

      $("img.graphicButtonLink").each(function() {
        var el = $(this)[0];
        var dataUrl = imgToDataUrl(el);
        var width = el.naturalWidth || el.width;
        var height = el.naturalHeight || el.height;

        console.log("Graphic Link Dimensions: width =" + width + ", height = " + height);

        let clientRolloverButtonContainer = document.createElement("div");
        clientRolloverButtonContainer.classList += "imageSize";

        let clientRolloverImg = document.createElement("img");
        clientRolloverImg.src = dataUrl;
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
        imagesGrid.appendChild(clientRolloverButtonContainer);
      });

      //News Flash
      $(".widgetNewsFlash .widgetItem:first-child a img").each(function() {
        var el = $(this)[0];
        var width = el.naturalWidth || el.width;
        var height = el.naturalHeight || el.height;

        console.log("News Flash Image Dimensions: " + width + " x " + height);
        if (width > 1 && height > 1) {
          var dataUrl = imgToDataUrl(el);
          let clientNewsContainer = document.createElement("div");
          clientNewsContainer.classList += "imageSize";

          let clientNewsImg = document.createElement("img");
          clientNewsImg.src = dataUrl;
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
          imagesGrid.appendChild(clientNewsContainer);
        }
      });

      //All Images
      $("img").each(function() {
        var el = $(this)[0];
        var width = el.naturalWidth || el.width;
        var height = el.naturalHeight || el.height;

        console.log("Image Dimensions: " + width + " x " + height);
        if (width > 1 && height > 1) {
          var dataUrl = imgToDataUrl(el);
          let clientImgContainer = document.createElement("div");
          clientImgContainer.classList += "imageSize";

          let clientImgImg = document.createElement("img");
          clientImgImg.src = dataUrl;
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
          imagesGrid.appendChild(clientImgContainer);
        }
      });

      //Add editing buttons
      //Create remove Button
      let removeButton = pdf.document.createElement("a");
      removeButton.classList += "noPrint";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", function() {
        this.parentNode.style.display = "none";
      });

      // Add CSS to document
      let pdfStyles = document.createElement("div");
      let myCSS =
        '<style>' +
        '@media print {' +
        '  .noPrint, .noPrintColorRemove, .toolbar { display: none !important; }' +
        '  .print-source-info { display: block !important; }' +
        '  body { padding: 0; }' +
        '  #clientPDF { max-width: 100%; }' +
        '  h2 { break-after: avoid; }' +
        '  .color, .imageSize, .fontCard { break-inside: avoid; }' +
        '}' +
        '*, *::before, *::after { box-sizing: border-box; }' +
        'body {' +
        '  font-family: "Inter", "Segoe UI", Arial, sans-serif;' +
        '  color: #2d3748;' +
        '  background: #f7f8fa;' +
        '  margin: 0;' +
        '  padding: 40px 20px;' +
        '  line-height: 1.5;' +
        '}' +
        '#clientPDF {' +
        '  max-width: 800px;' +
        '  margin: 0 auto;' +
        '  background: #fff;' +
        '  border-radius: 12px;' +
        '  box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06);' +
        '  padding: 48px 40px;' +
        '}' +
        'h1 {' +
        '  font-size: 28px;' +
        '  font-weight: 700;' +
        '  color: #1a202c;' +
        '  margin: 0 0 8px;' +
        '  padding-bottom: 16px;' +
        '  border-bottom: 3px solid #af282f;' +
        '}' +
        'h2 {' +
        '  font-size: 16px;' +
        '  font-weight: 600;' +
        '  color: #fff;' +
        '  background: #af282f;' +
        '  margin: 32px 0 20px;' +
        '  padding: 10px 20px;' +
        '  border-radius: 6px;' +
        '  text-transform: uppercase;' +
        '  letter-spacing: 0.5px;' +
        '}' +
        '.card-grid {' +
        '  display: grid;' +
        '  grid-template-columns: repeat(3, 1fr);' +
        '  gap: 16px;' +
        '  margin-bottom: 8px;' +
        '}' +
        '.card-grid-2 {' +
        '  grid-template-columns: repeat(2, 1fr);' +
        '}' +
        '.color, .imageSize {' +
        '  padding: 16px;' +
        '  background: #f9fafb;' +
        '  border: 1px solid #e8ecf0;' +
        '  border-radius: 8px;' +
        '  min-height: 140px;' +
        '}' +
        '.circleWrapper {' +
        '  display: flex;' +
        '  flex-direction: column;' +
        '  align-items: center;' +
        '  width: fit-content;' +
        '  margin-bottom: 10px;' +
        '}' +
        '.colorCircle {' +
        '  width: 52px;' +
        '  height: 52px;' +
        '  border: 2px solid #e8ecf0;' +
        '  border-radius: 50%;' +
        '  box-shadow: 0 1px 3px rgba(0,0,0,0.1);' +
        '}' +
        'a.noPrintColorRemove {' +
        '  color: #e53e3e;' +
        '  font-size: 11px;' +
        '  font-style: italic;' +
        '  cursor: pointer;' +
        '  display: inline-block;' +
        '  opacity: 0.7;' +
        '  width: fit-content;' +
        '  margin: 0 auto;' +
        '  text-align: center;' +
        '  margin-left: 5px;' +
        '}' +
        'a.noPrintColorRemove:hover { opacity: 1; }' +
        '.color p {' +
        '  font-size: 13px;' +
        '  line-height: 1.4;' +
        '  margin: 2px 0;' +
        '  color: #4a5568;' +
        '  font-family: "Monaco", "Consolas", monospace;' +
        '}' +
        '.color p:first-of-type {' +
        '  font-family: "Inter", "Segoe UI", Arial, sans-serif;' +
        '  font-weight: 600;' +
        '  color: #2d3748;' +
        '  font-size: 14px;' +
        '}' +
        'h3.fontSize {' +
        '  text-transform: capitalize;' +
        '  font-size: 16px;' +
        '  color: #2d3748;' +
        '}' +
        '.fontSize {' +
        '  height: auto;' +
        '  margin: 0;' +
        '}' +
        '.fontCard {' +
        '  padding: 16px;' +
        '  background: #f9fafb;' +
        '  border: 1px solid #e8ecf0;' +
        '  border-radius: 8px;' +
        '}' +
        '.imageSize h3 {' +
        '  font-size: 13px;' +
        '  font-weight: 600;' +
        '  color: #4a5568;' +
        '  margin: 4px 0 0;' +
        '  text-transform: uppercase;' +
        '  letter-spacing: 0.3px;' +
        '}' +
        '.imageSize p {' +
        '  font-size: 18px;' +
        '  font-weight: 600;' +
        '  color: #1a202c;' +
        '  margin: 4px 0 0;' +
        '}' +
        '.imageSize img {' +
        '  border-radius: 4px;' +
        '}' +
        '#colophon {' +
        '  margin-top: 40px;' +
        '  padding-top: 24px;' +
        '  border-top: 1px solid #e8ecf0;' +
        '  font-size: 13px;' +
        '  color: #718096;' +
        '}' +
        '#colophon h4 {' +
        '  font-size: 14px;' +
        '  font-weight: 600;' +
        '  color: #4a5568;' +
        '  margin: 0 0 8px;' +
        '}' +
        '#colophon p {' +
        '  margin: 0 0 6px;' +
        '  line-height: 1.6;' +
        '}' +
        '.noPrint {' +
        '  color: #e53e3e;' +
        '  font-size: 11px;' +
        '  font-style: italic;' +
        '  cursor: pointer;' +
        '  display: inline-block;' +
        '  margin-top: 4px;' +
        '  opacity: 0.7;' +
        '}' +
        '.noPrint:hover { opacity: 1; }' +
        '.draggable-card { cursor: grab; }' +
        '.draggable-card:active { cursor: grabbing; }' +
        '.drop-indicator {' +
        '  outline: 2px dashed #af282f;' +
        '  outline-offset: -2px;' +
        '  background: #fff5f5 !important;' +
        '}' +
        '.toolbar {' +
        '  display: flex;' +
        '  gap: 8px;' +
        '  margin-bottom: 20px;' +
        '}' +
        '.toolbar button {' +
        '  padding: 8px 16px;' +
        '  border: 1px solid #e0e0e0;' +
        '  border-radius: 4px;' +
        '  font-size: 13px;' +
        '  font-weight: 500;' +
        '  cursor: pointer;' +
        '  background: #fff;' +
        '  color: #333;' +
        '  font-family: "Inter", "Segoe UI", Arial, sans-serif;' +
        '}' +
        '.toolbar button:hover { background: #f5f5f5; }' +
        '.toolbar button.primary {' +
        '  background: #af282f;' +
        '  color: #fff;' +
        '  border-color: #af282f;' +
        '}' +
        '.toolbar button.primary:hover { background: #c42f37; }' +

        // Print-friendly mode: clean, ink-saving, paper-optimized
        'body.print-friendly .noPrint,' +
        'body.print-friendly .noPrintColorRemove,' +
        'body.print-friendly .toolbar { display: none !important; }' +

        // White background, no decorative shadows or rounded corners
        'body.print-friendly {' +
        '  background: #fff;' +
        '  padding: 0;' +
        '  margin: 0;' +
        '  color: #000;' +
        '  font-family: Georgia, "Times New Roman", serif;' +
        '  font-size: 12pt;' +
        '  line-height: 1.6;' +
        '}' +
        'body.print-friendly #clientPDF {' +
        '  box-shadow: none;' +
        '  border-radius: 0;' +
        '  padding: 20px 40px;' +
        '  max-width: 100%;' +
        '}' +

        // Typography: black text, readable serif font
        'body.print-friendly h1 {' +
        '  color: #000;' +
        '  font-size: 22pt;' +
        '  border-bottom: 2px solid #000;' +
        '}' +
        'body.print-friendly h2 {' +
        '  color: #000;' +
        '  background: none;' +
        '  border-bottom: 1px solid #000;' +
        '  border-radius: 0;' +
        '  padding: 4px 0;' +
        '  font-size: 14pt;' +
        '}' +
        'body.print-friendly h3 { color: #000; }' +
        'body.print-friendly p { color: #000; }' +
        'body.print-friendly .color p { color: #000; }' +

        // Cards: no background color, simple borders to save ink
        'body.print-friendly .color,' +
        'body.print-friendly .imageSize,' +
        'body.print-friendly .fontCard {' +
        '  background: #fff;' +
        '  border: 1px solid #ccc;' +
        '}' +

        // Disable interactive affordances
        'body.print-friendly .draggable-card { cursor: default; }' +
        'body.print-friendly [contenteditable] { outline: none; cursor: default; }' +

        // Page break control
        'body.print-friendly h2 { page-break-after: avoid; }' +
        'body.print-friendly .color,' +
        'body.print-friendly .imageSize,' +
        'body.print-friendly .fontCard { page-break-inside: avoid; }' +
        'body.print-friendly .card-grid { page-break-inside: avoid; }' +

        // Source info bar
        '.print-source-info {' +
        '  display: none;' +
        '  font-size: 10pt;' +
        '  color: #666;' +
        '  border-bottom: 1px solid #ccc;' +
        '  padding: 8px 0 12px;' +
        '  margin-bottom: 16px;' +
        '  font-family: Georgia, "Times New Roman", serif;' +
        '}' +
        '.print-source-info span {' +
        '  display: block;' +
        '  margin-bottom: 2px;' +
        '}' +
        'body.print-friendly .print-source-info { display: block; }' +

        // Colophon: black text in print-friendly
        'body.print-friendly #colophon,' +
        'body.print-friendly #colophon h4,' +
        'body.print-friendly #colophon p { color: #000; }' +
        'body.print-friendly #colophon { border-top: 1px solid #000; }' +
        '</style>';
      pdfStyles.innerHTML = myCSS;

      //Open window with printable PDF
      pdf.document.open();
      pdf.document.write("<html><head></head><body></body></html>");

      // Load Inter font as a non-blocking <link> instead of @import
      let interFontLink = pdf.document.createElement("link");
      interFontLink.rel = "stylesheet";
      interFontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
      pdf.document.head.appendChild(interFontLink);

      pdf.document.body.appendChild(clientSpecPDF);

      var allDivs = pdf.document.getElementsByTagName("div");
      for (let i = 1; i < allDivs.length; i++) {
        var div = allDivs[i];
        if (div.classList.contains("colorCircle") || div.classList.contains("circleWrapper")) continue;
        let newRemoveButton = removeButton.cloneNode("true");
        newRemoveButton.addEventListener("click", function() {
          this.parentNode.style.display = "none";
        });
        div.appendChild(newRemoveButton);
      }

      // Wire up drag-and-drop reordering on all cards
      var draggableCards = pdf.document.querySelectorAll(".color, .imageSize, .fontCard");
      for (let i = 0; i < draggableCards.length; i++) {
        var card = draggableCards[i];
        card.setAttribute("draggable", "true");
        card.classList.add("draggable-card");
        card.addEventListener("dragstart", onDragStart);
        card.addEventListener("dragend", onDragEnd);
        card.addEventListener("dragover", onDragOver);
        card.addEventListener("dragleave", onDragLeave);
        card.addEventListener("drop", onDrop);
      }

      let clientColophon = document.createElement("div");
      let currentYear = new Date().getFullYear();
      clientColophon.innerHTML =
        '<div id="colophon"><div style="clear: both;">' +
        '<h4>' + currentYear + ' Web Standards</h4>' +
        '<p>Above are guidelines to assist you in updating and maintaining your CivicPlus website. All image dimensions are listed as width &times; height and measured in pixels at 72ppi.</p>' +
        '<p>Contact your Client Success Manager with any questions.</p>' +
        '</div></div>';
      clientSpecPDF.appendChild(clientColophon);
      pdf.document.body.appendChild(pdfStyles);
      pdf.document.close();
    }

    createClientPDF();
  });
})();
