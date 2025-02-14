CREATE TABLE "PRC332" (
"MyOBSI_ID" int,
"_obsiID" int,
"csInvoiceID" int,
"DateStart" datetime,
"TimeStart" datetime,
"TimeEnd" datetime,
"ElapsedTime" int,
"Billable_Time_Rounded" int,
"Hourly_Rate" int,
"Work Performed" varchar(255),
"total Time" int,
"__ID" varchar(255),
"_projectID" varchar(255),
"f_dnb" varchar(255),
"f_billed" varchar(255),
"weekNo" int,
"sumTimebyWeek" int,
"year" int,
"sumTimebyDay" int,
"sumTimebyYear" int,
"f_omit" varchar(255),
"month" int,
"sumTimebyProject" int,
"_staffID" varchar(255),
"~CreatedBy" varchar(255), /*Account name of the user who created each record*/
"~CreationTimestamp" datetime, /*Date and time each record was created*/
"~ModificationTimestamp" datetime, /*Date and time each record was last modified*/
"~ModifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"_taskID" varchar(255),
"~recordId" int,
PRIMARY KEY (__ID),
FOREIGN KEY (_projectID) REFERENCES customers_Projects(__ID)
);

CREATE TABLE "Customers" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~creationTimestamp" datetime, /*Date and time each record was created*/
"~createdBy" varchar(255), /*Account name of the user who created each record*/
"~modificationTimestamp" datetime, /*Date and time each record was last modified*/
"~modifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"Name" varchar(255), /*Account name of the user who last modified each record*/
"OBSI ClientNo" varchar(255), /*Account name of the user who last modified each record*/
"chargeRate" int,
"Email" varchar(255),
"_stripeOrgID_deprecated" varchar(255),
"f_USD" varchar(255),
"f_prePay" int,
"fundsAvailable" int,
"phone" varchar(255),
"E164number" varchar(255),
"f_active" int,
"dbPath" varchar(255),
"dbUserName" varchar(255),
"dbPasword" varchar(255),
"f_EUR" varchar(255),
"_stripeID" varchar(255),
"_qbID" varchar(255),
"_qbSyncID" varchar(255),
"_devteamID" varchar(255),
"g_projectID" varchar(255),
"~recordId" int,
PRIMARY KEY (__ID),
FOREIGN KEY (g_projectID) REFERENCES customersPROJECTID__Projects(__ID),
FOREIGN KEY (_devteamID) REFERENCES customers_DevTeam(__ID)
);

CREATE TABLE "customers_Projects" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~creationTimestamp" datetime, /*Date and time each record was created*/
"~createdBy" varchar(255), /*Account name of the user who created each record*/
"~modificationTimestamp" datetime, /*Date and time each record was last modified*/
"~modifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"projectName" varchar(255),
"_custID" varchar(255),
"status" varchar(255),
"estOfTime" datetime,
"_teamID" varchar(255),
"userName" varchar(255),
"password" varchar(255),
"dataName" varchar(255),
"dataPath" varchar(255),
"~recordId" int,
PRIMARY KEY (__ID),
FOREIGN KEY (_custID) REFERENCES Customers(__ID)
);

CREATE TABLE "projectObjectives" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~creationTimestamp" datetime, /*Date and time each record was created*/
"~createdBy" varchar(255), /*Account name of the user who created each record*/
"~modificationTimestamp" datetime, /*Date and time each record was last modified*/
"~modifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"projectObjective" varchar(255),
"_projectID" varchar(255),
"Status" varchar(255),
"f_completed" int,
PRIMARY KEY (__ID),
FOREIGN KEY (_projectID) REFERENCES customers_Projects(__ID)
);

CREATE TABLE "Selector" (
"g_text" varchar(255),
"xOr" varchar(255),
"g_ID" varchar(255),
"g_Container" varchar(255),
"g_url" varchar(255),
"g_result" varchar(255),
"g_assignedTeam" varchar(255),
"g_customerIDS" varchar(255),
"g_qboID" varchar(255),
FOREIGN KEY (g_customerIDS) REFERENCES selectorCustomerIDS_Customers(__ID),
FOREIGN KEY (g_ID) REFERENCES selector|ID_PRC332(__ID),
FOREIGN KEY (xOr) REFERENCES Customers(__ID)
);

