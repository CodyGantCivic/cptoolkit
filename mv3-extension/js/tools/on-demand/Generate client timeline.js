(function() {
  // Get the API key for requests from the page
  var apikey;
  $(`<script>
    jQuery("<input type='hidden' id='apikey'>").appendTo("body");
    jQuery("#apikey").val(window.authenticity_token);
    </script>`).appendTo("body");

  function checkForKey() {
    if ($("#apikey").val()) {
      apikey = $("#apikey").val();
    } else {
      setTimeout(function() {
        checkForKey();
      }, 500);
    }
  }
  checkForKey();

  // Get workspace id from Mavenlink
  let urlPath = workspacePath.split("/");
  let workspaceId = urlPath[urlPath.length - 1];
  let brandLogo = "https://logos-download.com/wp-content/uploads/2017/05/CivicPlus_logo-700x129-420x77.png";
  let brandColor = "#af282f";

  function buildTimeline(id) {
    // Determine product and brand
    $.ajax({
      beforeSend: function(request) {
        request.setRequestHeader("x-csrf-token", window.authenticity_token);
        //numOpenAjax++;
      },
      url: "https://civicplus.mavenlink.com/api/v1/workspaces/" + id + "?include=custom_field_values",
      type: "get",
      dataType: "json",
      async: false,
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      success: function(data) {
        let myData = data;
        console.log(myData);
        for (key in myData.custom_field_values) {
          if (myData.custom_field_values[key].custom_field_name == "Product Suite") {
            let prodSuite = myData.custom_field_values[key].display_value;

            switch (prodSuite) {
              case "CivicEngage":
                brandLogo =
                  "https://irp-cdn.multiscreensite.com/2a88bb9e/dms3rep/multi/mobile/CivicEngage%20Wordmark-1665x182.png";
                brandColor = "#055587";
                break;
              case "CivicClerk":
                brandLogo =
                  "https://irp-cdn.multiscreensite.com/2a88bb9e/dms3rep/multi/mobile/CivicClerk+Wordmark1.png";
                brandColor = "#755884";
                break;
              case "CivicRec":
                brandLogo =
                  "https://irp-cdn.multiscreensite.com/2a88bb9e/dms3rep/multi/mobile/CivicRec%20Wordmark-1145x200.png";
                brandColor = "#097b43";
                break;
              case "CivicHR":
                brandLogo =
                  "https://irp-cdn.multiscreensite.com/2a88bb9e/dms3rep/multi/mobile/CivicHR%20Wordmark-978x193.png";
                brandColor = "#027fa8";
                break;
              case "CivicReady":
                brandLogo =
                  "https://irp-cdn.multiscreensite.com/2a88bb9e/dms3rep/multi/mobile/CivicReady%20Wordmark-1435x298.png";
                brandColor = "#db8427";
                break;
              case "Platform":
                brandLogo = "https://logos-download.com/wp-content/uploads/2017/05/CivicPlus_logo-700x129-420x77.png";
                brandColor = "#af282f";
                break;
              case "General":
                brandLogo = "https://logos-download.com/wp-content/uploads/2017/05/CivicPlus_logo-700x129-420x77.png";
                brandColor = "#af282f";
                break;
              case "":
                brandLogo = "https://logos-download.com/wp-content/uploads/2017/05/CivicPlus_logo-700x129-420x77.png";
                brandColor = "#af282f";
                break;
              default:
                brandLogo = "https://logos-download.com/wp-content/uploads/2017/05/CivicPlus_logo-700x129-420x77.png";
                brandColor = "#af282f";
              // code block
            }
          }
        }
      }
    });

    // Open new window
    let pdf = window.open("", "clientTimelinePDF", "height=1100,scrollbars=1,resizable=1");

    //Create Document
    let clientTimelinePDF = pdf.document.createElement("div");

    // Add jQuery
    //let myjQuery = document.createElement('div');
    //myjQuery.innerHTML = '<script src="https://code.jquery.com/jquery-3.3.1.min.js" integrity="sha256-FgpCb/KJQlLNfOu91ta32o/NMZxltwRo8QtmkMRdAu8=" crossorigin="anonymous"></script>';
    //pdf.document.head.appendChild(myjQuery);

    // Title window
    let windowTitle = document.title + "  Project Timeline";
    let pdfTitle = document.createElement("title");
    pdfTitle.innerHTML = windowTitle;
    clientTimelinePDF.appendChild(pdfTitle);

    // Add toolbar
    let tools = document.createElement("div");
    tools.id = "tools";
    tools.classList.add("noPrint");

    // tag toggle tool
    let tagToggleLabel = document.createElement("label");
    tagToggleLabel.innerText = "Remove tasks without tags";
    tagToggleLabel.id = "tagTool";
    let tagToggle = document.createElement("input");
    tagToggle.setAttribute("type", "checkbox");
    tagToggle.classList.add("noPrint");
    tagToggle.id = "tagToggle";
    tools.appendChild(tagToggle);
    tools.appendChild(tagToggleLabel);

    // description toggle tool
    let descToggleLabel = document.createElement("label");
    descToggleLabel.innerText = "Remove descriptions";
    descToggleLabel.id = "descriptionTool";
    let descToggle = document.createElement("input");
    descToggle.setAttribute("type", "checkbox");
    descToggle.classList.add("noPrint");
    descToggle.id = "descToggle";
    tools.appendChild(descToggle);
    tools.appendChild(descToggleLabel);

    //make tools available in app
    clientTimelinePDF.appendChild(tools);

    // Create header
    let pdfHeader = document.createElement("div");
    let clientName = document.title.split("|")[0];
    let clientProject = document.title.split("|")[1];

    let projLogo = document.createElement("img");
    projLogo.src = brandLogo;
    projLogo.height = 30;
    pdfHeader.appendChild(projLogo);
    pdfHeader.innerHTML += `<h1 contenteditable="true">${clientName}</h1><h2 contenteditable="true">${clientProject} | Project Timeline</h2>`;
    clientTimelinePDF.appendChild(pdfHeader);

    // Create table
    let clientTimeline = document.createElement("table");
    clientTimeline.id = "timeline";
    clientTimeline.style.display = "none";

    //Get data from API
    $.ajax({
      beforeSend: function(request) {
        request.setRequestHeader("x-csrf-token", window.authenticity_token);
        //numOpenAjax++;
      },
      url:
        "https://civicplus.mavenlink.com/api/v1/stories?workspace_id=" +
        id +
        "&include=tags,assignees,workspace&order=due_date:asc&all_on_account=true&per_page=200;",
      type: "get",
      dataType: "json",
      async: false,
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      success: function(data) {
        let myData = data;
        console.log(myData);
        for (key in myData.results) {
          let curTask = myData.results[key].id;
          let taskInfo = myData.stories[curTask];
          //console.log(taskInfo.title)

          for (key in myData.stories) {
            if (myData.stories[key].id == taskInfo.id) {
              //if( myData.stories[key].tag_ids.length != 0 || myData.stories[key].story_type == "milestone" ) {

              if (myData.stories[key]) {
                let myRow = document.createElement("tr");
                myRow.dataset.id = myData.stories[key].id;
                myRow.dataset.parentId = myData.stories[key].parent_id;
                myRow.classList.add("task");

                if (myData.stories[key].tag_ids.length > 0) {
                  myRow.dataset.tags = "true";
                }

                let startDate = document.createElement("td");
                startDate.classList.add("start");
                let dateString = myData.stories[key].start_date;
                let dateObj = new Date(dateString);
                dateObj.setDate(dateObj.getDate() + 1);
                startDate.innerHTML = dateObj.toLocaleDateString("en-US");
                startDate.contentEditable = "true";

                let dueDate = document.createElement("td");
                dueDate.classList.add("due");
                let dateString2 = myData.stories[key].due_date;
                let dateObj2 = new Date(dateString2);
                dateObj2.setDate(dateObj2.getDate() + 1);
                dueDate.innerHTML = dateObj2.toLocaleDateString("en-US");
                dueDate.contentEditable = "true";

                let taskTags = document.createElement("td");
                taskTags.classList.add("client");

                for (let i = 0; i < myData.stories[key].tag_ids.length; i++) {
                  let tagId = myData.stories[key].tag_ids[i];
                  //console.log(tagId);
                  if (myData.tags[tagId].name != "Client") {
                    taskTags.innerHTML += myData.tags[tagId].name + " ";
                  }
                }

                taskTags.contentEditable = "true";

                // Add title of task
                let myNode = document.createElement("td");
                myNode.classList.add("name");
                myNode.innerHTML = myData.stories[key].title;
                myNode.contentEditable = "true";

                let myDescription = document.createElement("td");
                myDescription.classList.add("description");
                myDescription.innerHTML = myData.stories[key].description;
                myDescription.contentEditable = "true";

                // Set indent of Task
                myNode.classList.add("level" + myData.stories[key].ancestor_ids.length);

                // Add content based on task type
                if (myData.stories[key].story_type == "milestone") {
                  myRow.classList.add("milestone");
                  myRow.style.background = brandColor;
                  myNode.colSpan = "1";
                  startDate.innerHTML = "";
                  dueDate.innerHTML = "";
                  myRow.appendChild(myNode);

                  let descHeader = document.createElement("td");
                  descHeader.innerHTML = "Description";
                  descHeader.classList.add("description");
                  descHeader.contentEditable = "true";
                  myRow.appendChild(descHeader);

                  let tagsHeader = document.createElement("td");
                  tagsHeader.innerHTML = "Notes";
                  tagsHeader.classList.add("tags");
                  tagsHeader.classList.add("client");
                  tagsHeader.contentEditable = "true";
                  myRow.appendChild(tagsHeader);

                  let startHeader = document.createElement("td");
                  startHeader.innerHTML = "Start Date";
                  startHeader.classList.add("due");
                  startHeader.contentEditable = "true";
                  myRow.appendChild(startHeader);

                  let dueHeader = document.createElement("td");
                  dueHeader.innerHTML = "Due Date";
                  dueHeader.classList.add("due");
                  dueHeader.contentEditable = "true";
                  myRow.appendChild(dueHeader);
                } else {
                  myRow.appendChild(myNode);
                  myRow.appendChild(myDescription);
                  myRow.appendChild(taskTags);
                  myRow.appendChild(startDate);
                  myRow.appendChild(dueDate);
                }

                let myMover = document.createElement("td");
                myMover.classList.add("move");
                myMover.classList.add("noPrint");
                myMover.innerHTML = '<i class="fas fa-arrows-alt"></i>';
                myRow.appendChild(myMover);

                //Make each task removable on click
                let removeButton = document.createElement("td");
                removeButton.classList.add("remove");
                removeButton.classList.add("noPrint");

                removeButton.innerHTML = "<i class='fas fa-trash-alt'></i>";
                removeButton.addEventListener("click", function() {
                  this.parentNode.style.display = "none";
                  this.parentNode.remove();
                });

                myRow.appendChild(removeButton);

                // Add task to table
                clientTimeline.append(myRow);
              }
            }
          }
        }

        // Add CSS to document
        let pdfStyles = document.createElement("div");

        let myCSS = `<style>
			body {
				font-family: Arial
			}

			#tools {
				background: white;
				padding: 15px;
				box-shadow: 0px 0px 15px rgba(0, 0, 0, .125);
				position: fixed;
				top: 20px;
				right: 20px;
				border-radius:15px;
				
			}

			h1 {
				font-size: 2.5em
			}

			h2 {
				font-size: 1.3em
			}

			tr:nth-child(even) {
				background-color: #efefef
			}

			tr,
			td {
				transition: .33s ease all
			}

			table#timeline {
				width: 100%;
				border-collapse: collapse;

			}

			.task td {
				padding: 1em;
				font-weight: normal;
				border-bottom: 1px solid rgba(0, 0, 0, .2);
			}
			
			.task.milestone {
				font-weight: bold;
				background: #055587;
				color: #fff;
				padding: 1em;
				font-weight: bold;
			}
			
			td.description {
				max-width:500px;
			}
			
			td.start, td.due {
				min-width:100px;
				text-align:right;
			}
			
			td.move, td.remove {
				width:10px;
			}
			
			tr.milestone td {
				color:#fff !important;
				text-transform:uppercase;
			}
			
			
			td.remove {
				color: #3d3d3d;
				font-size: 1em;
				padding: 1em;
				cursor: pointer;
				text-align: center
			}

			td.remove:hover {
				background-color: rgba(0, 0, 0, .8);
				color: #fff !important
			}

			td.remove:hover+td {
				text-decoration: line-through;
				background-color: rgba(0, 0, 0, .8) !important;
				color: #fff
			}

			.grab {
				cursor: grab
			}

			.grabbed {
				box-shadow: 0 0 13px #000
			}

			.grabCursor,
			.grabCursor * {
				cursor: grabbing !important
			}
			
			#tools label {
				margin: 10px;
				display: block;
				float: left;
			}
			
			#tools input {
				float:left;
				clear:both;
				margin:10px;
			}
			
			td.move {cursor:move;}

			@media print {
				@page {
					margin: .35in;
					height: 8.5in;
					width: 8.5in;
					font-size: .5em
				}
				
				#timeline {
				}
				
				tr {
					page-break-inside: avoid;
					}
				
				.task td {
					box-sizing:border-box;
					font-size: 8pt;
					padding: .6em 1em;
				
				}
				
				.task.milestone {
					font-size:10pt;
					padding:.5em 0em;
					text-transform:uppercase;
				}
				
				td.due, td.start {
					max-width:1in;
				}
				
				td.name {
					min-width:1.5in;
				}
				
				td.description {
					max-width:4in;
				}
			
				
				.noPrint, button {
					visibility: hidden;
					display: none !important
				}
			}
			</style>`;
        pdfStyles.innerHTML = myCSS;

        // Font Awesome
        let fontAwesome = document.createElement("div");
        fontAwesome.innerHTML =
          '<link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.7.2/css/all.css" integrity="sha384-fnmOCqbTlWIlj8LyTjo7mOUStjsKC4pOpQbqyi7RrhN7udi9RwhKkMHpvLbHG9Sr" crossorigin="anonymous">';
        pdf.document.head.append(fontAwesome);

        var script = document.createElement("SCRIPT");
        script.src = "https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js";
        script.type = "text/javascript";
        script.onload = function() {
          var $ = window.jQuery;
        };
        pdf.document.head.appendChild(script);

        clientTimelinePDF.appendChild(clientTimeline);
        pdf.document.body.appendChild(clientTimelinePDF);
        pdf.document.body.appendChild(pdfStyles);

        let myJquery = document.createElement("script");
        myJquery.innerHTML = `
			setTimeout(function() {
				// Make rows draggable
				$(document).ready(function(){
				
				
					$('.move').mousedown(function(e) {
						var tr = $(e.target).closest("TR"),
							si = tr.index(),
							sy = e.pageY,
							b = $(document.body),
							drag;
						//if (si == 0) return;
						b.addClass("grabCursor").css("userSelect", "none");
						tr.addClass("grabbed");
				
						function move(e) {
							if (!drag && Math.abs(e.pageY - sy) < 10) return;
							drag = true;
							tr.siblings().each(function() {
								var s = $(this),
									i = s.index(),
									y = s.offset().top;
								if (i > 0 && e.pageY >= y && e.pageY < y + s.outerHeight()) {
									if (i < tr.index())
										s.insertAfter(tr);
									else
										s.insertBefore(tr);
									return false;
								}
							});
						}
				
						function up(e) {
							if (drag && si != tr.index()) {
								drag = false;
								// alert("moved!");
							}
							$(document).unbind("mousemove", move).unbind("mouseup", up);
							b.removeClass("grabCursor").css("userSelect", "none");
							tr.removeClass("grabbed");
						}
						$(document).mousemove(move).mouseup(up);
					});});
					
					//sort tasks by parents
					$($(".task").get().reverse()).each(function() {
						if ($(this).data('parentId')) {
							let curId = $(this).data('parentId');
							let childEl = $(this);
							$($(".task").get().reverse()).each(function() {
									if ($(this).data('id') == curId) {
										let parId = $(this).data('id');
										let parEl = $(this);
										//console.log("parent:" + $(parEl) + " child:" + $(childEl));
										//console.log(childEl);
										parEl.insertBefore(childEl);
									}
								})
							}
					
						});
						
						//let myEl = $("td.name:contains('INITIATE')").closest('tr');
						//let firstEl = $('tr.task')[0];
						
						
						
						$('#tagToggle').on("change", function() {
							if( $('#tagToggle').attr('checked') == "checked" ) {
								$(this).fadeOut().remove();
								$('.task').not("[data-tags]").not('.milestone').fadeOut().remove();
								$('#tagTool').fadeOut().remove();
							} else {
								//$('.task').not("[data-tags]").not('.milestone').show()
							}
						});
						
						$('#descToggle').on("change", function() {
							if( $('#descToggle').attr('checked') == "checked" ) {
								$(this).fadeOut().remove();
								$('td.description').fadeOut().remove();
								$('#descriptionTool').fadeOut().remove();
							} else {
								//
							}
						});
						
						$('#timeline').fadeIn();
								
				}, 2500);`;
        pdf.document.body.appendChild(myJquery);

        pdf.document.close();
      }
    });
  }

  buildTimeline(workspaceId);
})();
