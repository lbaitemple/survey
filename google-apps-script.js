/**
 * SAC Survey - Google Apps Script Backend
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://sheets.google.com and create a new spreadsheet
 * 2. Name the first sheet "Responses" 
 * 3. Add these headers in row 1:
 *    A: id | B: conferenceId | C: name | D: email | E: ieeeStatus | F: graduationTimeframe
 *    G: likelyJoinIEEE | H: awareYP | I: awareWIE | J: likelyAttend | K: openResponse
 *    L: submittedAt | M: isWinner
 * 4. Create a second sheet named "Winners" with headers:
 *    A: name | B: email | C: drawnAt
 * 5. Go to Extensions > Apps Script
 * 6. Delete any existing code and paste this entire file
 * 7. Click Deploy > New deployment
 * 8. Select "Web app" as the type
 * 9. Set "Execute as" to "Me"
 * 10. Set "Who has access" to "Anyone"
 * 11. Click Deploy and copy the Web app URL
 * 12. Paste that URL into your index.html where it says GOOGLE_SCRIPT_URL
 * 
 * IMPORTANT: If you update this script, you must create a NEW deployment!
 * Go to Deploy > Manage deployments > Create new version
 */

// Handle POST requests (save new response)
function doPost(e) {
  // Log incoming request for debugging
  Logger.log('doPost called');
  Logger.log('Event object: ' + JSON.stringify(e));
  
  try {
    // Check if e is undefined (happens when testing manually)
    if (!e || !e.postData) {
      Logger.log('ERROR: No event data received. e=' + JSON.stringify(e));
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'No POST data received. Make sure you are sending a POST request with a body.'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    Logger.log('postData.contents: ' + e.postData.contents);
    Logger.log('postData.type: ' + e.postData.type);
    
    // Get or create the Responses sheet
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Responses');
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Responses');
      sheet.appendRow(['id', 'conferenceId', 'name', 'email', 'ieeeStatus', 'graduationTimeframe',
                       'likelyJoinIEEE', 'awareYP', 'awareWIE', 'likelyAttend', 'openResponse',
                       'submittedAt', 'isWinner']);
      Logger.log('Created Responses sheet');
    }
    
    // Parse the incoming data
    let data;
    try {
      data = JSON.parse(e.postData.contents);
      Logger.log('Parsed data: ' + JSON.stringify(data));
    } catch (parseError) {
      Logger.log('Parse error: ' + parseError.toString());
      Logger.log('Raw contents: ' + e.postData.contents);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Failed to parse JSON: ' + parseError.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Check for duplicate email
    const existingData = sheet.getDataRange().getValues();
    const emailColumn = 3; // D column (0-indexed = 3)
    for (let i = 1; i < existingData.length; i++) {
      if (existingData[i][emailColumn] && 
          existingData[i][emailColumn].toString().toLowerCase() === data.email.toLowerCase()) {
        Logger.log('Duplicate email found: ' + data.email);
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: 'Email already submitted'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // Append new response
    sheet.appendRow([
      data.id || '',
      data.conferenceId || '',
      data.name || '',
      data.email || '',
      data.ieeeStatus || '',
      data.graduationTimeframe || '',
      data.likelyJoinIEEE || '',
      data.awareYP || '',
      data.awareWIE || '',
      data.likelyAttend || '',
      data.openResponse || '',
      data.submittedAt || new Date().toISOString(),
      data.isWinner ? 'Yes' : 'No'
    ]);
    
    Logger.log('SUCCESS: Added response for ' + data.email);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Response saved successfully'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle GET requests (fetch all responses for admin)
function doGet(e) {
  Logger.log('doGet called with: ' + JSON.stringify(e));
  
  try {
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'getResponses';
    
    if (action === 'getResponses') {
      return getResponses();
    } else if (action === 'getWinners') {
      return getWinners();
    } else if (action === 'markWinner') {
      return markWinner(e.parameter.email, e.parameter.name);
    } else if (action === 'resetAll') {
      return resetAllData();
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Unknown action'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getResponses() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Responses');
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const headers = ['id', 'conferenceId', 'name', 'email', 'ieeeStatus', 'graduationTimeframe',
                   'likelyJoinIEEE', 'awareYP', 'awareWIE', 'likelyAttend', 'openResponse',
                   'submittedAt', 'isWinner'];
  
  const responses = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      if (h === 'likelyJoinIEEE' || h === 'awareYP' || h === 'awareWIE' || h === 'likelyAttend') {
        obj[h] = parseInt(row[i]) || 0;
      } else if (h === 'isWinner') {
        obj[h] = row[i] === 'Yes' || row[i] === true;
      } else {
        obj[h] = row[i];
      }
    });
    return obj;
  }).filter(r => r.id); // Filter out empty rows
  
  return ContentService.createTextOutput(JSON.stringify(responses))
    .setMimeType(ContentService.MimeType.JSON);
}

function getWinners() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Winners');
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const winners = data.slice(1).map(row => ({
    name: row[0],
    email: row[1],
    drawnAt: row[2]
  })).filter(w => w.name);
  
  return ContentService.createTextOutput(JSON.stringify(winners))
    .setMimeType(ContentService.MimeType.JSON);
}

function markWinner(email, name) {
  // Update Responses sheet
  const responsesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Responses');
  const data = responsesSheet.getDataRange().getValues();
  const emailColumn = 3; // D column (0-indexed)
  const winnerColumn = 12; // M column (0-indexed)
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][emailColumn] && 
        data[i][emailColumn].toString().toLowerCase() === email.toLowerCase()) {
      responsesSheet.getRange(i + 1, winnerColumn + 1).setValue('Yes');
      break;
    }
  }
  
  // Add to Winners sheet
  let winnersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Winners');
  if (!winnersSheet) {
    winnersSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Winners');
    winnersSheet.appendRow(['name', 'email', 'drawnAt']);
  }
  winnersSheet.appendRow([name, email, new Date().toISOString()]);
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Winner marked successfully'
  })).setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// RESET ALL DATA - Clears both sheets