CREATE TABLE "projectObjectiveSteps" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~creationTimestamp" datetime, /*Date and time each record was created*/
"~createdBy" varchar(255), /*Account name of the user who created each record*/
"~modificationTimestamp" datetime, /*Date and time each record was last modified*/
"~modifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"projectObjectiveStep" varchar(255),
"_projectID" varchar(255),
"Status" varchar(255),
"f_completed" int,
"_objectiveID" varchar(255),
PRIMARY KEY (__ID),
FOREIGN KEY (_objectiveID) REFERENCES projectObjectives(__ID)
);

CREATE TABLE "selector|ID_PRC332" (
"MyOBSI_ID" int,
"_obsiID" int,
"csInvoiceID" int,
"DateStart" datetime,
"TimeStart" datetime,
"TimeEnd" datetime,
"ElapsedTime" int,
"Billable_Time_Rounded" int,
"Hourly_Rate" int,
"Work Performed" varchar(255),
"total Time" int,
"__ID" varchar(255),
"_projectID" varchar(255),
"f_dnb" varchar(255),
"f_billed" varchar(255),
"weekNo" int,
"sumTimebyWeek" int,
"year" int,
"sumTimebyDay" int,
"sumTimebyYear" int,
"f_omit" varchar(255),
"month" int,
"sumTimebyProject" int,
"_staffID" varchar(255),
"~CreatedBy" varchar(255), /*Account name of the user who created each record*/
"~CreationTimestamp" datetime, /*Date and time each record was created*/
"~ModificationTimestamp" datetime, /*Date and time each record was last modified*/
"~ModifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"_taskID" varchar(255),
"~recordId" int,
PRIMARY KEY (__ID)
);

CREATE TABLE "twillioSMS" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~CreationTimestamp" datetime, /*Date and time each record was created*/
"~CreatedBy" varchar(255), /*Account name of the user who created each record*/
"~ModificationTimestamp" datetime, /*Date and time each record was last modified*/
"~ModifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"twillioAccountID" varchar(255),
"twillioAuthToken" varchar(255),
"twilioNumber" varchar(255),
"message" varchar(255),
"media" varbinary(4096),
"sendTo" varchar(255),
"result" varchar(255),
"mediaURL" varchar(255),
"companyName" varchar(255),
PRIMARY KEY (__ID)
);

CREATE TABLE "customers_Messages" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~creationTimestamp" datetime, /*Date and time each record was created*/
"~createdBy" varchar(255), /*Account name of the user who created each record*/
"~modificationTimestamp" datetime, /*Date and time each record was last modified*/
"~modifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"_custID" varchar(255),
"media" varbinary(4096),
"mediaURL" varchar(255),
"message" varchar(255),
"result" varchar(255),
"sendTo" varchar(255),
"f_messageDirection" int, /*1 is outgoing and 0 is incoming*/
PRIMARY KEY (__ID),
FOREIGN KEY (_custID) REFERENCES Customers(__ID)
);

CREATE TABLE "DataAPI" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~CreationTimestamp" datetime, /*Date and time each record was created*/
"~CreatedBy" varchar(255), /*Account name of the user who created each record*/
"~ModificationTimestamp" datetime, /*Date and time each record was last modified*/
"~ModifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"serverName" varchar(255),
"serverAddress" varchar(255),
"pwHash" varchar(255),
"readMe" varchar(255),
PRIMARY KEY (__ID)
);

CREATE TABLE "projectImages" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~creationTimestamp" datetime, /*Date and time each record was created*/
"~createdBy" varchar(255), /*Account name of the user who created each record*/
"~modificationTimestamp" datetime, /*Date and time each record was last modified*/
"~modifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"file" varbinary(4096),
"_fkID" varchar(255),
"fileName" varchar(255),
"image" varbinary(4096),
"image_base64" varchar(255),
"image_thm" varbinary(4096),
"f_processed" varchar(255),
"~recordId" int,
PRIMARY KEY (__ID),
FOREIGN KEY (_fkID) REFERENCES customers_Projects(__ID)
);

CREATE TABLE "projectLinks" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~creationTimestamp" datetime, /*Date and time each record was created*/
"~createdBy" varchar(255), /*Account name of the user who created each record*/
"~modificationTimestamp" datetime, /*Date and time each record was last modified*/
"~modifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"_fkID" varchar(255),
"link" varchar(255),
"~recordId" int,
PRIMARY KEY (__ID),
FOREIGN KEY (_fkID) REFERENCES customers_Projects(__ID)
);

