/*

From "tingle_live"

Description:

	JavaScript code for trich device targeting, data graphing and data storage

	state = 0: not connected
	state = 1: connected
	state = 2: have neural net weights to send

*/

// Application object.
var app = {};

// UI methods.
app.ui = {};

// Timer that updates the device list and removes inactive
// devices in case no devices are found by scan.
app.ui.updateTimer = null;

/**
 * Stores data user input data marker state  0 = false/false , 1 = true/false , 2 = false/true , 3 = true/true
 */
app.varState = 0;

app.connected = false;

app.DummyTimer;

/**
 * Nueral net control flags
 */
app.getTrueFlag = false;
app.getFalseFlag = false;
app.trainFlag = false;
app.neuroHaveFlag = false;
app.neuroSendFlag = false;
app.getDelay = 0;

/**
 * Nueral net data
 */
app.neuroScore = 0;
app.neuroData = {};
app.neuroData.weights = [
    [],
    []
];
app.neuroData.weights_compressed = [];
app.neuroData.avAngle = [0, 0, 0];
app.neuroData.lowAngle = [0, 0, 0];
app.neuroData.highAngle = [0, 0, 0];
app.neuroData.sendIndex = 0;
app.neuroData.transmitCount = 0;

app.neuroScore2 = 0;
app.neuroData2 = {};
app.neuroData2.weights = [
    [],
    []
];
app.neuroData2.weights_compressed = [];
app.neuroData2.avAngle = [0, 0, 0];
app.neuroData2.lowAngle = [0, 0, 0];
app.neuroData2.highAngle = [0, 0, 0];
app.neuroData2.sendIndex = 0;
app.neuroData2.transmitCount = 0;


/**
 * TARGET defines (inverted).
 */
app.targetOFF = 1;
app.targetON = 0;
app.totalTargets = 0;
app.setTargetFlag = false;

/**
 * Set of Training data
 */
app.trainingDataTrue = [];
app.trainingDataFalse = [];

app.trainingDataTrue2 = [];
app.trainingDataFalse2 = [];

app.trainingAngleTrueX = []; //for average accel values
app.trainingAngleTrueY = []; //for average accel values
app.trainingAngleTrueZ = []; //for average accel values

/**
 * Attach synaptic neural net components to app object
 */
app.Neuron = synaptic.Neuron;
app.Layer = synaptic.Layer;
app.Network = synaptic.Network;
app.Trainer = synaptic.Trainer;
app.Architect = synaptic.Architect;

app.Neuron2 = synaptic.Neuron;
app.Layer2 = synaptic.Layer;
app.Network2 = synaptic.Network;
app.Trainer2 = synaptic.Trainer;
app.Architect2 = synaptic.Architect;

//app.neuralNet = new app.Architect.LSTM(5, 5, 2, 1);
app.neuralNet = new app.Architect.Perceptron(5, 5, 2, 1);
//app.trainer = new Trainer(app.neuralNet);

app.neuralNet2 = new app.Architect.Perceptron(7, 5, 2, 1);
//app.trainer2 = new Trainer(app.neuralNet2);

/**
 * Default device name.
 */
app.deviceName = 'Tingle';

/**
 * Connected device.
 */
app.device = null;

/**
 * Object that holds wearable device UUIDs.
 */
app.deviceUUID = {};

// UUIDs for movement services and characteristics.
app.deviceUUID.PRIMARY_SERVICE =        '0000a000-0000-1000-8000-00805f9b34fb';
app.deviceUUID.READ_CHARACTERISTIC =    '0000a001-0000-1000-8000-00805f9b34fb';
app.deviceUUID.WRITE_CHARACTERISTIC =   '0000a002-0000-1000-8000-00805f9b34fb';
app.deviceUUID.SENSOR_DATA =            '0000a003-0000-1000-8000-00805f9b34fb'; //streaming sensor notifications
app.deviceUUID.DEVICE_DATA =            '0000a004-0000-1000-8000-00805f9b34fb'; //streaming device notifications
app.deviceUUID.NEURO_DATA =             '0000a005-0000-1000-8000-00805f9b34fb'; //streaming NN value notifications



/**
 * Low level initialization 
 */
document.addEventListener(
    'deviceready',
    function() { onDeviceReady(); }, false);

//low level init
/**
 * When low level initialization complete, this function is called.
 */
function onDeviceReady() {
    //Cordova vibration plugin
  //  console.log(navigator.vibrate);
    console.log("onDeviceReady()");

    //W3C Device Motion API
 //   window.addEventListener("devicemotion", processEvent, true);

    initialiseAccelerometer();
    //try connecting on app startup
  //  app.onConnectButton();
}
//function processEvent(event) {   /* process the event object */ }

/**
 * Low App initialization 
 */
app.initialize = function()
{


    // Called when HTML page has been loaded.
    $(document).ready(function() {
        // Adjust canvas size when browser resizes
        $(window).resize(app.respondCanvas);

        // Adjust the canvas size when the document has loaded.
        app.respondCanvas();

        //smoothie chart for streaming data
        initializeChart();

        //ENABLE EVERYTHING BECAUSE WE HAVE TEST DATA FROM PHONE
        //enable neural network UI
        enableButton('getTrueButton');
        enableButton('clearTrueButton');
        enableButton('getFalseButton');
        enableButton('clearFalseButton');
        enableButton('numTrueData');
        enableButton('numFalseData');
    });
};


 //Initialize phone accelerometer
//if (window.DeviceOrientationEvent) {
//  window.addEventListener('deviceorientation', deviceOrientationHandler, false)
//}




//smoothie chart data vis
//var chart = new SmoothieChart({minValue: 0, maxValue: 20});
var chart = new SmoothieChart({
	//timestampFormatter: SmoothieChart.timeFormatter, 
	millisPerPixel: 30,
	minValue: 0, 
	maxValue: 1,
	grid: { strokeStyle:'rgb(155, 155, 155)', fillStyle:'rgb(0, 0, 0)', lineWidth: 1, millisPerLine: 1000, verticalSections: 6, },
  //	labels: { disabled:false, showIntermediateLabels: true, fontSize:12, fillStyle:'#ffffff' }
    labels: { disabled:true, showIntermediateLabels: false, fontSize:12, fillStyle:'#ffffff' }
  });

var lineRoll = new TimeSeries();
var linePitch = new TimeSeries();
var lineTherm1 = new TimeSeries();
var lineTherm2 = new TimeSeries();
var lineTherm3 = new TimeSeries();
var lineTherm4 = new TimeSeries();
var lineDistance = new TimeSeries();
var lineNN = new TimeSeries();
var lineNN2 = new TimeSeries();

function initializeChart() 
{
    console.log("init chart");
    chart.streamTo(document.getElementById("streaming-data-chart"), 200 /*delay*/ ); //delay by one second because data aquisition is slow
    chart.addTimeSeries(lineRoll,      {strokeStyle: 'rgb(134, 136, 138)', 	lineWidth: 3 });
    chart.addTimeSeries(linePitch,     {strokeStyle: 'rgb(202, 204, 206)',  lineWidth: 3 });
    chart.addTimeSeries(lineTherm1,    {strokeStyle: 'rgb(255, 207, 0)',   	lineWidth: 3 });
    chart.addTimeSeries(lineTherm2,    {strokeStyle: 'rgb(255, 169, 0)', 	lineWidth: 3 });
    chart.addTimeSeries(lineTherm3,    {strokeStyle: 'rgb(223, 129, 9)', 	lineWidth: 3 });
    chart.addTimeSeries(lineTherm4,    {strokeStyle: 'rgb(255, 127, 1)', 	lineWidth: 3 });
    chart.addTimeSeries(lineDistance,  {strokeStyle: 'rgb(0, 130, 165)', 	lineWidth: 3 });
    chart.addTimeSeries(lineNN,        {strokeStyle: 'rgb(57, 255, 20)',   	lineWidth: 4 });
    chart.addTimeSeries(lineNN2,       {strokeStyle: 'rgb(51, 255, 255)',   lineWidth: 4 });
}


