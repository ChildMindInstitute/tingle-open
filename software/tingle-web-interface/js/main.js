/*
​x=r sin(φ)cos(θ)
​y=r sin(φ)sin(θ)
​z=r cos(φ)
*/
/* DATA SAMPLE TEMPLATE
{
  Thermo1 Object Temp,
  Thermo2 Object Temp,
  Thermo3 Object Temp,
  Thermo4 Object Temp,
  Distance,
  Pitch,
  Roll,
  Acc X,
  Acc Y,
  Acc Z,
  Thermo Ave. Device Temp,
  Time Stamp,
  Hand,
  Target,
  on/off Target Observed
}*/
var preProcess = 2; //THERMOPILE PREPROCESSING NORMALIZATION METHOD SELECTION

//sensor data object
var state = {};

    // Web Bluetooth connection -->

$( document ).ready(function() {
    button = document.getElementById("connect");
    message = document.getElementById("message");
});

//connection flag
var bluetoothDataFlag = false;

if ( 'bluetooth' in navigator === false ) {
    button.style.display = 'none';
    message.innerHTML = 'This browser doesn\'t support the <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API" target="_blank">Web Bluetooth API</a> :(';
}

const services = {
    controlService: {
        name: 'control service',
        uuid: '0000a000-0000-1000-8000-00805f9b34fb'
    }
}

const characteristics = {
    commandReadCharacteristic: {
        name: 'command read characteristic',
        uuid: '0000a001-0000-1000-8000-00805f9b34fb'
    },
    commandWriteCharacteristic: {
        name: 'command write characteristic',
        uuid: '0000a002-0000-1000-8000-00805f9b34fb'
    },
    deviceDataCharacteristic: {
        name: 'imu data characteristic',
        uuid: '0000a003-0000-1000-8000-00805f9b34fb'
    }
}

var _this;
var state = {};
var previousPose;

var sendCommandFlag = false; //global to keep track of when command is sent back to device
//let commandValue = new Uint8Array([0x01,0x03,0x02,0x03,0x01]);   //command to send back to device
let commandValue = new Uint8Array([0x99]); //command to send back to device

class ControllerWebBluetooth {
    constructor(name) {
        _this = this;
        this.name = name;
        this.services = services;
        this.characteristics = characteristics;
        this.standardServer;
    }

    connect() {
        return navigator.bluetooth.requestDevice({
            filters: [{
                        name: this.name
                    },
                    {
                        services: [services.controlService.uuid]
                    }
                ]
            })
            .then(device => {
                console.log('Device discovered', device.name);
                return device.gatt.connect();
            })
            .then(server => {
                console.log('server device: ' + Object.keys(server.device));

                this.getServices([services.controlService, ], [characteristics.commandReadCharacteristic, characteristics.commandWriteCharacteristic, characteristics.deviceDataCharacteristic], server);
            })
            .catch(error => {
                console.log('error', error)
            })
    }

    getServices(requestedServices, requestedCharacteristics, server) {
        this.standardServer = server;

        requestedServices.filter((service) => {
            if (service.uuid == services.controlService.uuid) {
                _this.getControlService(requestedServices, requestedCharacteristics, this.standardServer);
            }
        })
    }

    getControlService(requestedServices, requestedCharacteristics, server) {
        let controlService = requestedServices.filter((service) => {
            return service.uuid == services.controlService.uuid
        });
        let commandReadChar = requestedCharacteristics.filter((char) => {
            return char.uuid == characteristics.commandReadCharacteristic.uuid
        });
        let commandWriteChar = requestedCharacteristics.filter((char) => {
            return char.uuid == characteristics.commandWriteCharacteristic.uuid
        });

        // Before having access to IMU, EMG and Pose data, we need to indicate to the Myo that we want to receive this data.
        return server.getPrimaryService(controlService[0].uuid)
            .then(service => {
                console.log('getting service: ', controlService[0].name);
                return service.getCharacteristic(commandWriteChar[0].uuid);
            })
            .then(characteristic => {
                console.log('getting characteristic: ', commandWriteChar[0].name);
                // return new Buffer([0x01,3,emg_mode,imu_mode,classifier_mode]);
                // The values passed in the buffer indicate that we want to receive all data without restriction;
                //  let commandValue = new Uint8Array([0x01,0x03,0x02,0x03,0x01]);
                //this could be config info to be sent to the wearable device
                let commandValue = new Uint8Array([0x99]);
                //   characteristic.writeValue(commandValue); //disable initial write to device
            })
            .then(_ => {

                let deviceDataChar = requestedCharacteristics.filter((char) => {
                    return char.uuid == characteristics.deviceDataCharacteristic.uuid
                });

                console.log('getting service: ', controlService[0].name);
                _this.getdeviceData(controlService[0], deviceDataChar[0], server);

            })
            .catch(error => {
                console.log('error: ', error);
            })
    }

    sendControlService(requestedServices, requestedCharacteristics, server) {
        let controlService = requestedServices.filter((service) => {
            return service.uuid == services.controlService.uuid
        });
        let commandReadChar = requestedCharacteristics.filter((char) => {
            return char.uuid == characteristics.commandReadCharacteristic.uuid
        });
        let commandWriteChar = requestedCharacteristics.filter((char) => {
            return char.uuid == characteristics.commandWriteCharacteristic.uuid
        });

        // Before having access to sensor, we need to indicate to the Tingle that we want to receive this data.
        return server.getPrimaryService(controlService[0].uuid)
            .then(service => {
                console.log('getting service: ', controlService[0].name);
                return service.getCharacteristic(commandWriteChar[0].uuid);
            })
            .then(characteristic => {
                console.log('getting write command to device characteristic: ', commandWriteChar[0].name);
                // return new Buffer([0x01,3,emg_mode,imu_mode,classifier_mode]);
                // The values passed in the buffer indicate that we want to receive all data without restriction;
                let commandValue = new Uint8Array([0x99]);
                getConfig();
                commandValue[0] = targetCommand;

                console.log("CONFIG target:" + activeTarget + "  command:" + commandValue[0]);
                characteristic.writeValue(commandValue);
            })
            .then(_ => {

                //  let deviceDataChar = requestedCharacteristics.filter((char) => {return char.uuid == characteristics.deviceDataCharacteristic.uuid});
                console.log("COMMAND SENT TO DEVICE");
                sendCommandFlag = false;
                //   console.log('getting service: ', controlService[0].name);
                //  _this.getdeviceData(controlService[0], deviceDataChar[0], server);

            })
            .catch(error => {
                sendCommandFlag = false;
                console.log("COMMAND SEND ERROR");
                console.log('error: ', error);
            })
    }


    handleDeviceDataChanged(event) {
        //byteLength of deviceData DataView object is 20.
        // deviceData return {{orientation: {w: *, x: *, y: *, z: *}, accelerometer: Array, gyroscope: Array}}

        let deviceData = event.target.value;

    let accelerometerRoll   = ( (event.target.value.getUint8(0) / 255) * 360 );
    let accelerometerPitch  = ( (event.target.value.getUint8(1) / 255) * 360 );

    let proximity           = (event.target.value.getUint8(2) );

    let objectTemp1         = (event.target.value.getUint8(3) / 8) + 70;
    let objectTemp2         = (event.target.value.getUint8(4) / 8) + 70;
    let objectTemp3         = (event.target.value.getUint8(5) / 8) + 70;
    let objectTemp4         = (event.target.value.getUint8(6) / 8) + 70;

    let ambientAverage      = (event.target.value.getUint8(7) / 8) + 70;

    let batteryVoltage          = (event.target.value.getUint8(8) );

    let deviceCommand       = (event.target.value.getUint8(9) );

    let accelerometerX      = (event.target.value.getUint8(10) / 100) - 1;
    let accelerometerY      = (event.target.value.getUint8(11) / 100) - 1;
    let accelerometerZ      = (event.target.value.getUint8(12) / 100) - 1;

    let objectTemp1norm        = (event.target.value.getUint8(13) / 255 );
    let objectTemp2norm        = (event.target.value.getUint8(14) / 255 );
    let objectTemp3norm        = (event.target.value.getUint8(15) / 255 );
    let objectTemp4norm        = (event.target.value.getUint8(16) / 255 );

    let deviceNN5           = (event.target.value.getUint8(17) / 255 );
    let deviceNN7           = (event.target.value.getUint8(18) / 255 );

    console.log(accelerometerRoll + " " + accelerometerPitch + " " + proximity + " " + objectTemp1 + " " + objectTemp2 + " " + objectTemp3 + " " + objectTemp4 + " " + objectTemp1norm + " " + objectTemp2norm + " " + objectTemp3norm + " " + objectTemp4norm + " " + ambientAverage + " " + batteryVoltage);
    console.log("DEVICE NN5: " + deviceNN5 + " DEVICE NN7: " + deviceNN7);


        var data = {
            accelerometer: {
                pitch: accelerometerPitch,
                roll: accelerometerRoll,
                x: accelerometerX,
                y: accelerometerY,
                z: accelerometerZ
            },
            objectTemp: {
                a: objectTemp1,
                b: objectTemp2,
                c: objectTemp3,
                d: objectTemp4,
                e: objectTemp1norm,
                f: objectTemp2norm,
                g: objectTemp3norm,
                h: objectTemp4norm
            },
            ambientTemp: {
                a: ambientAverage
            },
            proximityData: {
                a: proximity
            },
            batteryData: {
                a: batteryVoltage
            },
            detectionData: {
                a: deviceNN5,
                b: deviceNN7
            }
        }

        state = {
            orientation: data.orientation,
            accelerometer: data.accelerometer,
            objectTemp: data.objectTemp,
            ambientTemp: data.ambientTemp,
            proximityData: data.proximityData,
            battery: data.batteryData,
            deviceDetect: data.detectionData
        }

        //move this out of state change 
        if (sendCommandFlag) {
            //this.standardServer = server;
            for (var i = 0; i < 3; i++) {
                //  sendControlService();
                _this.sendControlService([services.controlService, ], [characteristics.commandReadCharacteristic, characteristics.commandWriteCharacteristic, characteristics.deviceDataCharacteristic], _this.standardServer);
            }
            sendCommandFlag = false;
        }

        _this.onStateChangeCallback(state);
    }

    onStateChangeCallback() {}

    getdeviceData(service, characteristic, server) {
        return server.getPrimaryService(service.uuid)
            .then(newService => {
                console.log('getting characteristic: ', characteristic.name);
                return newService.getCharacteristic(characteristic.uuid)
            })
            .then(char => {
                char.startNotifications().then(res => {
                    char.addEventListener('characteristicvaluechanged', _this.handleDeviceDataChanged);
                })
            })
    }

    onStateChange(callback) {
        _this.onStateChangeCallback = callback;
    }
}

/*******************************************************************************************************************
 *********************************************** INITIALIZE *********************************************************
 ********************************************************************************************************************/

//sensor array sample data
var sensorDataArray = new Array(18).fill(0);

var masterDataArray = new Array(42);

for (var i = 0; i < masterDataArray.length; i++) {
  masterDataArray[i] = new Array;
}

var batteryVoltage;

var selectedTargetNum = 0;                   //starting target number index
var selectedTargetName = "sh-r-eyes-select"; //starting target ID

//sensor array sample data FOR CUSTOM TRAINING
var NN1TrueDataArray = new Array;
var NN1FalseDataArray = new Array;
var NN2TrueDataArray = new Array;
var NN2FalseDataArray = new Array;

var NN1Architecture = 'none';
var NN2Architecture = 'none';

var NN1NumInputs = 5;
var NN2NumInputs = 7;

//master session data array of arrays
var sensorDataSession = [];

//which samples in the session data array are part of a particular sample set
var sessionSampleSetIndex = [];

var getSamplesFlag = 0;
var getSamplesTypeFlag = 0; //0=none 1=NN1T 2=NN1F 3=NN2T 4=NN2F

//do we have a trained NN to apply to live sensor data?
var haveNNFlag1 = false;
var trainNNFlag1 = false;
var activeNNFlag1 = false;

var haveNNFlag2 = false;
var trainNNFlag2 = false;
var activeNNFlag2 = false;

//stored MM models
var loadNNFlag = false;
var loadNNTargetSelect;
var loadNNData5 = new Array(500).fill(0);
var loadNNData7 = new Array(575).fill(0);

//NN scores
var scoreArray = new Array(1).fill(0);
var scoreArraySmooth = new Array(2);
scoreArraySmooth[0] = 0.5;
scoreArraySmooth[1] = 0.5;

var pastDataNN1 = new Array(5).fill(0.5);
var pastDataNN2 = new Array(5).fill(0.5);

var initialised = false;
var timeout = null;

