function doPost(e) {
  const sheet = SpreadsheetApp.openById('1l20j_NhoLIYOtUDWhZfH6wdQ0Y2VsjdxaTf6Op_gd7s').getSheetByName('data');
  const data = JSON.parse(e.postData.contents);
  
  sheet.appendRow([
    data.kort1,
    data.kort2,
    data.kort3,
    data.kort4,
    data.kort5,
    data.hand,
    data.innehavare,
    data.timestamp
  ]);
  
  return ContentService.createTextOutput('Success');
}