/**
 * Scan for device and connect.
 */
 
app.startScan = function() {

    //connection progress bar display
    $("#connect-progress").show();

    evothings.ble.startScan(
        function(device) {

        	//asign BLE device to global app object
        	app.device = device;

            if( $('#device_search').val() != " "){
                app.deviceName = $('#device_search').val();
            }

            //never mind
            app.deviceName = 'Tingle';
        	
            // If my device is found connect to it.
            if (app.device.name == app.deviceName) {
                app.showInfo('Status: connected to ' + app.deviceName);
                console.log('Status: connected to ' + app.deviceName);
                evothings.ble.stopScan();
                app.connectToDevice(app.device);
            }
        },
        function(error) {
            app.showInfo('Error: startScan: ' + error);
        },
        { serviceUUIDs: ['0000a000-0000-1000-8000-00805f9b34fb'] });
};


/**
 * Read services for a device.
 */
app.connectToDevice = function(device) {
    app.showInfo('Status: Connecting...');
  /*  device.connect(
        function(device) {
            app.device = device;
            app.showInfo('Status: Connected');
            app.readServices(app.device);

            //Start data streaming and graphing after device connection
            app.startSensorDataStream();
        },
        function(errorCode) {
            app.showInfo('Error: Connection failed: ' + errorCode);
        }); */
  /*  evothings.ble.connect(
    device,
    function(device)
    {
            app.device = device;
            app.showInfo('Status: Connected');
         //   app.readServices(app.device);

            //Start data streaming and graphing after device connection
            app.startSensorDataStream();
    },
    function(errorCode)
    {
        console.log('Connect error: ' + errorCode);
    }); */
    evothings.ble.connectToDevice(
    app.device,
    function(device)
    {
    //  console.log('Connected to device: ' + device.name);
        app.device = device;
        app.showInfo('Status: connected to device: ' + app.device.name);

        app.connected = true;
        clearInterval(app.DummyTimer); //ditch dummy timed loop

        //activate send settings button now that we are connected
        $('#sendSettingsButton').addClass('is-active');

        app.primaryService = 		evothings.ble.getService(app.device, app.deviceUUID.PRIMARY_SERVICE);
		app.sensorsCharacteristic = evothings.ble.getCharacteristic(app.primaryService, app.deviceUUID.SENSOR_DATA);
		app.dataCharacteristic = 	evothings.ble.getCharacteristic(app.primaryService, app.deviceUUID.DEVICE_DATA);
		app.writeCharacteristic = 	evothings.ble.getCharacteristic(app.primaryService, app.deviceUUID.WRITE_CHARACTERISTIC);
		app.readCharacteristic = 	evothings.ble.getCharacteristic(app.primaryService, app.deviceUUID.READ_CHARACTERISTIC);
        app.neuroCharacteristic = 	evothings.ble.getCharacteristic(app.primaryService, app.deviceUUID.NEURO_DATA);

     //   app.readServices(device);

        //Start data streaming and graphing after device connection
        app.startSettingsNotifications(app.device);

        //Start data streaming and graphing after device connection
        app.startSensorDataStream(app.device);



        //connection progress bar display
        $(".connect-button").hide();
        //connection progress bar display
        $("#connect-progress").hide();
        //send settings button display
        $(".send-settings").show();

        //enable neural network UI
        enableButton('getTrueButton');
        enableButton('clearTrueButton');
        enableButton('getFalseButton');
        enableButton('clearFalseButton');
        enableButton('numTrueData');
        enableButton('numFalseData');

        //remove phone accelerometer event listener
     //   window.removeEventListener("deviceorientation", processEvent);
    },
    function(device)
    {
        console.log('Disconnected from device: ' + app.device.name);
        app.connected = false;

        //START EXAMPLE BASED ON PHONE ACCELEROMETER
        app.startSensorDataStream(app.device);

        //connection progress bar display
        $(".connect-button").show();
        //connection progress bar display
        $("#connect-progress").hide();
        //send settings button display
        $(".send-settings").hide();
    },
    function(errorCode)
    {
      console.log('Connect error: ' + errorCode);
      app.connected = false;

        //START EXAMPLE BASED ON PHONE ACCELEROMETER
        app.startSensorDataStream(app.device);

        //connection progress bar display
        $(".connect-button").show();
        //connection progress bar display
        $("#connect-progress").hide();
        //send settings button display
        $(".send-settings").hide();
    });
};



/**
 * Dump all information on named device to the console
 */ 
app.readServices = function(device) {
    // Read all services.
    evothings.ble.readAllServiceData(
  //  device.readServices(
        device,
        function() {
            console.log("readServices success");

            //handle sensor data from device
            app.startSensorDataStream(app.device);
        },
        function(error) {
            console.log('Error: Failed to read services: ' + error);
        });
};




// Start the scan. Call the callback function when a device is found.
// Format:
//   callbackFun(deviceInfo, errorCode)
//   deviceInfo: address, rssi, name
//   errorCode: String
/*
app.startScan = function(callbackFun)
{
	app.stopScan();

	evothings.ble.startScan(
		function(device)
		{
			// Report success. Sometimes an RSSI of +127 is reported.
			// We filter out these values here.
			//if (device.rssi <= 0)
			if (device.address == 'CA:03:75:64:65:E2')
			{
				callbackFun(device, null);
			}
		},
		function(errorCode)
		{
			// Report error.
			callbackFun(null, errorCode);
		},
		{ serviceUUIDs: ['0000a000-0000-1000-8000-00805f9b34fb'] } //filter out everything but smartpill
	);
};
*/
/*
// Stop scanning for devices.
app.stopScan = function()
{
	evothings.ble.stopScan();
};


// Called when a device is found.
app.ui.deviceFound = function(device, errorCode)
{
	console.log('Found device:' + JSON.stringify(device.advertisementData));
	if (device)
	{
		// Set timestamp for device (this is used to remove
		// inactive devices).
		device.timeStamp = Date.now();

		// Insert the device into table of found devices.
		app.devices[device.address] = device;
	}
	else if (errorCode)
	{
		app.ui.displayStatus('Scan Error: ' + errorCode);
	}
};

// Display the device list.
app.ui.displayDeviceList = function()
{
	console.log("display");
	// Clear device list.
	$('#found-devices').empty();

	var timeNow = Date.now();

	$.each(app.devices, function(key, device)
	{

			// Map the RSSI value to a width in percent for the indicator.
			var pillData = (3.3 * ( parseInt(device.advertisementData.kCBAdvDataLocalName) ) / 1021).toFixed(2);
			var rssiWidth = 100; // Used when RSSI is zero or greater.
			if (device.rssi < -100) { rssiWidth = 0; }
			else if (device.rssi < 0) { rssiWidth = 100 + device.rssi; }

			// Create tag for device data.
			var element = $(
				'<li>'
				+	'<strong>bio-galvanic cell voltage: ' + pillData + 'v</strong><br />'
				// Do not show address on iOS since it can be confused
				// with an iBeacon UUID.
				+	'address: ' + device.address + '<br />'
				+	'signal strength: ' + device.rssi + '<br />' 
				+ 	'<div style="background:rgb(225,0,0);height:20px;width:'
				+ 		(rssiWidth - 10) + '%;"></div>'
				+ '</li>'
			);

			$('#found-devices').append(element);

			//update chart

			var now = Date.now();
			line_data.append(now, pillData);
			console.log("timestamp: " + now + "  data: " + pillData );  //log because time gets big


	});


}; 
*/