$(document).ready(function() {

    /*******************************************************************************************************************
     *********************************************** WEB BLUETOOTH ******************************************************
     ********************************************************************************************************************/

    //Web Bluetooth connection button and ongoing device data update function
    button.onclick = function(e) {
        var sensorController = new ControllerWebBluetooth("Tingle");
        sensorController.connect();

        //ON SENSOR DATA UPDATE
        sensorController.onStateChange(function(state) {
            bluetoothDataFlag = true;
        });

        //check for new data every X milliseconds - this is to decouple execution from Web Bluetooth actions
        setInterval(function() {
            //     bluetoothDataFlag = getBluetoothDataFlag();

            if (bluetoothDataFlag == true) {

                //      state = getState();
                /*    objectTempData = state.objectTemp;
                    proximityData = state.proximityData;
                    accelerometerData = state.accelerometer;
                    ambientTempData = state.ambientTemp;
                    heartRateData = state.heartRate; */
                timeStamp = new Date().getTime();

                //load data into global array
                sensorDataArray = new Array(18).fill(0);

                sensorDataArray[0] = state.objectTemp.a.toFixed(1);
                sensorDataArray[1] = state.objectTemp.b.toFixed(1);
                sensorDataArray[2] = state.objectTemp.c.toFixed(1);
                sensorDataArray[3] = state.objectTemp.d.toFixed(1);

                sensorDataArray[4] = state.proximityData.a.toFixed(1);

                sensorDataArray[5] = state.accelerometer.pitch.toFixed(1);
                sensorDataArray[6] = state.accelerometer.roll.toFixed(1);
                sensorDataArray[7] = state.accelerometer.x.toFixed(2);
                sensorDataArray[8] = state.accelerometer.y.toFixed(2);
                sensorDataArray[9] = state.accelerometer.z.toFixed(2);

                sensorDataArray[10] = state.ambientTemp.a.toFixed(2);

                sensorDataArray[11] = state.objectTemp.e.toFixed(4);
                sensorDataArray[12] = state.objectTemp.f.toFixed(4);
                sensorDataArray[13] = state.objectTemp.g.toFixed(4);
                sensorDataArray[14] = state.objectTemp.h.toFixed(4);

                sensorDataArray[15] = timeStamp;

                batteryVoltage = state.battery.a.toFixed(2);

                //update time series chart
                var rawThermo1Chart = ((sensorDataArray[0] - 76) / 24);
                var rawThermo2Chart = ((sensorDataArray[1] - 76) / 24);
                var rawThermo3Chart = ((sensorDataArray[2] - 76) / 24);
                var rawThermo4Chart = ((sensorDataArray[3] - 76) / 24);
                var rawPitchChart = (sensorDataArray[5] / 400);
                var rawRollChart = (sensorDataArray[6] / 400);
                var rawProximityChart = (sensorDataArray[4] / 270);

                //sensor values in bottom 2/3 of chart , 1/10 height each
                rawThermo1Chart = (rawThermo1Chart / 4.5) + 5.5 * 0.1;
                rawThermo2Chart = (rawThermo2Chart / 4.5) + 5 * 0.1;
                rawThermo3Chart = (rawThermo3Chart / 4.5) + 4.5 * 0.1;
                rawThermo4Chart = (rawThermo4Chart / 4.5) + 4 * 0.1;
                rawPitchChart = (rawPitchChart / 7) + 3 * 0.1;
                rawRollChart = (rawRollChart / 7) + 2 * 0.1;
                rawProximityChart = (rawProximityChart / 10) + 1 * 0.1;

                lineThermo1.append(timeStamp, rawThermo1Chart);
                lineThermo2.append(timeStamp, rawThermo2Chart);
                lineThermo3.append(timeStamp, rawThermo3Chart);
                lineThermo4.append(timeStamp, rawThermo4Chart);
                linePitch.append(timeStamp, rawPitchChart);
                lineRoll.append(timeStamp, rawRollChart);
                lineProximity.append(timeStamp, rawProximityChart);


                //if data sample collection has been flagged
                //  getSensorData();
                if (getSamplesFlag > 0) {
                    collectData();
                } else if (trainNNFlag1 || trainNNFlag2) {
                    //don't do anything
                } else {
                    if (haveNNFlag1 && activeNNFlag1) { //we have a NN and we want to apply to current sensor data
                        getNNScore(1);
                    } else if( loadNNFlag ){ //run loaded model
                        getNNScore(1);
                    }
                    if (haveNNFlag2 && activeNNFlag2) { //we have a NN and we want to apply to current sensor data
                        getNNScore(2);
                    } else if( loadNNFlag ){ //run loaded model
                        getNNScore(2);
                    } 
                }

                displayData();

                bluetoothDataFlag = false;
            }

        }, 200); // throttle 100 = 10Hz limit
    }


    /*******************************************************************************************************************
    **************************************** STREAMING SENSOR DATA CHART ***********************************************
    *******************************************************************************************************************/

    //add smoothie.js time series streaming data chart
    var chartHeight = 100;
    var chartWidth = $(window).width();

    $("#streaming-data-chart").html('<canvas id="chart-canvas" width="' + chartWidth + '" height="' + chartHeight + '"></canvas>');

    var streamingChart = new SmoothieChart({/*  grid: { strokeStyle:'rgb(125, 0, 0)', fillStyle:'rgb(60, 0, 0)', lineWidth: 1, millisPerLine: 250, verticalSections: 6, }, labels: { fillStyle:'rgb(60, 0, 0)' } */ });

streamingChart.streamTo(document.getElementById("chart-canvas"), 350 /*delay*/ );
    var lineThermo1 = new TimeSeries();
    var lineThermo2 = new TimeSeries();
    var lineThermo3 = new TimeSeries();
    var lineThermo4 = new TimeSeries();
    var linePitch = new TimeSeries();
    var lineRoll = new TimeSeries();
    var lineProximity = new TimeSeries();
    var lineNN1 = new TimeSeries();
    var lineNN2 = new TimeSeries();
    var lineNN1Smooth = new TimeSeries();
    var lineNN2Smooth = new TimeSeries();
    var lineNN1Var = new TimeSeries();
    var lineNN2Var = new TimeSeries();
    var lineNNAv = new TimeSeries();
    streamingChart.addTimeSeries(lineThermo1, {
        strokeStyle: 'rgb(133, 87, 35)',
        lineWidth: 3
    });
    streamingChart.addTimeSeries(lineThermo2, {
        strokeStyle: 'rgb(185, 156, 107)',
        lineWidth: 3
    });
    streamingChart.addTimeSeries(lineThermo3, {
        strokeStyle: 'rgb(143, 59, 27)',
        lineWidth: 3
    });
    streamingChart.addTimeSeries(lineThermo4, {
        strokeStyle: 'rgb(213, 117, 0)',
        lineWidth: 3
    });
    streamingChart.addTimeSeries(linePitch, {
        strokeStyle: 'rgb(128, 128, 128)',
        lineWidth: 3
    });
    streamingChart.addTimeSeries(lineRoll, {
        strokeStyle: 'rgb(240, 240, 240)',
        lineWidth: 3
    });
    streamingChart.addTimeSeries(lineProximity, {
        strokeStyle: 'rgb(128, 128, 255)',
        lineWidth: 3
    });
    streamingChart.addTimeSeries(lineNN1, {
        strokeStyle: 'rgb(72, 244, 68)',
        lineWidth: 4
    });
    streamingChart.addTimeSeries(lineNN2, {
        strokeStyle: 'rgb(244, 66, 66)',
        lineWidth: 4
    });
    streamingChart.addTimeSeries(lineNN1Smooth, {
        strokeStyle: 'rgb(58, 230, 54)',
        lineWidth: 3
    });
    streamingChart.addTimeSeries(lineNN2Smooth, {
        strokeStyle: 'rgb(230, 52, 52)',
        lineWidth: 3
    });
    streamingChart.addTimeSeries(lineNN1Var, {
        strokeStyle: 'rgb(38, 210, 32)',
        lineWidth: 3
    });
    streamingChart.addTimeSeries(lineNN2Var, {
        strokeStyle: 'rgb(210, 30, 30)',
        lineWidth: 3
    });
    streamingChart.addTimeSeries(lineNNAv, {
        strokeStyle: 'rgb(255, 0, 255)',
        lineWidth: 4
    });

    //min/max streaming chart button
    $('#circleDrop').click(function() {

        $('.card-middle').slideToggle();
        $('.close').toggleClass('closeRotate');

        var chartHeight = $(window).height() / 1.2;
        var chartWidth = $(window).width();

        if ($("#chart-size-button").hasClass('closeRotate')) {
            $("#streaming-data-chart").html('<canvas id="chart-canvas" width="' + chartWidth + '" height="' + chartHeight + '"></canvas>');
        } else {
            $("#streaming-data-chart").html('<canvas id="chart-canvas" width="' + chartWidth + '" height="' + 100 + '"></canvas>');
        }

        //hide controls
        $("#basic-interface-container, #hand-head-ui-container, #nn-slide-controls, .console, #interface-controls, #dump-print, #record-controls").toggleClass("hide-for-chart");
        //redraw chart
        streamingChart.streamTo(document.getElementById("chart-canvas"), 350 /*delay*/ );
    });

    function displayData() {

        var objectTempElement1 = document.getElementsByClassName('object-temp-1-data')[0];
        objectTempElement1.innerHTML = sensorDataArray[0];

        var objectTempElement2 = document.getElementsByClassName('object-temp-2-data')[0];
        objectTempElement2.innerHTML = sensorDataArray[1];

        var objectTempElement3 = document.getElementsByClassName('object-temp-3-data')[0];
        objectTempElement3.innerHTML = sensorDataArray[2];

        var objectTempElement4 = document.getElementsByClassName('object-temp-4-data')[0];
        objectTempElement4.innerHTML = sensorDataArray[3];

        var proximityElement = document.getElementsByClassName('proximity-data')[0];
        proximityElement.innerHTML = sensorDataArray[4];

        var accelerometerPitchDiv = document.getElementsByClassName('accelerometer-pitch-data')[0];
        accelerometerPitchDiv.innerHTML = sensorDataArray[5];

        var accelerometerRollDiv = document.getElementsByClassName('accelerometer-roll-data')[0];
        accelerometerRollDiv.innerHTML = sensorDataArray[6];

        var accelerometerXElement = document.getElementsByClassName('accelerometer-x-data')[0];
        accelerometerXElement.innerHTML = sensorDataArray[7];

        var accelerometerYElement = document.getElementsByClassName('accelerometer-y-data')[0];
        accelerometerYElement.innerHTML = sensorDataArray[8];

        var accelerometerZElement = document.getElementsByClassName('accelerometer-z-data')[0];
        accelerometerZElement.innerHTML = sensorDataArray[9];

        var ambientTempAverageElement = document.getElementsByClassName('ambient-temp-average-data')[0];
        ambientTempAverageElement.innerHTML = sensorDataArray[10];

        var batteryDataElement = document.getElementsByClassName('battery-data')[0];
        batteryDataElement.innerHTML = batteryVoltage;

    }

    function updateSampleCountDisplay() {
        $('.message-nn1-true').html(NN1TrueDataArray.length);
        $('.message-nn1-false').html(NN1FalseDataArray.length);
        $('.message-nn2-true').html(NN2TrueDataArray.length);
        $('.message-nn2-false').html(NN2FalseDataArray.length);
    }




    /**********************************************************************************************************
    ********************************** COLLECT SENSOR DATA  ***************************************************
    **********************************************************************************************************/

    function collectData() {
        var collectedDataArray = new Array(18).fill(0); //12 device 
        collectedDataArray = sensorDataArray;

        console.log("web bluetooth sensor data:");
        console.dir(collectedDataArray);

        //add sample to set
        sensorDataSession.push(collectedDataArray);

        //add to master
        masterDataArray[selectedTargetNum].push(sensorDataArray);
        $( "span[data='" + selectedTargetNum + "']" ).html(masterDataArray[selectedTargetNum].length);

        if (getSamplesTypeFlag == 1) {

            //add to master
         //   masterDataArray[selectedTargetNum].push(collectedDataArray);
         //   $( "span[data='" + selectedTargetNum + "']" ).html(masterDataArray[selectedTargetNum].length);

            NN1TrueDataArray.push(collectedDataArray);
            $('.message-nn1-true').html(NN1TrueDataArray.length);
        } else if (getSamplesTypeFlag == 2) {
            NN1FalseDataArray.push(collectedDataArray);
            $('.message-nn1-false').html(NN1FalseDataArray.length);
        } else if (getSamplesTypeFlag == 3) {
            NN2TrueDataArray.push(collectedDataArray);
            $('.message-nn2-true').html(NN2TrueDataArray.length);
        } else if (getSamplesTypeFlag == 4) {
            NN2FalseDataArray.push(collectedDataArray);
            $('.message-nn2-false').html(NN2FalseDataArray.length);
        }

        console.log("Set Index: ");
        console.dir(sessionSampleSetIndex);

        //countdown for data collection
        getSamplesFlag = getSamplesFlag - 1;
    }


    /*******************************************************************************************************************
     *********************************************** NEURAL NETWORKS ****************************************************
     ********************************************************************************************************************/
    /**
     * Attach synaptic neural net components to app object
     */
    var nnRate =        $("#rate-input").val();
    var nnIterations =  $("#iterations-input").val();
    var nnError =       $("#error-input").val();

    // ************** NEURAL NET #1
    var Neuron = synaptic.Neuron;
    var Layer = synaptic.Layer;
    var Network = synaptic.Network;
    var Trainer = synaptic.Trainer;
    var Architect = synaptic.Architect;
    var neuralNet = new Architect.LSTM(5, 5, 2, 1);
    var trainer = new Trainer(neuralNet);
    var trainingData;

    // ************* NEURAL NET #2
    var Neuron2 = synaptic.Neuron;
    var Layer2 = synaptic.Layer;
    var Network2 = synaptic.Network;
    var Trainer2 = synaptic.Trainer;
    var Architect2 = synaptic.Architect;
    var neuralNet2 = new Architect2.LSTM(7, 5, 2, 1);
    var trainer2 = new Trainer2(neuralNet2);
    var trainingData2;



    /**********************************************************************************************************
    ********************************** GET NEURAL NETWORK MODEL SCORE *****************************************
    **********************************************************************************************************/

    function getNNScore(selectNN) {

        var scoreArray = new Array(1).fill(0);
        var timeStamp = new Date().getTime();
        var displayScore;

        if (selectNN == 1) {
            var feedArray = new Array(5).fill(0);
            if(preProcess == 1){
	            feedArray[0] = sensorDataArray[0] / 101;
	            feedArray[1] = sensorDataArray[1] / 101;
	            feedArray[2] = sensorDataArray[2] / 101;
	            feedArray[3] = sensorDataArray[3] / 101; 

	        } else if(preProcess == 2) {
                feedArray[0] = (sensorDataArray[0] - 69) / (101 - 69);
                feedArray[1] = (sensorDataArray[1] - 69) / (101 - 69);
                feedArray[2] = (sensorDataArray[2] - 69) / (101 - 69);
                feedArray[3] = (sensorDataArray[3] - 69) / (101 - 69);

            } else if(preProcess == 3) {
	            feedArray[0] = sensorDataArray[11];
	            feedArray[1] = sensorDataArray[12];
	            feedArray[2] = sensorDataArray[13];
	            feedArray[3] = sensorDataArray[14]; 

	        } else if(preProcess == 4) {
	        	var thermSampAv = ( (parseFloat(sensorDataArray[0]) - 69) + (parseFloat(sensorDataArray[1]) - 69) + (parseFloat(sensorDataArray[2]) - 69) + (parseFloat(sensorDataArray[3]) - 69)) / 4;
	        	feedArray[0] = (sensorDataArray[0] - 69) / thermSampAv - 0.5;
	            feedArray[1] = (sensorDataArray[1] - 69) / thermSampAv - 0.5;
	            feedArray[2] = (sensorDataArray[2] - 69) / thermSampAv - 0.5;
	            feedArray[3] = (sensorDataArray[3] - 69) / thermSampAv - 0.5; 
	        } else if(preProcess == 5) {
                var thermSampMin = Math.min( parseFloat(sensorDataArray[0]), Math.min( parseFloat(sensorDataArray[1]), Math.min( parseFloat(sensorDataArray[2]), parseFloat(sensorDataArray[3]) ) ) );
                feedArray[0] = (sensorDataArray[0] - 69) / (thermSampMin - 69);
                feedArray[1] = (sensorDataArray[1] - 69) / (thermSampMin - 69);
                feedArray[2] = (sensorDataArray[2] - 69) / (thermSampMin - 69);
                feedArray[3] = (sensorDataArray[3] - 69) / (thermSampMin - 69);
            }
            feedArray[4] = sensorDataArray[4] / 250;

            // use trained NN or loaded NN
            if (haveNNFlag1 && activeNNFlag1) {
                scoreArray = neuralNet.activate(feedArray); //RUN TRAINED NN MODEL
            } else if (loadNNFlag) {
                scoreArray = runStoredModel5(feedArray);    //RUN STORED NN MODEL
            }
            console.log("NN1 FEED ARRAY: " + feedArray);
            console.log("NN1 SCORE ARRAY: " + scoreArray);

            displayScore = scoreArray[0].toFixed(4) * 100;
            displayScore = displayScore.toFixed(2);
            $(".message-nn1-score").html(displayScore + '%');
            var rawLineNN1Chart = scoreArray[0].toFixed(4);
            rawLineNN1Chart = (rawLineNN1Chart / 2) + 0.7;
            lineNN1.append(timeStamp, rawLineNN1Chart);

            //RUNNING AVERAGE
            scoreArraySmooth[0] = (parseFloat(scoreArraySmooth[0]) + parseFloat(scoreArray[0]) ) / 2;
            var rawLineNN1ChartSmooth = scoreArraySmooth[0].toFixed(4);
            rawLineNN1ChartSmooth = (rawLineNN1ChartSmooth / 2) + 0.7;
            lineNN1Smooth.append(timeStamp, rawLineNN1ChartSmooth);
            console.log("rawLineNN1ChartSmooth: " + rawLineNN1ChartSmooth);

            //VARIANCE
            //update historical data and calcualte average
            var NN1Av = 0;
            for(var j = 0; j < 4; j++){ 
            	pastDataNN1[j] = pastDataNN1[j + 1]; 
            	NN1Av = NN1Av + pastDataNN1[j + 1];
            }
            pastDataNN1[4] = parseFloat(scoreArray[0]);
            NN1Av = (NN1Av + pastDataNN1[4]) / 5;
            //calculate variance
            var NN1Var = 0;
	        for(var k = 0; k < 5; k++){ 
	        	NN1Var = NN1Var + Math.abs(NN1Av - pastDataNN1[k]);
	        }
	        NN1Var = NN1Var / 5;
	        lineNN1Var.append(timeStamp, NN1Var);
	        console.log("NN1 Variance: " + (NN1Var * 100));

        } else if (selectNN == 2) {

            var feedArray = new Array(7).fill(0);

            if(preProcess == 1){
	            feedArray[0] = sensorDataArray[0] / 101;
	            feedArray[1] = sensorDataArray[1] / 101;
	            feedArray[2] = sensorDataArray[2] / 101;
	            feedArray[3] = sensorDataArray[3] / 101; 

	        } else if(preProcess == 2) {
                feedArray[0] = (sensorDataArray[0] - 69) / (101 - 69);
                feedArray[1] = (sensorDataArray[1] - 69) / (101 - 69);
                feedArray[2] = (sensorDataArray[2] - 69) / (101 - 69);
                feedArray[3] = (sensorDataArray[3] - 69) / (101 - 69);

            } else if(preProcess == 3) {
	            feedArray[0] = sensorDataArray[11];
	            feedArray[1] = sensorDataArray[12];
	            feedArray[2] = sensorDataArray[13];
	            feedArray[3] = sensorDataArray[14]; 

	        } else if(preProcess == 4) {
	        	var thermSampAv = ( (parseFloat(sensorDataArray[0]) - 69) + (parseFloat(sensorDataArray[1]) - 69) + (parseFloat(sensorDataArray[2]) - 69) + (parseFloat(sensorDataArray[3]) - 69)) / 4;
	        	feedArray[0] = (sensorDataArray[0] - 69) / thermSampAv - 0.5;
	            feedArray[1] = (sensorDataArray[1] - 69) / thermSampAv - 0.5;
	            feedArray[2] = (sensorDataArray[2] - 69) / thermSampAv - 0.5;
	            feedArray[3] = (sensorDataArray[3] - 69) / thermSampAv - 0.5; 
	        } else if(preProcess == 5) {
                var thermSampMin = Math.min( parseFloat(sensorDataArray[0]), Math.min( parseFloat(sensorDataArray[1]), Math.min( parseFloat(sensorDataArray[2]), parseFloat(sensorDataArray[3]) ) ) );
                feedArray[0] = (sensorDataArray[0] - 69) / (thermSampMin - 69);
                feedArray[1] = (sensorDataArray[1] - 69) / (thermSampMin - 69);
                feedArray[2] = (sensorDataArray[2] - 69) / (thermSampMin - 69);
                feedArray[3] = (sensorDataArray[3] - 69) / (thermSampMin - 69);
            }
            feedArray[4] = sensorDataArray[4] / 250;
            feedArray[5] = sensorDataArray[5] / 360;
            feedArray[6] = sensorDataArray[6] / 360;


            if (haveNNFlag2 && activeNNFlag2) {
                scoreArray = neuralNet2.activate(feedArray);    //RUN TRAINED NN MODEL
            } else if (loadNNFlag) {
                scoreArray = runStoredModel7(feedArray);        //RUN STORED NN MODEL
            }

            console.log("NN2 FEED ARRAY: " + feedArray);
            console.log("NN2 SCORE ARRAY: " + scoreArray);



            displayScore = scoreArray[0].toFixed(4) * 100;
            displayScore = displayScore.toFixed(2);
            $(".message-nn2-score").html(displayScore + '%');
            var rawLineNN2Chart = scoreArray[0].toFixed(4);
            rawLineNN2Chart = (rawLineNN2Chart / 2) + 0.7;
            lineNN2.append(timeStamp, rawLineNN2Chart);

            //RUNNING AVERAGE
            scoreArraySmooth[1] = ( parseFloat(scoreArraySmooth[1]) + parseFloat(scoreArraySmooth[1]) + parseFloat(scoreArray[0]) ) / 3;
            var rawLineNN2ChartSmooth = scoreArraySmooth[1].toFixed(4);
            rawLineNN2ChartSmooth = (rawLineNN2ChartSmooth / 2) + 0.7;
            lineNN2Smooth.append(timeStamp, rawLineNN2ChartSmooth);
            console.log("rawLineNN2ChartSmooth: " + rawLineNN2ChartSmooth);

            //VARIANCE
            //update historical data and calcualte average
            var NN2Av = 0;
            for(var j = 0; j < 4; j++){ 
            	pastDataNN2[j] = pastDataNN2[j + 1]; 
            	NN2Av = NN2Av + pastDataNN2[j + 1];
            }
            pastDataNN2[4] = parseFloat(scoreArray[0]);
            NN2Av = (NN2Av + pastDataNN2[4]) / 5;
            //calculate variance
            var NN2Var = 0;
	        for(var k = 0; k < 5; k++){ 
	        	NN2Var = NN2Var + Math.abs(NN2Av - pastDataNN2[k]);
	        }
	        NN2Var = NN2Var / 5;
	        lineNN2Var.append(timeStamp, NN2Var);
	        console.log("NN2 Variance: " + (NN2Var * 100));

	        //PLOT AVERAGE OF NN1 and NN2
	        var rawLineNNAv = ( parseFloat(scoreArraySmooth[0]) + parseFloat(scoreArraySmooth[1]) ) / 2;
	        rawLineNNAv = (rawLineNNAv / 2) + 0.7;
	        lineNNAv.append(timeStamp, rawLineNNAv);
	    }

    }




    /**********************************************************************************************************
    ********************************** TRAIN NEURAL NETWORK MODEL *********************************************
    **********************************************************************************************************/
    function trainNN(selectNN) {
        //'5:2:1', '5:5:1', '5:5:2:1', '5:5:5:1', '7:2:1', '7:7:1', '7:7:2:1', '7:7:7:1'
        //  var processedDataSession = sensorDataSession;
        var processedDataSession = new Array;
        var falseDataArray = new Array;
        var trueDataArray = new Array;

        trainingData = new Array;
        trainingData2 = new Array;

        nnRate = $("#rate-input").val();
        nnIterations = $("#iterations-input").val();
        nnError = $("#error-input").val();

    /*    if (selectNN == 1) {
            trueDataArray = NN1TrueDataArray;
            falseDataArray = NN1FalseDataArray;
        } else if (selectNN == 2) {
            trueDataArray = NN2TrueDataArray;
            falseDataArray = NN2FalseDataArray;
        }   */

        /* cycle the position text field inputs */
        console.log("***FINDING DATA TO TRAIN AGAINST***");
        $( ".target-select-text" ).each(function() {
            var positionSelectedSampleTotal = parseInt( $( this ).val() );
            var falseSelectElementID = $(this).attr("id"); 

            console.log(falseSelectElementID + " : " + positionSelectedSampleTotal);


            if(positionSelectedSampleTotal > 0){
                var falseSelectElementIndex = parseInt( $(this).attr("num") );
           //     var falseSelectElementID = parseInt( $(this).attr("id") );
                var falseSelectLength = masterDataArray[falseSelectElementIndex].length;

                console.log("** " + positionSelectedSampleTotal + " SAMPLES FROM " + falseSelectElementID);
                console.log("false select length: " + falseSelectLength);

                //asking for more data than exists
                if(positionSelectedSampleTotal >= falseSelectLength){
                    for(var j = 0; j < falseSelectLength; j++){
                        falseDataArray.push(masterDataArray[falseSelectElementIndex][j]);

                    }
                } else {
                /*	var j=0;
                    while(j < positionSelectedSampleTotal){
                    	var oneQuartPlace = Math.round( (falseSelectLength / 4) * 1) + j - 1;  //get data from different places
                        var midPlace = Math.round( (falseSelectLength / 4) * 2) + j - 1;
                        var threeQuartPlace = Math.round( (falseSelectLength / 4) * 3) + j - 1;
                        console.log("quarter place:" + oneQuartPlace + " half place:" + midPlace + " three quarter place:" + threeQuartPlace);

                        if(j < positionSelectedSampleTotal){ falseDataArray.push(masterDataArray[falseSelectElementIndex][j]); j++;
                        
		                    if(j < positionSelectedSampleTotal && oneQuartPlace < falseSelectLength){ falseDataArray.push(masterDataArray[falseSelectElementIndex][oneQuartPlace]); j++; 
		                        
		                    	if(j < positionSelectedSampleTotal && midPlace < falseSelectLength){ falseDataArray.push(masterDataArray[falseSelectElementIndex][midPlace]); j++; 

		                    		if(j < positionSelectedSampleTotal && threeQuartPlace < falseSelectLength){ falseDataArray.push(masterDataArray[falseSelectElementIndex][threeQuartPlace]); j++; }
		                    	}
		                    }
		                }
                    } */
                    var trackRandom = new Array(2000).fill(0);
                    var countFalseSamples = 0;
                    while(countFalseSamples < positionSelectedSampleTotal){
                        //random sample in target position array of samples
                        var randomSampleIndex = Math.floor(Math.random() * falseSelectLength) + 1;

                        //make sure we haven't used this data point yet
                        if(trackRandom[(randomSampleIndex - 1)] == 0){
                            falseDataArray.push(masterDataArray[falseSelectElementIndex][(randomSampleIndex - 1)]);

                            //done with that sample, make note in tracking array
                            trackRandom[(randomSampleIndex - 1)] = 1;
                            countFalseSamples++;
                        }
                    }
                }

            }
        });

        console.log("TRAINING AGAINST " + falseDataArray.length + " SAMPLES");
        console.log("FALSE DATA: " + falseDataArray);

        //true data is currently selected target
        trueDataArray = masterDataArray[selectedTargetNum];

                //ADD DUPLICATE TRUE DATA IF MORE FALSE DATA THAN TRUE DATA
        var trueDataCounter = 0;
        while(falseDataArray.length >  trueDataArray.length){
            trueDataArray.push(masterDataArray[selectedTargetNum][trueDataCounter]);

            trueDataCounter++;

            if(trueDataCounter > (masterDataArray[selectedTargetNum].length - 1)) trueDataCounter = 0;
        }

        console.log("TRAINING FOR " + trueDataArray.length + "TARGET SAMPLES");

        //combine true and false data
        var addSample = new Array(18).fill(0);

        for (var j = 0; j < trueDataArray.length; j++) {
            addSample = trueDataArray[j];
            addSample[17] = 1; //true
            processedDataSession.push(addSample);
        }
        for (var k = 0; k < falseDataArray.length; k++) {
            addSample = falseDataArray[k];
            addSample[17] = 0; //false
            processedDataSession.push(addSample);
        }



            neuralNet = new Architect.LSTM(5, 5, 2, 1);
            trainer = new Trainer(neuralNet);

            neuralNet2 = new Architect.LSTM(7, 5, 2, 1);
            trainer2 = new Trainer2(neuralNet2);



        for (var i = 0; i < processedDataSession.length; i++) {

            var currentSample = processedDataSession[i];
            var outputArray = new Array(1).fill(0);

            outputArray[0] = currentSample[17]; //true or false

            var inputArray = new Array(5).fill(0);

	        if(preProcess == 1){
	            inputArray[0] = currentSample[0] / 101;
	            inputArray[1] = currentSample[1] / 101;
	            inputArray[2] = currentSample[2] / 101;
	            inputArray[3] = currentSample[3] / 101; 

	        } else if(preProcess == 2) {
                inputArray[0] = (currentSample[0] - 69) / (101 - 69);
                inputArray[1] = (currentSample[1] - 69) / (101 - 69);
                inputArray[2] = (currentSample[2] - 69) / (101 - 69);
                inputArray[3] = (currentSample[3] - 69) / (101 - 69);
            } else if(preProcess == 3) {
	            inputArray[0] = currentSample[11];
	            inputArray[1] = currentSample[12];
	            inputArray[2] = currentSample[13];
	            inputArray[3] = currentSample[14]; 

	        } else if(preProcess == 4) {
	        	var thermSampAv = ( (parseFloat(currentSample[0]) - 69) + (parseFloat(currentSample[1]) - 69)  + (parseFloat(currentSample[2]) - 69)  + (parseFloat(currentSample[3]) - 69) ) / 4;
	        	console.log("average for norm: " + thermSampAv);
	        	inputArray[0] = ( (currentSample[0] - 69) / thermSampAv) - 0.5;
	            inputArray[1] = ( (currentSample[1] - 69) / thermSampAv) - 0.5;
	            inputArray[2] = ( (currentSample[2] - 69) / thermSampAv) - 0.5;
	            inputArray[3] = ( (currentSample[3] - 69) / thermSampAv) - 0.5; 
	        } else if(preProcess == 5) {
                var thermSampMin = Math.min( parseFloat(currentSample[0]), Math.min( parseFloat(currentSample[1]), Math.min( parseFloat(currentSample[2]), parseFloat(currentSample[3]) ) ) );
                inputArray[0] = (currentSample[0] - 69) / (thermSampMin - 69);
                inputArray[1] = (currentSample[1] - 69) / (thermSampMin - 69);
                inputArray[2] = (currentSample[2] - 69) / (thermSampMin - 69);
                inputArray[3] = (currentSample[3] - 69) / (thermSampMin - 69);
            }
            inputArray[4] = currentSample[4] / 250;

            var inputArray2 = new Array(7).fill(0);

	        if(preProcess == 1){
	            inputArray2[0] = currentSample[0] / 101;
	            inputArray2[1] = currentSample[1] / 101;
	            inputArray2[2] = currentSample[2] / 101;
	            inputArray2[3] = currentSample[3] / 101; 

	        } else if(preProcess == 2) {
                inputArray2[0] = (currentSample[0] - 69) / (101 - 69);
                inputArray2[1] = (currentSample[1] - 69) / (101 - 69);
                inputArray2[2] = (currentSample[2] - 69) / (101 - 69);
                inputArray2[3] = (currentSample[3] - 69) / (101 - 69);

            } else if(preProcess == 3) {
	            inputArray2[0] = currentSample[11];
	            inputArray2[1] = currentSample[12];
	            inputArray2[2] = currentSample[13];
	            inputArray2[3] = currentSample[14]; 

	        } else if(preProcess == 4) {
	        	var thermSampAv = ( (parseFloat(currentSample[0]) - 69) + (parseFloat(currentSample[1]) - 69) + (parseFloat(currentSample[2]) - 69) + (parseFloat(currentSample[3]) - 69)) / 4;
	        	inputArray2[0] = ( (currentSample[0] - 69) / thermSampAv) - 0.5;
	            inputArray2[1] = ( (currentSample[1] - 69) / thermSampAv) - 0.5;
	            inputArray2[2] = ( (currentSample[2] - 69) / thermSampAv) - 0.5;
	            inputArray2[3] = ( (currentSample[3] - 69) / thermSampAv) - 0.5; 
	        } else if(preProcess == 5) {
                var thermSampMin = Math.min( parseFloat(currentSample[0]), Math.min( parseFloat(currentSample[1]), Math.min( parseFloat(currentSample[2]), parseFloat(currentSample[3]) ) ) );
                inputArray2[0] = (currentSample[0] - 69) / (thermSampMin - 69);
                inputArray2[1] = (currentSample[1] - 69) / (thermSampMin - 69);
                inputArray2[2] = (currentSample[2] - 69) / (thermSampMin - 69);
                inputArray2[3] = (currentSample[3] - 69) / (thermSampMin - 69);
            }
            inputArray2[4] = currentSample[4] / 250;
            inputArray2[5] = currentSample[5] / 360;
            inputArray2[6] = currentSample[6] / 360;

            trainingData.push({
                input: inputArray,
                output: outputArray
            });

            trainingData2.push({
                input: inputArray2,
                output: outputArray
            });

            console.log(currentSample + " TRAINING INPUT: " + inputArray + "  --> NN# " + selectNN);
            console.log(currentSample + " TRAINING OUTPUT: " + outputArray + "  --> NN# " + selectNN);
        }



            console.log("TRAINING ON selectNN1 --> interations:" + nnIterations + "  error:" + nnError + "  rate:" + nnRate);

            trainer.train(trainingData, {
                rate: nnRate,
                iterations: nnIterations,
                error: nnError,
                shuffle: true,
                log: 5,
                cost: Trainer.cost.CROSS_ENTROPY
            });

            //we have a trained NN to use
            haveNNFlag1 = true;
            trainNNFlag1 = false;
            $('#activate-btn').addClass("haveNN");
            $('#export-btn').addClass("haveNN");


            console.log("TRAINING ON selectNN2");

            trainer2.train(trainingData2, {
                rate: nnRate,
                iterations: nnIterations,
                error: nnError,
                shuffle: true,
                log: 5,
                cost: Trainer2.cost.CROSS_ENTROPY
            });

            //we have a trained NN to use
            haveNNFlag2 = true;
            trainNNFlag2 = false;
            $('#activate2-btn').addClass("haveNN");
            $('#export2-btn').addClass("haveNN");
    }

    



    /********************************************************************************************************************
    *********************************************** RUN STORED MODEL ****************************************************
    ********************************************************************************************************************/
    function runStoredModel5(feedArray){
        var output = [];
        var F1 = loadNNData5;

        F1[3] =     feedArray[0];
        F1[5] =     feedArray[1];
        F1[7] =     feedArray[2];
        F1[9] =     feedArray[3];
        F1[11] =    feedArray[4];

        F1[0] = F1[1];F1[1] = F1[2];F1[1] += F1[3] * F1[4];F1[1] += F1[5] * F1[6];F1[1] += F1[7] * F1[8];F1[1] += F1[9] * F1[10];F1[1] += F1[11] * F1[12];F1[1] += F1[13] * F1[14];F1[1] += F1[15] * F1[16];F1[1] += F1[17] * F1[18];F1[1] += F1[19] * F1[20];F1[1] += F1[21] * F1[22];F1[23] = (1 / (1 + Math.exp(-F1[1])));F1[24] = F1[23] * (1 - F1[23]);F1[25] = F1[23];F1[26] = F1[23];F1[27] = F1[23];F1[28] = F1[23];F1[29] = F1[23];
        F1[30] = F1[31];F1[31] = F1[32];F1[31] += F1[3] * F1[33];F1[31] += F1[5] * F1[34];F1[31] += F1[7] * F1[35];F1[31] += F1[9] * F1[36];F1[31] += F1[11] * F1[37];F1[31] += F1[13] * F1[38];F1[31] += F1[15] * F1[39];F1[31] += F1[17] * F1[40];F1[31] += F1[19] * F1[41];F1[31] += F1[21] * F1[42];F1[43] = (1 / (1 + Math.exp(-F1[31])));F1[44] = F1[43] * (1 - F1[43]);F1[45] = F1[43];F1[46] = F1[43];F1[47] = F1[43];F1[48] = F1[43];F1[49] = F1[43];
        F1[50] = F1[51];F1[51] = F1[52];F1[51] += F1[3] * F1[53];F1[51] += F1[5] * F1[54];F1[51] += F1[7] * F1[55];F1[51] += F1[9] * F1[56];F1[51] += F1[11] * F1[57];F1[51] += F1[13] * F1[58];F1[51] += F1[15] * F1[59];F1[51] += F1[17] * F1[60];F1[51] += F1[19] * F1[61];F1[51] += F1[21] * F1[62];F1[63] = (1 / (1 + Math.exp(-F1[51])));F1[64] = F1[63] * (1 - F1[63]);F1[65] = F1[63];F1[66] = F1[63];F1[67] = F1[63];F1[68] = F1[63];F1[69] = F1[63];
        F1[70] = F1[71];F1[71] = F1[72];F1[71] += F1[3] * F1[73];F1[71] += F1[5] * F1[74];F1[71] += F1[7] * F1[75];F1[71] += F1[9] * F1[76];F1[71] += F1[11] * F1[77];F1[71] += F1[13] * F1[78];F1[71] += F1[15] * F1[79];F1[71] += F1[17] * F1[80];F1[71] += F1[19] * F1[81];F1[71] += F1[21] * F1[82];F1[83] = (1 / (1 + Math.exp(-F1[71])));F1[84] = F1[83] * (1 - F1[83]);F1[85] = F1[83];F1[86] = F1[83];F1[87] = F1[83];F1[88] = F1[83];F1[89] = F1[83];
        F1[90] = F1[91];F1[91] = F1[92];F1[91] += F1[3] * F1[93];F1[91] += F1[5] * F1[94];F1[91] += F1[7] * F1[95];F1[91] += F1[9] * F1[96];F1[91] += F1[11] * F1[97];F1[91] += F1[13] * F1[98];F1[91] += F1[15] * F1[99];F1[91] += F1[17] * F1[100];F1[91] += F1[19] * F1[101];F1[91] += F1[21] * F1[102];F1[103] = (1 / (1 + Math.exp(-F1[91])));F1[104] = F1[103] * (1 - F1[103]);F1[105] = F1[103];F1[106] = F1[103];F1[107] = F1[103];F1[108] = F1[103];F1[109] = F1[103];
        F1[110] = F1[111];F1[111] = F1[112];F1[111] += F1[3] * F1[113];F1[111] += F1[5] * F1[114];F1[111] += F1[7] * F1[115];F1[111] += F1[9] * F1[116];F1[111] += F1[11] * F1[117];F1[111] += F1[13] * F1[118];F1[111] += F1[15] * F1[119];F1[111] += F1[17] * F1[120];F1[111] += F1[19] * F1[121];F1[111] += F1[21] * F1[122];F1[123] = (1 / (1 + Math.exp(-F1[111])));F1[124] = F1[123] * (1 - F1[123]);F1[125] = F1[123];
        F1[126] = F1[127];F1[127] = F1[128];F1[127] += F1[3] * F1[129];F1[127] += F1[5] * F1[130];F1[127] += F1[7] * F1[131];F1[127] += F1[9] * F1[132];F1[127] += F1[11] * F1[133];F1[127] += F1[13] * F1[134];F1[127] += F1[15] * F1[135];F1[127] += F1[17] * F1[136];F1[127] += F1[19] * F1[137];F1[127] += F1[21] * F1[138];F1[139] = (1 / (1 + Math.exp(-F1[127])));F1[140] = F1[139] * (1 - F1[139]);F1[141] = F1[139];
        F1[142] = F1[143];F1[143] = F1[144];F1[143] += F1[3] * F1[145];F1[143] += F1[5] * F1[146];F1[143] += F1[7] * F1[147];F1[143] += F1[9] * F1[148];F1[143] += F1[11] * F1[149];F1[143] += F1[13] * F1[150];F1[143] += F1[15] * F1[151];F1[143] += F1[17] * F1[152];F1[143] += F1[19] * F1[153];F1[143] += F1[21] * F1[154];F1[155] = (1 / (1 + Math.exp(-F1[143])));F1[156] = F1[155] * (1 - F1[155]);F1[157] = F1[155];
        F1[158] = F1[159];F1[159] = F1[160];F1[159] += F1[3] * F1[161];F1[159] += F1[5] * F1[162];F1[159] += F1[7] * F1[163];F1[159] += F1[9] * F1[164];F1[159] += F1[11] * F1[165];F1[159] += F1[13] * F1[166];F1[159] += F1[15] * F1[167];F1[159] += F1[17] * F1[168];F1[159] += F1[19] * F1[169];F1[159] += F1[21] * F1[170];F1[171] = (1 / (1 + Math.exp(-F1[159])));F1[172] = F1[171] * (1 - F1[171]);F1[173] = F1[171];
        F1[174] = F1[175];F1[175] = F1[176];F1[175] += F1[3] * F1[177];F1[175] += F1[5] * F1[178];F1[175] += F1[7] * F1[179];F1[175] += F1[9] * F1[180];F1[175] += F1[11] * F1[181];F1[175] += F1[13] * F1[182];F1[175] += F1[15] * F1[183];F1[175] += F1[17] * F1[184];F1[175] += F1[19] * F1[185];F1[175] += F1[21] * F1[186];F1[187] = (1 / (1 + Math.exp(-F1[175])));F1[188] = F1[187] * (1 - F1[187]);F1[189] = F1[187];
        F1[190] = F1[191];F1[191] = F1[125] * F1[192] * F1[191] + F1[193];F1[191] += F1[3] * F1[194] * F1[25];F1[191] += F1[5] * F1[195] * F1[26];F1[191] += F1[7] * F1[196] * F1[27];F1[191] += F1[9] * F1[197] * F1[28];F1[191] += F1[11] * F1[198] * F1[29];F1[13] = (1 / (1 + Math.exp(-F1[191])));F1[199] = F1[13] * (1 - F1[13]);
        F1[200] = F1[201];F1[201] = F1[141] * F1[202] * F1[201] + F1[203];F1[201] += F1[3] * F1[204] * F1[45];F1[201] += F1[5] * F1[205] * F1[46];F1[201] += F1[7] * F1[206] * F1[47];F1[201] += F1[9] * F1[207] * F1[48];F1[201] += F1[11] * F1[208] * F1[49];F1[15] = (1 / (1 + Math.exp(-F1[201])));F1[209] = F1[15] * (1 - F1[15]);
        F1[210] = F1[211];F1[211] = F1[157] * F1[212] * F1[211] + F1[213];F1[211] += F1[3] * F1[214] * F1[65];F1[211] += F1[5] * F1[215] * F1[66];F1[211] += F1[7] * F1[216] * F1[67];F1[211] += F1[9] * F1[217] * F1[68];F1[211] += F1[11] * F1[218] * F1[69];F1[17] = (1 / (1 + Math.exp(-F1[211])));F1[219] = F1[17] * (1 - F1[17]);
        F1[220] = F1[221];F1[221] = F1[173] * F1[222] * F1[221] + F1[223];F1[221] += F1[3] * F1[224] * F1[85];F1[221] += F1[5] * F1[225] * F1[86];F1[221] += F1[7] * F1[226] * F1[87];F1[221] += F1[9] * F1[227] * F1[88];F1[221] += F1[11] * F1[228] * F1[89];F1[19] = (1 / (1 + Math.exp(-F1[221])));F1[229] = F1[19] * (1 - F1[19]);
        F1[230] = F1[231];F1[231] = F1[189] * F1[232] * F1[231] + F1[233];F1[231] += F1[3] * F1[234] * F1[105];F1[231] += F1[5] * F1[235] * F1[106];F1[231] += F1[7] * F1[236] * F1[107];F1[231] += F1[9] * F1[237] * F1[108];F1[231] += F1[11] * F1[238] * F1[109];F1[21] = (1 / (1 + Math.exp(-F1[231])));F1[239] = F1[21] * (1 - F1[21]);
        F1[240] = F1[241];F1[241] = F1[242];F1[241] += F1[3] * F1[243];F1[241] += F1[5] * F1[244];F1[241] += F1[7] * F1[245];F1[241] += F1[9] * F1[246];F1[241] += F1[11] * F1[247];F1[241] += F1[13] * F1[248];F1[241] += F1[15] * F1[249];F1[241] += F1[17] * F1[250];F1[241] += F1[19] * F1[251];F1[241] += F1[21] * F1[252];F1[253] = (1 / (1 + Math.exp(-F1[241])));F1[254] = F1[253] * (1 - F1[253]);F1[255] = F1[253];
        F1[256] = F1[257];F1[257] = F1[258];F1[257] += F1[3] * F1[259];F1[257] += F1[5] * F1[260];F1[257] += F1[7] * F1[261];F1[257] += F1[9] * F1[262];F1[257] += F1[11] * F1[263];F1[257] += F1[13] * F1[264];F1[257] += F1[15] * F1[265];F1[257] += F1[17] * F1[266];F1[257] += F1[19] * F1[267];F1[257] += F1[21] * F1[268];F1[269] = (1 / (1 + Math.exp(-F1[257])));F1[270] = F1[269] * (1 - F1[269]);F1[271] = F1[269];
        F1[272] = F1[273];F1[273] = F1[274];F1[273] += F1[3] * F1[275];F1[273] += F1[5] * F1[276];F1[273] += F1[7] * F1[277];F1[273] += F1[9] * F1[278];F1[273] += F1[11] * F1[279];F1[273] += F1[13] * F1[280];F1[273] += F1[15] * F1[281];F1[273] += F1[17] * F1[282];F1[273] += F1[19] * F1[283];F1[273] += F1[21] * F1[284];F1[285] = (1 / (1 + Math.exp(-F1[273])));F1[286] = F1[285] * (1 - F1[285]);F1[287] = F1[285];
        F1[288] = F1[289];F1[289] = F1[290];F1[289] += F1[3] * F1[291];F1[289] += F1[5] * F1[292];F1[289] += F1[7] * F1[293];F1[289] += F1[9] * F1[294];F1[289] += F1[11] * F1[295];F1[289] += F1[13] * F1[296];F1[289] += F1[15] * F1[297];F1[289] += F1[17] * F1[298];F1[289] += F1[19] * F1[299];F1[289] += F1[21] * F1[300];F1[301] = (1 / (1 + Math.exp(-F1[289])));F1[302] = F1[301] * (1 - F1[301]);F1[303] = F1[301];
        F1[304] = F1[305];F1[305] = F1[306];F1[305] += F1[3] * F1[307];F1[305] += F1[5] * F1[308];F1[305] += F1[7] * F1[309];F1[305] += F1[9] * F1[310];F1[305] += F1[11] * F1[311];F1[305] += F1[13] * F1[312];F1[305] += F1[15] * F1[313];F1[305] += F1[17] * F1[314];F1[305] += F1[19] * F1[315];F1[305] += F1[21] * F1[316];F1[317] = (1 / (1 + Math.exp(-F1[305])));F1[318] = F1[317] * (1 - F1[317]);F1[319] = F1[317];
        F1[320] = F1[321];F1[321] = F1[322];F1[321] += F1[3] * F1[323];F1[321] += F1[5] * F1[324];F1[321] += F1[7] * F1[325];F1[321] += F1[9] * F1[326];F1[321] += F1[11] * F1[327];F1[321] += F1[13] * F1[328];F1[321] += F1[15] * F1[329];F1[321] += F1[17] * F1[330];F1[321] += F1[19] * F1[331];F1[321] += F1[21] * F1[332];F1[321] += F1[333] * F1[334];F1[321] += F1[335] * F1[336];F1[337] = (1 / (1 + Math.exp(-F1[321])));F1[338] = F1[337] * (1 - F1[337]);F1[339] = F1[337];F1[340] = F1[337];F1[341] = F1[337];F1[342] = F1[337];F1[343] = F1[337];F1[344] = F1[337];F1[345] = F1[337];F1[346] = F1[337];F1[347] = F1[337];F1[348] = F1[337];
        F1[349] = F1[350];F1[350] = F1[351];F1[350] += F1[3] * F1[352];F1[350] += F1[5] * F1[353];F1[350] += F1[7] * F1[354];F1[350] += F1[9] * F1[355];F1[350] += F1[11] * F1[356];F1[350] += F1[13] * F1[357];F1[350] += F1[15] * F1[358];F1[350] += F1[17] * F1[359];F1[350] += F1[19] * F1[360];F1[350] += F1[21] * F1[361];F1[350] += F1[333] * F1[362];F1[350] += F1[335] * F1[363];F1[364] = (1 / (1 + Math.exp(-F1[350])));F1[365] = F1[364] * (1 - F1[364]);F1[366] = F1[364];F1[367] = F1[364];F1[368] = F1[364];F1[369] = F1[364];F1[370] = F1[364];F1[371] = F1[364];F1[372] = F1[364];F1[373] = F1[364];F1[374] = F1[364];F1[375] = F1[364];
        F1[376] = F1[377];F1[377] = F1[378];F1[377] += F1[3] * F1[379];F1[377] += F1[5] * F1[380];F1[377] += F1[7] * F1[381];F1[377] += F1[9] * F1[382];F1[377] += F1[11] * F1[383];F1[377] += F1[13] * F1[384];F1[377] += F1[15] * F1[385];F1[377] += F1[17] * F1[386];F1[377] += F1[19] * F1[387];F1[377] += F1[21] * F1[388];F1[377] += F1[333] * F1[389];F1[377] += F1[335] * F1[390];F1[391] = (1 / (1 + Math.exp(-F1[377])));F1[392] = F1[391] * (1 - F1[391]);F1[393] = F1[391];
        F1[394] = F1[395];F1[395] = F1[396];F1[395] += F1[3] * F1[397];F1[395] += F1[5] * F1[398];F1[395] += F1[7] * F1[399];F1[395] += F1[9] * F1[400];F1[395] += F1[11] * F1[401];F1[395] += F1[13] * F1[402];F1[395] += F1[15] * F1[403];F1[395] += F1[17] * F1[404];F1[395] += F1[19] * F1[405];F1[395] += F1[21] * F1[406];F1[395] += F1[333] * F1[407];F1[395] += F1[335] * F1[408];F1[409] = (1 / (1 + Math.exp(-F1[395])));F1[410] = F1[409] * (1 - F1[409]);F1[411] = F1[409];
        F1[412] = F1[413];F1[413] = F1[393] * F1[414] * F1[413] + F1[415];F1[413] += F1[3] * F1[416] * F1[339];F1[413] += F1[5] * F1[417] * F1[340];F1[413] += F1[7] * F1[418] * F1[341];F1[413] += F1[9] * F1[419] * F1[342];F1[413] += F1[11] * F1[420] * F1[343];F1[413] += F1[13] * F1[421] * F1[344];F1[413] += F1[15] * F1[422] * F1[345];F1[413] += F1[17] * F1[423] * F1[346];F1[413] += F1[19] * F1[424] * F1[347];F1[413] += F1[21] * F1[425] * F1[348];F1[333] = (1 / (1 + Math.exp(-F1[413])));F1[426] = F1[333] * (1 - F1[333]);
        F1[427] = F1[428];F1[428] = F1[411] * F1[429] * F1[428] + F1[430];F1[428] += F1[3] * F1[431] * F1[366];F1[428] += F1[5] * F1[432] * F1[367];F1[428] += F1[7] * F1[433] * F1[368];F1[428] += F1[9] * F1[434] * F1[369];F1[428] += F1[11] * F1[435] * F1[370];F1[428] += F1[13] * F1[436] * F1[371];F1[428] += F1[15] * F1[437] * F1[372];F1[428] += F1[17] * F1[438] * F1[373];F1[428] += F1[19] * F1[439] * F1[374];F1[428] += F1[21] * F1[440] * F1[375];F1[335] = (1 / (1 + Math.exp(-F1[428])));F1[441] = F1[335] * (1 - F1[335]);
        F1[442] = F1[443];F1[443] = F1[444];F1[443] += F1[3] * F1[445];F1[443] += F1[5] * F1[446];F1[443] += F1[7] * F1[447];F1[443] += F1[9] * F1[448];F1[443] += F1[11] * F1[449];F1[443] += F1[13] * F1[450];F1[443] += F1[15] * F1[451];F1[443] += F1[17] * F1[452];F1[443] += F1[19] * F1[453];F1[443] += F1[21] * F1[454];F1[443] += F1[333] * F1[455];F1[443] += F1[335] * F1[456];F1[457] = (1 / (1 + Math.exp(-F1[443])));F1[458] = F1[457] * (1 - F1[457]);F1[459] = F1[457];
        F1[460] = F1[461];F1[461] = F1[462];F1[461] += F1[3] * F1[463];F1[461] += F1[5] * F1[464];F1[461] += F1[7] * F1[465];F1[461] += F1[9] * F1[466];F1[461] += F1[11] * F1[467];F1[461] += F1[13] * F1[468];F1[461] += F1[15] * F1[469];F1[461] += F1[17] * F1[470];F1[461] += F1[19] * F1[471];F1[461] += F1[21] * F1[472];F1[461] += F1[333] * F1[473];F1[461] += F1[335] * F1[474];F1[475] = (1 / (1 + Math.exp(-F1[461])));F1[476] = F1[475] * (1 - F1[475]);F1[477] = F1[475];
        F1[478] = F1[479];F1[479] = F1[480];F1[479] += F1[13] * F1[481] * F1[255];F1[479] += F1[15] * F1[482] * F1[271];F1[479] += F1[17] * F1[483] * F1[287];F1[479] += F1[19] * F1[484] * F1[303];F1[479] += F1[21] * F1[485] * F1[319];F1[479] += F1[333] * F1[486] * F1[459];F1[479] += F1[335] * F1[487] * F1[477];F1[479] += F1[3] * F1[488];F1[479] += F1[5] * F1[489];F1[479] += F1[7] * F1[490];F1[479] += F1[9] * F1[491];F1[479] += F1[11] * F1[492];F1[493] = (1 / (1 + Math.exp(-F1[479])));F1[494] = F1[493] * (1 - F1[493]);
     //   var output = [];
        output[0] = F1[493];
        return output;
    }


    function runStoredModel7(feedArray){
        var output = [];
        var F2 = loadNNData7;

        F2[3] =     feedArray[0];
        F2[5] =     feedArray[1];
        F2[7] =      feedArray[2];
        F2[9] =     feedArray[3];
        F2[11] =    feedArray[4];
        F2[13] =    feedArray[5];
        F2[15] =    feedArray[6];

        F2[0] = F2[1];F2[1] = F2[2];F2[1] += F2[3] * F2[4];F2[1] += F2[5] * F2[6];F2[1] += F2[7] * F2[8];F2[1] += F2[9] * F2[10];F2[1] += F2[11] * F2[12];F2[1] += F2[13] * F2[14];F2[1] += F2[15] * F2[16];F2[1] += F2[17] * F2[18];F2[1] += F2[19] * F2[20];F2[1] += F2[21] * F2[22];F2[1] += F2[23] * F2[24];F2[1] += F2[25] * F2[26];F2[27] = (1 / (1 + Math.exp(-F2[1])));F2[28] = F2[27] * (1 - F2[27]);F2[29] = F2[27];F2[30] = F2[27];F2[31] = F2[27];F2[32] = F2[27];F2[33] = F2[27];F2[34] = F2[27];F2[35] = F2[27];
        F2[36] = F2[37];F2[37] = F2[38];F2[37] += F2[3] * F2[39];F2[37] += F2[5] * F2[40];F2[37] += F2[7] * F2[41];F2[37] += F2[9] * F2[42];F2[37] += F2[11] * F2[43];F2[37] += F2[13] * F2[44];F2[37] += F2[15] * F2[45];F2[37] += F2[17] * F2[46];F2[37] += F2[19] * F2[47];F2[37] += F2[21] * F2[48];F2[37] += F2[23] * F2[49];F2[37] += F2[25] * F2[50];F2[51] = (1 / (1 + Math.exp(-F2[37])));F2[52] = F2[51] * (1 - F2[51]);F2[53] = F2[51];F2[54] = F2[51];F2[55] = F2[51];F2[56] = F2[51];F2[57] = F2[51];F2[58] = F2[51];F2[59] = F2[51];
        F2[60] = F2[61];F2[61] = F2[62];F2[61] += F2[3] * F2[63];F2[61] += F2[5] * F2[64];F2[61] += F2[7] * F2[65];F2[61] += F2[9] * F2[66];F2[61] += F2[11] * F2[67];F2[61] += F2[13] * F2[68];F2[61] += F2[15] * F2[69];F2[61] += F2[17] * F2[70];F2[61] += F2[19] * F2[71];F2[61] += F2[21] * F2[72];F2[61] += F2[23] * F2[73];F2[61] += F2[25] * F2[74];F2[75] = (1 / (1 + Math.exp(-F2[61])));F2[76] = F2[75] * (1 - F2[75]);F2[77] = F2[75];F2[78] = F2[75];F2[79] = F2[75];F2[80] = F2[75];F2[81] = F2[75];F2[82] = F2[75];F2[83] = F2[75];
        F2[84] = F2[85];F2[85] = F2[86];F2[85] += F2[3] * F2[87];F2[85] += F2[5] * F2[88];F2[85] += F2[7] * F2[89];F2[85] += F2[9] * F2[90];F2[85] += F2[11] * F2[91];F2[85] += F2[13] * F2[92];F2[85] += F2[15] * F2[93];F2[85] += F2[17] * F2[94];F2[85] += F2[19] * F2[95];F2[85] += F2[21] * F2[96];F2[85] += F2[23] * F2[97];F2[85] += F2[25] * F2[98];F2[99] = (1 / (1 + Math.exp(-F2[85])));F2[100] = F2[99] * (1 - F2[99]);F2[101] = F2[99];F2[102] = F2[99];F2[103] = F2[99];F2[104] = F2[99];F2[105] = F2[99];F2[106] = F2[99];F2[107] = F2[99];
        F2[108] = F2[109];F2[109] = F2[110];F2[109] += F2[3] * F2[111];F2[109] += F2[5] * F2[112];F2[109] += F2[7] * F2[113];F2[109] += F2[9] * F2[114];F2[109] += F2[11] * F2[115];F2[109] += F2[13] * F2[116];F2[109] += F2[15] * F2[117];F2[109] += F2[17] * F2[118];F2[109] += F2[19] * F2[119];F2[109] += F2[21] * F2[120];F2[109] += F2[23] * F2[121];F2[109] += F2[25] * F2[122];F2[123] = (1 / (1 + Math.exp(-F2[109])));F2[124] = F2[123] * (1 - F2[123]);F2[125] = F2[123];F2[126] = F2[123];F2[127] = F2[123];F2[128] = F2[123];F2[129] = F2[123];F2[130] = F2[123];F2[131] = F2[123];
        F2[132] = F2[133];F2[133] = F2[134];F2[133] += F2[3] * F2[135];F2[133] += F2[5] * F2[136];F2[133] += F2[7] * F2[137];F2[133] += F2[9] * F2[138];F2[133] += F2[11] * F2[139];F2[133] += F2[13] * F2[140];F2[133] += F2[15] * F2[141];F2[133] += F2[17] * F2[142];F2[133] += F2[19] * F2[143];F2[133] += F2[21] * F2[144];F2[133] += F2[23] * F2[145];F2[133] += F2[25] * F2[146];F2[147] = (1 / (1 + Math.exp(-F2[133])));F2[148] = F2[147] * (1 - F2[147]);F2[149] = F2[147];
        F2[150] = F2[151];F2[151] = F2[152];F2[151] += F2[3] * F2[153];F2[151] += F2[5] * F2[154];F2[151] += F2[7] * F2[155];F2[151] += F2[9] * F2[156];F2[151] += F2[11] * F2[157];F2[151] += F2[13] * F2[158];F2[151] += F2[15] * F2[159];F2[151] += F2[17] * F2[160];F2[151] += F2[19] * F2[161];F2[151] += F2[21] * F2[162];F2[151] += F2[23] * F2[163];F2[151] += F2[25] * F2[164];F2[165] = (1 / (1 + Math.exp(-F2[151])));F2[166] = F2[165] * (1 - F2[165]);F2[167] = F2[165];
        F2[168] = F2[169];F2[169] = F2[170];F2[169] += F2[3] * F2[171];F2[169] += F2[5] * F2[172];F2[169] += F2[7] * F2[173];F2[169] += F2[9] * F2[174];F2[169] += F2[11] * F2[175];F2[169] += F2[13] * F2[176];F2[169] += F2[15] * F2[177];F2[169] += F2[17] * F2[178];F2[169] += F2[19] * F2[179];F2[169] += F2[21] * F2[180];F2[169] += F2[23] * F2[181];F2[169] += F2[25] * F2[182];F2[183] = (1 / (1 + Math.exp(-F2[169])));F2[184] = F2[183] * (1 - F2[183]);F2[185] = F2[183];
        F2[186] = F2[187];F2[187] = F2[188];F2[187] += F2[3] * F2[189];F2[187] += F2[5] * F2[190];F2[187] += F2[7] * F2[191];F2[187] += F2[9] * F2[192];F2[187] += F2[11] * F2[193];F2[187] += F2[13] * F2[194];F2[187] += F2[15] * F2[195];F2[187] += F2[17] * F2[196];F2[187] += F2[19] * F2[197];F2[187] += F2[21] * F2[198];F2[187] += F2[23] * F2[199];F2[187] += F2[25] * F2[200];F2[201] = (1 / (1 + Math.exp(-F2[187])));F2[202] = F2[201] * (1 - F2[201]);F2[203] = F2[201];
        F2[204] = F2[205];F2[205] = F2[206];F2[205] += F2[3] * F2[207];F2[205] += F2[5] * F2[208];F2[205] += F2[7] * F2[209];F2[205] += F2[9] * F2[210];F2[205] += F2[11] * F2[211];F2[205] += F2[13] * F2[212];F2[205] += F2[15] * F2[213];F2[205] += F2[17] * F2[214];F2[205] += F2[19] * F2[215];F2[205] += F2[21] * F2[216];F2[205] += F2[23] * F2[217];F2[205] += F2[25] * F2[218];F2[219] = (1 / (1 + Math.exp(-F2[205])));F2[220] = F2[219] * (1 - F2[219]);F2[221] = F2[219];
        F2[222] = F2[223];F2[223] = F2[149] * F2[224] * F2[223] + F2[225];F2[223] += F2[3] * F2[226] * F2[29];F2[223] += F2[5] * F2[227] * F2[30];F2[223] += F2[7] * F2[228] * F2[31];F2[223] += F2[9] * F2[229] * F2[32];F2[223] += F2[11] * F2[230] * F2[33];F2[223] += F2[13] * F2[231] * F2[34];F2[223] += F2[15] * F2[232] * F2[35];F2[17] = (1 / (1 + Math.exp(-F2[223])));F2[233] = F2[17] * (1 - F2[17]);
        F2[234] = F2[235];F2[235] = F2[167] * F2[236] * F2[235] + F2[237];F2[235] += F2[3] * F2[238] * F2[53];F2[235] += F2[5] * F2[239] * F2[54];F2[235] += F2[7] * F2[240] * F2[55];F2[235] += F2[9] * F2[241] * F2[56];F2[235] += F2[11] * F2[242] * F2[57];F2[235] += F2[13] * F2[243] * F2[58];F2[235] += F2[15] * F2[244] * F2[59];F2[19] = (1 / (1 + Math.exp(-F2[235])));F2[245] = F2[19] * (1 - F2[19]);
        F2[246] = F2[247];F2[247] = F2[185] * F2[248] * F2[247] + F2[249];F2[247] += F2[3] * F2[250] * F2[77];F2[247] += F2[5] * F2[251] * F2[78];F2[247] += F2[7] * F2[252] * F2[79];F2[247] += F2[9] * F2[253] * F2[80];F2[247] += F2[11] * F2[254] * F2[81];F2[247] += F2[13] * F2[255] * F2[82];F2[247] += F2[15] * F2[256] * F2[83];F2[21] = (1 / (1 + Math.exp(-F2[247])));F2[257] = F2[21] * (1 - F2[21]);
        F2[258] = F2[259];F2[259] = F2[203] * F2[260] * F2[259] + F2[261];F2[259] += F2[3] * F2[262] * F2[101];F2[259] += F2[5] * F2[263] * F2[102];F2[259] += F2[7] * F2[264] * F2[103];F2[259] += F2[9] * F2[265] * F2[104];F2[259] += F2[11] * F2[266] * F2[105];F2[259] += F2[13] * F2[267] * F2[106];F2[259] += F2[15] * F2[268] * F2[107];F2[23] = (1 / (1 + Math.exp(-F2[259])));F2[269] = F2[23] * (1 - F2[23]);
        F2[270] = F2[271];F2[271] = F2[221] * F2[272] * F2[271] + F2[273];F2[271] += F2[3] * F2[274] * F2[125];F2[271] += F2[5] * F2[275] * F2[126];F2[271] += F2[7] * F2[276] * F2[127];F2[271] += F2[9] * F2[277] * F2[128];F2[271] += F2[11] * F2[278] * F2[129];F2[271] += F2[13] * F2[279] * F2[130];F2[271] += F2[15] * F2[280] * F2[131];F2[25] = (1 / (1 + Math.exp(-F2[271])));F2[281] = F2[25] * (1 - F2[25]);
        F2[282] = F2[283];F2[283] = F2[284];F2[283] += F2[3] * F2[285];F2[283] += F2[5] * F2[286];F2[283] += F2[7] * F2[287];F2[283] += F2[9] * F2[288];F2[283] += F2[11] * F2[289];F2[283] += F2[13] * F2[290];F2[283] += F2[15] * F2[291];F2[283] += F2[17] * F2[292];F2[283] += F2[19] * F2[293];F2[283] += F2[21] * F2[294];F2[283] += F2[23] * F2[295];F2[283] += F2[25] * F2[296];F2[297] = (1 / (1 + Math.exp(-F2[283])));F2[298] = F2[297] * (1 - F2[297]);F2[299] = F2[297];
        F2[300] = F2[301];F2[301] = F2[302];F2[301] += F2[3] * F2[303];F2[301] += F2[5] * F2[304];F2[301] += F2[7] * F2[305];F2[301] += F2[9] * F2[306];F2[301] += F2[11] * F2[307];F2[301] += F2[13] * F2[308];F2[301] += F2[15] * F2[309];F2[301] += F2[17] * F2[310];F2[301] += F2[19] * F2[311];F2[301] += F2[21] * F2[312];F2[301] += F2[23] * F2[313];F2[301] += F2[25] * F2[314];F2[315] = (1 / (1 + Math.exp(-F2[301])));F2[316] = F2[315] * (1 - F2[315]);F2[317] = F2[315];
        F2[318] = F2[319];F2[319] = F2[320];F2[319] += F2[3] * F2[321];F2[319] += F2[5] * F2[322];F2[319] += F2[7] * F2[323];F2[319] += F2[9] * F2[324];F2[319] += F2[11] * F2[325];F2[319] += F2[13] * F2[326];F2[319] += F2[15] * F2[327];F2[319] += F2[17] * F2[328];F2[319] += F2[19] * F2[329];F2[319] += F2[21] * F2[330];F2[319] += F2[23] * F2[331];F2[319] += F2[25] * F2[332];F2[333] = (1 / (1 + Math.exp(-F2[319])));F2[334] = F2[333] * (1 - F2[333]);F2[335] = F2[333];
        F2[336] = F2[337];F2[337] = F2[338];F2[337] += F2[3] * F2[339];F2[337] += F2[5] * F2[340];F2[337] += F2[7] * F2[341];F2[337] += F2[9] * F2[342];F2[337] += F2[11] * F2[343];F2[337] += F2[13] * F2[344];F2[337] += F2[15] * F2[345];F2[337] += F2[17] * F2[346];F2[337] += F2[19] * F2[347];F2[337] += F2[21] * F2[348];F2[337] += F2[23] * F2[349];F2[337] += F2[25] * F2[350];F2[351] = (1 / (1 + Math.exp(-F2[337])));F2[352] = F2[351] * (1 - F2[351]);F2[353] = F2[351];
        F2[354] = F2[355];F2[355] = F2[356];F2[355] += F2[3] * F2[357];F2[355] += F2[5] * F2[358];F2[355] += F2[7] * F2[359];F2[355] += F2[9] * F2[360];F2[355] += F2[11] * F2[361];F2[355] += F2[13] * F2[362];F2[355] += F2[15] * F2[363];F2[355] += F2[17] * F2[364];F2[355] += F2[19] * F2[365];F2[355] += F2[21] * F2[366];F2[355] += F2[23] * F2[367];F2[355] += F2[25] * F2[368];F2[369] = (1 / (1 + Math.exp(-F2[355])));F2[370] = F2[369] * (1 - F2[369]);F2[371] = F2[369];
        F2[372] = F2[373];F2[373] = F2[374];F2[373] += F2[3] * F2[375];F2[373] += F2[5] * F2[376];F2[373] += F2[7] * F2[377];F2[373] += F2[9] * F2[378];F2[373] += F2[11] * F2[379];F2[373] += F2[13] * F2[380];F2[373] += F2[15] * F2[381];F2[373] += F2[17] * F2[382];F2[373] += F2[19] * F2[383];F2[373] += F2[21] * F2[384];F2[373] += F2[23] * F2[385];F2[373] += F2[25] * F2[386];F2[373] += F2[387] * F2[388];F2[373] += F2[389] * F2[390];F2[391] = (1 / (1 + Math.exp(-F2[373])));F2[392] = F2[391] * (1 - F2[391]);F2[393] = F2[391];F2[394] = F2[391];F2[395] = F2[391];F2[396] = F2[391];F2[397] = F2[391];F2[398] = F2[391];F2[399] = F2[391];F2[400] = F2[391];F2[401] = F2[391];F2[402] = F2[391];F2[403] = F2[391];F2[404] = F2[391];
        F2[405] = F2[406];F2[406] = F2[407];F2[406] += F2[3] * F2[408];F2[406] += F2[5] * F2[409];F2[406] += F2[7] * F2[410];F2[406] += F2[9] * F2[411];F2[406] += F2[11] * F2[412];F2[406] += F2[13] * F2[413];F2[406] += F2[15] * F2[414];F2[406] += F2[17] * F2[415];F2[406] += F2[19] * F2[416];F2[406] += F2[21] * F2[417];F2[406] += F2[23] * F2[418];F2[406] += F2[25] * F2[419];F2[406] += F2[387] * F2[420];F2[406] += F2[389] * F2[421];F2[422] = (1 / (1 + Math.exp(-F2[406])));F2[423] = F2[422] * (1 - F2[422]);F2[424] = F2[422];F2[425] = F2[422];F2[426] = F2[422];F2[427] = F2[422];F2[428] = F2[422];F2[429] = F2[422];F2[430] = F2[422];F2[431] = F2[422];F2[432] = F2[422];F2[433] = F2[422];F2[434] = F2[422];F2[435] = F2[422];
        F2[436] = F2[437];F2[437] = F2[438];F2[437] += F2[3] * F2[439];F2[437] += F2[5] * F2[440];F2[437] += F2[7] * F2[441];F2[437] += F2[9] * F2[442];F2[437] += F2[11] * F2[443];F2[437] += F2[13] * F2[444];F2[437] += F2[15] * F2[445];F2[437] += F2[17] * F2[446];F2[437] += F2[19] * F2[447];F2[437] += F2[21] * F2[448];F2[437] += F2[23] * F2[449];F2[437] += F2[25] * F2[450];F2[437] += F2[387] * F2[451];F2[437] += F2[389] * F2[452];F2[453] = (1 / (1 + Math.exp(-F2[437])));F2[454] = F2[453] * (1 - F2[453]);F2[455] = F2[453];
        F2[456] = F2[457];F2[457] = F2[458];F2[457] += F2[3] * F2[459];F2[457] += F2[5] * F2[460];F2[457] += F2[7] * F2[461];F2[457] += F2[9] * F2[462];F2[457] += F2[11] * F2[463];F2[457] += F2[13] * F2[464];F2[457] += F2[15] * F2[465];F2[457] += F2[17] * F2[466];F2[457] += F2[19] * F2[467];F2[457] += F2[21] * F2[468];F2[457] += F2[23] * F2[469];F2[457] += F2[25] * F2[470];F2[457] += F2[387] * F2[471];F2[457] += F2[389] * F2[472];F2[473] = (1 / (1 + Math.exp(-F2[457])));F2[474] = F2[473] * (1 - F2[473]);F2[475] = F2[473];
        F2[476] = F2[477];F2[477] = F2[455] * F2[478] * F2[477] + F2[479];F2[477] += F2[3] * F2[480] * F2[393];F2[477] += F2[5] * F2[481] * F2[394];F2[477] += F2[7] * F2[482] * F2[395];F2[477] += F2[9] * F2[483] * F2[396];F2[477] += F2[11] * F2[484] * F2[397];F2[477] += F2[13] * F2[485] * F2[398];F2[477] += F2[15] * F2[486] * F2[399];F2[477] += F2[17] * F2[487] * F2[400];F2[477] += F2[19] * F2[488] * F2[401];F2[477] += F2[21] * F2[489] * F2[402];F2[477] += F2[23] * F2[490] * F2[403];F2[477] += F2[25] * F2[491] * F2[404];F2[387] = (1 / (1 + Math.exp(-F2[477])));F2[492] = F2[387] * (1 - F2[387]);
        F2[493] = F2[494];F2[494] = F2[475] * F2[495] * F2[494] + F2[496];F2[494] += F2[3] * F2[497] * F2[424];F2[494] += F2[5] * F2[498] * F2[425];F2[494] += F2[7] * F2[499] * F2[426];F2[494] += F2[9] * F2[500] * F2[427];F2[494] += F2[11] * F2[501] * F2[428];F2[494] += F2[13] * F2[502] * F2[429];F2[494] += F2[15] * F2[503] * F2[430];F2[494] += F2[17] * F2[504] * F2[431];F2[494] += F2[19] * F2[505] * F2[432];F2[494] += F2[21] * F2[506] * F2[433];F2[494] += F2[23] * F2[507] * F2[434];F2[494] += F2[25] * F2[508] * F2[435];F2[389] = (1 / (1 + Math.exp(-F2[494])));F2[509] = F2[389] * (1 - F2[389]);
        F2[510] = F2[511];F2[511] = F2[512];F2[511] += F2[3] * F2[513];F2[511] += F2[5] * F2[514];F2[511] += F2[7] * F2[515];F2[511] += F2[9] * F2[516];F2[511] += F2[11] * F2[517];F2[511] += F2[13] * F2[518];F2[511] += F2[15] * F2[519];F2[511] += F2[17] * F2[520];F2[511] += F2[19] * F2[521];F2[511] += F2[21] * F2[522];F2[511] += F2[23] * F2[523];F2[511] += F2[25] * F2[524];F2[511] += F2[387] * F2[525];F2[511] += F2[389] * F2[526];F2[527] = (1 / (1 + Math.exp(-F2[511])));F2[528] = F2[527] * (1 - F2[527]);F2[529] = F2[527];
        F2[530] = F2[531];F2[531] = F2[532];F2[531] += F2[3] * F2[533];F2[531] += F2[5] * F2[534];F2[531] += F2[7] * F2[535];F2[531] += F2[9] * F2[536];F2[531] += F2[11] * F2[537];F2[531] += F2[13] * F2[538];F2[531] += F2[15] * F2[539];F2[531] += F2[17] * F2[540];F2[531] += F2[19] * F2[541];F2[531] += F2[21] * F2[542];F2[531] += F2[23] * F2[543];F2[531] += F2[25] * F2[544];F2[531] += F2[387] * F2[545];F2[531] += F2[389] * F2[546];F2[547] = (1 / (1 + Math.exp(-F2[531])));F2[548] = F2[547] * (1 - F2[547]);F2[549] = F2[547];
        F2[550] = F2[551];F2[551] = F2[552];F2[551] += F2[17] * F2[553] * F2[299];F2[551] += F2[19] * F2[554] * F2[317];F2[551] += F2[21] * F2[555] * F2[335];F2[551] += F2[23] * F2[556] * F2[353];F2[551] += F2[25] * F2[557] * F2[371];F2[551] += F2[387] * F2[558] * F2[529];F2[551] += F2[389] * F2[559] * F2[549];F2[551] += F2[3] * F2[560];F2[551] += F2[5] * F2[561];F2[551] += F2[7] * F2[562];F2[551] += F2[9] * F2[563];F2[551] += F2[11] * F2[564];F2[551] += F2[13] * F2[565];F2[551] += F2[15] * F2[566];F2[567] = (1 / (1 + Math.exp(-F2[551])));F2[568] = F2[567] * (1 - F2[567]);
      //  var output = [];
        output[0] = F2[567];
        return output;
    }



    /********************************************************************************************************************
    *********************************************** CHANGE CURRENT TARGET ***********************************************
    ********************************************************************************************************************/
    $('.target-select-radio').click(function() {
        selectedTargetNum = parseInt( $(this).attr("num") );
        selectedTargetName = $(this).attr("id");
        var isChecked = $('#rdSelect').prop('checked');

        console.log("SELECTED TARGET: " + selectedTargetName + " " + selectedTargetNum + " " + isChecked);
    });




    /********************************************************************************************************************
    *********************************************** SLIDER UI ***********************************************************
    ********************************************************************************************************************/
    var rangeSlider = function(){
        var slider = $('.range-slider'),
            range = $('.range-slider__range'),
            value = $('.range-slider__value');
          
        slider.each(function(){

        value.each(function(){
            var value = $(this).prev().attr('value');
            $(this).html(value);
        });

        if( $(this).hasClass('nn-architecture') ){ $('.range-slider__value.nn-architecture').html('2:5:1'); }

        range.on('input', function(){
            var labels = ['2:1', '2:5:1', '2:5:5:1', '3:1', '3:5:1', '3:5:5:1', '5:1', '5:5:1', '5:7:7:1'];
            $(this).next(value).html(this.value);

            if( $(this).hasClass('nn-architecture') ){ $(this).next(value).html( labels[this.value] ); }
          
          });
        });
    }

    rangeSlider();

    //RANGE SLIDER EVENT HANDLER
    $( ".range-slider" ).each(function() {

        if($(this).hasClass("nn-architecture")){
            // Add labels to slider whose values 
            // are specified by min, max and whose
            // step is set to 1
            
            // Get the options for this slider
            //var opt = $(this).data().uiSlider.options;
            // Get the number of possible values
            var $input = $(this).find("input");
            var min = parseInt($input.attr("min"));
            var max = parseInt($input.attr("max"));
            var step = parseInt($input.attr("step"));
            var increment = parseInt($input.attr("increment"));
            var vals = max - min; //opt.max - opt.min;
            //if(min < 0){ vals = max + min; }
            var labels = ['2:1', '2:5:1', '2:5:5:1', '3:1', '3:5:1', '3:5:5:1', '5:1', '5:5:1', '5:7:7:1'];
            
            // Space out values
            for (var i = 0; (i * increment) <= vals; i++) {
                var s = min + (i * increment);
                var el = $('<label>'+ labels[s] +'</label>').css('left',( 4 + Math.abs((s-min)/vals) *($input.width() -24)+'px'));
                //   var el = $('<label>'+ s +'</label>').css('left',( 3 + ((s-min)/vals) *($input.width() -24)+'px'));
                if(s == 0){ el = $('<label>'+ labels[s] +'</label>').css('left',( 21 + Math.abs((s-min)/vals) *($input.width() -24)+'px')); }
                if(s == vals){ el = $('<label>'+ labels[s] +'</label>').css('left',( -20 + Math.abs((s-min)/vals) *($input.width() -24)+'px')); }
                $(this).append(el);
            }
        }  
    });




    /*******************************************************************************************************************
     ******************************************* NEURAL NETWORK BUTTONS *************************************************
     ********************************************************************************************************************/
    $('#train-btn').click(function() {
        console.log("train button 1");
        trainNNFlag1 = true;
        trainNN(1);
    });

    $('#activate-btn').click(function() {
        console.log("activate button");
        activeNNFlag1 = true;
        $('#activate-btn').toggleClass("activatedNN");

        //if loaded NN, turn off
        if (loadNNFlag) {
            loadNNFlag = false;
            $('#load-nn-btn').toggleClass("activatedNN");
        }
    });

    $('#train2-btn').click(function() {
        console.log("train button 2");
        trainNNFlag2 = true;
        trainNN(2);
    });

    $('#activate2-btn').click(function() {
        console.log("activate button");
        activeNNFlag2 = true;
        $('#activate2-btn').toggleClass("activatedNN");

        //if leaded NN, turn off
        if (loadNNFlag) {
            loadNNFlag = false;
            $('#load-nn-btn').toggleClass("activatedNN");
        }
    });


    // ************* LOAD TWO EXPORTED NEURAL NET ACTIVATION FUNCTIONS AND WEIGHTS
    $('#load-nn-btn').click(function() {
        console.log("load exported NN button");
        loadNNFlag = true;
        $('#load-nn-btn').toggleClass("activatedNN");

        console.log("LOADING MODEL FOR TARGET: " + selectedTargetName + " " + selectedTargetNum);
        //SHORT RIGHT
        if(selectedTargetName == 'sh-r-eyes-select'){
            loadNNData5 = set_RHand_ShortHair_EyesPosition_5Weights(loadNNData5);
            loadNNData7 = set_RHand_ShortHair_EyesPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'sh-r-mouth-select'){
            loadNNData5 = set_RHand_ShortHair_MouthPosition_5Weights(loadNNData5);
            loadNNData7 = set_RHand_ShortHair_MouthPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'sh-r-front-select'){
            loadNNData5 = set_RHand_ShortHair_FrontPosition_5Weights(loadNNData5);
            loadNNData7 = set_RHand_ShortHair_FrontPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'sh-r-side-select'){
            loadNNData5 = set_RHand_ShortHair_SidePosition_5Weights(loadNNData5);
            loadNNData7 = set_RHand_ShortHair_SidePosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'sh-r-top-select'){
            loadNNData5 = set_RHand_ShortHair_TopPosition_5Weights(loadNNData5);
            loadNNData7 = set_RHand_ShortHair_TopPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'sh-r-back-select'){
            loadNNData5 = set_RHand_ShortHair_BackPosition_5Weights(loadNNData5);
            loadNNData7 = set_RHand_ShortHair_BackPosition_7Weights(loadNNData7);
        }
        //SHORT LEFT
        else if(selectedTargetName == 'sh-l-eyes-select'){
            loadNNData5 = set_LHand_ShortHair_EyesPosition_5Weights(loadNNData5);
            loadNNData7 = set_LHand_ShortHair_EyesPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'sh-l-mouth-select'){
            loadNNData5 = set_LHand_ShortHair_MouthPosition_5Weights(loadNNData5);
            loadNNData7 = set_LHand_ShortHair_MouthPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'sh-l-front-select'){
            loadNNData5 = set_LHand_ShortHair_FrontPosition_5Weights(loadNNData5);
            loadNNData7 = set_LHand_ShortHair_FrontPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'sh-l-side-select'){
            loadNNData5 = set_LHand_ShortHair_SidePosition_5Weights(loadNNData5);
            loadNNData7 = set_LHand_ShortHair_SidePosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'sh-l-top-select'){
            loadNNData5 = set_LHand_ShortHair_TopPosition_5Weights(loadNNData5);
            loadNNData7 = set_LHand_ShortHair_TopPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'sh-l-back-select'){
            loadNNData5 = set_LHand_ShortHair_BackPosition_5Weights(loadNNData5);
            loadNNData7 = set_LHand_ShortHair_BackPosition_7Weights(loadNNData7);
        }
        //MEDIUM LEFT
        else if(selectedTargetName == 'md-l-eyes-select'){
            loadNNData5 = set_LHand_MediumHair_EyesPosition_5Weights(loadNNData5);
            loadNNData7 = set_LHand_MediumHair_EyesPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'md-l-mouth-select'){
            loadNNData5 = set_LHand_MediumHair_MouthPosition_5Weights(loadNNData5);
            loadNNData7 = set_LHand_MediumHair_MouthPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'md-l-front-select'){
            loadNNData5 = set_LHand_MediumHair_FrontPosition_5Weights(loadNNData5);
            loadNNData7 = set_LHand_MediumHair_FrontPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'md-l-side-select'){
            loadNNData5 = set_LHand_MediumHair_SidePosition_5Weights(loadNNData5);
            loadNNData7 = set_LHand_MediumHair_SidePosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'md-l-top-select'){
            loadNNData5 = set_LHand_MediumHair_TopPosition_5Weights(loadNNData5);
            loadNNData7 = set_LHand_MediumHair_TopPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'md-l-back-select'){
            loadNNData5 = set_LHand_MediumHair_BackPosition_5Weights(loadNNData5);
            loadNNData7 = set_LHand_MediumHair_BackPosition_7Weights(loadNNData7);
        }
        //MEDIUM RIGHT
        else if(selectedTargetName == 'md-r-eyes-select'){
            loadNNData5 = set_RHand_MediumHair_EyesPosition_5Weights(loadNNData5);
            loadNNData7 = set_RHand_MediumHair_EyesPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'md-r-mouth-select'){
            loadNNData5 = set_RHand_MediumHair_MouthPosition_5Weights(loadNNData5);
            loadNNData7 = set_RHand_MediumHair_MouthPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'md-r-front-select'){
            loadNNData5 = set_RHand_MediumHair_FrontPosition_5Weights(loadNNData5);
            loadNNData7 = set_RHand_MediumHair_FrontPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'md-r-side-select'){
            loadNNData5 = set_RHand_MediumHair_SidePosition_5Weights(loadNNData5);
            loadNNData7 = set_RHand_MediumHair_SidePosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'md-r-top-select'){
            loadNNData5 = set_RHand_MediumHair_TopPosition_5Weights(loadNNData5);
            loadNNData7 = set_RHand_MediumHair_TopPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'md-r-back-select'){
            loadNNData5 = set_RHand_MediumHair_BackPosition_5Weights(loadNNData5);
            loadNNData7 = set_RHand_MediumHair_BackPosition_7Weights(loadNNData7);
        }
        //LONG LEFT
        else if(selectedTargetName == 'lg-l-eyes-select'){
            loadNNData5 = set_LHand_LongHair_EyesPosition_5Weights(loadNNData5);
            loadNNData7 = set_LHand_LongHair_EyesPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'lg-l-mouth-select'){
            loadNNData5 = set_LHand_LongHair_MouthPosition_5Weights(loadNNData5);
            loadNNData7 = set_LHand_LongHair_MouthPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'lg-l-front-select'){
            loadNNData5 = set_LHand_LongHair_FrontPosition_5Weights(loadNNData5);
            loadNNData7 = set_LHand_LongHair_FrontPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'lg-l-side-select'){
            loadNNData5 = set_LHand_LongHair_SidePosition_5Weights(loadNNData5);
            loadNNData7 = set_LHand_LongHair_SidePosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'lg-l-top-select'){
            loadNNData5 = set_LHand_LongHair_TopPosition_5Weights(loadNNData5);
            loadNNData7 = set_LHand_LongHair_TopPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'lg-l-back-select'){
            loadNNData5 = set_LHand_LongHair_BackPosition_5Weights(loadNNData5);
            loadNNData7 = set_LHand_LongHair_BackPosition_7Weights(loadNNData7);
        }
        //LONG RIGHT
        else if(selectedTargetName == 'lg-r-eyes-select'){
            loadNNData5 = set_RHand_LongHair_EyesPosition_5Weights(loadNNData5);
            loadNNData7 = set_RHand_LongHair_EyesPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'lg-r-mouth-select'){
            loadNNData5 = set_RHand_LongHair_MouthPosition_5Weights(loadNNData5);
            loadNNData7 = set_RHand_LongHair_MouthPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'lg-r-front-select'){
            loadNNData5 = set_RHand_LongHair_FrontPosition_5Weights(loadNNData5);
            loadNNData7 = set_RHand_LongHair_FrontPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'lg-r-side-select'){
            loadNNData5 = set_RHand_LongHair_SidePosition_5Weights(loadNNData5);
            loadNNData7 = set_RHand_LongHair_SidePosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'lg-r-top-select'){
            loadNNData5 = set_RHand_LongHair_TopPosition_5Weights(loadNNData5);
            loadNNData7 = set_RHand_LongHair_TopPosition_7Weights(loadNNData7);
        } else if(selectedTargetName == 'lg-r-back-select'){
            loadNNData5 = set_RHand_LongHair_BackPosition_5Weights(loadNNData5);
            loadNNData7 = set_RHand_LongHair_BackPosition_7Weights(loadNNData7);
        }

    });




    /*******************************************************************************************************************
     ********************************** COLLECT, PRINT, LOAD BUTTON ACTIONS *********************************************
     ********************************************************************************************************************/

    /*************** COLLECT SAMPLE - SONSOR AND MODEL DATA - STORE IN GSHEET AND ADD TO NN TRAINING OBJECT *****************/
    $('#collect-true-1').click(function() {
        //how many samples for this set?
        getSamplesFlag = $('input.sample-size').val();
        getSamplesTypeFlag = 1;
        console.log("Collect btn NN1T #samples flag: " + getSamplesFlag);
    });

    $('#collect-false-1').click(function() {
        //how many samples for this set?
        //this flag is applied in the bluetooth data notification function
        getSamplesFlag = $('input.sample-size').val();
        getSamplesTypeFlag = 2;
        console.log("Collect btn NN1F #samples flag: " + getSamplesFlag);
    });

    $('#collect-true-2').click(function() {
        //how many samples for this set?
        getSamplesFlag = $('input.sample-size').val();
        //this flag is applied in the bluetooth data notification function
        getSamplesTypeFlag = 3;
        console.log("Collect btn NN2T #samples flag: " + getSamplesFlag);
    });

    $('#collect-false-2').click(function() {
        //how many samples for this set?
        getSamplesFlag = $('input.sample-size').val();
        //this flag is applied in the bluetooth data notification function
        getSamplesTypeFlag = 4;
        console.log("Collect btn NN2F #samples flag: " + getSamplesFlag);
    });

    $('#clear-1').click(function() {
        NN1TrueDataArray = new Array;
        NN1FalseDataArray = new Array;
        sensorDataArray = new Array(18).fill(0);
        sensorDataSession = new Array;
        updateSampleCountDisplay();
        $("#dump-print").html("");
        console.log("Clear NN1 Data");
    });

    $('#clear-2').click(function() {
        NN2TrueDataArray = new Array;
        NN2FalseDataArray = new Array;
        sensorDataArray = new Array(18).fill(0);
        sensorDataSession = new Array;
        updateSampleCountDisplay();
        $("#dump-print").html("");
        console.log("Clear NN2 Data");
    });

    $('#export-btn').click(function() {
        console.log("export1 NN button");
        //clear everything but key values from stored NN
        neuralNet.clear();

        //export optimized weights and activation function
        var standalone = neuralNet.standalone();

        //convert to string for parsing
        standalone = standalone.toString();

        console.log(standalone);
        $("#dump-print").html(standalone);
        $("#dump-print").addClass("active-print");
    });

    $('#export2-btn').click(function() {
        console.log("export2 NN button");
        //clear everything but key values from stored NN
        neuralNet2.clear();

        //export optimized weights and activation function
        var standalone = neuralNet2.standalone();

        //convert to string for parsing
        standalone = standalone.toString();

        console.log(standalone);
        $("#dump-print").html(standalone);
        $("#dump-print").addClass("active-print");
    });

        //print sensor data to browser at bottom of app screen
    $('#print-btn').click(function() {
        console.log("print button");
        $("#dump-print").html("");

    var dataVarNames=["sh_r_eyes_data", "sh_r_mouth_data", "sh_r_front_data", "sh_r_side_data", "sh_r_top_data", "sh_r_back_data", "sh_r_off_data",
                        "sh_l_eyes_data", "sh_l_mouth_data", "sh_l_front_data", "sh_l_side_data", "sh_l_top_data", "sh_l_back_data", "sh_l_off_data",
                        "md_r_eyes_data", "md_r_mouth_data", "md_r_front_data", "md_r_side_data", "md_r_top_data", "md_r_back_data", "md_r_off_data",
                        "md_l_eyes_data", "md_l_mouth_data", "md_l_front_data", "md_l_side_data", "md_l_top_data", "md_l_back_data", "md_l_off_data",
                        "lg_r_eyes_data", "lg_r_mouth_data", "lg_r_front_data", "lg_r_side_data", "lg_r_top_data", "lg_r_back_data", "lg_r_off_data",
                        "lg_l_eyes_data", "lg_l_mouth_data", "lg_l_front_data", "lg_l_side_data", "lg_l_top_data", "lg_l_back_data", "lg_l_off_data"];

        for( var i=0; i < masterDataArray.length; i++){
            $("#dump-print").append("<p>var " + dataVarNames[i] + "=" + JSON.stringify(masterDataArray[i]) + ";</p>" );
            console.log(dataVarNames[i] + " SESSION DATA: " + masterDataArray[i]);
        }

     //   $("#dump-print").html(JSON.stringify(sensorDataSession));
        $("#dump-print").addClass("active-print");
       // console.log("SENSOR SESSIONS DATA: " + sensorDataSession);

    });

    //load data from js file (JSON or JS object) into sensor session data
    $('#load-btn').click(function() {
        console.log("load button");
        masterDataArray[0] = sh_r_eyes_data
        masterDataArray[1] = sh_r_mouth_data;
        masterDataArray[2] = sh_r_front_data;
        masterDataArray[3] = sh_r_side_data;
        masterDataArray[4] = sh_r_top_data;
        masterDataArray[5] = sh_r_back_data;
        masterDataArray[6] = sh_r_off_data;

        masterDataArray[7] = sh_l_eyes_data;
        masterDataArray[8] = sh_l_mouth_data;
        masterDataArray[9] = sh_l_front_data;
        masterDataArray[10] = sh_l_side_data;
        masterDataArray[11] = sh_l_top_data;
        masterDataArray[12] = sh_l_back_data;
        masterDataArray[13] = sh_l_off_data;

        masterDataArray[14] = md_r_eyes_data;
        masterDataArray[15] = md_r_mouth_data;
        masterDataArray[16] = md_r_front_data;
        masterDataArray[17] = md_r_side_data;
        masterDataArray[18] = md_r_top_data;
        masterDataArray[19] = md_r_back_data;
        masterDataArray[20] = md_r_off_data;

        masterDataArray[21] = md_l_eyes_data;
        masterDataArray[22] = md_l_mouth_data;
        masterDataArray[23] = md_l_front_data;
        masterDataArray[24] = md_l_side_data;
        masterDataArray[25] = md_l_top_data;
        masterDataArray[26] = md_l_back_data;
        masterDataArray[27] = md_l_off_data;

        masterDataArray[28] = lg_r_eyes_data;
        masterDataArray[29] = lg_r_mouth_data;
        masterDataArray[30] = lg_r_front_data;
        masterDataArray[31] = lg_r_side_data;
        masterDataArray[32] = lg_r_top_data;
        masterDataArray[33] = lg_r_back_data;
        masterDataArray[34] = lg_r_off_data;

        masterDataArray[35] = lg_l_eyes_data;
        masterDataArray[36] = lg_l_mouth_data;
        masterDataArray[37] = lg_l_front_data;
        masterDataArray[38] = lg_l_side_data;
        masterDataArray[39] = lg_l_top_data;
        masterDataArray[40] = lg_l_back_data;
        masterDataArray[41] = lg_l_off_data;

     /*   masterDataArray[28] = $.merge( lg_r_eyes_data, md_r_eyes_data);
        masterDataArray[29] = $.merge( lg_r_mouth_data, md_r_mouth_data);
        masterDataArray[30] = $.merge( lg_r_front_data, md_r_front_data);
        masterDataArray[31] = $.merge( lg_r_side_data, md_r_side_data);
        masterDataArray[32] = $.merge( lg_r_top_data, md_r_top_data);
        masterDataArray[33] = $.merge( lg_r_back_data, md_r_back_data);
        masterDataArray[34] = $.merge( lg_r_off_data, md_r_off_data);

        masterDataArray[35] = $.merge( lg_l_eyes_data, md_l_eyes_data);
        masterDataArray[36] = $.merge( lg_l_mouth_data, md_l_mouth_data);
        masterDataArray[37] = $.merge( lg_l_front_data, md_l_front_data);
        masterDataArray[38] = $.merge( lg_l_side_data, md_l_side_data);
        masterDataArray[39] = $.merge( lg_l_top_data, md_l_top_data);
        masterDataArray[40] = $.merge( lg_l_back_data, md_l_back_data);
        masterDataArray[41] = $.merge( lg_l_off_data, md_l_off_data); */

        //update data count labels
        for( var i=0; i < masterDataArray.length; i++){
            $( "span[data='" + i + "']" ).html(masterDataArray[i].length);
        }

    });

}); // end on document load
//}