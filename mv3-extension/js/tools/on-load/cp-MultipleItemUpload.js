(function loadTool() {
  var thisTool = "cp-MultipleItemUpload";
  chrome.storage.local.get(thisTool, function(settings) {
    if (chrome.runtime.lastError) {
      console.error("[CP Toolkit] Error loading settings for " + thisTool + ":", chrome.runtime.lastError);
      return;
    }
    detect_if_cp_site(function() {
      if (settings[thisTool] !== false) {
        console.log("[CP Toolkit] Loaded " + thisTool);
        try {
          // When you are on the main News Flash Page, get all category ID's + Names and post them to Chrome storage for future use
          if (
            $("td:contains('Published Categories')").length &&
            window.location.pathname.toLowerCase() == "/admin/civicalerts.aspx"
          ) {
            var callAlertCategoryDetails = $(".adminthin a");
            var allCategoryIDs = [];
            var i;
            for (i = 0; i < callAlertCategoryDetails.length; i++) {
              var onClick = $(".adminthin a")[i].getAttributeNode("onclick").nodeValue;
              var res = onClick.slice(24);
              var categoryID = res.substring(0, res.indexOf(","));
              var categoryName = $(".adminthin a")[i].innerText;
              allCategoryIDs.push({
                categoryName,
                categoryID
              });
            }
            // MV3: Use chrome.storage instead of localStorage
            chrome.storage.local.set({ "callAlertCategories": allCategoryIDs }, function() {
              if (chrome.runtime.lastError) {
                console.error("[CP Toolkit] Error saving categories:", chrome.runtime.lastError);
              } else {
                // console.log("[CP Toolkit] Category list saved to Chrome storage");
              }
            });
          }
          
          // If you are on the Item creation (not modify) page, add the Save to Multiple Categories Button and Related Categories section + run function
          // Only activate if CivicPlus doesn't already have a native Related Categories section
          if (
            ($("input[value*='Save']").length || $("input[value*='Save and Preview']").length) &&
            window.location.pathname.toLowerCase() == "/admin/civicalerts.aspx"
          ) {
            if ($(".relatedCivicAlertCategories").length) {
              // console.log("[CP Toolkit] ℹ️ Native Related Categories section detected - custom section not needed");
            } else {
              // console.log("[CP Toolkit] No native Related Categories found - adding custom section");
            var uploadMultiple = $(
              '<input type="button" class="cp-button" value="Save to Multiple Categories" style="margin-left: 5px;"><textarea id="completedResults" style="display: none;margin: 0px 921px 0px 0px; height: 356px; width: 362px;"></textarea>'
            );
            var thisButtonSection = $("input[value*='Save']");
            thisButtonSection.first().after(uploadMultiple[0]);
            thisButtonSection.first().after(uploadMultiple[1]);
            var relatedCats = $(`
              <div class="formline selfClear relatedCategories">
            		<label id="lblRelatedCategories">Related Categories<span>(CPToolkit Extension)</span></label>
            		<div>
            			<div class="listing categories relataedCategoriesNewsFlash_cl">
            				<div>
            					<ul class="items selfClear" id="relataedCategoriesNewsFlash_ts">
            					</ul>
            				</div>
            			</div>
            		</div>
            	</div>`);
            $("#divForm").append(relatedCats);

            var css = `
              .relatedCategories{margin-left: 30px;margin-top: 20px;background-color: #fff;padding: 10px;border-radius: 5px;width:1100px}
              .relatedCategories label{color: #0b5486;display:block;font-size: 1.1rem;font-weight: 400;margin: .5rem 0 .25rem;}
              .relatedCategories label span {color: #646a70;font-size: 0.9rem;font-style: italic;font-weight: 400;}
              .relatedCategories label.check{display:inline;cursor:pointer}
              .relatedCategories .categories{border-bottom: 1px solid #e6ebef;margin-bottom: 0px;margin-top: 0px}
              .nfCategory_cl{margin-left:5px;}
              .cp-button{background-color:#d3d657 !important;border-bottom-color:#b3b64a !important;}
              #completedResults{width:500px; height:500px;}`;
            var head = document.head || document.getElementsByTagName("head")[0];
            var style = document.createElement("style");
            head.appendChild(style);
            style.type = "text/css";
            if (style.styleSheet) {
              style.styleSheet.cssText = css;
            } else {
              style.appendChild(document.createTextNode(css));
            }

            // MV3: Load categories from chrome.storage instead of localStorage
            chrome.storage.local.get("callAlertCategories", function(result) {
              if (chrome.runtime.lastError) {
                console.error("[CP Toolkit] Error loading categories:", chrome.runtime.lastError);
                return;
              }
              
              var allCats = result.callAlertCategories || [];
              
              // Append Related Categories to List
              for (var category in allCats) {
                var newLI = document.createElement("li");
                newLI.className = "item";
                var newLABEL = document.createElement("label");
                newLABEL.className = "check";
                newLABEL.setAttribute("for", "relataedCategoriesNewsFlash_ts_" + allCats[category].categoryID);
                newLABEL.innerHTML = allCats[category].categoryName;
                newLI.appendChild(newLABEL);
                var newInput = document.createElement("input");
                newInput.className = "nfCategory_cl";
                newInput.id = "relataedCategoriesNewsFlash_ts_" + allCats[category].categoryID;
                newInput.value = allCats[category].categoryID;
                newInput.type = "checkbox";
                newInput.name = "relataedCategoriesNewsFlash_ts_" + allCats[category].categoryID;
                newLABEL.appendChild(newInput);
                document.getElementById("relataedCategoriesNewsFlash_ts").appendChild(newLI);
              }
            });

            // Get selected categories and post to those categories
            uploadMultiple.click(function() {
              var selectedCatsArray = [];
              var selectedCatsInput = $(".nfCategory_cl:checked");
              for (var catInput in selectedCatsInput) {
                if (selectedCatsInput[catInput].value != undefined) {
                  selectedCatsArray.push(selectedCatsInput[catInput].value);
                }
              }

              var newsPost = {};
              var imgURL = {};
              var formData = new FormData(document.getElementById("FormEdit"));

              for (var pair of formData.entries()) {
                newsPost[pair[0]] = pair[1];
                if (pair[0] == "fpGraphic$fuNewFile") {
                  imgURL = pair[1];
                }
              }

              var newsPostTitle = newsPost["txtTitle"];
              var newsPostDesc = newsPost["txtShortDescription"];
              var newsPostLink = newsPost["txtLink"];
              var newsPostBody = newsPost["txtBody"];
              var newsPostTargetBlank = newsPost["chkTargetBlank"];
              if (newsPostTargetBlank == "on") {
                newsPostTargetBlank = "true";
              } else {
                newsPostTargetBlank = "false";
              }
              var newsPostPublishedDate = newsPost["txtPubDate"];
              var newsPostExpirationDate = newsPost["txtExpDate"];
              var newsPostTicker = newsPost["chkRunTicker"];
              var newsPostFeatured = newsPost["chkFeaturedOn"];
              if (newsPostTicker == "on") {
                newsPostTicker = "true";
              } else {
                newsPostTicker = "false";
              }
              if (newsPostFeatured == "on") {
                newsPostFeatured = "true";
              } else {
                newsPostFeatured = "false";
              }
              console.log("imgURL: " + imgURL);

              var completed = 0;
              var userName = prompt("Please Enter Your Email");
              var password = prompt("Please Enter Your Password");

              chrome.storage.sync.get(["siteID"], function(result) {
                if (chrome.runtime.lastError) {
                  console.error("[CP Toolkit] Error loading siteID:", chrome.runtime.lastError);
                  return;
                }
                var siteID = result.siteID;
                chrome.storage.sync.get(["apiKey"], function(result) {
                  if (chrome.runtime.lastError) {
                    console.error("[CP Toolkit] Error loading apiKey:", chrome.runtime.lastError);
                    return;
                  }
                  var apiKey = result.apiKey;

                  selectedCatsArray.forEach(function(categoryID) {
                    var newsPostFormData = new FormData();

                    newsPostFormData.append("categoryID", categoryID);
                    newsPostFormData.append("title", newsPostTitle);
                    newsPostFormData.append("shortDescription", newsPostDesc);
                    newsPostFormData.append("link", newsPostLink);
                    newsPostFormData.append("body", newsPostBody);
                    newsPostFormData.append("targetBlank", newsPostTargetBlank);
                    newsPostFormData.append("ticker", newsPostTicker);
                    newsPostFormData.append("featured", newsPostFeatured);
                    newsPostFormData.append("publishedDateTime", newsPostPublishedDate);
                    newsPostFormData.append("expirationDateTime", newsPostExpirationDate);
                    newsPostFormData.append("alertStatus", "Published");
                    newsPostFormData.append("file", imgURL);

                    var myHeaders = new Headers();
                    myHeaders.append("publicKey", apiKey);
                    myHeaders.append("userName", userName);
                    myHeaders.append("password", password);

                    var myInit = {
                      method: "POST",
                      headers: myHeaders,
                      body: newsPostFormData
                    };

                    var apiURL = "https://clientapi.civicplus.com/api/" + siteID + "/alert/add";
                    fetch(apiURL, myInit)
                      .then(function(response) {
                        return response.json();
                      })
                      .then(function(data) {
                        completed++;
                        $("#completedResults").val(
                          $("#completedResults").val() + "\n\nSuccess: " + categoryID + " - " + data.message
                        );
                        if (completed >= selectedCatsArray.length) {
                          $("#completedResults").css("display", "block");
                        }
                      })
                      .catch(function(error) {
                        completed++;
                        console.error("[CP Toolkit] Error posting to category " + categoryID + ":", error);
                        $("#completedResults").val(
                          $("#completedResults").val() + "\n\nError: " + categoryID + " - " + error
                        );
                        if (completed >= selectedCatsArray.length) {
                          $("#completedResults").css("display", "block");
                        }
                      });
                  });
                });
              });
            });
          }
          } // End of else block for custom section
        } catch (err) {
          console.warn("[CP Toolkit](" + thisTool + ") Error:", err);
        }
      } else {
        // console.log("[CP Toolkit] ○ Skipping " + thisTool + " (disabled in settings)");
      }
    });
  });
})();