CREATE TABLE "customers_Environment" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~creationTimestamp" datetime, /*Date and time each record was created*/
"~createdBy" varchar(255), /*Account name of the user who created each record*/
"~modificationTimestamp" datetime, /*Date and time each record was last modified*/
"~modifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"_custID" varchar(255),
"host" datetime,
"dbPasword" varchar(255),
"dbPath" varchar(255),
"dbUserName" varchar(255),
PRIMARY KEY (__ID),
FOREIGN KEY (_custID) REFERENCES Customers(__ID)
);

CREATE TABLE "selector|ID_Logs" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~creationTimestamp" datetime, /*Date and time each record was created*/
"~createdBy" varchar(255), /*Account name of the user who created each record*/
"~modificationTimestamp" datetime, /*Date and time each record was last modified*/
"~modifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"_projectID" varchar(255),
"log" varchar(255),
"_custID" varchar(255),
"type" varchar(255),
"_mj_messageID" varchar(255),
"sentBy" varchar(255),
"sentTo" varchar(255),
"message" varchar(255),
"error" varchar(255),
"_taskID" varchar(255),
PRIMARY KEY (__ID)
);

CREATE TABLE "Organization" (
"User Name" varchar(255),
"Slogan" varchar(255),
"Prov" varchar(255),
"Postal Code" varchar(255),
"Main Phone" varchar(255),
"Logo" varbinary(4096),
"Email" varchar(255),
"Corporate Name" varchar(255),
"City" varchar(255),
"Address" varchar(255),
"License Key" varchar(255),
"Passcode" varchar(255),
"_connectionID" varchar(255),
"version" varchar(255),
"GST No" int,
"GST Rate" int,
"PST Rate" int,
"__ID" varchar(255),
"dateCREATED" datetime,
"dateCREATOR" varchar(255),
"dateMODIFIED" datetime,
"dateMODIFIER" varchar(255),
"dateMODIFIED host" datetime,
"base rate" int,
"serverResponse" varchar(255),
"dateMODIFIED sync utc" int,
"Logo b64" varchar(255),
"Logo fileName" varchar(255),
"dateMODIFIED utc" int, /*Used by FMEasySync to keep track of changes made to remote records.*/
"SMS Number" varchar(255),
"Corporate Start Date" datetime,
"qb_ClientID" varchar(255),
"qb_ClientSecret" varchar(255),
"qb_accessCode" varchar(255),
"qb_relmID" varchar(255),
"qb_accessToken" varchar(255),
"qb_refreshToken" varchar(255),
"qb_version" varchar(255),
"_qbStateID" int,
"qb_refreshTokenDate" datetime,
"deviceModifiedID" varchar(255),
"_qbSyncID" varchar(255),
"_qbID" varchar(255),
"emailBookKeeping" varchar(255),
"mj_apiToken" varchar(255),
"mj_apiKey" varchar(255),
"qb_accessTokenDate" datetime,
PRIMARY KEY (__ID)
);

CREATE TABLE "HTML" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~CreationTimestamp" datetime, /*Date and time each record was created*/
"~CreatedBy" varchar(255), /*Account name of the user who created each record*/
"~ModificationTimestamp" datetime, /*Date and time each record was last modified*/
"~ModifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"name" varchar(255),
"HTML" varchar(255),
"readMe" varchar(255),
PRIMARY KEY (__ID)
);

CREATE TABLE "Teams" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~CreationTimestamp" datetime, /*Date and time each record was created*/
"~CreatedBy" varchar(255), /*Account name of the user who created each record*/
"~ModificationTimestamp" datetime, /*Date and time each record was last modified*/
"~ModifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"name" varchar(255),
PRIMARY KEY (__ID)
);

CREATE TABLE "TeamMembers" (
"__ID" varchar(255),
"~CreationTimestamp" datetime, /*Date and time each record was created*/
"~CreatedBy" varchar(255), /*Account name of the user who created each record*/
"~ModificationTimestamp" datetime, /*Date and time each record was last modified*/
"~ModifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"name" varchar(255),
"role" varchar(255),
"_teamID" varchar(255),
"_staffID" varchar(255),
"~recordId" int,
PRIMARY KEY (__ID),
FOREIGN KEY (_teamID) REFERENCES Teams(__ID)
);

