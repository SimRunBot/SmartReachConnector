// four functions needed in the lifecycle 

var cc = DataStudioApp.createCommunityConnector();

// 1
function getAuthType(){
  //console.log("getAuth");
  var AuthTypes = cc.AuthType;
  return cc.newAuthTypeResponse()
    .setAuthType(AuthTypes.KEY)
    .setHelpUrl('https://smartreach.io/api_docs#rest-api-key')
    .build();
}

/**
 * Returns true if the auth service has access.
 * @return {boolean} True if the auth service has access.
 */
function isAuthValid() {
  var userProperties = PropertiesService.getUserProperties();
  var key = userProperties.getProperty('sr.key');
  // This assumes you have a validateKey function that can validate
  // if the key is valid.
  return validateKey(key);
}

function validateKey(key){
  //console.log("validateKey");
  //console.log("null check: ", key == null);
  if (key == null) return false;
  var options = {
    headers : {"X-API-KEY": key},
    'muteHttpExceptions': true //true
  };
  var url = 'https://api.smartreach.io/api/v1';
  var res = UrlFetchApp.fetch(url, options);
  //console.log("response validateKey ",res.getResponseCode());
  return res.getResponseCode() == 200;
}


/**
 * Sets the credentials.
 * @param {Request} request The set credentials request.
 * @return {object} An object with an errorCode.
 */
function setCredentials(request) {
  //console.log("setCredentials");
  var key = request.key;

  // Check if the provided key is valid through a call to your service.
  var validKey = validateKey(key);
  if (!validKey) {
    return cc.newSetCredentialsResponse()
    .setIsValid(false)
    .build();
  }
  else{
    var userProperties = PropertiesService.getUserProperties();
    userProperties.setProperty('sr.key', key);
    return cc.newSetCredentialsResponse()
    .setIsValid(true)
    .build();
  }
}

/**
 * Resets the auth service.
 */
function resetAuth() {
  var userProperties = PropertiesService.getUserProperties();
  userProperties.deleteProperty('sr.key');
}

//optional for debugging

function isAdminUser(){
  return true;
}

// 2
function getConfig(){
  var config = cc.getConfig();
  // test config not required because of correct Authroization key
 /*  config
    .newInfo()
    .setId('instructions')
    .setText(
      'insert your Smart Reach API key and click ADD'
    );

  config
    .newTextInput()
    .setId("apikey")
    .setName("API KEY"); */

  //date not required as parameter
  //config.setDateRangeRequired(true); 
  return config.build();
}

// 3
function getFields(){
  var fields = cc.getFields();
  var types = cc.FieldType;

  // Field Schema for Campaign Data
  fields
    .newDimension()
    .setId("id")
    .setName("id")
    .setType(types.NUMBER);
  
  fields
    .newDimension()
    .setId("account_id")
    .setName("account_id")
    .setType(types.NUMBER);
  
  fields
    .newDimension()
    .setId("name")
    .setName("Campaign Name")
    .setType(types.TEXT);

  fields
    .newDimension()
    .setId("status")
    .setName("Campaign Status")
    .setType(types.TEXT);

  fields 
    .newMetric()
    .setId("total_sent")
    .setName("total_sent")
    .setType(types.NUMBER);

  fields 
    .newMetric()
    .setId("total_opened")
    .setName("total_opened")
    .setType(types.NUMBER);

  fields 
    .newMetric()
    .setId("total_clicked")
    .setName("total_clicked")
    .setType(types.NUMBER);

  fields 
    .newMetric()
    .setId("total_replied")
    .setName("total_replied")
    .setType(types.NUMBER);

  fields 
    .newDimension()
    .setId("created_at")
    .setName("created_at")
    .setType(types.YEAR_MONTH_DAY);

  return fields;
}

function getSchema(request) {
  return {schema: getFields().build()};
}

// 4
function getData(request){
  //console.log("getData");
  var requestedFields = getFields().forIds(
    request.fields.map(function(field) {
      return field.name;
    })
  );
  try {
    var apiResponse = fetchDataFromApi(request);
    var normalizedResponse = normalizeResponse(request, apiResponse);
    var data = getFormattedData(normalizedResponse, requestedFields);
  } catch (e) {
    cc.newUserError()
      .setDebugText('Error fetching data from API. Exception details: ' + e)
      .setText(
        'The connector has encountered an unrecoverable error. Please try again later, or file an issue if this error persists.'
      )
      .throwException();
  }

  return {
    schema: requestedFields.build(),
    rows: data
  };
}


/**
 * @param {Object} request Data request parameters.
 * @returns {string} Response text for UrlFetchApp.
 */
function fetchDataFromApi(request) {
  //console.log("fetchDataFromApi");
  var url = 'https://api.smartreach.io/api/v1/campaigns';
  
  // add apikey to header
  var userProperties = PropertiesService.getUserProperties();
  var key = userProperties.getProperty('sr.key');

  var apikey =  key;
  //request.configParams.apikey;
  var options = {
    headers : {"X-API-KEY": apikey}
  };
  var response = UrlFetchApp.fetch(url, options);
  //console.log("response", response.getResponseCode());

  return response;
}

/**
 * Parses response string into an object.
 *
 * @param {Object} request Data request parameters.
 * @param {string} responseString Response from the API.
 * @return {Object} just parses the response
 */
function normalizeResponse(request, responseString) {
  //console.log("normalizeResponse");
  var response = JSON.parse(responseString);
  // { status: 'success',message: 'Campaigns found',data: { campaigns: [ [Object] ] } }
  return response;
}

/**
 * Formats the parsed response from external data source into correct tabular
 * format and returns only the requestedFields
 *
 * @param {Object} response The response string from external data source
 *     parsed into an object in a standard format.
 * @param {Array} requestedFields The fields requested in the getData request.
 * @returns {Array} Array containing rows of data in key-value pairs for each
 *     field.
 */
function getFormattedData(response, requestedFields) {
  //console.log("getFormattedData");
  var campaignsArray = response.data.campaigns;
  var data = [];
  var formattedData = campaignsArray.map(function(campaign) {
    return formatData(requestedFields, campaign);
  });
  data = data.concat(formattedData);
  return data;
}

/**
 * Formats a single row of data into the required format.
 *
 * @param {Object} requestedFields Fields requested in the getData request.
 * @param {Object} campaign The campaign data
 * @returns {Object} Contains values for requested fields in predefined format.
 */
function formatData(requestedFields, campaign) {
  var row = requestedFields.asArray().map(function(requestedField) {
    //console.log("inside formatData map ", requestedField.getId());
    switch (requestedField.getId()) {
      case 'id':
        return campaign.id;
      case 'account_id':
        return campaign.owner_id;
      case 'name':
        return campaign.name;
      case 'status':
        return campaign.status;
      case 'total_sent':
        return campaign.stats.total_sent;
      case 'total_opened':
        return campaign.stats.total_opened;
      case 'total_clicked':
        return campaign.stats.total_clicked;
      case 'total_replied':
        return campaign.stats.total_replied;
      case 'created_at':
        //  created_at: '2022-05-16T17:30:38.149Z',
        // field YYYYMMDD such as 20170317
        var parseDate = campaign.created_at.split("T")[0];
        var yearmonthday = parseDate.replaceAll("-","");
        return yearmonthday;
      default:
        return '';
    }
  });
  //console.log("outside formatData map after switch : ", row);
  return {values: row};
}
