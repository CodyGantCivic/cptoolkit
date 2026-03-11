/*function createNewsItem(title, leadIn, text, readOnText) {
  $("#txtTitle").val(title);
  $("#ctl01_txtBriefDesc").val(leadIn);
  $(
    `<script>$jq213("#txtPageContent").froalaEditor('html.set', '` +
      text +
      `'); $jq213("#txtPageContent").froalaEditor('undo.saveStep');</script>`
  ).appendTo("body");
  $(".fr-element.fr-view").html("<p>" + text + "</p>");
  $("#txtLinkTitle1").val(readOnText);

  // Set end date to current date plus 2 years
  var currentDate = $("#dtiBeginningDate")
    .val()
    .split("/");
  var newEndDate = currentDate[0] + "/" + currentDate[1] + "/" + (parseInt(currentDate[2]) + 2);
  $("#dtiEndingDate").val(newEndDate);

  // Once the image is changed, save the button
  imageChangeObserver = new MutationObserver(function(mutation) {
    $("#btnSaveAndPublishAlertDetails").click();
  });
  imageChangeObserver.observe($(".imagePreview")[0], { attributes: true });

  // Open the image picker dialog
  $(".chooseImage").click();
}*/

const startDate = new Date();
startDate.setDate(startDate.getDate() - 7);

const endDate = new Date();
endDate.setDate(endDate.getDate() + 365);

function createNewsItem(category, { title, description, fullText, readOnText = "Read More" }) {
  const data = {
    CategoryId: category,
    Name: title,
    Description: description,
    Status: "Published",
    StartDate: startDate.toISOString(),
    EndDate: endDate.toISOString(),
    FullText: fullText,
    ReadOnText: readOnText,
    NotifyMePopup: {
      SendType: "None"
    }
  };

  fetch("/api/NewsFlash/v1/Item", {
    method: "POST",
    body: JSON.stringify(data),
    credentials: "include"
  })
    .then((resp) => {
      console.log("resp");
      console.log(resp);
    })
    .catch((err) => {
      console.error("Failure creating news items");
      console.error(err);
    });
}

/*$.ajax({
  type: "POST",
  url: "/admin/civicalerts.aspx",
  data: data
}).done((resp) => {
  console.log("resp");
  console.log(resp);
});*/

const exampleItems = [
  {
    title: "Example Item",
    description: "This is an example lead-in. Lorem ipsum dolor sit amet.",
    fullText: "Example",
    readOn: "Read More"
  },
  {
    title: "Example Item with a longer headline so that it spans multiple lines. Lorem ipsum dolor sit amet dol.",
    description:
      "This is an example lead-in of the maximum length (255 characters). Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet. Lorem ipsum doloris.",
    fullText: "Example",
    readOn: "Read More"
  },
  {
    title: "Example Item",
    description:
      "This is an example lead-in of the maximum length (255 characters). Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet. Lorem ipsum doloris.",
    fullText: "Example",
    readOn: "Read More"
  }
];

const category = document.getElementsByName("lngCivicAlertCategoryID")[0].value;
// exampleItems.forEach((item) => createNewsItem(item));
createNewsItem(category, exampleItems[0]);
/*
CivicPlus.SDK.Entities.Dto.NewsFlash.Item {
Id (integer, optional): Item Id ,
CategoryId (integer, optional): Category Id that item is associated with ,
Name (string): Name of item ,
Description (string, optional): Description of Item ,
Status (string, optional): Item Status = ['Deleted', 'MovedToArchived', 'DeletedWithPermissionsIntact', 'Draft', 'DraftExpired', 'DraftPending', 'Rejected', 'Submitted', 'WaitingForApproval', 'Void', 'AwaitingPayment', 'Expired', 'Pending', 'Archived', 'Published'],
StartDate (string, optional): The starting date and time of the NewsFlash item. ,
EndDate (string, optional): The ending date and time of the NewsFlash item. ,
FullText (string, optional): A full, detailed description of the Newsflash item. ,
OrderIndex (integer, optional): Order of item in category ,
ReadOnText (string, optional): Message users click on at the end of the brief description to access the full description screen. ,
LinkUrl (string, optional): NewsFlash link's url. ,
LinkOpenInNewWindow (boolean, optional): Does this link open in new window ,
LinkDisplayText (string, optional): Display text for the link with this NewsFlash item. ,
PhotoPath (string, optional): Folder path to the photo ,
PhotoPathWithoutFile (string, optional),
PhotoAltText (string, optional): Photo's alternative text. ,
PhotoIsAlignLeft (boolean, optional): Does the photo have left alignment, if false it has right alignment. ,
PhotoName (string, optional): Photo name. ,
Photo (string, optional): A Base64 string representing a photo. ,
NotifyMePopup (CivicPlus.SDK.Entities.Dto.NewsFlash.Popup, optional): NotifyMe Popup information when saving item ,
LastModifiedBy (integer, optional): Which user was the last to modify the item ,
LastModifiedOn (string, optional): When was the item last modified ,
ShowArchives (boolean, optional): Are item archives publically visible. ,
ShowInRssFeed (boolean, optional): True to show item in RSS Feed.
}
CivicPlus.SDK.Entities.Dto.NewsFlash.Popup {
SendOptions (Array[string], optional): Available Send Options for current module ,
SendType (string, optional): When to send notification = ['None', 'Immediately', 'OnStart', 'NumberDaysBefore'],
Comments (string, optional): Message comments ,
SmsComments (string, optional): Sms Message Comments ,
TxtSubject (string, optional),
IncludeStatusInEmailSubject (boolean, optional): True to include New or Modified status in email subject. ,
IncludeLinkIntoSms (boolean, optional): True to include Link to event into in SMS mesasges.
}
 */
