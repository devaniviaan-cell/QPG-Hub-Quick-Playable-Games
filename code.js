/*
============================================================
QPG HUB GAME SUBMISSION BACKEND
Google Apps Script
============================================================

IMPORTANT:
Do NOT put your GitHub token or ADMIN_KEY in your HTML files.

Store them using the setup() function below.

============================================================
*/

const CONFIG = {

  /*
  YOUR TWO REVIEW EMAILS
  */
  REVIEW_EMAILS:
    "devaniviaan@gmail.com,26bwsmd020041@bh05.billabonghighschool.com",

  /*
  GITHUB REPOSITORY
  */
  GITHUB_OWNER:
    "QPG-Quick-Playable-Games",

  GITHUB_REPO:
    "QPG-Hub",

  GITHUB_BRANCH:
    "main",

  GITHUB_INDEX_PATH:
    "index.html",

  /*
  This text identifies the game grid.
  Your current QPG Hub uses a .games container.
  */
  GAMES_MARKER:
    '<div class="games">',

  /*
  Apps Script spreadsheet storage.
  */
  SHEET_NAME:
    "Submissions"

};


/*
============================================================
ONE-TIME SETUP
============================================================

Run setup() manually once from Apps Script.

It will ask you to enter:
- GitHub token
- Admin key

The values are stored in Script Properties, NOT in the
public HTML files.
============================================================
*/

function setup(){

  const props =
    PropertiesService
      .getScriptProperties();

  /*
  CHANGE THESE TWO VALUES BEFORE RUNNING setup().
  */

  const githubToken =
    "PASTE_YOUR_GITHUB_FINE_GRAINED_TOKEN_HERE";

  const adminKey =
    "CREATE_A_LONG_RANDOM_ADMIN_KEY_HERE";

  if(
    githubToken.includes("PASTE_") ||
    adminKey.includes("CREATE_")
  ){

    throw new Error(
      "Edit setup() first and enter your private GitHub token and admin key."
    );

  }

  props.setProperties({

    GITHUB_TOKEN:
      githubToken,

    ADMIN_KEY:
      adminKey

  });

  /*
  Create a spreadsheet if one does not already exist.
  */

  const existingId =
    props.getProperty("SPREADSHEET_ID");

  if(!existingId){

    const ss =
      SpreadsheetApp.create(
        "QPG Hub Game Submissions"
      );

    const sheet =
      ss.getSheets()[0];

    sheet.setName(
      CONFIG.SHEET_NAME
    );

    sheet.appendRow([
      "ID",
      "Submitted At",
      "Status",
      "User Name",
      "Game Name",
      "Emoji",
      "Description",
      "Category",
      "Email",
      "GitHub",
      "Game Link",
      "Game Code",
      "Decision Reason",
      "Decision At"
    ]);

    props.setProperty(
      "SPREADSHEET_ID",
      ss.getId()
    );

  }

  Logger.log(
    "QPG backend setup complete."
  );

}


/*
============================================================
WEB APP ENTRY
============================================================
*/

function doGet(e){

  const params =
    e && e.parameter
      ? e.parameter
      : {};

  const action =
    params.action || "";

  /*
  STATUS LOOKUP
  */

  if(action === "status"){

    return jsonp(
      getPublicStatus(params),
      params.callback
    );

  }

  /*
  ADMIN SUBMISSIONS
  */

  if(action === "list"){

    return jsonp(
      getAdminSubmissions(params),
      params.callback
    );

  }

  /*
  ADMIN DECISION
  */

  if(action === "decide"){

    return jsonp(
      processDecision(params),
      params.callback
    );

  }

  return output({
    ok:true,
    service:"QPG Hub Submission Backend",
    status:"online"
  });

}


/*
============================================================
SUBMISSION
============================================================
*/

