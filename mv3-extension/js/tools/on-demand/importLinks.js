function getToday() {
  let today = new Date();
  let dd = today.getDate();
  let mm = today.getMonth() + 1; // January is 0!
  let yyyy = today.getFullYear();

  if (dd < 10) dd = "0" + dd;
  if (mm < 10) mm = "0" + mm;
  today = mm + "/" + dd + "/" + yyyy;
  return today;
}

async function linkIsValid(link) {
  try {
    const req = await fetch(link, { method: "HEAD" });
    return req.status >= 200 && req.status < 300;
  } catch (e) {
    return false;
  }
}

async function addQuickLink(categoryID, today, title, url = "/") {
  // const valid = await linkIsValid(url);
  const valid = true;

  const params = {
    lngResourceID: 29,
    strResourceType: "M",
    ysnSave: 1,
    intQLCategoryID: categoryID,
    txtCategoryIDListSave: categoryID,
    strAction: "qlLinkSave",
    strActionSubmit: 0,
    save: valid ? "Save and Publish" : "Save",
    dtiStartDate: today
  };

  return $.ajax({
    type: "POST",
    url: `/admin/quicklinks.aspx`,
    data: {
      ...params,
      txtLink: url,
      txtLinkText: title
    }
  }).then(() => {
    console.log(`Created [${title}]: ${url}`);
  });
}

function createQLCategory(name) {
  const params = {
    lngResourceID: 29,
    strResourceType: "M",
    ysnSave: 1,
    intQLCategoryID: 0,
    strAction: "qlCategorySave",
    ysnPublishDetail: 1,
    txtName: name,
    txtGroupViewList: 2,
    txtGroupAuthorList: 2,
    txtGroupPublishList: 2,
    txtGroupOwnerList: 2
  };

  return $.ajax({
    type: "POST",
    url: `https://${document.location.hostname}/admin/quicklinks.aspx`,
    data: params
  }).then(() => {
    console.log(`Created category: ${name}`);
  });
}

function getMatches(re, str) {
  const matches = [];
  let match = re.exec(str);
  while (match !== null) {
    matches.push(match);
    match = re.exec(str);
  }
  return matches;
}

async function importLinks() {
  try {
    const rawData = prompt("Paste here: ");
    if (!rawData || !rawData.trim()) return false;
    const today = getToday();
    const data = JSON.parse(rawData);
    let catID = document.getElementsByName("intQLCategoryID");
    let req;
    if (catID.length > 2 && catID[1].value) {
      catID = catID[1].value;
    } else {
      const catName = prompt("Category name? ");
      req = createQLCategory(catName);

      req.then((resp) => {
        const startIndex = resp.indexOf('<table class="classicCategories" summary="Categories"');
        let parseString = resp.substring(startIndex);
        const endIndex = parseString.indexOf("</table>");
        // " + 9" adjusts the index to include the closing tag.
        parseString = parseString.substring(0, endIndex + 8);

        const re = /<a href="" onclick="categoryDetails\((\d+), false, \d+\); return false;">(.+)<\/a>/g;
        let cats = getMatches(re, parseString);
        cats = cats.filter((cat) => cat[2] === catName);
        if (cats.length !== 1) {
          console.error("Categories in response failed to capture...");
          console.error(cats);
          console.error(parseString);
          throw new Error("Categories in response failed to capture...");
        }
        catID = cats[0][1];
      });
    }
    if (req) await req;
    // Await each, because we want to maintain order of links.
    for (const cat of data) {
      await addQuickLink(catID, today, cat[0], cat[1]);
    }
  } catch (e) {
    alert("Failed to import links...");
    console.error("[CP Toolkit]: Failed to import links...");
    console.error(e);
  }
  return true;
}

(async () => {
  ajaxPostBackStart();
  const stat = await importLinks();
  ajaxPostBackEnd();

  if (!stat) return;

  if (location.href.toLowerCase().indexOf("quicklinks.aspx") > -1) {
    setTimeout(() => location.reload(), 500);
  } else {
    alert("Success!");
  }
})();

/*
// System does not return valid XML. Parse by hand.
// const parser = new DOMParser();
// const xmlDoc = parser.parseFromString(parseString, "text/xml");
// const matchingCats = getMatchingCategories(xmlDoc, catName);

function getMatchingCategories(doc, name) {
const rawCats = doc.querySelectorAll("table.classicCategories tr");
console.log(rawCats);
return [...rawCats].filter((cat) => {
  console.log("CAT");
  console.log(cat);
  const isCat = cat.querySelectorAll("select").length > 0;
  console.log(isCat);
  if (!isCat) return false;
  let catName = cat.querySelector("td:first-child a");
  console.log(catName);
  if (catName === null) return false;
  console.log(catName.innerText);
  return catName.innerText === name;
});
}

*/
