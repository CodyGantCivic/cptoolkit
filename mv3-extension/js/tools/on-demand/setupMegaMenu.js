function setOptions(pageID, contentCollectionID, widgetID, contentContainerID, skinID, columnCount) {
  return $.ajax({
    url: `\
/Pages/PagesWidget/Save?\
pageID=${pageID}&\
contentCollectionID=${contentCollectionID}&\
widgetID=${widgetID}&\
contentContainerID=${contentContainerID}&\
moduleID=null`,
    type: "POST",
    data: {
      options: [
        {
          WidgetID: widgetID,
          Name: "Format",
          Value: "3",
          ModuleWidgetOptionSetOptionID: 0
        },
        {
          WidgetID: widgetID,
          Name: "ColumnCount",
          Value: columnCount,
          ModuleWidgetOptionSetOptionID: 0
        },
        {
          WidgetID: widgetID,
          Name: "HeaderText",
          Value: "",
          ModuleWidgetOptionSetOptionID: 0
        },
        {
          WidgetID: widgetID,
          Name: "Depth",
          Value: "2",
          ModuleWidgetOptionSetOptionID: 0
        },
        {
          WidgetID: widgetID,
          Name: "WidgetSkinID",
          Value: skinID,
          ModuleWidgetOptionSetOptionID: 0
        }
      ],
      additionalOptions: [{ key: "WidgetBreakpoint", value: "25" }]
    }
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSkinID() {
  const handle = $("a.handle.options.insideMegaMenu");
  if (handle.length > 0) handle[0].click();

  await sleep(500);
  let skinList = $(".cpTabPanel.insideMegaMenu select#skin > option");

  function filterSkins(opts, list) {
    return list.filter((_, skin) => {
      const name = skin.innerText;
      for (const matchElem of opts) {
        if (name.toLowerCase().indexOf(matchElem) !== -1) {
          return true;
        }
      }
      return false;
    });
  }

  let matchingSkins = filterSkins(["mega", "menu", "mm"], skinList);

  let skinID;
  if (matchingSkins.length > 1) {
    // prettier-ignore
    const resp = prompt(`Multiple matching skins, enter one of: [${
      matchingSkins.map((skin) => skin.innerText).join(", ")
    }]`).toLowerCase();

    matchingSkins = filterSkins([resp], matchingSkins);
    if (matchingSkins.length === 1) skinID = matchingSkins[0].value;
    else skinID = skinList[0].value;
  } else if (matchingSkins.length === 1) {
    skinID = matchingSkins[0].value;
  } else {
    alert("No matching skin found. Setting to skinList[0]");
    skinID = skinList[0].value;
  }

  return skinID;
}

(async () => {
  const requests = [];

  const skinID = await getSkinID();
  const columnCount = prompt("Column count? ");
  const contentCollectionID = $("input#hdnContentCollectionID")[0].value;

  const mainNavItems = $(".rootNavMenu#mainNavMenu > li.topMenuItem").filter(
    (_, navItem) => navItem.getAttribute("data-displaymegamenu") === "True"
  );
  for (let i = 0; i < mainNavItems.length; i++) {
    const navItem = mainNavItems[i];

    const pageID = navItem.getAttribute("data-pageid");

    const mmContainer = $(`.megaMenuContainer.pageID_${pageID}`);
    if (mmContainer.length !== 1) {
      console.warn(`Failed to set Mega Menu options on ${navItem.innerText}`);
      alert(`Failed to set Mega Menu options on ${navItem.innerText}`);
      continue;
    }

    const contentContainer = mmContainer.find(" > div.pageContent");
    if (contentContainer.length !== 1) {
      console.warn(`Failed to find contentContainer on ${navItem.innerText}`);
      alert(`Failed to find contentContainer on ${navItem.innerText}`);
      continue;
    }
    const contentContainerID = contentContainer[0].getAttribute("data-containerid");

    // Unsure if this is the best way to find, but it seemed like the most filtered option...?
    const mmWidgetHandle = contentContainer.find(
      " > .row.outer > .col.outer > .row.nest > .col.inner > a.handle.options.insideMegaMenu"
    );
    if (mmWidgetHandle.length !== 1) {
      console.warn(`Failed to find widget handle on ${navItem.innerText}`);
      alert(`Failed to find widget handle on ${navItem.innerText}`);
      continue;
    }
    const widgetID = mmWidgetHandle[0].getAttribute("data-widgetid");

    requests.push(setOptions(pageID, contentCollectionID, widgetID, contentContainerID, skinID, columnCount));
  }

  await Promise.all(requests);
  setTimeout(() => {
    window.location.reload();
  }, 500);
})();