function doPost(e){

  try{

    if(!e || !e.parameter){

      throw new Error(
        "No submission data received."
      );

    }

    const p =
      e.parameter;

    if(p.action !== "submit"){

      throw new Error(
        "Invalid submission action."
      );

    }

    /*
    Basic validation
    */

    const required = [
      "userName",
      "gameName",
      "gameEmoji",
      "gameDescription",
      "gameCategory",
      "userEmail",
      "gameLink",
      "gameCode"
    ];

    required.forEach(function(field){

      if(!String(p[field] || "").trim()){

        throw new Error(
          "Missing field: " + field
        );

      }

    });

    if(
      String(p.consent).toLowerCase()
      !== "true"
    ){

      throw new Error(
        "Submission permission was not given."
      );

    }

    /*
    Validate category.
    */

    const allowedCategories = [
      "dodge",
      "rhythm",
      "puzzle",
      "party",
      "3d"
    ];

    if(
      allowedCategories.indexOf(
        p.gameCategory
      ) === -1
    ){

      throw new Error(
        "Invalid game category."
      );

    }

    /*
    Validate email.
    */

    if(
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(p.userEmail)
    ){

      throw new Error(
        "Invalid email address."
      );

    }

    /*
    Validate game URL.
    */

    validateURL(
      p.gameLink
    );

    /*
    Generate real server-side submission ID.
    */

    const id =
      "QPG-" +
      Utilities.getUuid()
        .split("-")[0]
        .toUpperCase();

    const submittedAt =
      new Date();

    const submission = {

      id:id,

      submittedAt:
        submittedAt.toISOString(),

      status:"pending",

      userName:
        clean(p.userName,100),

      gameName:
        clean(p.gameName,100),

      gameEmoji:
        clean(p.gameEmoji,8),

      gameDescription:
        clean(p.gameDescription,2000),

      gameCategory:
        clean(p.gameCategory,30),

      userEmail:
        clean(p.userEmail,200),

      userGithub:
        clean(p.userGithub,300),

      gameLink:
        clean(p.gameLink,500),

      gameCode:
        String(p.gameCode || ""),

      reason:"",

      decisionAt:""

    };

    /*
    Save it first.
    */

    saveSubmission(
      submission
    );

    /*
    Send complete submission to BOTH reviewers.
    */

    sendReviewEmail(
      submission
    );

    /*
    Return a simple HTML response for the hidden iframe.
    */

    return HtmlService.createHtmlOutput(
      "<h2>Submission received.</h2>"
    );

  }catch(error){

    console.error(error);

    return HtmlService.createHtmlOutput(
      "<h2>Submission error</h2><p>" +
      escapeHTMLServer(
        error.message
      ) +
      "</p>"
    );

  }

}


/*
============================================================
SAVE SUBMISSION
============================================================
*/

function saveSubmission(submission){

  const sheet =
    getSheet();

  sheet.appendRow([

    submission.id,

    submission.submittedAt,

    submission.status,

    submission.userName,

    submission.gameName,

    submission.gameEmoji,

    submission.gameDescription,

    submission.gameCategory,

    submission.userEmail,

    submission.userGithub,

    submission.gameLink,

    submission.gameCode,

    submission.reason,

    submission.decisionAt

  ]);

}


/*
============================================================
EMAIL REVIEW TEAM
============================================================
*/

function sendReviewEmail(submission){

  const subject =
    "🎮 QPG Game Submission — " +
    submission.gameName;

  const body =

`NEW QPG HUB GAME SUBMISSION

==================================================
SUBMISSION
==================================================

Submission ID:
${submission.id}

Submitted:
${submission.submittedAt}

Status:
PENDING REVIEW


==================================================
CREATOR
==================================================

Name:
${submission.userName}

Email:
${submission.userEmail}

GitHub:
${submission.userGithub || "Not provided"}


==================================================
GAME
==================================================

Game Name:
${submission.gameName}

Emoji:
${submission.gameEmoji}

Category:
${submission.gameCategory}

Description:
${submission.gameDescription}

Game Link:
${submission.gameLink}


==================================================
COMPLETE GAME CODE
==================================================

${submission.gameCode}


==================================================
ADMIN
==================================================

Open your QPG Admin Panel to approve or decline this submission.

IMPORTANT:
APPROVE = add game to QPG Hub
DECLINE = do not modify QPG Hub

==================================================
`;

  MailApp.sendEmail({

    to:
      CONFIG.REVIEW_EMAILS,

    subject:
      subject,

    body:
      body,

    replyTo:
      submission.userEmail,

    name:
      "QPG Hub Game Submissions"

  });

}


/*
============================================================
GET ADMIN SUBMISSIONS
============================================================
*/