// ============================================
function resetAllData() {
  Logger.log('resetAllData called');
  
  try {
    // Clear Responses sheet (keep header row)
    const responsesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Responses');
    if (responsesSheet) {
      const lastRow = responsesSheet.getLastRow();
      if (lastRow > 1) {
        responsesSheet.deleteRows(2, lastRow - 1);
        Logger.log('Cleared ' + (lastRow - 1) + ' rows from Responses');
      }
    }
    
    // Clear Winners sheet (keep header row)
    const winnersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Winners');
    if (winnersSheet) {
      const lastRow = winnersSheet.getLastRow();
      if (lastRow > 1) {
        winnersSheet.deleteRows(2, lastRow - 1);
        Logger.log('Cleared ' + (lastRow - 1) + ' rows from Winners');
      }
    }
    
    Logger.log('SUCCESS: All data reset');
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'All data has been reset'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error in resetAllData: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// TEST FUNCTION - Run this to verify setup
// ============================================
// In Apps Script Editor: Click "Run" > Select "testSetup" > Click Run
function testSetup() {
  // Create or verify Responses sheet
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Responses');
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Responses');
    sheet.appendRow(['id', 'conferenceId', 'name', 'email', 'ieeeStatus', 'graduationTimeframe',
                     'likelyJoinIEEE', 'awareYP', 'awareWIE', 'likelyAttend', 'openResponse',
                     'submittedAt', 'isWinner']);
    Logger.log('✅ Created Responses sheet with headers');
  } else {
    Logger.log('✅ Responses sheet exists');
  }
  
  // Create or verify Winners sheet
  let winnersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Winners');
  if (!winnersSheet) {
    winnersSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Winners');
    winnersSheet.appendRow(['name', 'email', 'drawnAt']);
    Logger.log('✅ Created Winners sheet with headers');
  } else {
    Logger.log('✅ Winners sheet exists');
  }
  
  // Add a test row
  const testData = {
    id: 'test_' + new Date().getTime(),
    conferenceId: 'TEST001',
    name: 'Test User',
    email: 'test@example.com',
    ieeeStatus: 'IEEE Student',
    graduationTimeframe: 'Within 6 months',
    likelyJoinIEEE: 5,
    awareYP: 3,
    awareWIE: 2,
    likelyAttend: 4,
    openResponse: 'This is a test entry',
    submittedAt: new Date().toISOString(),
    isWinner: false
  };
  
  sheet.appendRow([
    testData.id,
    testData.conferenceId,
    testData.name,
    testData.email,
    testData.ieeeStatus,
    testData.graduationTimeframe,
    testData.likelyJoinIEEE,
    testData.awareYP,
    testData.awareWIE,
    testData.likelyAttend,
    testData.openResponse,
    testData.submittedAt,
    'No'
  ]);
  
  Logger.log('✅ Added test row to Responses sheet');
  Logger.log('🎉 Setup complete! Check your spreadsheet for the test entry.');
  Logger.log('📌 NEXT STEPS:');
  Logger.log('1. Deploy > New deployment > Web app');
  Logger.log('2. Execute as: Me');
  Logger.log('3. Who has access: Anyone');
  Logger.log('4. Copy the URL and paste into index.html');
}

// ============================================
// TEST doPost - Simulates a real POST request
// ============================================
// Run this to test doPost without an actual HTTP request
function testDoPost() {
  // Create a fake event object that mimics what a real POST request looks like
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        id: 'test_post_' + new Date().getTime(),
        conferenceId: 'TEST002',
        name: 'Test POST User',
        email: 'testpost_' + Date.now() + '@example.com', // Unique email
        ieeeStatus: 'IEEE Student',
        graduationTimeframe: 'Within 6 months',
        likelyJoinIEEE: 5,
        awareYP: 3,
        awareWIE: 2,
        likelyAttend: 4,
        openResponse: 'Testing doPost function directly',
        submittedAt: new Date().toISOString(),
        isWinner: false
      }),
      type: 'application/json'
    }
  };
  
  Logger.log('Testing doPost with simulated event...');
  const result = doPost(fakeEvent);
  Logger.log('Result: ' + result.getContent());
  Logger.log('✅ Check your Responses sheet for the new test entry!');
}