CREATE TABLE "customers_DevTeam" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~CreationTimestamp" datetime, /*Date and time each record was created*/
"~CreatedBy" varchar(255), /*Account name of the user who created each record*/
"~ModificationTimestamp" datetime, /*Date and time each record was last modified*/
"~ModifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"name" varchar(255),
PRIMARY KEY (__ID)
);

CREATE TABLE "selectorCustomerIDS_Customers" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~creationTimestamp" datetime, /*Date and time each record was created*/
"~createdBy" varchar(255), /*Account name of the user who created each record*/
"~modificationTimestamp" datetime, /*Date and time each record was last modified*/
"~modifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"Name" varchar(255), /*Account name of the user who last modified each record*/
"OBSI ClientNo" varchar(255), /*Account name of the user who last modified each record*/
"chargeRate" int,
"Email" varchar(255),
"_stripeOrgID_deprecated" varchar(255),
"f_USD" varchar(255),
"f_prePay" int,
"fundsAvailable" int,
"phone" varchar(255),
"E164number" varchar(255),
"f_active" int,
"dbPath" varchar(255),
"dbUserName" varchar(255),
"dbPasword" varchar(255),
"f_EUR" varchar(255),
"_stripeID" varchar(255),
"_qbID" varchar(255),
"_qbSyncID" varchar(255),
"_devteamID" varchar(255),
"g_projectID" varchar(255),
"~recordId" int,
PRIMARY KEY (__ID)
);

CREATE TABLE "globals" (
"g_search" varchar(255),
"g_text" varchar(255)
);

CREATE TABLE "Staff" (
"__ID" varchar(255),
"~CreationTimestamp" datetime, /*Date and time each record was created*/
"~CreatedBy" varchar(255), /*Account name of the user who created each record*/
"~ModificationTimestamp" datetime, /*Date and time each record was last modified*/
"~ModifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"name" varchar(255),
"role" varchar(255),
"image" varbinary(4096),
"image_thm" varbinary(4096),
"image_base64" varchar(255),
"date_start" datetime,
"date_end" datetime,
"_projectIDS" varchar(255),
"~recordId" int,
PRIMARY KEY (__ID),
FOREIGN KEY (_projectIDS) REFERENCES staff_Projects(__ID)
);

CREATE TABLE "teams_Projects" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~creationTimestamp" datetime, /*Date and time each record was created*/
"~createdBy" varchar(255), /*Account name of the user who created each record*/
"~modificationTimestamp" datetime, /*Date and time each record was last modified*/
"~modifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"projectName" varchar(255),
"_custID" varchar(255),
"status" varchar(255),
"estOfTime" datetime,
"_teamID" varchar(255),
"userName" varchar(255),
"password" varchar(255),
"dataName" varchar(255),
"dataPath" varchar(255),
"~recordId" int,
PRIMARY KEY (__ID),
FOREIGN KEY (_teamID) REFERENCES Teams(__ID)
);

CREATE TABLE "staff_Projects" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~creationTimestamp" datetime, /*Date and time each record was created*/
"~createdBy" varchar(255), /*Account name of the user who created each record*/
"~modificationTimestamp" datetime, /*Date and time each record was last modified*/
"~modifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"projectName" varchar(255),
"_custID" varchar(255),
"status" varchar(255),
"estOfTime" datetime,
"_teamID" varchar(255),
"userName" varchar(255),
"password" varchar(255),
"dataName" varchar(255),
"dataPath" varchar(255),
"~recordId" int,
PRIMARY KEY (__ID)
);

CREATE TABLE "Tasks" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~CreationTimestamp" datetime, /*Date and time each record was created*/
"~CreatedBy" varchar(255), /*Account name of the user who created each record*/
"~ModificationTimestamp" datetime, /*Date and time each record was last modified*/
"~ModifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"task" varchar(255),
"_projectID" varchar(255),
"_staffID" varchar(255), /*used as assigned to*/
"f_completed" int,
"f_status" varchar(255),
"f_priority" varchar(255),
"~recordId" int,
PRIMARY KEY (__ID),
FOREIGN KEY (_projectID) REFERENCES customers_Projects(__ID)
);