function getAdminSubmissions(params){

  if(
    !isAdmin(params.adminKey)
  ){

    return {
      ok:false,
      error:"Unauthorized"
    };

  }

  const sheet =
    getSheet();

  const values =
    sheet.getDataRange()
      .getValues();

  if(values.length <= 1){

    return {
      ok:true,
      submissions:[]
    };

  }

  const rows =
    values.slice(1);

  const submissions =
    rows.map(function(row){

      return {

        id: row[0],
        submittedAt: row[1],
        status: row[2],
        userName: row[3],
        gameName: row[4],
        gameEmoji: row[5],
        gameDescription: row[6],
        gameCategory: row[7],
        userEmail: row[8],
        userGithub: row[9],
        gameLink: row[10],
        gameCode: row[11],
        reason: row[12],
        decisionAt: row[13]

      };

    });

  return {

    ok:true,
    submissions:submissions

  };

}


/*
============================================================
PUBLIC STATUS
============================================================
*/

function getPublicStatus(params){

  const email =
    String(params.email || "")
      .trim()
      .toLowerCase();

  const gameName =
    String(params.gameName || "")
      .trim()
      .toLowerCase();

  if(!email || !gameName){

    return {
      ok:false
    };

  }

  const sheet =
    getSheet();

  const values =
    sheet.getDataRange()
      .getValues();

  for(
    let i = values.length - 1;
    i >= 1;
    i--
  ){

    const row =
      values[i];

    const rowEmail =
      String(row[8] || "")
        .trim()
        .toLowerCase();

    const rowGame =
      String(row[4] || "")
        .trim()
        .toLowerCase();

    if(
      rowEmail === email &&
      rowGame === gameName
    ){

      return {

        ok:true,

        status:
          String(row[2]),

        gameName:
          String(row[4]),

        reason:
          String(row[12] || "")

      };

    }

  }

  return {

    ok:true,

    status:"pending"

  };

}


/*
============================================================
APPROVE / DECLINE
============================================================
*/

function processDecision(params){

  if(
    !isAdmin(params.adminKey)
  ){

    return {
      ok:false,
      error:"Unauthorized"
    };

  }

  const id =
    String(params.id || "");

  const decision =
    String(params.status || "");

  if(
    decision !== "approved" &&
    decision !== "declined"
  ){

    return {
      ok:false,
      error:"Invalid decision."
    };

  }

  const sheet =
    getSheet();

  const values =
    sheet.getDataRange()
      .getValues();

  let rowNumber = -1;
  let submission = null;

  for(
    let i = 1;
    i < values.length;
    i++
  ){

    if(
      String(values[i][0])
      === id
    ){

      rowNumber =
        i + 1;

      submission = {

        id: values[i][0],
        submittedAt: values[i][1],
        status: values[i][2],
        userName: values[i][3],
        gameName: values[i][4],
        gameEmoji: values[i][5],
        gameDescription: values[i][6],
        gameCategory: values[i][7],
        userEmail: values[i][8],
        userGithub: values[i][9],
        gameLink: values[i][10],
        gameCode: values[i][11],
        reason: values[i][12],
        decisionAt: values[i][13]

      };

      break;

    }

  }

  if(
    !submission ||
    rowNumber === -1
  ){

    return {
      ok:false,
      error:"Submission not found."
    };

  }

  /*
  Prevent double decisions.
  */

  if(
    submission.status !== "pending"
  ){

    return {
      ok:false,
      error:
        "This submission has already been decided."
    };

  }

  const reason =
    String(params.reason || "")
      .substring(0,1000);

  /*
  ==========================================================
  DECLINE
  ==========================================================

  IMPORTANT:
  We DO NOT call GitHub here.
  Therefore nothing is added to QPG Hub.
  */

  if(decision === "declined"){

    sheet
      .getRange(rowNumber,3)
      .setValue("declined");

    sheet
      .getRange(rowNumber,13)
      .setValue(
        reason
      );

    sheet
      .getRange(rowNumber,14)
      .setValue(
        new Date().toISOString()
      );

    sendDecisionEmail(
      submission,
      "declined",
      reason
    );

    return {

      ok:true,
      status:"declined"

    };

  }

  /*
  ==========================================================
  APPROVE
  ==========================================================

  Only here do we modify GitHub.
  */

  try{

    addGameToQPGHub(
      submission
    );

    sheet
      .getRange(rowNumber,3)
      .setValue("approved");

    sheet
      .getRange(rowNumber,13)
      .setValue("");

    sheet
      .getRange(rowNumber,14)
      .setValue(
        new Date().toISOString()
      );

    sendDecisionEmail(
      submission,
      "approved",
      ""
    );

    return {

      ok:true,
      status:"approved"

    };

  }catch(error){

    console.error(error);

    /*
    IMPORTANT:
    If GitHub fails, the submission stays pending.
    This prevents the admin panel from claiming success
    when the Hub wasn't actually updated.
    */

    return {

      ok:false,

      error:
        "Approval failed before the submission was marked approved: " +
        error.message

    };

  }

}


