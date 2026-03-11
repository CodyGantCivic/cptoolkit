function addLayout(name, type, xml, css) {

}

function addMigrationLayouts() {

}

addMigrationLayouts();

/*

Layouts:
  Create layout

  Update layout


Actual:
  POST /Admin/DesignCenter/Layouts/Create

  <form method="post" action="Create">
    <input name="__RequestVerificationToken" ...>

  function save(url, activate) {

  // Validate name
	if ($('#txtStructureName').val().trim() == "") {
		alert(layoutLocalization.LayoutNameRequired);
		return;
  }
  // Validate name
	if ($('#txtStructureName').val().match(/\?|"|\\|\/|\*|<|>|\|/)) {
		alert(layoutLocalization.StructureNameInvalidCharacters);
		return;
	}
  //Validations for Layout Create Page and not for Layout Modify page
	if (url.indexOf("/Create") != -1) {
	    if ($('#structureFile').val().trim() == "") {
	        alert(layoutLocalization.XmlFileRequired);
	        return;
	    }
	    if ($('#layoutCssFile').val().trim() == "") {
	        if (!confirm(layoutLocalization.CssFileNotUploadedMessage))
	            return;
	    }
  }
  // Validate main breakpoint
	if (!$('#mainMenuBreakpoint').val().match(/\d+(em|px)$/)) {
		alert(layoutLocalization.MainMenuBreakpointNoValid);
		return;
	}
	$('.save').addClass("inactive");
	
	var errorString = '';
	$('#aspnetForm').ajaxSubmit({
		type: 'POST',
		url: url,
		data: {"activate": activate},
		cache: false,
		iframe: true,
		dataType: 'json',
		success: function (response) {
			$('.save').removeClass("inactive");
			if (response.ErrorMessage) {
				$('#SpecificErroreMessage').html(response.ErrorMessage);
				$('#ErrorMessage').slideDown();
			} else {
				var redirectPage = function () {
					window.location.href = '/Admin/DesignCenter/Layouts';
				};
				if (!response.CanCreate)
					errorString += layoutLocalization.NotValidLayoutName + '\n';
				if (!response.IsXml)
					errorString += layoutLocalization.NotValidXmlFile + '\n';
				if (!response.IsCss)
					errorString += layoutLocalization.NotValidCssFile + '\n';
				if (errorString != '')
					alert(errorString);
				else
					redirectPage();
			}
		},
		beforeSend: function () {
		    ajaxPostBackStart('Saving Layout.<br/>This process could take some minutes.<br/>Please do not close you browser or navigate away from the page.');
		},
		error: function (xhr, textStatus, exception) {
			alert('Error: ' + xhr.statusText + '\nStatus: ' + xhr.status);
		},
		complete: function () {
			ajaxPostBackEnd();
		}
	});
}

*/