CREATE TABLE "customersPROJECTID__Projects" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~creationTimestamp" datetime, /*Date and time each record was created*/
"~createdBy" varchar(255), /*Account name of the user who created each record*/
"~modificationTimestamp" datetime, /*Date and time each record was last modified*/
"~modifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"projectName" varchar(255),
"_custID" varchar(255),
"status" varchar(255),
"estOfTime" datetime,
"_teamID" varchar(255),
"userName" varchar(255),
"password" varchar(255),
"dataName" varchar(255),
"dataPath" varchar(255),
"~recordId" int,
PRIMARY KEY (__ID)
);

CREATE TABLE "customersPROJECTID__Activity" (
"MyOBSI_ID" int,
"_obsiID" int,
"csInvoiceID" int,
"DateStart" datetime,
"TimeStart" datetime,
"TimeEnd" datetime,
"ElapsedTime" int,
"Billable_Time_Rounded" int,
"Hourly_Rate" int,
"Work Performed" varchar(255),
"total Time" int,
"__ID" varchar(255),
"_projectID" varchar(255),
"f_dnb" varchar(255),
"f_billed" varchar(255),
"weekNo" int,
"sumTimebyWeek" int,
"year" int,
"sumTimebyDay" int,
"sumTimebyYear" int,
"f_omit" varchar(255),
"month" int,
"sumTimebyProject" int,
"_staffID" varchar(255),
"~CreatedBy" varchar(255), /*Account name of the user who created each record*/
"~CreationTimestamp" datetime, /*Date and time each record was created*/
"~ModificationTimestamp" datetime, /*Date and time each record was last modified*/
"~ModifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"_taskID" varchar(255),
"~recordId" int,
PRIMARY KEY (__ID)
);

CREATE TABLE "Logs" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~creationTimestamp" datetime, /*Date and time each record was created*/
"~createdBy" varchar(255), /*Account name of the user who created each record*/
"~modificationTimestamp" datetime, /*Date and time each record was last modified*/
"~modifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"_projectID" varchar(255),
"log" varchar(255),
"_custID" varchar(255),
"type" varchar(255),
"_mj_messageID" varchar(255),
"sentBy" varchar(255),
"sentTo" varchar(255),
"message" varchar(255),
"error" varchar(255),
"_taskID" varchar(255),
PRIMARY KEY (__ID)
);

CREATE TABLE "taskNotes" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~CreationTimestamp" datetime, /*Date and time each record was created*/
"~CreatedBy" varchar(255), /*Account name of the user who created each record*/
"~ModificationTimestamp" datetime, /*Date and time each record was last modified*/
"~ModifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"note" varchar(255),
"_fkID" varchar(255),
"type" varchar(255),
"~recordId" int,
PRIMARY KEY (__ID),
FOREIGN KEY (_fkID) REFERENCES Tasks(__ID)
);

CREATE TABLE "taskImages" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~creationTimestamp" datetime, /*Date and time each record was created*/
"~createdBy" varchar(255), /*Account name of the user who created each record*/
"~modificationTimestamp" datetime, /*Date and time each record was last modified*/
"~modifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"file" varbinary(4096),
"_fkID" varchar(255),
"fileName" varchar(255),
"image" varbinary(4096),
"image_base64" varchar(255),
"image_thm" varbinary(4096),
"f_processed" varchar(255),
"~recordId" int,
PRIMARY KEY (__ID),
FOREIGN KEY (_fkID) REFERENCES Tasks(__ID)
);

CREATE TABLE "taskLinks" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~creationTimestamp" datetime, /*Date and time each record was created*/
"~createdBy" varchar(255), /*Account name of the user who created each record*/
"~modificationTimestamp" datetime, /*Date and time each record was last modified*/
"~modifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"_fkID" varchar(255),
"link" varchar(255),
"~recordId" int,
PRIMARY KEY (__ID),
FOREIGN KEY (_fkID) REFERENCES Tasks(__ID)
);

CREATE TABLE "projectNotes" (
"__ID" varchar(255), /*Unique identifier of each record in this table*/
"~CreationTimestamp" datetime, /*Date and time each record was created*/
"~CreatedBy" varchar(255), /*Account name of the user who created each record*/
"~ModificationTimestamp" datetime, /*Date and time each record was last modified*/
"~ModifiedBy" varchar(255), /*Account name of the user who last modified each record*/
"note" varchar(255),
"_fkID" varchar(255),
"type" varchar(255),
"~recordId" int,
PRIMARY KEY (__ID),
FOREIGN KEY (_fkID) REFERENCES customers_Projects(__ID)
);

