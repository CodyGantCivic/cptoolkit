/*

function moveEmployee(intDir) {
  // This is applicaible for moving categories
	if (childType == 1) {
		// Should only be 'first (0)' or 'last (1)' direction:
		frmCat.lngCityDepartmentID.value = document.getElementById('divItem' + moveNid).parentNode.id.substr(3); // Old parent.
		frmCat.lngDestCityDepartmentID.value = nid; // New parent.
		frmCat.lngCityEmployeeID.value = moveNid; // What is moving.
		frmCat.lngDestCityEmployeeID.value = -1; // Not applicable.
	} else { // applicaible for moving actual people
		// Should only be 'above (2)' or 'below (3)' direction:
		frmCat.lngCityDepartmentID.value = document.getElementById('divItem' + moveNid).parentNode.id.substr(3); // Old parent.
		frmCat.lngDestCityDepartmentID.value = document.getElementById('divItem' + nid).parentNode.id.substr(3); // New parent.
		frmCat.lngCityEmployeeID.value = moveNid; // What is moving.
		frmCat.lngDestCityEmployeeID.value = nid; // Where moveNid will be placed relative to. It's new sibling.
	}
	frmCat.lngContainerID.value = "";
	frmCat.intDirection.value = intDir;
	frmCat.ysnSave.value = 1;
	frmCat.strPage.value = "ItemMoveEx";
	frmCat.submit();
}

childType:
  1 - category
  2 - staff (Person)

*/

/*
intDir
  0 - insert item as first in category
  1 - insert item as last in category
  2 - insert above
  3 - insert below


moveNid - origin id of the PERSON


nid - destination to move RELATIVE to????

frmCat - <form> on page with many <input> elements


const topMenu = $(".topmenu")
const children = topMenu.children("div[id^=div]")
children.map((_, e) => ({name: $(e).children("[id^=category]").text(), value: parseInt(e.id.substring(3))}))


 */

(async () => {
  /**
   * Gets the details for an element in the staff directory tree. This will differentiate between items and categories.
   *
   * @param elem
   * @returns {{name: string, id: string, type: string, elem: jQuery}}
   */
  function getDetails(elem) {
    elem = $(elem).get(0);

    let id, name, type;
    // Item
    if (elem.id.startsWith("divItem")) {
      type = "item";
      id = elem.id.substr(7);
      const nameElem = $(elem)
        .children(`#item${id}`)
        .get(0);

      name = $(nameElem).text();
    }
    // Category
    else if (elem.id.startsWith("div")) {
      type = "category";
      id = elem.id.substr(3);
      const nameElem = $(elem)
        .children(`#category${id}`)
        .get(0);

      name = $(nameElem).text();
    }
    // Unknown...
    else {
      throw new Error(`getDetails - Invalid item: ${elem.id}`);
    }

    return {
      type,
      id: parseInt(id, 10),
      name,
      elem,
    };
  }

  /**
   * Gets children of the specified element. This will be filtered to only select categories and items, differentiating
   *    between them.
   *
   * @param elem
   * @returns {{categories: jQuery, items: jQuery}}
   */
  function getChildren(elem) {
    const categories = $(elem)
      .children("[id^=div]:not([id^=divItem])")
      .toArray();

    const items = $(elem)
      .children("[id^=divItem]")
      .toArray();

    return {
      categories,
      items,
    };
  }

  /**
   * Moves element to the first spot in its category.
   *
   * @param moving: Element that you are putting first
   */
  async function moveElementFirst(moving) {
    const parentDetails = getDetails(moving.elem.parentElement);

    const params = {
      strResourceType: "M",
      lngResourceID: 4,
      intWhatShown: -1, // ?
      strPage: "ItemMoveEx",
      ysnSave: 1,
      ysnArchShowForce: -1,
      ysnTogglePersonal: 0,
      intTriggeredFrom: 0,
      intSibling: -1,

      // Important params below
      intDirection: 0,
      lngCityDepartmentID: parentDetails.id,
      lngDestCityDepartmentID: parentDetails.id,
      lngCityEmployeeID: moving.id,
      lngDestCityEmployeeID: -1,
      /*
      lngCityDepartmentID: 5
      lngDestCityDepartmentID: 5
      lngCityEmployeeID: 6
      lngDestCityEmployeeID: 7
       */
    };

    return await $.ajax({
      type: "POST",
      url: `https://${document.location.hostname}/Admin/Directory.aspx`,
      data: params,
    });
  }

  /**
   * Moves element relative to a separate element at the same level in the tree.
   *
   * @param moving: Element that you are trying to move
   * @param relative: Element you are moving relative to
   */
  async function moveElementBelow(moving, relative) {
    const parentDetails = getDetails(moving.elem.parentElement);

    const params = {
      strResourceType: "M",
      lngResourceID: 4,
      intWhatShown: -1, // ?
      strPage: "ItemMoveEx",
      ysnSave: 1,
      ysnArchShowForce: -1,
      ysnTogglePersonal: 0,
      intTriggeredFrom: 0,
      intSibling: -1,

      // Important params below
      intDirection: 3,
      lngCityDepartmentID: parentDetails.id,
      lngDestCityDepartmentID: parentDetails.id,
      lngCityEmployeeID: moving.id,
      lngDestCityEmployeeID: relative.id,
      /*lngCityDepartmentID: 5,
      lngDestCityDepartmentID: 5,
      lngCityEmployeeID: 7,
      lngDestCityEmployeeID: -1,*/
    };

    return await $.ajax({
      type: "POST",
      url: `https://${document.location.hostname}/Admin/Directory.aspx`,
      data: params,
    });
  }

  function sortDetails(details) {
    return details.sort((a, b) => {
      if (a.name > b.name) return 1;
      if (b.name > a.name) return -1;

      return 0;
    });
  }

  /**
   * This should call moveElementFirst and moveElementBelow to put each element into the proper order on the server.
   *
   * @param sorted
   */
  async function serverSort(sorted) {
    if (sorted.length > 0) {
      await moveElementFirst(sorted[0]);

      for (let i = 1; i < sorted.length; i += 1) {
        await moveElementBelow(sorted[i], sorted[i - 1]);
      }
    }
  }

  /**
   * Sorts this elements children. Will call helper functions to support the actual sorting of names, and sorting of
   *    elements on the server (what you see on the page)
   *
   * @param node
   */
  async function sortChildren(node) {
    node = $(node).get(0);
    const { categories, items } = getChildren(node);

    // Sort categories
    const categoryDetails = categories.map((e) => getDetails(e));
    const sortedCategories = sortDetails(categoryDetails);
    await serverSort(sortedCategories);

    // Sort items
    const itemDetails = items.map((e) => getDetails(e));
    const sortedItems = sortDetails(itemDetails);
    await serverSort(sortedItems);

    // Recurse into child nodes
    for (let i = 0; i < categories.length; i += 1) {
      await sortChildren(categories[i]);
    }
  }

  // Entry point for the script
  ajaxPostBackStart();

  await sortChildren("#div0");

  // Example usages of functions
  // await moveElementFirst(getDetails("#divItem7"));
  // await moveElementBelow(getDetails("#divItem6"), getDetails("#divItem5"));

  ajaxPostBackEnd();
  // setTimeout(() => location.reload(), 500);
})();