app.startSettingsNotifications = function(device) {

    // Start generic settings notification.
    evothings.ble.enableNotification(
    	device,
        app.readCharacteristic, 
        function(data) { 
			var hand, handCode, hair, hairCode, sensitivity, sensitivityCode, targetCode; 
			var targets = new Array;

        	var dataArray = new Uint8Array(data); //convert data to usable format

        	handCode = dataArray[0];
        	hairCode = dataArray[1];
        	targetCode = dataArray[2];
        	sensitivityCode = dataArray[3];
    	
    		console.log("recieved settings");

    		console.log("hand:" + handCode + "hair:" + hairCode + "target:" + targetCode + "sensitivity:" + sensitivityCode);

        }, function(errorCode) {
            console.log('Error: Settings enableNotification: ' + errorCode + '.');
        });

};


/**
 * Read device sensor data.
 */
app.startSensorDataStream = function(device) {
 //   app.showInfo('Status: Starting data stream...');
    app.showInfo('Status: Data stream active');

    // Start accelerometer notification.
    evothings.ble.enableNotification(
    	device,
        app.sensorsCharacteristic, 
        function(data) { 
        if( $("#dataPageButton").hasClass("is-active") ){
        	
        //    app.showInfo('Status: Data stream active');

            var dataArray = new Uint8Array(data);

            /*************************** SEND APP STATUS TO DEVICE *****************************/
          //  app.alertDetect();

            //parse data from sensors
            var values = dataArray; //app.getSensorValues(dataArray); //return [roll, pitch, proximity, thermo1, thermo2, thermo3, thermo4, accelX, accelY, accelZ];
            values[3] =  (values[3] / 8) + 70; //t1
            values[4] =  (values[4] / 8) + 70; //t2
            values[5] =  (values[5] / 8) + 70; //t3
            values[6] =  (values[6] / 8) + 70; //t4
            values[7] =  (values[7] / 8) + 70; //tav

            values[10] =  (values[10] / 100) - 1; //acc x
            values[11] =  (values[11] / 100) - 1; //acc y
            values[12] =  (values[12] / 100) - 1; //acc z

        //    values[17] =  (values[17] / 255.0); //NN5 score from device
      //      values[18] =  (values[18] / 255.0); //NN5 score from device

            //scores sent FROM Tingle TO app
            var deviceNN5score = values[17] / 255;
            var deviceNN7score = values[18] / 255;

            /*************************** UPDATE CHART SENSOR DATA *****************************/
            var now = Date.now();

            if(app.neuroHaveFlag != true){ //oncle we have a nn model we only visualize that
    			lineRoll.append(now,     ( (values[0] / 360) / 7) + 0.05);
                linePitch.append(now,    ( (values[1] / 360) / 7) + 0.10);
                lineDistance.append(now, ( (values[2] / 255) / 9) + 0.25);
                lineTherm1.append(now,   ( ( (values[3] - 70) / (101 - 70) ) / 4) + 0.25);
                lineTherm2.append(now,   ( ( (values[4] - 70) / (101 - 70) ) / 4) + 0.35);
                lineTherm3.append(now,   ( ( (values[5] - 70) / (101 - 70) ) / 4) + 0.45);
                lineTherm4.append(now,   ( ( (values[6] - 70) / (101 - 70) ) / 4) + 0.55);
            }
            

			console.log("timestamp: " + now + "  data: " + values[0] + " " + values[1] + " " + values[2] + " " + values[3] + " " + values[4] + " " + values[5] + " " + values[6] + " " + values[7] + " " + values[17] + " " + values[18]);  //log because time gets big

            //      pitch = (180/3.141592) * ( atan2( acc[0], sqrt( acc[1] * acc[1] + acc[2] * acc[2])) );
            //		roll = (180/3.141592) * ( atan2(-acc[1], -acc[2]) );



            /*************************** START ACTIVATE NEURAL NETWORK ***********************************/
            /*************************** START ACTIVATE NEURAL NETWORK ***********************************/
            if(app.neuroHaveFlag && app.connected == true){
                app.neuroScore = app.neuralNet.activate([
                    (values[2] / 300),
                    ( (values[3] - 69) / (101 - 69) ),
                    ( (values[4] - 69) / (101 - 69) ),
                    ( (values[5] - 69) / (101 - 69) ),
                    ( (values[6] - 69) / (101 - 69) )
                ]);

                //from 0-1 to 0-100%
                app.neuroScore = app.neuroScore * 100;

                //round to three sig digits
                app.neuroScore = (Math.round(app.neuroScore * 1000)) / 1000;

                if (app.neuroScore > 0.95){ app.alertDetect(); }

                /**************** ACTIVATE NEURAL NETWORK W/ ANGULAR POSITION *****************/
                app.neuroScore2 = app.neuralNet2.activate([
                    (values[0] / 360),
                    (values[1] / 360),
                    (values[2] / 300),
                    ( (values[3] - 69) / (101 - 69) ),
                    ( (values[4] - 69) / (101 - 69) ),
                    ( (values[5] - 69) / (101 - 69) ),
                    ( (values[6] - 69) / (101 - 69) )
                ]);

                //from 0-1 to 0-100%
                app.neuroScore2 = app.neuroScore2 * 100;

                //round to three sig digits
                app.neuroScore2 = (Math.round(app.neuroScore2 * 1000)) / 1000;

                if (app.neuroScore2 > 0.95){ app.alertDetect(); }

                
                  //  app.showInfo('Score with proximity: ' + app.neuroScore.toFixed(2) + '</br></br>Score w/ NO proximity: ' + app.neuroScore2.toFixed(2));
             //   lineNN.append(now,     ( (app.neuroScore / 100) / 7) + 0.65);
             //   lineNN2.append(now,     ( (app.neuroScore2 / 100) / 7) + 0.75);
                lineNN.append(now,     (app.neuroScore / 100) );
                lineNN2.append(now,     (app.neuroScore2 / 100) );

                app.showInfo('Detection: ' + app.neuroScore.toFixed(2) + "%  " + app.neuroScore2.toFixed(2) + "%");
            } 

            //EXAMPLE NEURAL NETWORK FROM PHONE ACCELEROMETER DATA
            else if(app.neuroHaveFlag && app.connected == false){
                app.neuroScore = app.neuralNet.activate([
                    (values[0] / 360),
                    (values[1] / 360)
                ]);

                //from 0-1 to 0-100%
                app.neuroScore = app.neuroScore * 100;

                //round to three sig digits
                app.neuroScore = (Math.round(app.neuroScore * 1000)) / 1000;

                if (app.neuroScore > 0.90){ app.alertDetect(); }

             //   lineNN.append(now,     ( (app.neuroScore / 100) / 7) + 0.65);
                lineNN.append(now,     (app.neuroScore / 100) );
                app.showInfo('Detection: ' + app.neuroScore.toFixed(2) + "%");
            }

            //scores sent FROM Tingle TO app
            else if(app.connected == true && deviceNN5score < 1.01 && deviceNN5score >=0 && deviceNN7score < 1.01 && deviceNN7score >=0){
                lineNN.append(now,     deviceNN5score );
                lineNN2.append(now,     deviceNN7score );
            }
            /*************************** END ACTIVATE NEURAL NETWORK ***********************************/
            /*************************** END ACTIVATE NEURAL NETWORK ***********************************/




            /*************************** START GET TRUE/ON TARGET SAMPLES ******************************/
            /*************************** START GET TRUE/ON TARGET SAMPLES ******************************/
            if (app.getTrueFlag && app.connected == true) {

                //Let device know we are gathering true data
                app.varState = 2;

                app.trainingDataTrue.push({
                    input: [ (values[2] / 300), (values[3] / 101), (values[4] / 101), (values[5] / 101), (values[6] / 101) ],
                    output: [1]
                });

                app.trainingDataTrue2.push({   // WITH ANGULAR POSITION
                    input: [ (values[0]/360), (values[1]/360), (values[2] / 300),  (values[3] / 101), (values[4] / 101), (values[5] / 101), (values[6] / 101)],
                    output: [1]
                });

                //for averages
                //return [roll, pitch, proximity, thermo1, thermo2, thermo3, thermo4, accelX, accelY, accelZ];
            //    app.trainingAngleTrueX.push(values[7]); //for average accel values
            //    app.trainingAngleTrueY.push(values[8]); //for average accel values
            //    app.trainingAngleTrueZ.push(values[9]); //for average accel values

                app.showInfo(" ...gathering true training data");
                $("#numTrueData").attr( "data-badge", app.trainingDataTrue.length );
            }
            /*************************** END GET TRUE/ON TARGET SAMPLES **********************************/
            /*************************** END GET TRUE/ON TARGET SAMPLES **********************************/



            /*************************** START GET FALSE/OFF TARGET SAMPLES ******************************/
            /*************************** START GET FALSE/OFF TARGET SAMPLES ******************************/
            else if (app.getFalseFlag && app.connected == true) {
                //      if(app.getDelay == 0){ //skip to slow down
                //Let device know we are gathering true data
                app.varState = 3;

                app.trainingDataFalse.push({
                    input: [ (values[2] / 300), ( (values[3] - 69) / (101 - 69)), ( (values[4] - 69) / (101 - 69)), ( (values[5] - 69) / (101 - 69)), ( (values[6] - 69) / (101 - 69)) ],
                    output: [0]
                });

                app.trainingDataFalse2.push({   // WITH ANGULAR POSITION
                    input: [ (values[0]/360), (values[1]/360), ( (values[3] - 69) / (101 - 69)), ( (values[4] - 69) / (101 - 69)), ( (values[5] - 69) / (101 - 69)), ( (values[6] - 69) / (101 - 69)) ],
                    output: [0]
                });

                console.log("trainingDataFalse input: " + app.trainingDataFalse[app.trainingDataFalse.length - 1].input[0] + " " + app.trainingDataFalse[app.trainingDataFalse.length - 1].input[1] + " " + app.trainingDataFalse[app.trainingDataFalse.length - 1].input[2] + " " + app.trainingDataFalse[app.trainingDataFalse.length - 1].input[3] + " " + app.trainingDataFalse[app.trainingDataFalse.length - 1].input[4]);
                app.showInfo(" ...gathering false training data");
                $("#numFalseData").attr( "data-badge", app.trainingDataFalse.length );
            } 
            /*************************** END GET FALSE/OFF TARGET SAMPLES ******************************/
            /*************************** END GET FALSE/OFF TARGET SAMPLES ******************************/


            /*********************************************************/
      /*      else if (app.neuroData.transmitCount > 5) {
          //  document.getElementById('score').innerHTML = "Neural Net Score: 1: " + app.neuroScore + "% 2: " + app.neuroScore2 + " %";

            app.showInfo("Neural Net Score: " + app.neuroScore + "%");
            } else app.showInfo("Neural Net standing by...");    */




            /********************************* START TRAIN NEURAL NET ***********************************/
            /********************************* START TRAIN NEURAL NET ***********************************/
            if (app.trainFlag && app.connected == true) {

                app.showInfo('Status: Training...');
                console.log("**Training...");

                $("#training-progress div.progressbar").css("width", "0%" );



                //have NN weights to send
                app.varState = 2;
                app.neuroData.transmitCount = 0;

                //Recreate neural net and trainer
                app.neuralNet = new app.Architect.LSTM(5, 5, 2, 1);
              //  app.neuralNet = new app.Architect.Perceptron(5, 5, 2, 1);
                app.trainer = new app.Trainer(app.neuralNet);

                var trainingData = app.trainingDataTrue.concat(app.trainingDataFalse); 
                var iterationCount = 0;

                console.log("NN1 Training data length: " + trainingData.length + "  input length: " + trainingData[2].input.length + "  output length: " + trainingData[2].output.length);
                for(var f=0; f < trainingData.length; f++){
                    console.log("trainingData " + f + ": input: " + trainingData[f].input[0] + " " + trainingData[f].input[1] + " " + trainingData[f].input[2] + " " + trainingData[f].input[3] + " " + trainingData[f].input[4] + " output:" + trainingData[f].output[0]);
                }

                //synaptic hyperparameters and controls
                var numIterations        = 1000;
                var numRate              = 0.06;
                var numError             = 0.06;
                var numLogInterval       = 100;
                var numScheduleInterval  = 100;

             //   app.trainer.trainAsync(trainingData, {
                app.trainer.train(trainingData, {
                    rate: numRate,
                    iterations: numIterations,
                    error: numError,
                    shuffle: true,
                    log: numLogInterval,
                    cost: app.Trainer.cost.CROSS_ENTROPY,
                    schedule: {
                        every: numScheduleInterval, // repeat this task every 500 iterations
                        do: function(data) {
                            // custom log
                            iterationCount = iterationCount + numScheduleInterval;
                            app.showInfo(iterationCount + '/' + numIterations + ' training iterations');
                            console.log("schedule log - error:" + data.error + " iterations:" + data.iterations + " rate:" + data.rate);

                        //    $("#training-progress div.progressbar").css("width", ((iterationCount / numIterations) * 50) + "%" );
                        //    if (someCondition)
                        //        return true; // abort/stop training
                        }
                    }
                });
            //    }).then(results => console.log('done!', results));


                // ANGULAR POSITION SECOND NEURAL NETWORK MODEL
                app.neuralNet2 = new app.Architect.LSTM(7, 5, 2, 1);
             //   app.neuralNet2 = new app.Architect2.Perceptron(7, 5, 2, 1);
                app.trainer2 = new app.Trainer2(app.neuralNet2);

                var trainingData2 = app.trainingDataTrue2.concat(app.trainingDataFalse2);
                var iterationCount2 = 0;
                app.neuroData2.transmitCount = 0;

                console.log("Training data length2: " + trainingData2.length);
                console.dir(trainingData2);

                console.log("NN2 Training data length: " + trainingData2.length + "  input length: " + trainingData2[2].input.length + "  output length: " + trainingData2[2].output.length);

                app.trainer2.train(trainingData2, {
              //  app.trainer2.trainAsync(trainingData2, {
                    rate: numRate,
                    iterations: numIterations,
                    error: numError,
                    shuffle: true,
                    log: numLogInterval,
                    cost: app.Trainer2.cost.CROSS_ENTROPY,
                    schedule: {
                        every: numScheduleInterval, // repeat this task every 500 iterations
                        do: function(data) {
                            // custom log
                            iterationCount2 = iterationCount2 + numScheduleInterval;
                            app.showInfo(iterationCount2 + '/' + numIterations + ' training iterations');
                            console.log("schedule log - error:" + data.error + " iterations:" + data.iterations + " rate:" + data.rate);

                            $("#training-progress div.progressbar").css("width", ((iterationCount2 / numIterations) * 100) + "%" );

                            //hide indeterminate progress bar
                            if(iterationCount2 > (numIterations - iterationCount2 - iterationCount2 - 1)) $("#training-progress").hide();             
                
                        //    if (someCondition)
                        //        return true; // abort/stop training
                        }
                    }
                });//.then(results => console.log('done!', results)); 


                app.showInfo('Status: Training Completed');
                console.log("**End Training...");

                //ready to send
                enableButton("sendNeuroButton");

                app.neuroHaveFlag = true;
                app.trainFlag = false;
            }
            /********************************* END TRAIN NEURAL NET ***********************************/
            /********************************* END TRAIN NEURAL NET ***********************************/


            /*************************** START SEND NEURAL NETWORK TO DEVICE *****************************/
            /*************************** START SEND NEURAL NETWORK TO DEVICE *****************************/
			if (app.neuroSendFlag) {

				   //export NN + activation code

                //clear everything but key values from stored NN
                app.neuralNet.clear();
                app.neuralNet2.clear();

                //export optimized weights and activation function
                var standalone = app.neuralNet.standalone();
                var standalone2 = app.neuralNet2.standalone();

                //convert to string for parsing
                standalone = standalone.toString();
                standalone2 = standalone2.toString();

                console.log("Standalone NN: " + standalone);
                console.log("Standalone NN2: " + standalone2);

                //split off weights & get rid of activation stuff
                standalone = standalone.split("}");
                standalone2 = standalone2.split("}");


                standalone = standalone[0];
                standalone2 = standalone2[0];

                //split off starting functiony stuff
                standalone = standalone.split("{");
                standalone = standalone.reverse();
                standalone = standalone[0];

                standalone2 = standalone2.split("{");
                standalone2 = standalone2.reverse();
                standalone2 = standalone2[0];

                //	console.log(standalone);

                //remove line breaks
                standalone = standalone.replace(/(\r\n|\n|\r)/gm, "");
                standalone2 = standalone2.replace(/(\r\n|\n|\r)/gm, "");


                standalone = standalone.split(",");
                standalone2 = standalone2.split(",");


                console.log("Processed Standalone NN: " + standalone);
                console.log("Processed Standalone NN2: " + standalone2);

                //four weights for each packet
                var fourToSend;


                //PROCESS ARRAY OF RAW DATA STRINGS
                for (var j = 0; j < standalone.length; j++) {

                    var splitLine = standalone[j].split(":");

                    var intIndex = splitLine[0];  //weight ID
                    var strWeight = splitLine[1]; //weight value

                    var weightIndex = parseInt(strIndex);
                    var floatWeight = parseFloat(strWeight);



                    //NN METADATA
                    //first digit is nor NN ID, second is for weight being positive or negative
                    //IS IT NN1 OR NN2?
                    var weightMetadata = '0'; //'0' for first 5 input NN
                    //IS IT NEGATIVE?
                    if(floatWeight >= 0){
                    	weightMetadata = weightMetadata + '1';
                    } else {
                    	weightMetadata = weightMetadata + '0';
                    	floatWeight = floatWeight * (-1);
                    } 

                    //modify weight value for sending
                    var hexWeight = Math.round( ( floatWeight * 10000) ).toString(16);
                    

                   	console.log("ID:" + intIndex + "raw weight:" + strWeight + " compressed wieght:" + Math.round( ( floatWeight * 10000) ) + " hex weight:" + hexWeight + " meta:" + weightMetadata);
                   	
                   	var weightData;
                    weightData.id = intIndex;
                   	weightData.meta = weightMetadata;
                   	weightData.val = hexWeight

                   	fourToSend.push()
                    //***PROCESS INDEX VALUE
                    var processSendData = new Uint8Array(20);

                    processSendData[0] = "00";
                    processSendData[1] = "00";
                    processSendData[2] = "00";
                    processSendData[3] = "00";
                    processSendData[4] = "00";
                    processSendData[5] = "00";
                    processSendData[6] = "00";
                    processSendData[7] = "00";
                    processSendData[8] = "00";
                    processSendData[9] = "00";
                    processSendData[10] = "00";
                    processSendData[11] = "00";
                    processSendData[12] = "00";
                    processSendData[13] = "00";
                    processSendData[14] = "00";
                    processSendData[15] = "00";
                    processSendData[16] = "00";
                    processSendData[17] = "00";
                    processSendData[18] = "00";
                    processSendData[19] = "00";

                }
                app.neuroSendFlag = false;

/*
                //third position in data for +/- weight
                processSendData[2] = "00"; //default positive
                if (floatWeight < 0) {
                    processSendData[2] = "01"; //weight is negative
                    floatWeight = floatWeight * (-1); //absolute value
                }

                if (floatWeight != 0) { //if zero then already taken care of

                    floatWeight = floatWeight * 100000; //push back beyond decimal for storage

                    strWeight = floatWeight.toString();
                    strWeight = strWeight.split(".")[0]; //get rid of period and trailing digits

                    //	strWeight = parseFloat( strWeight ).toString(16);


                        if (strWeight.length == 7) strWeight = '0' + strWeight;
                        else if (strWeight.length == 6) strWeight = '00' + strWeight;
                        else if (strWeight.length == 5) strWeight = '000' + strWeight;
                        else if (strWeight.length == 4) strWeight = '0000' + strWeight;
                        else if (strWeight.length == 3) strWeight = '00000' + strWeight;
                        else if (strWeight.length == 2) strWeight = '000000' + strWeight;
                        else if (strWeight.length == 1) strWeight = '0000000' + strWeight;

                        console.log("strWeight: " + strWeight + " stIndex: " + strIndex + " [2]: " + processSendData[2] + " [3]: " + processSendData[3] + " [4]: " + processSendData[4] + " [5]: " + processSendData[5] + "  [6]: " + processSendData[6]);

                        processSendData[3] = strWeight.charAt(0) + strWeight.charAt(1);
                        processSendData[4] = strWeight.charAt(2) + strWeight.charAt(3);
                        processSendData[5] = strWeight.charAt(4) + strWeight.charAt(5);
                        processSendData[6] = strWeight.charAt(6) + strWeight.charAt(7);
                        
                }

                    //*** Load N weight into NN network weight array 
                    var parsedIndex = parseInt(strIndex, 10);
                    app.sendData.weights[parsedIndex] = processSendData;

            } //end of single NN send    

            //I send the weights multiple times to verify correct transmission 
            var numSend = 2;
            for (var r = 0; r < numSend; r++) { //send multiple N weights

                if ((app.neuroSendFlag == true) && (app.sendData.transmitCount < 256)) {

                    console.log("NEURO INDEX: " + app.sendData.sendIndex);
                    console.log("NEURO VAL: " + app.sendData.weights[app.sendData.sendIndex]);

                    app.device.writeCharacteristic(
                        '0000a005-0000-1000-8000-00805f9b34fb',
                        app.sendData.weights[app.sendData.sendIndex],
                        function() {
                            console.log('Neuro value sent successfully!');
                            app.sendData.transmitCount = app.sendData.transmitCount + 1;

                        },
                        function(error) {
                            console.log('Neuro value send failed: ' + error)
                        }
                    );

                    if (app.sendData.transmitCount < 256) app.showInfo("Sending neural network: " + app.sendData.transmitCount + "/255"); //document.getElementById('score').innerHTML = "Sending neural network: " + app.sendData.transmitCount + "/1000";

                    app.sendData.sendIndex++; //cycle to next NN neuron weight

                    if (app.sendData.sendIndex > (app.sendData.weights.length - 1)) app.sendData.sendIndex = 0; //start over again
                } */

            }
        /*************************** END SEND NEURAL NETWORK TO DEVICE *****************************/
        /*************************** END SEND NEURAL NETWORK TO DEVICE *****************************/

        } //end if data tab has class "is-active"

        }, function(errorCode) {
            console.log('Error: data enableNotification: ' + errorCode + '.');
        });

};