/*
============================================================
ADD GAME TO QPG HUB
============================================================
*/

function addGameToQPGHub(submission){

  const token =
    PropertiesService
      .getScriptProperties()
      .getProperty("GITHUB_TOKEN");

  if(!token){

    throw new Error(
      "GitHub token is not configured."
    );

  }

  /*
  Get current index.html.
  */

  const apiURL =
    "https://api.github.com/repos/" +
    CONFIG.GITHUB_OWNER +
    "/" +
    CONFIG.GITHUB_REPO +
    "/contents/" +
    CONFIG.GITHUB_INDEX_PATH +
    "?ref=" +
    encodeURIComponent(
      CONFIG.GITHUB_BRANCH
    );

  const getResponse =
    UrlFetchApp.fetch(
      apiURL,
      {
        method:"get",
        headers:{
          "Authorization":
            "Bearer " + token,

          "Accept":
            "application/vnd.github+json",

          "X-GitHub-Api-Version":
            "2026-03-10"
        },

        muteHttpExceptions:true

      }
    );

  const getCode =
    getResponse.getResponseCode();

  if(getCode !== 200){

    throw new Error(
      "GitHub could not read index.html. HTTP " +
      getCode +
      ": " +
      getResponse.getContentText()
    );

  }

  const fileInfo =
    JSON.parse(
      getResponse.getContentText()
    );

  /*
  GitHub returns base64 content.
  */

  const currentHTML =
    Utilities.newBlob(
      Utilities.base64Decode(
        fileInfo.content.replace(/\s/g,"")
      )
    ).getDataAsString();

  /*
  Prevent duplicate game insertion.
  */

  const duplicateMarker =
    'data-qpg-submission="' +
    submission.id +
    '"';

  if(
    currentHTML.indexOf(
      duplicateMarker
    ) !== -1
  ){

    throw new Error(
      "This submission already exists in QPG Hub."
    );

  }

  /*
  Build the game card.

  NOTE:
  We use the submitted game LINK as the playable
  destination. We don't execute submitted code inside
  index.html.
  */

  const card =
`
<a class="card"
   data-cat="${escapeAttribute(submission.gameCategory)}"
   data-search="${escapeAttribute(
     (
       submission.gameName + " " +
       submission.gameDescription + " " +
       submission.gameCategory + " " +
       submission.userName
     ).toLowerCase()
   )}"
   data-qpg-submission="${escapeAttribute(submission.id)}"
   href="${escapeAttribute(submission.gameLink)}">

  <span class="scanline" aria-hidden="true"></span>

  <span class="cat-tag">
    ${escapeHTMLServer(
      categoryName(
        submission.gameCategory
      )
    )}
  </span>

  <span class="icon">
    ${escapeHTMLServer(
      submission.gameEmoji
    )}
  </span>

  <h2>
    ${escapeHTMLServer(
      submission.gameName
    )}
  </h2>

  <p>
    ${escapeHTMLServer(
      submission.gameDescription
    )}
  </p>

  <p class="qpg-creator">
    Created by ${escapeHTMLServer(
      submission.userName
    )}
  </p>

</a>
`;

  /*
  Find the first .games container.
  */

  const markerIndex =
    currentHTML.indexOf(
      CONFIG.GAMES_MARKER
    );

  if(markerIndex === -1){

    throw new Error(
      'Could not find <div class="games"> in index.html. No changes were made.'
    );

  }

  const insertPosition =
    markerIndex +
    CONFIG.GAMES_MARKER.length;

  const updatedHTML =
    currentHTML.slice(
      0,
      insertPosition
    ) +
    card +
    currentHTML.slice(
      insertPosition
    );

  /*
  Base64 encode updated file.
  */

  const encoded =
    Utilities.base64Encode(
      Utilities.newBlob(
        updatedHTML
      ).getBytes()
    );

  /*
  Update index.html.
  */

  const putResponse =
    UrlFetchApp.fetch(
      "https://api.github.com/repos/" +
      CONFIG.GITHUB_OWNER +
      "/" +
      CONFIG.GITHUB_REPO +
      "/contents/" +
      CONFIG.GITHUB_INDEX_PATH,
      {

        method:"put",

        headers:{

          "Authorization":
            "Bearer " + token,

          "Accept":
            "application/vnd.github+json",

          "X-GitHub-Api-Version":
            "2026-03-10",

          "Content-Type":
            "application/json"

        },

        payload:
          JSON.stringify({

            message:
              "Add approved game: " +
              submission.gameName,

            content:
              encoded,

            sha:
              fileInfo.sha,

            branch:
              CONFIG.GITHUB_BRANCH,

            committer:{

              name:
                "QPG Game Submission Bot",

              email:
                "qpg-game-submission-bot@users.noreply.github.com"

            }

          }),

        muteHttpExceptions:true

      }
    );

  const putCode =
    putResponse.getResponseCode();

  if(
    putCode !== 200 &&
    putCode !== 201
  ){

    throw new Error(
      "GitHub rejected the update. HTTP " +
      putCode +
      ": " +
      putResponse.getContentText()
    );

  }

}