/****************************************************
*******EXAMPLE BASED ON PHONE ACCELEROMETER *********
****************************************************/

//app.startExampleDataStream = function(device) {
function accelerometerHandler(accelerationX, accelerationY, accelerationZ){
 //   app.showInfo('Status: Starting data stream...');
    app.showInfo('Status: Example data stream active');

    if( $("#dataPageButton").hasClass("is-active") ){
            
        var acc = [accelerationX, accelerationY, accelerationZ];
        var pitch = (180/3.141592) * ( Math.atan2( acc[0], Math.sqrt( acc[1] * acc[1] + acc[2] * acc[2])) );
        var roll = (180/3.141592) * ( Math.atan2(-acc[1], -acc[2]) );


        //parse data from sensors
        var values = new Array(); 
        values[0] =  pitch + 180; //((accelerationX + 10) / 18) * 360; //pitch
        values[1] =  roll; //((accelerationY + 10) / 18) * 360; //roll
        if(values[1] < 0) values[1] = 360 + roll;

        /*************************** UPDATE CHART SENSOR DATA *****************************/
        var now = Date.now();
        if(app.neuroHaveFlag != true){ //oncle we have a nn model we only visualize that
        //    lineRoll.append(now,     ( (values[0] / 360) / 7) + 0.05);
        //    linePitch.append(now,    ( (values[1] / 360) / 7) + 0.10);
            lineTherm1.append(now,    ((values[0] / 360) / 2) + 0.5);
            lineTherm4.append(now,    ((values[1] / 360) / 2) + 0.0);
        }
            
   //     console.log("timestamp + example: " + now + "  pitch: " + values[0] + " roll:" + values[1]);  //log because time gets big




        /*************************** START ACTIVATE NEURAL NETWORK ***********************************/
        //EXAMPLE NEURAL NETWORK FROM PHONE ACCELEROMETER DATA
        if(app.neuroHaveFlag && app.connected == false){
                app.neuroScore = app.neuralNet.activate([
                    (values[0] / 360),
                    (values[1] / 360)
                ]);

                //from 0-1 to 0-100%
                app.neuroScore = app.neuroScore * 100;

                //round to three sig digits
                app.neuroScore = (Math.round(app.neuroScore * 1000)) / 1000;

                if (app.neuroScore > 0.90){ app.alertDetect(); }

             //   lineNN.append(now,     ( (app.neuroScore / 100) / 7) + 0.65);
                lineNN.append(now,     (app.neuroScore / 100) );
                app.showInfo('Detection: ' + app.neuroScore.toFixed(2) + "%");
            }
            /*************************** END ACTIVATE NEURAL NETWORK ***********************************/

            /*************************** START EXAMPLE GET TRUE/ON TARGET SAMPLES ******************************/
            if (app.getTrueFlag && app.connected == false && app.trainingDataTrue.length < 100) {

                app.trainingDataTrue.push({
                    input: [ (values[0] / 360), (values[1] / 360)],
                    output: [1]
                });

                app.showInfo(" ...gathering true example training data");
                $("#numTrueData").attr( "data-badge", app.trainingDataTrue.length );
            }
            /*************************** END EXAMPLE GET TRUE/ON TARGET SAMPLES **********************************/

            /*************************** START EXAMPLE GET FALSE/OFF TARGET SAMPLES ******************************/
            else if (app.getFalseFlag && app.connected == false && app.trainingDataFalse.length < 100) {

                app.trainingDataFalse.push({
                    input: [ (values[0] / 360), (values[1] / 360)],
                    output: [0]
                });

                console.log("trainingDataFalse input: " + app.trainingDataFalse[app.trainingDataFalse.length - 1].input[0] + " " + app.trainingDataFalse[app.trainingDataFalse.length - 1].input[1] + " " + app.trainingDataFalse[app.trainingDataFalse.length - 1].input[2] + " " + app.trainingDataFalse[app.trainingDataFalse.length - 1].input[3] + " " + app.trainingDataFalse[app.trainingDataFalse.length - 1].input[4]);
                app.showInfo(" ...gathering false training data");
                $("#numFalseData").attr( "data-badge", app.trainingDataFalse.length );
            } 
            /*************************** END EXAMPLE GET FALSE/OFF TARGET SAMPLES ******************************/

            /********************************* START TRAIN EXAMPLE NEURAL NET ***********************************/
            if (app.trainFlag && app.connected == false) {

                app.showInfo('Status: Training...');
                console.log("**Training...");

                $("#training-progress div.progressbar").css("width", "0%" );

                //Recreate neural net and trainer
                app.neuralNet = new app.Architect.LSTM(2, 2, 2, 1);

                app.trainer = new app.Trainer(app.neuralNet);

                var trainingData = app.trainingDataTrue.concat(app.trainingDataFalse); 
                var iterationCount = 0;

                console.log("NN1 Training data length: " + trainingData.length + "  input length: " + trainingData[2].input.length + "  output length: " + trainingData[2].output.length);
                for(var f=0; f < trainingData.length; f++){
                    console.log("trainingData " + f + ": input: " + trainingData[f].input[0] + " " + trainingData[f].input[1] + " output:" + trainingData[f].output[0]);
                }

                //synaptic hyperparameters and controls
                var numIterations        = 1000;
                var numRate              = 0.06;
                var numError             = 0.06;
                var numLogInterval       = 100;
                var numScheduleInterval  = 100;

             //   app.trainer.trainAsync(trainingData, {
                app.trainer.train(trainingData, {
                    rate: numRate,
                    iterations: numIterations,
                    error: numError,
                    shuffle: true,
                    log: numLogInterval,
                    cost: app.Trainer.cost.CROSS_ENTROPY,
                    schedule: {
                        every: numScheduleInterval, // repeat this task every 500 iterations
                        do: function(data) {
                            // custom log
                            iterationCount = iterationCount + numScheduleInterval;
                            app.showInfo(iterationCount + '/' + numIterations + ' training iterations');
                            console.log("schedule log - error:" + data.error + " iterations:" + data.iterations + " rate:" + data.rate);
                        }
                    }
                });


                app.showInfo('Status: Training Example Completed');
                console.log("**End Example Training...");

                app.neuroHaveFlag = true;
                app.trainFlag = false;
            }
        } //is on data page?
}

/****************************************************
*****END EXAMPLE BASED ON PHONE ACCELEROMETER *******
****************************************************/


/**
 * Do this if neural network score(s) is above threshold
 */
app.alertDetect = function() {
    /********** CORDOVA VIBRATION PLUGIN ALERT **********/
    // navigator.vibrate(1000);
};




/**
 * Calculate sensor values from raw data for Tingle.
 * @param data - an Uint8Array.
 * @return Object with fields: [roll, pitch, proximity, thermo1, thermo2, thermo3, thermo4, accelX, accelY, accelZ]
 */
app.getSensorValues = function(data) {
    //	var divisors = { x: -16384.0, y: 16384.0, z: -16384.0 };
    	console.log("app.getAccelerometerValues" );

    //Parse data
    var roll = evothings.util.littleEndianToUint8(data, 0);
    var pitch = evothings.util.littleEndianToUint8(data, 1);
    var proximity = evothings.util.littleEndianToUint8(data, 2);
    //devide by two because multiplied before sending to make best use of max val 255 8bit unsigned int
    var thermo1 = (evothings.util.littleEndianToUint8(data, 3) / 8.0) + 70.0;
    var thermo2 = (evothings.util.littleEndianToUint8(data, 4) / 8.0) + 70.0;
    var thermo3 = (evothings.util.littleEndianToUint8(data, 5) / 8.0) + 70.0;
    var thermo4 = (evothings.util.littleEndianToUint8(data, 6) / 8.0) + 70.0;

    var thermoDeviceTemperature = (evothings.util.littleEndianToUint8(data, 7) / 8.0) + 70.0;
    var batteryValue = evothings.util.littleEndianToUint8(data, 8);
    var deviceCommand = evothings.util.littleEndianToUint8(data, 9);


    var accelX = evothings.util.littleEndianToUint8(data, 10);
    var accelY = evothings.util.littleEndianToUint8(data, 11);
    var accelZ = evothings.util.littleEndianToUint8(data, 12);

    // *raw accelerometer values were originally between -1 and 1. added 1 and multiplied by 100 to make best use of max 255 8bit unsigned int

    	console.log("roll: " + roll + " pitch: " + pitch + " proximity: " + proximity + " thermo1: " + thermo1 + " thermo2: " + thermo2 + " thermo3: " + thermo3 + " thermo4: " + thermo4);

    // Return result.
    return [roll, pitch, proximity, thermo1, thermo2, thermo3, thermo4, accelX, accelY, accelZ];
};