/*
============================================================
SEND CREATOR DECISION EMAIL
============================================================
*/

function sendDecisionEmail(
  submission,
  decision,
  reason
){

  let subject;
  let body;

  if(decision === "approved"){

    subject =
      "🎉 Your game was approved — QPG Hub";

    body =

`Hello ${submission.userName},

Great news!

Your game "${submission.gameName}" has been APPROVED by the QPG team.

It has been added to the QPG Hub with:

Game:
${submission.gameName}

Category:
${categoryName(submission.gameCategory)}

Emoji:
${submission.gameEmoji}

Credits:
${submission.userName}

Game Link:
${submission.gameLink}

Thank you for submitting your game to QPG!

— QPG Hub Team
`;

  }else{

    subject =
      "QPG Hub submission update";

    body =

`Hello ${submission.userName},

Thank you for submitting "${submission.gameName}" to QPG Hub.

After review, the QPG team has decided not to approve the submission at this time.

${
  reason
  ? "Reason:\n" + reason + "\n"
  : ""
}

Nothing was added to the QPG Hub from this submission.

— QPG Hub Team
`;

  }

  MailApp.sendEmail({

    to:
      submission.userEmail,

    subject:
      subject,

    body:
      body,

    name:
      "QPG Hub"

  });

}


/*
============================================================
HELPERS
============================================================
*/

function getSheet(){

  const id =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        "SPREADSHEET_ID"
      );

  if(!id){

    throw new Error(
      "Spreadsheet has not been created. Run setup()."
    );

  }

  const ss =
    SpreadsheetApp.openById(id);

  let sheet =
    ss.getSheetByName(
      CONFIG.SHEET_NAME
    );

  if(!sheet){

    sheet =
      ss.insertSheet(
        CONFIG.SHEET_NAME
      );

  }

  return sheet;

}


function isAdmin(key){

  const stored =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        "ADMIN_KEY"
      );

  return Boolean(
    stored &&
    key &&
    String(key) === String(stored)
  );

}


function validateURL(value){

  const url =
    new URL(value);

  if(
    url.protocol !== "https:" &&
    url.protocol !== "http:"
  ){

    throw new Error(
      "Game link must use HTTP or HTTPS."
    );

  }

}


function clean(value,max){

  return String(
    value || ""
  )
  .trim()
  .substring(0,max);

}


function categoryName(category){

  const names = {

    dodge:
      "Dodge & Dash",

    rhythm:
      "Rhythm & Reflex",

    puzzle:
      "Puzzle & Brain",

    party:
      "Party",

    "3d":
      "3D Games"

  };

  return names[category] || category;

}


function escapeHTMLServer(value){

  return String(
    value || ""
  )
  .replace(/&/g,"&amp;")
  .replace(/</g,"&lt;")
  .replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;")
  .replace(/'/g,"&#039;");

}


function escapeAttribute(value){

  return escapeHTMLServer(
    value
  );

}


function output(obj){

  return ContentService
    .createTextOutput(
      JSON.stringify(obj)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );

}


function jsonp(obj,callback){

  /*
  Only allow simple JavaScript callback names.
  */

  if(
    !callback ||
    !/^[A-Za-z_$][A-Za-z0-9_$]*$/
      .test(callback)
  ){

    return output(obj);

  }

  return ContentService
    .createTextOutput(
      callback +
      "(" +
      JSON.stringify(obj) +
      ");"
    )
    .setMimeType(
      ContentService.MimeType.JAVASCRIPT
    );

}