/***************************************************
**************** BUTTON FUNCTIONS ******************
****************************************************/

/**
 * when low level initialization complete,
 * this function is called
 */
app.onConnectButton = function() {
    console.log("app.onConnectButton");
    // Get device name from text field.
    app.deviceName = $('#device_search').val();

    // Save it for next time we use the app.
  //  localStorage.setItem('deviceName', app.deviceName);

    // Call stop before you start, just in case something else is running.
    evothings.ble.stopScan();
    evothings.ble.reset();

  //  app.connectToDevice(app.device);
    app.showInfo('Status: Scanning...');
    app.startScan();
};

/**
 * Gather neural net training data for true condition - when on target
 */
app.onSendSettingsButton = function() {

    console.log("app.onSendSettingsButton");
    var hand, handCode, hair, hairCode, sensitivity, sensitivityCode; 
    var targets = new Array;
    var targetsCode1 = '0'; //default
    var targetsCode2 = '0'; //default
  //  var targets = {'null','null'};

    //check hand settings
    if( $('#option-left').is(':checked')){
        hand = 'left';
        handCode = '01';
    } else {
        hand = 'right';
        handCode = '02';
    }

    //check hair setting
    if( $('#option-short').is(':checked')){
        hair = 'short';
        hairCode = '01';
    } else if( $('#option-medium').is(':checked')){
        hair = 'medium';
        hairCode = '02';
    } else {
        hair = 'long';
        hairCode = '03';
    }

    //check sensitivity settings
    sensitivity = $("#sensitivity-slider").val();
    sensitivityCode = '0' + sensitivity.toString();

    //check target settings
 /*   if( $('.target-option-container #checkbox-1').is(':checked')) targets.push('front');
    if( $('.target-option-container #checkbox-2').is(':checked')) targets.push('side');
    if( $('.target-option-container #checkbox-3').is(':checked')) targets.push('back');
    if( $('.target-option-container #checkbox-4').is(':checked')) targets.push('top');
    if( $('.target-option-container #checkbox-5').is(':checked')) targets.push('mouth');
    if( $('.target-option-container #checkbox-6').is(':checked')) targets.push('eyes'); */
    var numChecked = 0;
    $('.target-option-container').find('input').each(function() {
        console.log("iterate targets");
        if(numChecked >= 2) return false;

        if ( $(this).is(":checked") ){
            targets.push( $(this).attr('name') );
            numChecked++;
          //  console.log("target checked");

            if(numChecked == 1){
                targetsCode1 = $(this).attr('code');
            } else { targetsCode2 = $(this).attr('code'); }
        }
    });

    if(targetsCode1.length == 1) targetsCode1 = '0' + targetsCode1;
    if(targetsCode2.length == 1) targetsCode2 = '0' + targetsCode2;

    console.log('Settings - hand:' + hand + ' hair:' + hair + ' targetsCode1:' + targetsCode1 + ' targetsCode2:' + targetsCode2 + ' targets:' + targets[0] + ' ' + targets[1] + ' sensitivity:' + sensitivityCode);
    console.log(handCode + '-' + hairCode + '-' + targetsCode1 + '-' + sensitivityCode);

 //   if( $("#sendSettingsButton").hasClass("is-active") ){
        console.log("sending....");
	    app.sendFlag = true;

	    var settingsSendData = new Uint8Array(20);

        settingsSendData[0] = handCode;
        settingsSendData[1] = hairCode;
        settingsSendData[2] = targetsCode1;
        settingsSendData[3] = sensitivityCode;
        settingsSendData[4] = '00';
        settingsSendData[5] = '00';
        settingsSendData[6] = '00';
        settingsSendData[7] = '00';
        settingsSendData[8] = '00';
        settingsSendData[9] = '00';
        settingsSendData[10] = '00';
        settingsSendData[11] = '00';
        settingsSendData[12] = '00';
        settingsSendData[13] = '00';
        settingsSendData[14] = '00';
        settingsSendData[15] = '00';
        settingsSendData[16] = '00';
        settingsSendData[17] = '00';
        settingsSendData[18] = '00';
        settingsSendData[19] = '18';   //send type code
        

     //   var settingsSendData = new Uint8Array(2);
     //   settingsSendData[0] = 7;
    //    settingsSendData[1] = 9;

       // var settingsSendData = new ArrayBuffer(['7']);
     //   var settingsSendData = new Uint16Array([7]);
      //  settingsSendData[0] = '99';

       // var settingsSendData = str2ab('99');

    //   var data = new ArrayBuffer(['7','9']);
     //  var data = new Uint8Array(['7','9']);
      // var settingsSendData = new Uint8Array([data]);


	    evothings.ble.writeCharacteristic(
	    	app.device,
            app.writeCharacteristic,
            settingsSendData, //new Uint8Array([1]), //settingsSendData,
            function() {
                console.log('Settings sent successfully!');
                },
                function(error) {
                    console.log('Settings send failed: ' + error);
                }
        );


    //RECONNECT TO DEVICE BECAUSE DEVICE MUST DISCONNECT TO STORE SETTINGS IN FLASH
    setTimeout(
        function(){ 
            app.onConnectButton();
        }
    , 2000)
//	}

};



//limit number of selected targets and warn
app.onClickTarget = function(code) {
    console.log("target input click");
    $('.mdl-js-checkbox').each(function (index, element) { 
        if( $(this).find('input').attr("code") == code ){

        } else {
            element.MaterialCheckbox.uncheck();
        }
    });

/*

    var targetCount = 0;

    $('.target-option-container').find('input').each(function() {
        if ( $(this).is(":checked") ){
            targetCount++;
        }
    });


    if(targetCount <= 1){ //two target max
        if(targetCount <= 0){ 

        $('.target-option-container').find('input').each(function() {
            enableButton( $(this).parent().attr('id') );
            enableButton( $(this).attr('id') );
        });


    } else if(targetCount >= 2){  //two target max


        $('.target-option-container').find('input').each(function() {


            if ( $(this).is(":checked") ){
                enableButton( $(this).attr('id') );
            } else {
                disableButton( $(this).parent().attr('id') );
                disableButton( $(this).attr('id') );
            }

        });



    } 

    if(targetCount >= 2){
    //    $(this).attr('checked', false);   
    //    $(this).closest("label").removeClass("is-checked");
    //    $(this).closest("label").css( "color", "green" ); 
    //    $(this).parent().css( "color", "yellow" );
    //    document.querySelector('.target-position').MaterialCheckbox.disable();
    //    if ( $(this).is(":checked") ){
    //        $(this).trigger( "click" );
    //    }

        $("#target-count-warning").show();
    } else { $("#target-count-warning").hide(); } */
/*        $('.target-option-container').find('input').each(function() {

            disableButton( $(this).attr('id') );
            enableButton( $(this).attr('id') );
        });

    $("input.target-position").prop('checked', false);
    $("input.target-position").attr('checked', false);
    $("input.target-position").removeClass('selected');
    $("input.target-position").removeClass('current-checked');

    $("input.target-position[code=" + code + "]").addClass('current-checked'); */

 /*   $('.target-option-container').find('input').each(function() {
        enableButton( $(this).attr('id') );
        $(this).prop('checked', false);
        $(this).removeClass('selected');
        $(this).removeClass('current-checked');
    });

    var $activeTarget = $("input").find("[code='" + code + "']"); 
    $activeTarget.prop('checked', true);
    $activeTarget.addClass('selected');
    $activeTarget.addClass('current-checked'); */

}; 


/**
 * Gather neural net training data for true condition - when on target
 */
app.onSendNeuroButton = function() {
    console.log("app.onSendButton");
    app.neuroSendFlag = true;
};

/**
 * Gather neural net training data for true condition - when on target
 */
app.onTrainButton = function() {
    console.log("app.onTrainButton");

    //show indeterminate progress bar
    $("#training-progress").show();
    app.trainFlag = true;
}; 


/**
 * Gather neural net training data for true condition - when on target
 */
app.onGetTrueButton = function() {
    console.log("app.onGetTrueButton");

    app.getTrueFlag = !app.getTrueFlag;

    if (app.getTrueFlag) {
        $("#getTrueButton").html("Finished On Target");
    } else {
        $("#getTrueButton").html("Add On Target");
        //Let device know we are at standby
        app.varState = 0;
    }         

    if( app.trainingDataTrue.length > 0 && app.trainingDataFalse.length > 0){
        enableButton("trainButton");
    }
};

/**
 * Gather neural net training data for false condition - when off target
 */
app.onGetFalseButton = function() {
    console.log("app.onGetFalseButton");

    app.getFalseFlag = !app.getFalseFlag;

    if (app.getFalseFlag){
        $("#getFalseButton").html("Finished Off Target");
    } else {
        $("#getFalseButton").html("Add Off Target");
        //Let device know we are at standby
        app.varState = 0;
    }

    if( app.trainingDataTrue.length > 0 && app.trainingDataFalse.length > 0){
        enableButton("trainButton");
    }
};

/**
 * Clear True Training set
 */
app.onClearTrueButton = function() {
    console.log("app.onClearTrueButton");
    app.trainingDataTrue = [];
    $("#numTrueData").attr( "data-badge", 0 );
  //  document.getElementById('numTrueData').innerHTML = "0";

    app.trainingDataTrue = [];

    disableButton("trainButton");
    disableButton("sendNeuroButton");
};

/**
 * Clear True Training set
 */
app.onClearFalseButton = function() {
    console.log("app.onClearFalseButton");
    app.trainingDataFalse = [];
    $("#numFalseData").attr( "data-badge", 0 );
  //  document.getElementById('numFalseData').innerHTML = "0";

    app.trainingDataFalse = [];

    disableButton("trainButton");
    disableButton("sendNeuroButton");
};

/**
 * Sensitivity slider value change
 */
app.onSetSensitivity = function() {
//$( "#sensitivity-slider" ).change(function() {
    var sensitivity = $("#sensitivity-slider").val();
    console.log("Sensitivity slider value: " + sensitivity);

    if(sensitivity == 0) $(".sensitivity-label").html("Sensitivity: <span>very low</span>");
    if(sensitivity == 1) $(".sensitivity-label").html("Sensitivity: <span>low</span>");
    if(sensitivity == 2) $(".sensitivity-label").html("Sensitivity: <span>medium</span>");
    if(sensitivity == 3) $(".sensitivity-label").html("Sensitivity: <span>high</span>");
    if(sensitivity == 4) $(".sensitivity-label").html("Sensitivity: <span>very high</span>");
//});
};

/*******************************************
************* UTILITY FUNCTIONS ************
*******************************************/

/**
 * Adjust the canvas dimensions based on its container's dimensions.
 */
app.respondCanvas = function() {
    var canvas = $('#streaming-data-chart');
    var container = $(canvas).parent();
    canvas.attr('width', ($(container).width() * 1.00));  // Max width
    // Not used: canvas.attr('height', $(container).height() ) // Max height
};


/**
 * Print debug info to console and application UI.
 */
app.showInfo = function(info) {
    document.getElementById('info').innerHTML = info;
    console.log(info);
};


/**
 * Other Utility Functions
 */
 function enableButton(buttonID) {
    var btn = document.getElementById(buttonID);
    btn.removeAttribute("disabled");
    componentHandler.upgradeElement(btn);
}

function disableButton(buttonID) {
    var btn = document.getElementById(buttonID);
    btn.setAttribute("disabled", "");
    componentHandler.upgradeElement(btn);
}

function mergeObjects(obj, src) {
    Object.keys(src).forEach(function(key) {
        obj[key] = src[key];
    });
    return obj;
}

longToByteArray = function( /*long*/ long) {
    // we want to represent the input as a 8-bytes array
    var byteArray = [0, 0, 0, 0, 0, 0, 0, 0];

    for (var index = 0; index < byteArray.length; index++) {
        var byte = long & 0xff;
        byteArray[index] = byte;
        long = (long - byte) / 256;
    }

    return byteArray;
};

byteArrayToLong = function( /*byte[]*/ byteArray) {
    var value = 0;
    for (var i = byteArray.length - 1; i >= 0; i--) {
        value = (value * 256) + byteArray[i];
    }

    return value;
};

fillStringZeros = function(shortString, targetLength){
	var startL = shortString.length;
	if(startL == targetLength){} //do nothing
	else if(startL == (targetLength - 1) ) shortString = '0' + shortString;
	else if(startL == (targetLength - 2) ) shortString = '00' + shortString;
	else if(startL == (targetLength - 3) ) shortString = '000' + shortString;
	else if(startL == (targetLength - 4) ) shortString = '0000' + shortString;
	else if(startL == (targetLength - 5) ) shortString = '00000' + shortString;
	else if(startL == (targetLength - 6) ) shortString = '000000' + shortString;
	else if(startL == (targetLength - 7) ) shortString = '0000000' + shortString;
	else if(startL == (targetLength - 8) ) shortString = '00000000' + shortString;
	else if(startL == (targetLength - 9) ) shortString = '000000000' + shortString;
	else if(startL == (targetLength - 10) ) shortString = '0000000000' + shortString;


    return shortString;
}

//format data for sending as BLE characteristic
function str2ab(str){
    var buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
    var bufView = new Uint8Array(buf);
    for (var i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);

        return bufView;  
    }
}

/*
function deviceOrientationHandler(evt) {
    var orientationData = evt;

    // vertical tilt
  //  orientationEl.children[3].innerHTML = evt.beta;
    // horizontal tilt
  //  orientationEl.children[5].innerHTML = evt.gamma;

    setInterval(function() {
    //    console.log('orientation.x: ' + evt.beta + 'orientation.y: ' + evt.gamma);

        if(app.connected == false && $("#dataPageButton").hasClass("is-active")){
            console.log('orientation.x: ' + evt.beta + 'orientation.y: ' + evt.gamma);
            accelerometerHandler(evt.beta, evt.gamma);
        }

    }, 250);
}
*/

function initialiseAccelerometer()
{
    function onSuccess(acceleration)
    {
        //  console.log('acceleration.x: ' + acceleration.x + 'acceleration.y: ' + acceleration.y);
        if(app.connected == false && $("#dataPageButton").hasClass("is-active")){
            accelerometerHandler(acceleration.x, acceleration.y, acceleration.z);

            if( $("#graph-title").hasClass("example-data-title") ){

            } else {
                $("#graph-title").html("EXAMPLE DATA FROM PHONE");
                $("#graph-title").addClass("example-data-title")
            }
        }
        if(app.connected == true){
            // watchID created while adding the watchAcceleration listener
            navigator.accelerometer.clearWatch(watchID);
        }
    }

    function onError(error)
    {
        console.log('Accelerometer error: ' + error)
    }

    var watchID = navigator.accelerometer.watchAcceleration(
        onSuccess,
        onError,
        { frequency: 200 })
}


app.initialize();
